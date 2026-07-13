import { LEVELS, LOGICAL_HEIGHT, LOGICAL_WIDTH, POOL_LIMITS } from './constants.js';
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

const BULLET_MARGIN = 36;

function entityFactory() {
  return { x: 0, y: 0, vx: 0, vy: 0, radius: 4, rotation: 0, ageMs: 0 };
}

export function createWorld(rng = Math.random) {
  return {
    rng,
    player: { x: 180, y: 510, radius: 7, fireCooldownMs: 0 },
    enemies: new ObjectPool(POOL_LIMITS.ENEMIES, () => ({ ...entityFactory(), hp: 1, maxHp: 1, kind: 'puff', shotCooldownMs: 0, xpValue: 2 })),
    playerBullets: new ObjectPool(POOL_LIMITS.PLAYER_BULLETS, () => ({ ...entityFactory(), pierceLeft: 0, damage: 1 })),
    enemyBullets: new ObjectPool(POOL_LIMITS.ENEMY_BULLETS, () => ({ ...entityFactory(), grazed: false })),
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
    shotSoundCooldownMs: 0,
    metrics: { droppedEnemyBullets: 0 }
  };
}

export function resetWorld(world) {
  world.enemies.clear();
  world.playerBullets.clear();
  world.enemyBullets.clear();
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
  world.shotSoundCooldownMs = 0;
  world.metrics.droppedEnemyBullets = 0;
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
    shotCooldownMs: 900 + world.rng() * 900
  });
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

function spawnPlayerVolley(world, state, events) {
  const target = world.enemies.findNearest(world.player.x, world.player.y);
  const centerAngle = target ? Math.atan2(target.y - world.player.y, target.x - world.player.x) : -Math.PI / 2;
  const stats = derivePlayerStats(state.build);
  const count = stats.projectileCount;
  const spreadStep = 0.18;
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spreadStep;
    const angle = centerAngle + offset;
    world.playerBullets.acquire({
      x: world.player.x,
      y: world.player.y - 12,
      vx: Math.cos(angle) * 520,
      vy: Math.sin(angle) * 520,
      radius: 4,
      damage: 1,
      pierceLeft: stats.pierce,
      rotation: angle,
      ageMs: 0
    });
  }
  if (world.shotSoundCooldownMs <= 0) {
    events.push({ type: 'sfx', id: 'shot', volume: 0.24 });
    world.shotSoundCooldownMs = 70;
  }
  world.player.fireCooldownMs = stats.fireIntervalMs;
}

function updatePlayer(world, state, input, dtMs) {
  const dt = dtMs / 1000;
  const stats = derivePlayerStats(state.build);
  world.player.x += input.x * stats.speed * dt;
  world.player.y += input.y * stats.speed * dt;
  world.player.x = Math.max(18, Math.min(LOGICAL_WIDTH - 18, world.player.x));
  world.player.y = Math.max(76, Math.min(LOGICAL_HEIGHT - 36, world.player.y));
  world.player.fireCooldownMs -= dtMs;
}

function updateEnemies(world, state, dtMs) {
  const dt = dtMs / 1000;
  world.enemies.forEachActive((enemy) => {
    enemy.ageMs += dtMs;
    const dx = world.player.x - enemy.x;
    const dy = world.player.y - enemy.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const movementScale = enemy.kind === 'star' ? 0.24 : 1;
    enemy.x += (dx / length) * enemy.speed * movementScale * dt;
    enemy.y += (dy / length) * enemy.speed * movementScale * dt;
    enemy.rotation += dt * (enemy.kind === 'star' ? 1.8 : 0.55);
    enemy.shotCooldownMs -= dtMs;
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
      shotCooldownMs: Infinity
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

function updateProjectiles(world, dtMs) {
  const dt = dtMs / 1000;
  const updatePool = (pool) => pool.forEachActive((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ageMs += dtMs;
    if (bullet.x < -BULLET_MARGIN || bullet.x > LOGICAL_WIDTH + BULLET_MARGIN || bullet.y < -BULLET_MARGIN || bullet.y > LOGICAL_HEIGHT + BULLET_MARGIN) pool.release(bullet);
  });
  updatePool(world.playerBullets);
  updatePool(world.enemyBullets);
}

function circlesTouch(a, b, extra = 0) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.radius + b.radius + extra) ** 2;
}

function resolveCombatCollisions(world, state, events) {
  world.playerBullets.forEachActive((bullet) => {
    world.enemies.forEachActive((enemy) => {
      if (!bullet.active || !enemy.active || !circlesTouch(bullet, enemy)) return;
      enemy.hp -= bullet.damage;
      spawnParticleBurst(world, bullet.x, bullet.y, '#f8df72', 3);
      if (bullet.pierceLeft > 0) bullet.pierceLeft -= 1;
      else world.playerBullets.release(bullet);
      if (enemy.hp <= 0) {
        spawnPickup(world, enemy);
        spawnParticleBurst(world, enemy.x, enemy.y, '#f4c95f', 8);
        world.enemies.release(enemy);
      }
    });
  });

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
  updateEnemies(world, state, dtMs);
  if (state.levelId === LEVELS.ONE) {
    if (!tutorialActive) updateLevelOnePatterns(world, dtMs);
  } else updateLevelTwoPatterns(world, state, dtMs, events);

  if (world.player.fireCooldownMs <= 0) spawnPlayerVolley(world, state, events);
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
