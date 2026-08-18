import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, startCampaignStage, startLevelTwo, startNewRun } from '../src/core/state.js';
import { createWorld, updateWorld } from '../src/core/world.js';
import { MAX_WEAPON_LEVEL, WEAPON_IDS } from '../src/core/weapons.js';

const idleInput = { x: 0, y: 0 };

test('world emits completion as soon as the timer reaches zero', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  state.remainingMs = 5;
  const events = updateWorld({ world, state, input: idleInput, dtMs: 10 });
  assert.equal(state.remainingMs, 0);
  assert.equal(events.some((event) => event.type === 'level-complete' && event.levelId === 1), true);
});

test('third stage announces and spawns at most one elite', () => {
  const state = startNewRun(createInitialState(), 42);
  startCampaignStage(state, 2);
  state.readyMs = 0;
  state.elapsedMs = 9_999;
  const world = createWorld(() => 0.2);
  const warning = updateWorld({ world, state, input: idleInput, dtMs: 2 });
  assert.equal(warning.some((event) => event.type === 'elite-warning'), true);
  state.elapsedMs = 12_999;
  const spawned = updateWorld({ world, state, input: idleInput, dtMs: 2 });
  assert.equal(spawned.some((event) => event.type === 'elite-spawned'), true);
  assert.equal(world.enemies.items.filter((enemy) => enemy.active && enemy.kind === 'elite').length, 1);
  state.elapsedMs = 20_000;
  updateWorld({ world, state, input: idleInput, dtMs: 2 });
  assert.equal(world.enemies.items.filter((enemy) => enemy.active && enemy.kind === 'elite').length, 1);
});

test('fourth stage spawns a boss and begins warning-based attacks', () => {
  const state = startNewRun(createInitialState(), 9);
  startCampaignStage(state, 3);
  state.readyMs = 0;
  state.elapsedMs = 4_999;
  const world = createWorld(() => 0.5);
  const spawned = updateWorld({ world, state, input: idleInput, dtMs: 2 });
  assert.equal(spawned.some((event) => event.type === 'boss-spawned'), true);
  assert.equal(world.bossState.phase, 1);
  const warning = updateWorld({ world, state, input: idleInput, dtMs: 1_000 });
  assert.equal(warning.some((event) => event.type === 'boss-warning'), true);
});

test('player auto-fires even before an enemy becomes targetable', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  updateWorld({ world, state, input: idleInput, dtMs: 17 });
  assert.equal(world.playerBullets.activeCount, 1);
});

test('enemy bullet pool stays capped at 450 and records dropped bullets', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.readyMs = 0;
  const world = createWorld(() => 0.5);
  for (let index = 0; index < 450; index += 1) {
    world.enemyBullets.acquire({ x: 180, y: 100, vx: 0, vy: 0, radius: 4 });
  }
  updateWorld({ world, state, input: idleInput, dtMs: 17 });
  assert.equal(world.enemyBullets.activeCount, 450);
  assert.ok(world.metrics.droppedEnemyBullets > 0);
});

test('level two preparation freezes survival and suppresses hostile activity', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  const world = createWorld(() => 0.5);
  updateWorld({ world, state, input: { x: 1, y: 0 }, dtMs: 500 });
  assert.equal(state.remainingMs, 60_000);
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.readyMs, 500);
  assert.equal(world.enemies.activeCount, 0);
  assert.equal(world.enemyBullets.activeCount, 0);
  assert.ok(world.player.x > 180);
});

test('player cannot move behind the compact weapon HUD', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  world.player.y = 118;
  updateWorld({ world, state, input: { x: 0, y: -1 }, dtMs: 100 });
  assert.equal(world.player.y, 116);
});

function isolateLevelTwo(state, world) {
  state.readyMs = 0;
  world.spawnCooldownMs = Infinity;
  world.patternBand = 0;
  world.patternCooldownMs = Infinity;
  world.secondaryPatternCooldownMs = Infinity;
  if (world.weaponCooldownMs) {
    for (const id of WEAPON_IDS) world.weaponCooldownMs[id] = Infinity;
  }
  if ('fireCooldownMs' in world.player) world.player.fireCooldownMs = Infinity;
}

function activeItems(collection) {
  if (Array.isArray(collection)) return collection.filter((item) => item.active !== false);
  return collection?.items?.filter((item) => item.active) ?? [];
}

function createWeaponScenario(id, level = 1) {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.build.weaponSlots = [{ id, level }, null, null];
  const world = createWorld(() => 0.5);
  isolateLevelTwo(state, world);
  world.weaponCooldownMs[id] = 0;
  return { state, world };
}

function spawnStationaryEnemy(world, values = {}) {
  return world.enemies.acquire({
    x: 180,
    y: 220,
    vx: 0,
    vy: 0,
    radius: 12,
    speed: 0,
    kind: 'puff',
    hp: 20,
    maxHp: 20,
    shotCooldownMs: Infinity,
    ...values
  });
}

test('each weapon owns an independent cooldown key', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  assert.deepEqual(Object.keys(world.weaponCooldownMs).sort(), [...WEAPON_IDS].sort());

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.ok(world.weaponCooldownMs.carrot > 0);
  for (const id of WEAPON_IDS.filter((weaponId) => weaponId !== 'carrot')) {
    assert.equal(world.weaponCooldownMs[id], 0);
  }
});

test('all five weapons automatically create their distinct runtime output', () => {
  const cases = [
    ['carrot', 'projectile', 1],
    ['dandelion', 'projectile', 3],
    ['boomerang', 'projectile', 1],
    ['bubble', 'orbital', 1],
    ['lightning', 'effect', 1]
  ];

  for (const [id, output, expectedCount] of cases) {
    const { state, world } = createWeaponScenario(id);
    spawnStationaryEnemy(world);
    updateWorld({ world, state, input: idleInput, dtMs: 1 });

    const emitted = output === 'projectile'
      ? activeItems(world.playerBullets).filter((item) => item.weaponId === id)
      : output === 'orbital'
        ? activeItems(world.orbitals).filter((item) => item.weaponId === id)
        : activeItems(world.weaponEffects).filter((item) => item.weaponId === id);
    assert.equal(emitted.length, expectedCount, `${id} should create ${expectedCount} ${output}(s)`);
  }
});

test('projectile weapons automatically aim at the nearest enemy', () => {
  const { state, world } = createWeaponScenario('carrot');
  const nearest = spawnStationaryEnemy(world, { x: 220, y: 500 });
  spawnStationaryEnemy(world, { x: 180, y: 120 });

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const bullet = activeItems(world.playerBullets).find((item) => item.weaponId === 'carrot');
  const targetDx = nearest.x - world.player.x;
  const targetDy = nearest.y - (world.player.y - 12);
  const cross = bullet.vx * targetDy - bullet.vy * targetDx;
  assert.ok(Math.abs(cross) < 0.001, `expected nearest-target aim, cross product was ${cross}`);
  assert.ok(bullet.vx * targetDx + bullet.vy * targetDy > 0);
});

test('carrot projectiles keep steering toward moving enemies', () => {
  const { state, world } = createWeaponScenario('carrot');
  const enemy = spawnStationaryEnemy(world, { x: 180, y: 220 });
  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const bullet = activeItems(world.playerBullets).find((item) => item.weaponId === 'carrot');
  const initialVx = bullet.vx;

  enemy.x = 300;
  updateWorld({ world, state, input: idleInput, dtMs: 80 });
  assert.ok(bullet.vx > initialVx + 1, `expected positive steering, got ${bullet.vx}`);
});

test('boomerang does not damage the same enemy on adjacent frames', () => {
  const { state, world } = createWeaponScenario('boomerang');
  const enemy = spawnStationaryEnemy(world, { x: 180, y: 485, radius: 10 });

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const hpAfterFirstHit = enemy.hp;
  assert.ok(hpAfterFirstHit < enemy.maxHp);

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(enemy.hp, hpAfterFirstHit);
});

test('boomerang can hit a new enemy that reuses a released pool slot', () => {
  const { state, world } = createWeaponScenario('boomerang');
  const first = spawnStationaryEnemy(world, { x: 180, y: 485, radius: 10, entityId: 41 });
  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const reusedPoolIndex = first.poolIndex;
  world.enemies.release(first);
  const replacement = spawnStationaryEnemy(world, { x: 180, y: 484, radius: 10, entityId: 42 });
  assert.equal(replacement.poolIndex, reusedPoolIndex);

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.ok(replacement.hp < replacement.maxHp);
});

test('bubble orbitals intercept enemy bullets before they can damage the player', () => {
  const { state, world } = createWeaponScenario('bubble');
  spawnStationaryEnemy(world);
  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const orbital = activeItems(world.orbitals).find((item) => item.weaponId === 'bubble');
  const hostile = world.enemyBullets.acquire({
    x: orbital.x,
    y: orbital.y,
    vx: 0,
    vy: 0,
    radius: 4,
    grazed: false
  });

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(hostile.active, false);
  assert.equal(state.health, state.maxHealth);
  assert.equal(state.invulnerableMs, 0);
});

test('lightning chains through different enemies only', () => {
  const { state, world } = createWeaponScenario('lightning', 3);
  const enemies = [
    spawnStationaryEnemy(world, { x: 90, y: 200 }),
    spawnStationaryEnemy(world, { x: 180, y: 160 }),
    spawnStationaryEnemy(world, { x: 270, y: 220 })
  ];

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const effect = activeItems(world.weaponEffects).find((item) => item.weaponId === 'lightning');
  const expectedPoints = new Set(enemies.map((enemy) => `${enemy.x},${enemy.y}`));
  const targetPoints = effect.points.filter((point) => expectedPoints.has(`${point.x},${point.y}`));
  assert.equal(targetPoints.length, enemies.length);
  assert.equal(new Set(targetPoints.map((point) => `${point.x},${point.y}`)).size, targetPoints.length);
});

test('player bullet pool stays capped at 128 and records dropped bullets', () => {
  const { state, world } = createWeaponScenario('dandelion', 3);
  for (let index = 0; index < 128; index += 1) {
    world.playerBullets.acquire({ x: 180, y: 300, vx: 0, vy: 0, radius: 4 });
  }

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(world.playerBullets.activeCount, 128);
  assert.ok(world.metrics.droppedPlayerBullets > 0);
});

test('reused player bullets reset weapon-specific fields', () => {
  const { state, world } = createWeaponScenario('carrot');
  const stale = world.playerBullets.acquire({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    weaponId: 'boomerang',
    mode: 'returning',
    phase: 'returning',
    lastHitPoolIndex: 42,
    lastHitAgeMs: 123,
    hitEnemyIndices: new Set([42])
  });
  const reusedPoolIndex = stale.poolIndex;
  world.playerBullets.release(stale);

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  const reused = activeItems(world.playerBullets).find((item) => item.poolIndex === reusedPoolIndex);
  assert.equal(reused.weaponId, 'carrot');
  assert.notEqual(reused.mode, 'returning');
  assert.notEqual(reused.phase, 'returning');
  assert.notEqual(reused.lastHitPoolIndex, 42);
  assert.notEqual(reused.lastHitAgeMs, 123);
  assert.equal(reused.hitEnemyIndices?.has?.(42) ?? reused.hitEnemyIndices?.includes?.(42) ?? false, false);
});

test('graze emits once and pooled enemy bullets reset their graze state', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  const world = createWorld(() => 0.5);
  isolateLevelTwo(state, world);
  const bullet = world.enemyBullets.acquire({
    x: world.player.x + 12,
    y: world.player.y,
    vx: 0,
    vy: 0,
    radius: 4
  });

  const firstEvents = updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(firstEvents.filter((event) => event.type === 'grazed').length, 1);
  assert.equal(state.health, 3);
  assert.equal(bullet.grazed, true);
  assert.equal(world.particles.activeCount, 2);
  world.particles.forEachActive((particle) => assert.equal(particle.kind, 'graze'));

  const secondEvents = updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(secondEvents.some((event) => event.type === 'grazed'), false);

  world.enemyBullets.release(bullet);
  world.patternBand = -1;
  world.patternCooldownMs = 0;
  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(bullet.active, true);
  assert.equal(bullet.grazed, false);
});

test('pattern warning emits once when a warning window begins', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.elapsedMs = 9_190;
  const world = createWorld(() => 0.5);
  isolateLevelTwo(state, world);

  const firstEvents = updateWorld({ world, state, input: idleInput, dtMs: 10 });
  const warning = firstEvents.find((event) => event.type === 'pattern-warning');
  assert.deepEqual(warning, { type: 'pattern-warning', nextBand: 1 });
  assert.deepEqual(world.patternWarning, { nextBand: 1, remainingMs: 800 });

  const secondEvents = updateWorld({ world, state, input: idleInput, dtMs: 10 });
  assert.equal(secondEvents.some((event) => event.type === 'pattern-warning'), false);
});

test('secondary pattern waits its full start delay after a band change', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.readyMs = 0;
  state.elapsedMs = 39_999;
  const world = createWorld(() => 0.5);
  world.spawnCooldownMs = Infinity;
  world.patternBand = 2;
  world.patternCooldownMs = Infinity;
  world.secondaryPatternCooldownMs = Infinity;
  world.player.fireCooldownMs = Infinity;

  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(world.patternBand, 3);
  assert.equal(world.secondaryPatternCooldownMs, 375);
  assert.equal(world.secondaryShotIndex, 0);

  updateWorld({ world, state, input: idleInput, dtMs: 374 });
  assert.equal(world.secondaryShotIndex, 0);
  updateWorld({ world, state, input: idleInput, dtMs: 1 });
  assert.equal(world.secondaryShotIndex, 1);
});

test('level two enemies do not add aimed shots to the authored patterns', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  const world = createWorld(() => 0.5);
  isolateLevelTwo(state, world);
  world.enemies.acquire({
    x: 180,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 15,
    speed: 0,
    kind: 'bell',
    hp: 3,
    maxHp: 3,
    shotCooldownMs: 0
  });

  updateWorld({ world, state, input: idleInput, dtMs: 17 });
  assert.equal(world.enemyBullets.activeCount, 0);
});

test('standing still fails the authored opening within fifteen seconds', () => {
  const simulate = (build = {}) => {
    const state = startNewRun(createInitialState());
    startLevelTwo(state);
    state.readyMs = 0;
    Object.assign(state.build, build);
    state.shieldReady = state.build.shield > 0;
    const world = createWorld(() => 0.5);
    while (state.health > 0 && state.elapsedMs < 15_000) {
      updateWorld({ world, state, input: idleInput, dtMs: 1000 / 60 });
    }
    return state.elapsedMs;
  };

  const baseSurvivalMs = simulate();
  const maxBuildSurvivalMs = simulate({
    rapidFire: 6,
    moveSpeed: 6,
    shield: 5,
    weaponSlots: [
      { id: 'carrot', level: MAX_WEAPON_LEVEL },
      { id: 'dandelion', level: MAX_WEAPON_LEVEL },
      { id: 'boomerang', level: MAX_WEAPON_LEVEL }
    ]
  });
  assert.ok(baseSurvivalMs >= 5_000 && baseSurvivalMs <= 15_000, baseSurvivalMs);
  assert.ok(maxBuildSurvivalMs <= 15_000, maxBuildSurvivalMs);
});

test('combat collisions create distinct hit shield and damage particles', () => {
  const hitState = startNewRun(createInitialState());
  startLevelTwo(hitState);
  const hitWorld = createWorld(() => 0.5);
  isolateLevelTwo(hitState, hitWorld);
  hitWorld.enemies.acquire({ x: 220, y: 220, vx: 0, vy: 0, radius: 14, speed: 0, kind: 'puff', hp: 2, maxHp: 2 });
  hitWorld.playerBullets.acquire({ x: 220, y: 220, vx: 0, vy: 0, radius: 4, damage: 1, pierceLeft: 0 });
  updateWorld({ world: hitWorld, state: hitState, input: idleInput, dtMs: 1 });
  assert.equal(hitWorld.particles.activeCount, 3);

  const shieldState = startNewRun(createInitialState());
  startLevelTwo(shieldState);
  shieldState.build.shield = 1;
  shieldState.shieldReady = true;
  const shieldWorld = createWorld(() => 0.5);
  isolateLevelTwo(shieldState, shieldWorld);
  shieldWorld.enemyBullets.acquire({ x: shieldWorld.player.x, y: shieldWorld.player.y, vx: 0, vy: 0, radius: 4 });
  const shieldEvents = updateWorld({ world: shieldWorld, state: shieldState, input: idleInput, dtMs: 1 });
  assert.equal(shieldEvents.some((event) => event.type === 'shielded'), true);
  assert.equal(shieldWorld.particles.activeCount, 12);

  const damageState = startNewRun(createInitialState());
  startLevelTwo(damageState);
  const damageWorld = createWorld(() => 0.5);
  isolateLevelTwo(damageState, damageWorld);
  damageWorld.enemyBullets.acquire({ x: damageWorld.player.x, y: damageWorld.player.y, vx: 0, vy: 0, radius: 4 });
  const damageEvents = updateWorld({ world: damageWorld, state: damageState, input: idleInput, dtMs: 1 });
  assert.equal(damageEvents.some((event) => event.type === 'damaged'), true);
  assert.equal(damageWorld.particles.activeCount, 8);
});

test('collecting experience creates a small pickup feedback burst', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  const world = createWorld(() => 0.5);
  isolateLevelTwo(state, world);
  world.pickups.acquire({ x: world.player.x, y: world.player.y, vx: 0, vy: 0, radius: 6, value: 2 });

  updateWorld({ world, state, input: idleInput, dtMs: 1 });

  assert.equal(state.xp, 2);
  assert.equal(world.pickups.activeCount, 0);
  assert.equal(world.particles.activeCount, 4);
  world.particles.forEachActive((particle) => assert.equal(particle.kind, 'pickup'));
});

test('level one remains survivable for thirty seconds without movement', () => {
  const state = startNewRun(createInitialState());
  const values = [0.14, 0.62, 0.87, 0.33, 0.49];
  let cursor = 0;
  const world = createWorld(() => {
    const value = values[cursor % values.length];
    cursor += 1;
    return value;
  });
  for (let frame = 0; frame < 1_800 && state.health > 0; frame += 1) {
    updateWorld({ world, state, input: idleInput, dtMs: 1000 / 60 });
  }
  assert.ok(state.health > 0);
});
