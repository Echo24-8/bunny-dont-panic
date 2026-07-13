import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../src/core/constants.js';
import {
  beginLevelTwoTransition,
  createInitialState,
  retryLevelTwoState,
  startLevelTwo,
  startNewRun,
  takeDamage
} from '../src/core/state.js';

test('new run starts level one with clean health and build', () => {
  const state = startNewRun(createInitialState());
  assert.equal(state.phase, PHASES.PLAYING);
  assert.equal(state.levelId, 1);
  assert.equal(state.remainingMs, 30_000);
  assert.equal(state.health, 3);
  assert.deepEqual(state.build, { rapidFire: 0, splitShot: 0, pierce: 0, moveSpeed: 0, shield: 0 });
});

test('transition preserves health and build into level two', () => {
  const state = startNewRun(createInitialState());
  state.health = 2;
  state.build.rapidFire = 2;
  beginLevelTwoTransition(state);
  startLevelTwo(state);
  assert.equal(state.levelId, 2);
  assert.equal(state.health, 2);
  assert.equal(state.build.rapidFire, 2);
  assert.equal(state.remainingMs, 60_000);
});

test('level two retry restores health and retains all selected abilities', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.health = 0;
  state.xp = 11;
  state.upgradeCount = 4;
  state.build.splitShot = 2;
  retryLevelTwoState(state);
  assert.equal(state.health, 3);
  assert.equal(state.xp, 0);
  assert.equal(state.upgradeCount, 4);
  assert.equal(state.build.splitShot, 2);
});

test('damage grants invulnerability and prevents repeated loss', () => {
  const state = startNewRun(createInitialState());
  assert.equal(takeDamage(state), 'damaged');
  assert.equal(state.health, 2);
  assert.equal(takeDamage(state), 'ignored');
  assert.equal(state.health, 2);
});

test('ready shield absorbs damage before health', () => {
  const state = startNewRun(createInitialState());
  state.build.shield = 1;
  state.shieldReady = true;
  assert.equal(takeDamage(state), 'shielded');
  assert.equal(state.health, 3);
  assert.equal(state.shieldReady, false);
});

