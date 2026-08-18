import { LEVELS, LOGICAL_HEIGHT, LOGICAL_WIDTH, POOL_LIMITS } from './constants.js';
import { applyEliteAffix, createEliteSpec, ELITE_AFFIXES } from './elites.js';
import { advanceBossPhase, createBossState, getBossAttackSpec } from './bosses.js';
import { ObjectPool } from './object-pool.js';
import {
  getLevelTwoPatternSpec,
  getLevelTwoPatternState,
  makeAimed,
  makeFan,
  makeRing,
  makeSpiralBullet
} from './patterns.js';
import { takeDamage } from './state.js';
import { derivePlayerStats, upgradeThreshold } from './upgrades.js';
import { WEAPON_IDS, deriveWeaponStats } from './weapons.js';

const BULLET_MARGIN = 36;

function entityFactory() {
  return { x: 0, y: 0, vx: 0, vy: 0, radius: 4, rotation: 0, ageMs: 0 };
}

export function createWorld(rng = Math.random) {
  return {
    rng,
    player: { x: 180, y: 510, radius: 7, fireCooldownMs: 0 },
    enemies: new ObjectPool(POOL_LIMITS.ENEMIES, () => ({ ...entityFactory(), hp: 1, maxHp: 1, kind: 'puff', shotCooldownMs: 0, xpValue: 2 })),
    playerBullets: new ObjectPool(POOL_LIMITS.PLAYER_BULLETS, () => ({
      ...entityFactory(),
      weaponId: 'carrot',
      mode: 'linear',
      phase: 'outbound',
      pierceLeft: 0,
      damage: 1,
      maxAgeMs: 2_200,
      returnAfterMs: Infinity,
      maxTargets: 1,
      lastHitPoolIndex: -1,
      lastHitAgeMs: -Infinity,
      hitEnemyIndices: new Set()
    })),
    enemyBullets: new ObjectPool(POOL_LIMITS.ENEMY_BULLETS, () => ({ ...entityFactory(), grazed: false })),
    orbitals: new ObjectPool(POOL_LIMITS.ORBITALS, () => ({ ...entityFactory(), weaponId: 'bubble', slotIndex: 0, damage: 1, ready: true })),
    weaponEffects: new ObjectPool(POOL_LIMITS.WEAPON_EFFECTS, () => ({ weaponId: 'lightning', points: [], lifeMs: 0, ageMs: 0 })),
    pickups: new ObjectPool(POOL_LIMITS.PICKUPS, () => ({ ...entityFactory(), value: 2 })),
    particles: new ObjectPool(POOL_LIMITS.PARTICLES, () => ({ ...entityFactory(), lifeMs: 0, color: '#ffffff', size: 2, kind: 'combat' })),
    spawnCooldownMs: 0,
    aimedCooldownMs: 0,
    patternCooldownMs: 0,
    secondaryPatternCooldownMs: 0,
    patternBand: -1,
    patternWarning: null,
    mainShotIndex: 0,
    secondaryShotIndex: 0,
    grazeEffectCooldownMs: 0,
    tutorialEnemySpawned: false,
    tutorialBulletFired: false,
    eliteWarningSent: false,
    eliteSpawned: false,
    runEliteDefeated: false,
    bossState: null,
    bossSpawned: false,
    bossAttackCooldownMs: Infinity,
    bossAttackWarningMs: 0,
    bossWarningSent: false,
    shotSoundCooldownMs: 0,
    weaponCooldownMs: Object.fromEntries(WEAPON_IDS.map((id) => [id, 0])),
    nextEnemyId: 1,
    metrics: { droppedEnemyBullets: 0, droppedPlayerBullets: 0 }
  };
}

export function resetWorld(world) {
  world.enemies.clear();
  world.playerBullets.clear();
  world.enemyBullets.clear();
  world.orbitals.clear();
  world.weaponEffects.clear();
  world.pickups.clear();
  world.particles.clear();
  Object.assign(world.player, { x: 180, y: 510, fireCooldownMs: 0 });
  world.spawnCooldownMs = 0;
  world.aimedCooldownMs = 0;
  world.patternCooldownMs = 0;
  world.secondaryPatternCooldownMs = 0;
  world.patternBand = -1;
  world.patternWarning = null;
  world.mainShotIndex = 0;
  world.secondaryShotIndex = 0;
  world.grazeEffectCooldownMs = 0;
  world.tutorialEnemySpawned = false;
  world.tutorialBulletFired = false;
  world.eliteWarningSent = false;
  world.eliteSpawned = false;
  world.bossState = null;
  world.bossSpawned = false;
  world.bossAttackCooldownMs = Infinity;
  world.bossAttackWarningMs = 0;
  world.bossWarningSent = false;
  world.shotSoundCooldownMs = 0;
  for (const id of WEAPON_IDS) world.weaponCooldownMs[id] = 0;
  world.nextEnemyId = 1;
  world.metrics.droppedEnemyBullets = 0;
  world.metrics.droppedPlayerBullets = 0;
}

export function applyActiveSkillEffects(world, state, effects = []) {
  const events = [];
  for (const effect of effects) {
    if (!effect) continue;
    if (effect.type === 'dash') {
      const direction = effect.direction ?? { x: 0, y: -1 };
      const distance = Number(effect.distance) || 0;
      world.player.x = Math.max(18, Math.min(LOGICAL_WIDTH - 18, world.player.x + direction.x * distance));
      world.player.y = Math.max(116, Math.min(LOGICAL_HEIGHT - 36, world.player.y + direction.y * distance));
      state.invulnerableMs = Math.max(state.invulnerableMs ?? 0, effect.invulnerableMs ?? 0);
      events.push({ type: 'active-skill', skill: 'dash' });
      continue;
    }
    if (effect.type === 'shield') {
      state.activeShieldCharges = Math.max(state.activeShieldCharges ?? 0, effect.shieldCharges ?? 0);
      state.activeSkill.activeMs = Math.max(state.activeSkill.activeMs, effect.activeMs ?? 0);
      events.push({ type: 'active-skill', skill: 'cottonGuard' });
      continue;
    }
    if (effect.type === 'clear-and-damage') {
      const clearRadius = Number(effect.clearRadius) || 0;
      const clearRadiusSquared = clearRadius * clearRadius;
      world.enemyBullets.forEachActive((bullet) => {
        if ((bullet.x - world.player.x) ** 2 + (bullet.y - world.player.y) ** 2 <= clearRadiusSquared) {
          world.enemyBullets.release(bullet);
        }
      });
      const damageRadius = Number(effect.radius) || clearRadius;
      const damageRadiusSquared = damageRadius * damageRadius;
      world.enemies.forEachActive((enemy) => {
        if ((enemy.x - world.player.x) ** 2 + (enemy.y - world.player.y) ** 2 <= damageRadiusSquared) {
          damageEnemy(world, enemy, Number(effect.damage) || 0, enemy.x, enemy.y);
        }
      });
      events.push({ type: 'active-skill', skill: 'forestEcho' });
    }
  }
  return events;
}

function acquireEnemyBullet(world, specification) {
  const bullet = world.enemyBullets.acquire({ ...specification, ageMs: 0, grazed: false });
  if (!bullet) world.metrics.droppedEnemyBullets += 1;
  return bullet;
}

function emitBullets(world, bullets) {
  for (const bullet of bullets) acquireEnemyBullet(world, bullet);
}

function randomEdgeSpawn(rng) {
  const side = Math.floor(rng() * 3);
  if (side === 0) return { x: 28 + rng() * (LOGICAL_WIDTH - 56), y: 74 };
  if (side === 1) return { x: 20, y: 100 + rng() * 260 };
  return { x: LOGICAL_WIDTH - 20, y: 100 + rng() * 260 };
}

function spawnEnemy(world, levelId) {
  const roll = world.rng();
  const kind = levelId === LEVELS.ONE
    ? (roll < 0.76 ? 'puff' : 'bell')
    : (roll < 0.45 ? 'puff' : roll < 0.78 ? 'bell' : 'star');
  const spawn = randomEdgeSpawn(world.rng);
  const definition = {
    puff: { hp: 2, radius: 14, speed: levelId === 1 ? 26 : 52, xpValue: 2 },
    bell: { hp: 3, radius: 15, speed: levelId === 1 ? 18 : 32, xpValue: 2 },
    star: { hp: 5, radius: 17, speed: 18, xpValue: 3 }
  }[kind];
  world.enemies.acquire({
    ...spawn,
    vx: 0,
    vy: 0,
    ageMs: 0,
    rotation: 0,
    kind,
    hp: definition.hp,
    maxHp: definition.hp,
    radius: definition.radius,
    speed: definition.speed,
    xpValue: definition.xpValue,
    shotCooldownMs: 900 + world.rng() * 900,
    entityId: world.nextEnemyId++
  });
}

function activeEliteCount(world) {
  let count = 0;
  world.enemies.forEachActive((enemy) => { if (enemy.kind === 'elite') count += 1; });
  return count;
}

function spawnElite(world) {
  if (world.eliteSpawned || activeEliteCount(world) > 0) return null;
  const affix = ELITE_AFFIXES[Math.floor(world.rng() * ELITE_AFFIXES.length)];
  const spec = createEliteSpec({ affix, x: 180, y: 106, levelId: LEVELS.THREE });
  if (!spec) return null;
  applyEliteAffix(spec, affix);
  spec.xpValue = 10;
  spec.shotCooldownMs = 900;
  spec.entityId = world.nextEnemyId++;
  const elite = world.enemies.acquire(spec);
  if (elite) world.eliteSpawned = true;
  return elite;
}

function spawnBoss(world) {
  if (world.bossSpawned) return null;
  const bossState = createBossState();
  const boss = world.enemies.acquire({
    x: 180,
    y: 142,
    vx: 0,
    vy: 0,
    ageMs: 0,
    rotation: 0,
    kind: 'boss',
    hp: bossState.hp,
    maxHp: bossState.maxHp,
    radius: 28,
    speed: 0,
    xpValue: 20,
    shotCooldownMs: Infinity,
    entityId: world.nextEnemyId++
  });
  if (!boss) return null;
  world.bossState = bossState;
  world.bossSpawned = true;
  world.bossAttackCooldownMs = 900;
  return boss;
}

function spawnParticleBurst(world, x, y, color, count = 6, kind = 'combat') {
  for (let index = 0; index < count; index += 1) {
    const angle = world.rng() * Math.PI * 2;
    const speed = 18 + world.rng() * 45;
    world.particles.acquire({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      lifeMs: 360 + world.rng() * 260,
      color,
      size: 1.5 + world.rng() * 2.5,
      kind,
      ageMs: 0
    });
  }
}

function spawnPickup(world, enemy) {
  world.pickups.acquire({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, radius: 6, value: enemy.xpValue, ageMs: 0 });
}

function acquirePlayerProjectile(world, specification) {
  const projectile = world.playerBullets.acquire({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 4,
    rotation: 0,
    ageMs: 0,
    weaponId: 'carrot',
    mode: 'linear',
    phase: 'outbound',
    damage: 1,
    pierceLeft: 0,
    maxAgeMs: 2_200,
    returnAfterMs: Infinity,
    maxTargets: 1,
    lastHitPoolIndex: -1,
    lastHitAgeMs: -Infinity,
    ...specification
  });
  if (!projectile) {
    world.metrics.droppedPlayerBullets += 1;
    return null;
  }
  if (!(projectile.hitEnemyIndices instanceof Set)) projectile.hitEnemyIndices = new Set();
  projectile.hitEnemyIndices.clear();
  return projectile;
}

function queueShotSound(world, events, volume = 0.24) {
  if (world.shotSoundCooldownMs > 0) return;
  events.push({ type: 'sfx', id: 'shot', volume });
  world.shotSoundCooldownMs = 70;
}

function targetAngle(world, originX = world.player.x, originY = world.player.y - 12) {
  const target = world.enemies.findNearest(world.player.x, world.player.y);
  return target ? Math.atan2(target.y - originY, target.x - originX) : -Math.PI / 2;
}

function fireCarrot(world, stats, events) {
  const originX = world.player.x;
  const originY = world.player.y - 12;
  const centerAngle = targetAngle(world, originX, originY);
  for (let index = 0; index < stats.projectileCount; index += 1) {
    const angle = centerAngle + (index - (stats.projectileCount - 1) / 2) * stats.spread;
    acquirePlayerProjectile(world, {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * stats.speed,
      vy: Math.sin(angle) * stats.speed,
      radius: 4,
      weaponId: 'carrot',
      damage: stats.damage,
      rotation: angle,
      maxAgeMs: 1_800
    });
  }
  queueShotSound(world, events, 0.22);
}

function fireDandelion(world, stats, events) {
  const originX = world.player.x;
  const originY = world.player.y - 12;
  const centerAngle = targetAngle(world, originX, originY);
  for (let index = 0; index < stats.projectileCount; index += 1) {
    const ratio = stats.projectileCount === 1 ? 0 : index / (stats.projectileCount - 1) - 0.5;
    const angle = centerAngle + ratio * stats.spread;
    acquirePlayerProjectile(world, {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * stats.speed,
      vy: Math.sin(angle) * stats.speed,
      radius: 3,
      weaponId: 'dandelion',
      damage: stats.damage,
      rotation: angle,
      maxAgeMs: 1_650
    });
  }
  queueShotSound(world, events, 0.18);
}

function fireBoomerang(world, stats, events) {
  const originX = world.player.x;
  const originY = world.player.y - 12;
  const angle = targetAngle(world, originX, originY);
  acquirePlayerProjectile(world, {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * stats.speed,
    vy: Math.sin(angle) * stats.speed,
    radius: 7,
    weaponId: 'boomerang',
    mode: 'boomerang',
    damage: stats.damage,
    rotation: angle,
    returnAfterMs: stats.returnAfterMs,
    maxAgeMs: 2_200,
    maxTargets: stats.maxTargets
  });
  queueShotSound(world, events, 0.2);
}

function activeEnemies(world) {
  const enemies = [];
  world.enemies.forEachActive((enemy) => enemies.push(enemy));
  return enemies;
}

function fireLightning(world, stats, events) {
  const targets = activeEnemies(world)
    .sort((a, b) => (
      (a.x - world.player.x) ** 2 + (a.y - world.player.y) ** 2
      - ((b.x - world.player.x) ** 2 + (b.y - world.player.y) ** 2)
    ))
    .slice(0, stats.chainCount);
  if (targets.length === 0) return false;
  const points = [{ x: world.player.x, y: world.player.y - 12 }];
  for (const enemy of targets) {
    points.push({ x: enemy.x, y: enemy.y });
    damageEnemy(world, enemy, stats.damage, enemy.x, enemy.y);
  }
  world.weaponEffects.acquire({ weaponId: 'lightning', points, lifeMs: 230, ageMs: 0 });
  queueShotSound(world, events, 0.16);
  return true;
}

function updateBubbleWeapon(world, state, stats) {
  if (stats.level <= 0) {
    world.orbitals.clear();
    return;
  }
  if (world.weaponCooldownMs.bubble <= 0) {
    const orbitals = [];
    world.orbitals.forEachActive((orbital) => orbitals.push(orbital));
    while (orbitals.length < stats.projectileCount) {
      const orbital = world.orbitals.acquire({
        x: world.player.x,
        y: world.player.y,
        vx: 0,
        vy: 0,
        radius: 7,
        rotation: 0,
        ageMs: 0,
        weaponId: 'bubble',
        slotIndex: orbitals.length,
        damage: stats.damage,
        ready: true
      });
      if (!orbital) break;
      orbitals.push(orbital);
    }
    for (const orbital of orbitals) {
      orbital.damage = stats.damage;
      orbital.ready = true;
    }
    world.weaponCooldownMs.bubble = stats.fireIntervalMs;
  }
  const orbitals = [];
  world.orbitals.forEachActive((orbital) => orbitals.push(orbital));
  const count = Math.max(1, orbitals.length);
  const baseAngle = state.elapsedMs / 620;
  for (const orbital of orbitals) {
    const angle = baseAngle + (orbital.slotIndex * Math.PI * 2) / count;
    orbital.x = world.player.x + Math.cos(angle) * stats.orbitRadius;
    orbital.y = world.player.y + Math.sin(angle) * stats.orbitRadius;
    orbital.rotation = angle;
    orbital.ageMs += 1;
  }
}

function updateWeapons(world, state, dtMs, events) {
  for (const id of WEAPON_IDS) {
    world.weaponCooldownMs[id] = Math.max(0, world.weaponCooldownMs[id] - dtMs);
  }
  for (const slot of state.build.weaponSlots) {
    if (!slot) continue;
    const stats = deriveWeaponStats(state.build, slot.id);
    if (slot.id === 'bubble') {
      updateBubbleWeapon(world, state, stats);
      continue;
    }
    if (world.weaponCooldownMs[slot.id] > 0) continue;
    let fired = true;
    if (slot.id === 'carrot') fireCarrot(world, stats, events);
    else if (slot.id === 'dandelion') fireDandelion(world, stats, events);
    else if (slot.id === 'boomerang') fireBoomerang(world, stats, events);
    else if (slot.id === 'lightning') fired = fireLightning(world, stats, events);
    if (fired) world.weaponCooldownMs[slot.id] = stats.fireIntervalMs;
  }
}

function updatePlayer(world, state, input, dtMs) {
  const dt = dtMs / 1000;
  const stats = derivePlayerStats(state.build);
  world.player.x += input.x * stats.speed * dt;
  world.player.y += input.y * stats.speed * dt;
  world.player.x = Math.max(18, Math.min(LOGICAL_WIDTH - 18, world.player.x));
  world.player.y = Math.max(116, Math.min(LOGICAL_HEIGHT - 36, world.player.y));
  world.player.fireCooldownMs -= dtMs;
}

function updateEnemies(world, state, dtMs, events = []) {
  const dt = dtMs / 1000;
  world.enemies.forEachActive((enemy) => {
    enemy.ageMs += dtMs;
    const dx = world.player.x - enemy.x;
    const dy = world.player.y - enemy.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const movementScale = enemy.kind === 'star' ? 0.24 : enemy.kind === 'elite' ? 0.72 : enemy.kind === 'boss' ? 0 : 1;
    enemy.x += (dx / length) * enemy.speed * movementScale * dt;
    enemy.y += (dy / length) * enemy.speed * movementScale * dt;
    enemy.rotation += dt * (enemy.kind === 'star' ? 1.8 : 0.55);
    enemy.shotCooldownMs -= dtMs;
    if (enemy.kind === 'boss' && world.bossState) {
      world.bossState.hp = Math.max(0, enemy.hp);
      if (advanceBossPhase(world.bossState, world.bossState.hp / world.bossState.maxHp)) {
        events.push({ type: 'boss-phase', phase: world.bossState.phase });
      }
    }
    if (enemy.kind === 'elite' && enemy.affix === 'summoner') {
      enemy.summonCooldownMs -= dtMs;
      if (enemy.summonCooldownMs <= 0) {
        spawnEnemy(world, state.levelId);
        enemy.summonCooldownMs = 4_000;
      }
    }
    if (state.levelId === LEVELS.ONE && enemy.kind !== 'puff' && enemy.shotCooldownMs <= 0) {
      const teachingOffset = enemy.poolIndex % 2 === 0 ? -52 : 52;
      const bullet = makeAimed({
        x: enemy.x,
        y: enemy.y,
        targetX: world.player.x + teachingOffset,
        targetY: world.player.y,
        speed: 58
      });
      acquireEnemyBullet(world, bullet);
      enemy.shotCooldownMs = 2_600;
    }
  });
}

function updateLevelOneTutorial(world, state) {
  if (!world.tutorialEnemySpawned) {
    world.tutorialEnemySpawned = true;
    world.enemies.acquire({
      x: 304,
      y: 500,
      vx: 0,
      vy: 0,
      ageMs: 0,
      rotation: 0,
      kind: 'tutorial',
      hp: 1,
      maxHp: 1,
      radius: 12,
      speed: 0,
      xpValue: 8,
      shotCooldownMs: Infinity,
      entityId: world.nextEnemyId++
    });
  }
  if (!world.tutorialBulletFired && state.elapsedMs >= 3_600) {
    world.tutorialBulletFired = true;
    acquireEnemyBullet(world, makeAimed({
      x: 180,
      y: 260,
      targetX: world.player.x,
      targetY: world.player.y,
      speed: 60
    }));
  }
}

function updateLevelOnePatterns(world, dtMs) {
  world.aimedCooldownMs -= dtMs;
  if (world.aimedCooldownMs > 0) return;
  const origin = randomEdgeSpawn(world.rng);
  const offset = world.rng() < 0.5 ? -68 : 68;
  acquireEnemyBullet(world, makeAimed({ ...origin, targetX: world.player.x + offset, targetY: world.player.y, speed: 56 }));
  world.aimedCooldownMs = 2_500;
}

function emitPatternSpec(world, spec) {
  if (!spec) return;
  if (spec.kind === 'ring') emitBullets(world, makeRing(spec.args));
  else if (spec.kind === 'fan') emitBullets(world, makeFan(spec.args));
  else if (spec.kind === 'spiral') acquireEnemyBullet(world, makeSpiralBullet(spec.args));
}

function updateLevelTwoPatterns(world, state, dtMs, events) {
  const patternState = getLevelTwoPatternState(state.elapsedMs);
  const previousWarningBand = world.patternWarning?.nextBand ?? null;
  world.patternWarning = patternState.warning;
  if (world.patternWarning && world.patternWarning.nextBand !== previousWarningBand) {
    events.push({ type: 'pattern-warning', nextBand: world.patternWarning.nextBand });
  }

  const { band } = patternState;
  const enteredBand = band !== world.patternBand;
  if (enteredBand) {
    world.patternBand = band;
    world.mainShotIndex = 0;
    world.secondaryShotIndex = 0;
    world.patternCooldownMs = 0;
    world.secondaryPatternCooldownMs = getLevelTwoPatternSpec({
      band,
      channel: 'secondary',
      shotIndex: 0
    })?.startDelayMs ?? Infinity;
  }
  world.patternCooldownMs -= dtMs;
  if (!enteredBand) world.secondaryPatternCooldownMs -= dtMs;

  if (world.patternCooldownMs <= 0) {
    const spec = getLevelTwoPatternSpec({ band, channel: 'main', shotIndex: world.mainShotIndex });
    emitPatternSpec(world, spec);
    world.mainShotIndex += spec ? 1 : 0;
    world.patternCooldownMs = spec?.cooldownMs ?? Infinity;
  }
  if (world.secondaryPatternCooldownMs <= 0) {
    const spec = getLevelTwoPatternSpec({ band, channel: 'secondary', shotIndex: world.secondaryShotIndex });
    emitPatternSpec(world, spec);
    world.secondaryShotIndex += spec ? 1 : 0;
    world.secondaryPatternCooldownMs = spec?.cooldownMs ?? Infinity;
  }
}

function updateBossPatterns(world, state, dtMs, events) {
  if (!world.bossState) return;
  world.bossAttackCooldownMs -= dtMs;
  world.bossAttackWarningMs = Math.max(0, world.bossAttackWarningMs - dtMs);
  if (world.bossAttackCooldownMs <= 0) {
    const spec = getBossAttackSpec({ phase: world.bossState.phase, attackIndex: world.bossState.attackIndex, seed: state.campaign?.seed ?? 0 });
    if (!world.bossWarningSent) {
      world.bossWarningSent = true;
      world.bossAttackWarningMs = spec.warningMs;
      world.bossAttackCooldownMs = spec.warningMs;
      events.push({ type: 'boss-warning', warningMs: spec.warningMs });
      return;
    }
    emitPatternSpec(world, spec);
    world.bossState.attackIndex += 1;
    world.bossAttackCooldownMs = spec.cooldownMs;
    world.bossWarningSent = false;
  }
}

function updateProjectiles(world, dtMs) {
  const dt = dtMs / 1000;
  world.playerBullets.forEachActive((bullet) => {
    bullet.ageMs += dtMs;
    if (bullet.weaponId === 'carrot') {
      const target = world.enemies.findNearest(bullet.x, bullet.y);
      if (target) {
        const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const turn = Math.min(1, dtMs / 110);
        const mixedX = (bullet.vx / speed) * (1 - turn) + (dx / distance) * turn;
        const mixedY = (bullet.vy / speed) * (1 - turn) + (dy / distance) * turn;
        const mixedLength = Math.max(0.001, Math.hypot(mixedX, mixedY));
        bullet.vx = (mixedX / mixedLength) * speed;
        bullet.vy = (mixedY / mixedLength) * speed;
        bullet.rotation = Math.atan2(bullet.vy, bullet.vx);
      }
    }
    if (bullet.mode === 'boomerang') {
      bullet.rotation += dt * 9;
      if (bullet.phase === 'outbound' && bullet.ageMs >= bullet.returnAfterMs) bullet.phase = 'returning';
      if (bullet.phase === 'returning') {
        const dx = world.player.x - bullet.x;
        const dy = world.player.y - bullet.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const speed = Math.max(260, Math.hypot(bullet.vx, bullet.vy));
        bullet.vx = (dx / distance) * speed;
        bullet.vy = (dy / distance) * speed;
        if (distance < 12 && bullet.ageMs > bullet.returnAfterMs + 80) {
          world.playerBullets.release(bullet);
          return;
        }
      }
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.ageMs >= bullet.maxAgeMs) {
      world.playerBullets.release(bullet);
      return;
    }
    if (bullet.mode !== 'boomerang' && (
      bullet.x < -BULLET_MARGIN || bullet.x > LOGICAL_WIDTH + BULLET_MARGIN
      || bullet.y < -BULLET_MARGIN || bullet.y > LOGICAL_HEIGHT + BULLET_MARGIN
    )) world.playerBullets.release(bullet);
  });
  world.enemyBullets.forEachActive((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ageMs += dtMs;
    if (bullet.x < -BULLET_MARGIN || bullet.x > LOGICAL_WIDTH + BULLET_MARGIN || bullet.y < -BULLET_MARGIN || bullet.y > LOGICAL_HEIGHT + BULLET_MARGIN) {
      world.enemyBullets.release(bullet);
    }
  });
  world.weaponEffects.forEachActive((effect) => {
    effect.ageMs += dtMs;
    effect.lifeMs -= dtMs;
    if (effect.lifeMs <= 0) world.weaponEffects.release(effect);
  });
}

function circlesTouch(a, b, extra = 0) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.radius + b.radius + extra) ** 2;
}

function damageEnemy(world, enemy, damage, x = enemy.x, y = enemy.y) {
  if (!enemy.active) return false;
  enemy.hp -= damage;
  spawnParticleBurst(world, x, y, '#f4d45f', 3);
  if (enemy.hp > 0) return false;
  if (Number.isFinite(enemy.xpValue) && enemy.xpValue > 0) spawnPickup(world, enemy);
  spawnParticleBurst(world, enemy.x, enemy.y, '#f4c95f', 8);
  if (enemy.kind === 'elite' && enemy.affix === 'splitter') {
    for (let index = 0; index < 2; index += 1) {
      const angle = index === 0 ? -0.55 : 0.55;
      world.enemies.acquire({
        x: enemy.x + Math.cos(angle) * 12,
        y: enemy.y + 18,
        vx: 0,
        vy: 0,
        ageMs: 0,
        rotation: 0,
        kind: 'puff',
        hp: 2,
        maxHp: 2,
        radius: 12,
        speed: 44,
        xpValue: 2,
        shotCooldownMs: 1_500,
        entityId: world.nextEnemyId++
      });
    }
  }
  if (enemy.kind === 'elite') world.runEliteDefeated = true;
  world.enemies.release(enemy);
  return true;
}

function resolvePlayerProjectileCollisions(world) {
  world.playerBullets.forEachActive((bullet) => {
    world.enemies.forEachActive((enemy) => {
      if (!bullet.active || !enemy.active || !circlesTouch(bullet, enemy)) return;
      if (bullet.mode === 'boomerang') {
        if (!Number.isFinite(enemy.entityId)) enemy.entityId = world.nextEnemyId++;
        if (bullet.hitEnemyIndices.has(enemy.entityId)) return;
        bullet.hitEnemyIndices.add(enemy.entityId);
        bullet.lastHitPoolIndex = enemy.poolIndex;
        bullet.lastHitAgeMs = bullet.ageMs;
        damageEnemy(world, enemy, bullet.damage, bullet.x, bullet.y);
        if (bullet.hitEnemyIndices.size >= bullet.maxTargets) world.playerBullets.release(bullet);
        return;
      }
      damageEnemy(world, enemy, bullet.damage, bullet.x, bullet.y);
      if (bullet.pierceLeft > 0) bullet.pierceLeft -= 1;
      else world.playerBullets.release(bullet);
    });
  });
}

function resolveOrbitalCollisions(world) {
  world.orbitals.forEachActive((orbital) => {
    if (!orbital.ready) return;
    world.enemyBullets.forEachActive((bullet) => {
      if (!orbital.ready || !bullet.active || !circlesTouch(orbital, bullet)) return;
      world.enemyBullets.release(bullet);
      orbital.ready = false;
      spawnParticleBurst(world, orbital.x, orbital.y, '#83bfd1', 4);
    });
    world.enemies.forEachActive((enemy) => {
      if (!orbital.ready || !enemy.active || !circlesTouch(orbital, enemy)) return;
      damageEnemy(world, enemy, orbital.damage, orbital.x, orbital.y);
      orbital.ready = false;
    });
  });
}

function resolvePlayerDamage(world, state, events) {
  let hit = false;
  world.enemyBullets.forEachActive((bullet) => {
    if (hit) return;
    if (circlesTouch(bullet, world.player)) {
      world.enemyBullets.release(bullet);
      hit = true;
      return;
    }
    const distance = Math.hypot(bullet.x - world.player.x, bullet.y - world.player.y);
    const hitDistance = bullet.radius + world.player.radius;
    if (!bullet.grazed && distance > hitDistance && distance <= hitDistance + 8) {
      bullet.grazed = true;
      if (world.grazeEffectCooldownMs <= 0) {
        spawnParticleBurst(world, bullet.x, bullet.y, '#fff3b0', 2, 'graze');
        events.push({ type: 'grazed', x: bullet.x, y: bullet.y });
        world.grazeEffectCooldownMs = 100;
      }
    }
  });
  world.enemies.forEachActive((enemy) => {
    if (hit || !circlesTouch(enemy, world.player, 2)) return;
    world.enemies.release(enemy);
    hit = true;
  });
  if (hit) {
    const result = takeDamage(state);
    if (result === 'shielded') {
      spawnParticleBurst(world, world.player.x, world.player.y, '#74cbd8', 12);
      events.push({ type: 'shielded' });
    }
    if (result === 'damaged') {
      spawnParticleBurst(world, world.player.x, world.player.y, '#ef6f78', 8);
      events.push({ type: 'damaged' });
    }
    if (result === 'defeated') {
      spawnParticleBurst(world, world.player.x, world.player.y, '#ef6f78', 8);
      events.push({ type: 'defeated' });
    }
  }
}

function resolveCombatCollisions(world, state, events) {
  resolvePlayerProjectileCollisions(world);
  resolveOrbitalCollisions(world);
  resolvePlayerDamage(world, state, events);
  if (world.bossSpawned && world.bossState && world.bossState.hp > 0) {
    let bossAlive = false;
    world.enemies.forEachActive((enemy) => { if (enemy.kind === 'boss') bossAlive = true; });
    if (!bossAlive) {
      world.bossState.hp = 0;
      events.push({ type: 'boss-defeated' });
      state.remainingMs = 0;
    }
  }
}

function updatePickups(world, state, dtMs) {
  const dt = dtMs / 1000;
  world.pickups.forEachActive((pickup) => {
    pickup.ageMs += dtMs;
    const dx = world.player.x - pickup.x;
    const dy = world.player.y - pickup.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance < 100) {
      const speed = 90 + (100 - distance) * 4;
      pickup.x += (dx / distance) * speed * dt;
      pickup.y += (dy / distance) * speed * dt;
    }
    if (distance < 14) {
      state.xp += pickup.value;
      spawnParticleBurst(world, world.player.x, world.player.y, '#f4d45f', 4, 'pickup');
      world.pickups.release(pickup);
    }
  });
}

function updateParticles(world, dtMs) {
  const dt = dtMs / 1000;
  world.particles.forEachActive((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    particle.lifeMs -= dtMs;
    if (particle.lifeMs <= 0) world.particles.release(particle);
  });
}

function updateShield(state, dtMs, events) {
  if (state.build.shield <= 0 || state.shieldReady) return;
  state.shieldCooldownMs -= dtMs;
  if (state.shieldCooldownMs <= 0) {
    state.shieldReady = true;
    state.shieldCooldownMs = 0;
    events.push({ type: 'shield-ready' });
  }
}

export function updateWorld({ world, state, input, dtMs }) {
  const events = [];
  if (state.readyMs > 0) {
    state.readyMs = Math.max(0, state.readyMs - dtMs);
    updatePlayer(world, state, input, dtMs);
    return events;
  }
  state.remainingMs = Math.max(0, state.remainingMs - dtMs);
  state.elapsedMs += dtMs;
  state.invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);
  world.shotSoundCooldownMs = Math.max(0, world.shotSoundCooldownMs - dtMs);
  world.grazeEffectCooldownMs = Math.max(0, world.grazeEffectCooldownMs - dtMs);
  updateShield(state, dtMs, events);
  if (state.remainingMs <= 0) {
    events.push({ type: 'level-complete', levelId: state.levelId });
    return events;
  }

  if (state.levelId === LEVELS.THREE) {
    if (!world.eliteWarningSent && state.elapsedMs >= 10_000) {
      world.eliteWarningSent = true;
      events.push({ type: 'elite-warning' });
    }
    if (!world.eliteSpawned && state.elapsedMs >= 13_000) {
      const elite = spawnElite(world);
      if (elite) events.push({ type: 'elite-spawned', affix: elite.affix });
    }
  }
  if (state.levelId === LEVELS.FOUR && !world.bossSpawned && state.elapsedMs >= 5_000) {
    const boss = spawnBoss(world);
    if (boss) events.push({ type: 'boss-spawned' });
  }

  updatePlayer(world, state, input, dtMs);
  const tutorialActive = state.levelId === LEVELS.ONE && state.elapsedMs < 8_000;
  if (state.levelId === LEVELS.ONE) updateLevelOneTutorial(world, state);
  if (!tutorialActive) {
    world.spawnCooldownMs -= dtMs;
    if (world.spawnCooldownMs <= 0) {
      spawnEnemy(world, state.levelId);
      world.spawnCooldownMs = state.levelId === LEVELS.ONE ? 1_100 : 720;
    }
  }
  updateEnemies(world, state, dtMs, events);
  if (state.levelId === LEVELS.ONE) {
    if (!tutorialActive) updateLevelOnePatterns(world, dtMs);
  } else if (state.levelId === LEVELS.FOUR) updateBossPatterns(world, state, dtMs, events);
  else updateLevelTwoPatterns(world, state, dtMs, events);

  updateWeapons(world, state, dtMs, events);
  updateProjectiles(world, dtMs);
  resolveCombatCollisions(world, state, events);
  updatePickups(world, state, dtMs);
  updateParticles(world, dtMs);

  const threshold = upgradeThreshold(state.upgradeCount);
  if (state.xp >= threshold && state.health > 0) {
    state.xp -= threshold;
    events.push({ type: 'upgrade-ready' });
  }
  return events;
}
