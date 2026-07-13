import { LEVELS, LOGICAL_HEIGHT, LOGICAL_WIDTH, POOL_LIMITS } from './constants.js';
import { ObjectPool } from './object-pool.js';
import { makeAimed, makeFan, makeRing, makeSpiralBullet } from './patterns.js';
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
    enemyBullets: new ObjectPool(POOL_LIMITS.ENEMY_BULLETS, entityFactory),
    pickups: new ObjectPool(POOL_LIMITS.PICKUPS, () => ({ ...entityFactory(), value: 2 })),
    particles: new ObjectPool(POOL_LIMITS.PARTICLES, () => ({ ...entityFactory(), lifeMs: 0, color: '#ffffff', size: 2 })),
    spawnCooldownMs: 0,
    aimedCooldownMs: 0,
    patternCooldownMs: 0,
    secondaryPatternCooldownMs: 0,
    patternBand: -1,
    spiralAngle: 0,
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
  world.spiralAngle = 0;
  world.shotSoundCooldownMs = 0;
  world.metrics.droppedEnemyBullets = 0;
}

function acquireEnemyBullet(world, specification) {
  const bullet = world.enemyBullets.acquire({ ...specification, ageMs: 0 });
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

function spawnParticleBurst(world, x, y, color, count = 6) {
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
    if (enemy.kind !== 'puff' && enemy.shotCooldownMs <= 0) {
      const teachingOffset = state.levelId === LEVELS.ONE ? (enemy.poolIndex % 2 === 0 ? -52 : 52) : 0;
      const bullet = makeAimed({
        x: enemy.x,
        y: enemy.y,
        targetX: world.player.x + teachingOffset,
        targetY: world.player.y,
        speed: state.levelId === 1 ? 58 : 112
      });
      acquireEnemyBullet(world, bullet);
      enemy.shotCooldownMs = state.levelId === 1 ? 2_600 : (enemy.kind === 'star' ? 900 : 1_250);
    }
  });
}

function updateLevelOnePatterns(world, dtMs) {
  world.aimedCooldownMs -= dtMs;
  if (world.aimedCooldownMs > 0) return;
  const origin = randomEdgeSpawn(world.rng);
  const offset = world.rng() < 0.5 ? -68 : 68;
  acquireEnemyBullet(world, makeAimed({ ...origin, targetX: world.player.x + offset, targetY: world.player.y, speed: 56 }));
  world.aimedCooldownMs = 2_500;
}

function getPatternBand(seconds) {
  if (seconds < 10) return 0;
  if (seconds < 25) return 1;
  if (seconds < 40) return 2;
  if (seconds < 55) return 3;
  return 4;
}

function updateLevelTwoPatterns(world, state, dtMs) {
  const seconds = state.elapsedMs / 1000;
  const band = getPatternBand(seconds);
  if (band !== world.patternBand) {
    world.patternBand = band;
    world.patternCooldownMs = 0;
    world.secondaryPatternCooldownMs = 0;
  }
  world.patternCooldownMs -= dtMs;
  world.secondaryPatternCooldownMs -= dtMs;

  const targetAngle = Math.atan2(world.player.y - 92, world.player.x - 180);
  if (band === 0 && world.patternCooldownMs <= 0) {
    emitBullets(world, makeRing({ x: 180, y: 92, count: 24, speed: 96, gapAngle: targetAngle, gapWidth: Math.PI / 5, rotation: seconds * 0.08 }));
    world.patternCooldownMs = 1_250;
  }
  if (band === 1 && world.patternCooldownMs <= 0) {
    const fromLeft = Math.floor(seconds * 2) % 2 === 0;
    emitBullets(world, makeFan({
      x: fromLeft ? 20 : 340,
      y: 120 + ((seconds * 37) % 150),
      targetX: world.player.x,
      targetY: world.player.y,
      count: 7,
      spread: Math.PI * 0.54,
      speed: 112
    }));
    world.patternCooldownMs = 550;
  }
  if (band === 2) {
    if (world.patternCooldownMs <= 0) {
      acquireEnemyBullet(world, makeSpiralBullet({ x: 180, y: 100, angle: world.spiralAngle, speed: 108 }));
      world.spiralAngle += 0.27;
      world.patternCooldownMs = 70;
    }
    if (world.secondaryPatternCooldownMs <= 0) {
      emitBullets(world, makeFan({ x: 180, y: 100, targetX: world.player.x, targetY: world.player.y, count: 3, spread: 0.24, speed: 128 }));
      world.secondaryPatternCooldownMs = 1_100;
    }
  }
  if (band === 3) {
    if (world.patternCooldownMs <= 0) {
      emitBullets(world, makeRing({ x: 180, y: 96, count: 28, speed: 110, gapAngle: targetAngle, gapWidth: Math.PI / 7, rotation: seconds * 0.15 }));
      world.patternCooldownMs = 1_000;
    }
    if (world.secondaryPatternCooldownMs <= 0) {
      const fromLeft = Math.floor(seconds) % 2 === 0;
      emitBullets(world, makeFan({ x: fromLeft ? 12 : 348, y: 260, targetX: world.player.x, targetY: world.player.y, count: 7, spread: 1.1, speed: 122 }));
      world.secondaryPatternCooldownMs = 750;
    }
  }
  if (band === 4) {
    if (world.patternCooldownMs <= 0) {
      emitBullets(world, makeRing({ x: 180, y: 92, count: 36, speed: 126, gapAngle: targetAngle, gapWidth: Math.PI / 10, rotation: seconds * 0.24 }));
      world.patternCooldownMs = 700;
    }
    if (world.secondaryPatternCooldownMs <= 0) {
      emitBullets(world, makeFan({ x: seconds % 1.2 < 0.6 ? 14 : 346, y: 190, targetX: world.player.x, targetY: world.player.y, count: 9, spread: 1.15, speed: 135 }));
      world.secondaryPatternCooldownMs = 520;
    }
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
    if (hit || !circlesTouch(bullet, world.player)) return;
    world.enemyBullets.release(bullet);
    hit = true;
  });
  world.enemies.forEachActive((enemy) => {
    if (hit || !circlesTouch(enemy, world.player, 2)) return;
    world.enemies.release(enemy);
    hit = true;
  });
  if (hit) {
    const result = takeDamage(state);
    if (result === 'shielded') events.push({ type: 'shielded' });
    if (result === 'damaged') events.push({ type: 'damaged' });
    if (result === 'defeated') events.push({ type: 'defeated' });
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
  state.remainingMs = Math.max(0, state.remainingMs - dtMs);
  state.elapsedMs += dtMs;
  state.invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);
  world.shotSoundCooldownMs = Math.max(0, world.shotSoundCooldownMs - dtMs);
  updateShield(state, dtMs, events);
  if (state.remainingMs <= 0) {
    events.push({ type: 'level-complete', levelId: state.levelId });
    return events;
  }

  updatePlayer(world, state, input, dtMs);
  world.spawnCooldownMs -= dtMs;
  if (world.spawnCooldownMs <= 0) {
    spawnEnemy(world, state.levelId);
    world.spawnCooldownMs = state.levelId === LEVELS.ONE ? 1_100 : 720;
  }
  updateEnemies(world, state, dtMs);
  if (state.levelId === LEVELS.ONE) updateLevelOnePatterns(world, dtMs);
  else updateLevelTwoPatterns(world, state, dtMs);

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
