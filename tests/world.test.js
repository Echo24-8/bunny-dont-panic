import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, startLevelTwo, startNewRun } from '../src/core/state.js';
import { createWorld, updateWorld } from '../src/core/world.js';

const idleInput = { x: 0, y: 0 };

test('world emits completion as soon as the timer reaches zero', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  state.remainingMs = 5;
  const events = updateWorld({ world, state, input: idleInput, dtMs: 10 });
  assert.equal(state.remainingMs, 0);
  assert.equal(events.some((event) => event.type === 'level-complete' && event.levelId === 1), true);
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

function isolateLevelTwo(state, world) {
  state.readyMs = 0;
  world.spawnCooldownMs = Infinity;
  world.patternBand = 0;
  world.patternCooldownMs = Infinity;
  world.secondaryPatternCooldownMs = Infinity;
  world.player.fireCooldownMs = Infinity;
}

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
