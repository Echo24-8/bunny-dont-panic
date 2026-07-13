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
  const world = createWorld(() => 0.5);
  for (let index = 0; index < 450; index += 1) {
    world.enemyBullets.acquire({ x: 180, y: 100, vx: 0, vy: 0, radius: 4 });
  }
  updateWorld({ world, state, input: idleInput, dtMs: 17 });
  assert.equal(world.enemyBullets.activeCount, 450);
  assert.ok(world.metrics.droppedEnemyBullets > 0);
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
