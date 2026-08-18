import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, startNewRun } from '../src/core/state.js';
import { MAX_WEAPON_LEVEL, WEAPON_IDS, getWeaponLevel } from '../src/core/weapons.js';
import {
  applyUpgrade,
  derivePlayerStats,
  getUpgradeChoices,
  getUpgradePreview,
  getUpgradeRoleLabel,
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

test('upgrade choices cover distinct categories when eligible', () => {
  const state = startNewRun(createInitialState());
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0.5 });
  assert.equal(choices.some((choice) => choice.category === 'weapon'), true);
  assert.equal(choices.some((choice) => choice.category === 'ability'), true);
  assert.equal(new Set(choices.map((choice) => choice.category)).size >= 2, true);
});

test('all five weapons are present in the first-run upgrade pool', () => {
  const state = startNewRun(createInitialState());
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0, count: 20 });
  const weaponIds = choices
    .filter((choice) => choice.category === 'weapon')
    .map((choice) => choice.id);
  assert.deepEqual(new Set(weaponIds), new Set(WEAPON_IDS));
});

test('the first upgrade guarantees at least one new weapon', () => {
  const state = startNewRun(createInitialState());
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0.999 });
  assert.equal(
    choices.some((choice) => choice.category === 'weapon' && getWeaponLevel(state.build, choice.id) === 0),
    true
  );
});

test('full weapon slots exclude unowned weapons', () => {
  const state = startNewRun(createInitialState());
  state.build.weaponSlots = [
    { id: 'carrot', level: 1 },
    { id: 'dandelion', level: 1 },
    { id: 'boomerang', level: 1 }
  ];
  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0, count: 20 });
  assert.equal(choices.some((choice) => choice.id === 'bubble' || choice.id === 'lightning'), false);
});

test('maxed weapons and abilities are excluded while heart requires damage', () => {
  const state = startNewRun(createInitialState());
  state.build.weaponSlots = [
    { id: 'carrot', level: MAX_WEAPON_LEVEL },
    { id: 'dandelion', level: MAX_WEAPON_LEVEL },
    { id: 'boomerang', level: MAX_WEAPON_LEVEL }
  ];
  state.build.rapidFire = 6;
  state.build.moveSpeed = 6;
  state.build.shield = 5;

  assert.deepEqual(
    getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0, count: 20 }),
    []
  );

  state.health = 2;
  assert.deepEqual(
    getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0, count: 20 }).map(({ id }) => id),
    ['heart']
  );
});

test('selecting a weapon unlocks then upgrades one stable slot', () => {
  const state = startNewRun(createInitialState());

  assert.equal(applyUpgrade(state, 'dandelion'), true);
  assert.deepEqual(state.build.weaponSlots, [
    { id: 'carrot', level: 1 },
    { id: 'dandelion', level: 1 },
    null
  ]);
  assert.equal(state.upgradeCount, 1);

  assert.equal(applyUpgrade(state, 'dandelion'), true);
  assert.deepEqual(state.build.weaponSlots, [
    { id: 'carrot', level: 1 },
    { id: 'dandelion', level: 2 },
    null
  ]);
  assert.equal(state.upgradeCount, 2);

  applyUpgrade(state, 'bubble');
  assert.equal(applyUpgrade(state, 'lightning'), false);
  assert.equal(state.build.weaponSlots.some((slot) => slot?.id === 'lightning'), false);
  assert.equal(state.upgradeCount, 3);
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

  const weaponState = startNewRun(createInitialState());
  assert.equal(getUpgradePreview(weaponState, 'dandelion').levelText, '解锁');
  applyUpgrade(weaponState, 'dandelion');
  assert.equal(getUpgradePreview(weaponState, 'dandelion').levelText, 'Lv 1 → 2');

  weaponState.build.weaponSlots[1] = { id: 'boomerang', level: 1 };
  weaponState.build.moveSpeed = 1;
  assert.match(getUpgradePreview(weaponState, 'boomerang').valueText, /兔耳轻步：回收更快/);
});

test('upgrade roles make weapon and ability choices legible', () => {
  assert.equal(getUpgradeRoleLabel('carrot'), '单体追踪');
  assert.equal(getUpgradeRoleLabel('dandelion'), '范围清场');
  assert.equal(getUpgradeRoleLabel('bubble'), '拦截防守');
  assert.equal(getUpgradeRoleLabel('rapidFire'), '全武器增幅');
  assert.equal(getUpgradeRoleLabel('heart'), '立即恢复');
  assert.equal(getUpgradeRoleLabel('unknown'), '');
});
