import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_SKILL_DEFINITIONS,
  activateSkill,
  createActiveSkillState,
  updateActiveSkill
} from '../src/core/active-skills.js';

test('dash activates with a short invulnerability window and cooldown', () => {
  const state = createActiveSkillState('dash');
  const result = activateSkill(state, ACTIVE_SKILL_DEFINITIONS.dash, { direction: { x: 1, y: 0 } });
  assert.equal(result.accepted, true);
  assert.equal(result.effects[0].type, 'dash');
  assert.equal(result.effects[0].invulnerableMs, 260);
  assert.equal(state.cooldownMs, 8_000);
  assert.deepEqual(result.effects[0].direction, { x: 1, y: 0 });
});

test('cotton guard provides two shield charges', () => {
  const state = createActiveSkillState('cottonGuard');
  const result = activateSkill(state, ACTIVE_SKILL_DEFINITIONS.cottonGuard);
  assert.equal(result.accepted, true);
  assert.equal(result.effects[0].shieldCharges, 2);
  assert.equal(state.cooldownMs, 12_000);
});

test('a skill cannot activate while cooling down and timers never go negative', () => {
  const state = createActiveSkillState('forestEcho');
  assert.equal(activateSkill(state, ACTIVE_SKILL_DEFINITIONS.forestEcho).accepted, true);
  assert.equal(activateSkill(state, ACTIVE_SKILL_DEFINITIONS.forestEcho).accepted, false);
  updateActiveSkill(state, 99_999);
  assert.equal(state.cooldownMs, 0);
  assert.equal(state.activeMs, 0);
});
