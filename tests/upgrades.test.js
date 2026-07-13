import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, startNewRun } from '../src/core/state.js';
import {
  applyUpgrade,
  derivePlayerStats,
  getUpgradeChoices,
  getUpgradePreview,
  upgradeThreshold
} from '../src/core/upgrades.js';

test('upgrade threshold follows the approved linear curve', () => {
  assert.equal(upgradeThreshold(0), 8);
  assert.equal(upgradeThreshold(3), 26);
});

test('choices are unique and exclude heart at full health', () => {
  const state = startNewRun(createInitialState());
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0 });
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.equal(choices.some((choice) => choice.id === 'heart'), false);
});

test('maxed ability is excluded and heart appears only after damage', () => {
  const state = startNewRun(createInitialState());
  state.build.splitShot = 3;
  state.health = 2;
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0, count: 6 });
  assert.equal(choices.some((choice) => choice.id === 'splitShot'), false);
  assert.equal(choices.some((choice) => choice.id === 'heart'), true);
});

test('upgrades change derived combat statistics', () => {
  const state = startNewRun(createInitialState());
  applyUpgrade(state, 'rapidFire');
  applyUpgrade(state, 'moveSpeed');
  const stats = derivePlayerStats(state.build);
  assert.ok(stats.fireIntervalMs < 420);
  assert.ok(stats.speed > 190);
});

test('upgrade previews match the applied combat values', () => {
  const cases = [
    ['rapidFire', 'Lv 0 → 1', '射击间隔 420ms → 378ms'],
    ['splitShot', 'Lv 0 → 1', '弹丸 1 发 → 2 发'],
    ['pierce', 'Lv 0 → 1', '额外穿透 0 → 1'],
    ['moveSpeed', 'Lv 0 → 1', '移速 190 → 205'],
    ['shield', 'Lv 0 → 1', '护盾 无 → 14.0s']
  ];
  for (const [id, levelText, valueText] of cases) {
    const state = startNewRun(createInitialState());
    assert.deepEqual(getUpgradePreview(state, id), { levelText, valueText });
  }

  const damaged = startNewRun(createInitialState());
  damaged.health = 2;
  assert.deepEqual(getUpgradePreview(damaged, 'heart'), {
    levelText: '',
    valueText: '生命 2/3 → 3/3'
  });
});
