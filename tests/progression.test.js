import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressEvent, createProgressionState, evaluateChallenge, parseProgression, serializeProgression } from '../src/core/progression.js';

test('progress events are idempotent and preserve unlocks', () => {
  const start = createProgressionState();
  const once = applyProgressEvent(start, { type: 'unlock-skill', id: 'cottonGuard' });
  const twice = applyProgressEvent(once, { type: 'unlock-skill', id: 'cottonGuard' });
  assert.deepEqual(twice.unlockedSkills, ['dash', 'cottonGuard']);
});

test('progression serialization safely falls back on corruption and versions', () => {
  const state = createProgressionState();
  assert.deepEqual(parseProgression(serializeProgression(state)), state);
  assert.equal(parseProgression('{bad').highestStage, 0);
  assert.equal(parseProgression(JSON.stringify({ version: 99 })).unlockedSkills[0], 'dash');
});

test('challenges read only run summary data', () => {
  assert.equal(evaluateChallenge('guardianBreaker', { kind: 'success', stageIndex: 3 }), true);
  assert.equal(evaluateChallenge('noDamage', { kind: 'success', damageTaken: 1 }), false);
});
