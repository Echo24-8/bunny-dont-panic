import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_WEAPON_LEVEL,
  MAX_WEAPON_SLOTS,
  WEAPON_DEFINITIONS,
  WEAPON_IDS,
  cloneWeaponSlots,
  createDefaultWeaponSlots,
  deriveWeaponStats,
  getWeaponLevel,
  getWeaponSlot,
  getWeaponSynergyLabel
} from '../src/core/weapons.js';

test('all five weapons are available from the first run', () => {
  assert.deepEqual(WEAPON_IDS, ['carrot', 'dandelion', 'boomerang', 'bubble', 'lightning']);
  const definitionIds = Array.isArray(WEAPON_DEFINITIONS)
    ? WEAPON_DEFINITIONS.map(({ id }) => id)
    : Object.keys(WEAPON_DEFINITIONS);
  assert.deepEqual(new Set(definitionIds), new Set(WEAPON_IDS));
  assert.equal(MAX_WEAPON_SLOTS, 3);
  assert.equal(MAX_WEAPON_LEVEL, 3);
});

test('default weapon slots contain only a level-one carrot', () => {
  assert.deepEqual(createDefaultWeaponSlots(), [
    { id: 'carrot', level: 1 },
    null,
    null
  ]);
});

test('weapon slot cloning does not retain nested references', () => {
  const source = [{ id: 'carrot', level: 2 }, { id: 'bubble', level: 1 }, null];
  const cloned = cloneWeaponSlots(source);

  assert.deepEqual(cloned, source);
  assert.notStrictEqual(cloned, source);
  assert.notStrictEqual(cloned[0], source[0]);
  cloned[0].level = 3;
  assert.equal(source[0].level, 2);
});

test('weapon lookup reports equipped levels and zero for unowned weapons', () => {
  const build = {
    rapidFire: 0,
    moveSpeed: 0,
    shield: 0,
    weaponSlots: [{ id: 'carrot', level: 2 }, null, null]
  };

  assert.deepEqual(getWeaponSlot(build, 'carrot'), { id: 'carrot', level: 2 });
  assert.equal(getWeaponSlot(build, 'dandelion'), null);
  assert.equal(getWeaponLevel(build, 'carrot'), 2);
  assert.equal(getWeaponLevel(build, 'dandelion'), 0);
  assert.equal(deriveWeaponStats(build, 'dandelion').projectileCount, 0);
});

test('weapon synergies make compatible support upgrades matter', () => {
  const base = {
    rapidFire: 0,
    moveSpeed: 0,
    shield: 0,
    weaponSlots: [{ id: 'boomerang', level: 1 }, { id: 'bubble', level: 1 }, null]
  };
  const supported = { ...base, moveSpeed: 3, shield: 2 };
  assert.equal(getWeaponSynergyLabel(base, 'boomerang'), '');
  assert.equal(getWeaponSynergyLabel(supported, 'boomerang'), '兔耳轻步：回收更快');
  assert.equal(getWeaponSynergyLabel(supported, 'bubble'), '棉花护盾：覆盖更广');
  assert.ok(deriveWeaponStats(supported, 'boomerang').returnAfterMs < deriveWeaponStats(base, 'boomerang').returnAfterMs);
  assert.ok(deriveWeaponStats(supported, 'bubble').orbitRadius > deriveWeaponStats(base, 'bubble').orbitRadius);
});
