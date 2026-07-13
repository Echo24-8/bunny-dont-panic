import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../src/core/constants.js';
import {
  beginLevelTwoTransition,
  createInitialState,
  recordLevelTwoResult,
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

test('level two starts with one second preparation and first attempt', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  assert.equal(state.readyMs, 1_000);
  assert.equal(state.remainingMs, 60_000);
  assert.equal(state.level2Attempt, 1);
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

test('retry increments attempt and preserves retained progression', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.build.splitShot = 2;
  state.upgradeCount = 4;
  retryLevelTwoState(state);
  assert.equal(state.readyMs, 1_000);
  assert.equal(state.level2Attempt, 2);
  assert.equal(state.health, 3);
  assert.equal(state.xp, 0);
  assert.equal(state.build.splitShot, 2);
  assert.equal(state.upgradeCount, 4);
});

test('session best only increases and survives a new run', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  recordLevelTwoResult(state, 'defeat', 12_300);
  recordLevelTwoResult(state, 'defeat', 8_000);
  assert.equal(state.sessionBestSurvivalMs, 12_300);
  startNewRun(state);
  assert.equal(state.sessionBestSurvivalMs, 12_300);
  assert.equal(state.level2Attempt, 0);
});

test('recorded survival time is bounded to the level duration', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  assert.deepEqual(recordLevelTwoResult(state, 'defeat', -10), { kind: 'defeat', survivalMs: 0 });
  assert.deepEqual(recordLevelTwoResult(state, 'success', 61_000), { kind: 'success', survivalMs: 60_000 });
  assert.equal(state.sessionBestSurvivalMs, 60_000);
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

