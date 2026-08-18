import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_DEFINITIONS,
  createCampaign,
  createEventChoices,
  getEventReward,
  getStageDefinition,
  selectEvent
} from '../src/core/campaign.js';

test('campaign exposes four authored stages', () => {
  assert.deepEqual(STAGE_DEFINITIONS.map(({ durationMs }) => durationMs), [45_000, 60_000, 75_000, 90_000]);
  assert.equal(getStageDefinition(4), null);
  assert.deepEqual(getStageDefinition(0), { id: 'forest-entry', durationMs: 45_000, levelId: 1, kind: 'tutorial' });
});

test('same seed creates repeatable distinct event choices', () => {
  const firstCampaign = createCampaign(42);
  const secondCampaign = createCampaign(42);
  const first = createEventChoices(firstCampaign, { stageIndex: 1, health: 3, maxHealth: 3 });
  const second = createEventChoices(secondCampaign, { stageIndex: 1, health: 3, maxHealth: 3 });
  assert.deepEqual(first, second);
  assert.notEqual(first[0].id, first[1].id);
  assert.deepEqual(firstCampaign.eventChoices, first);
});

test('recovery is filtered at full health and selection clears choices', () => {
  const campaign = createCampaign(7);
  const choices = createEventChoices(campaign, { stageIndex: 0, health: 3, maxHealth: 3 });
  assert.equal(choices.some((choice) => choice.kind === 'recovery'), false);
  const selected = selectEvent(campaign, choices[0].id);
  assert.equal(selected.id, choices[0].id);
  assert.equal(campaign.selectedEventId, choices[0].id);
  assert.deepEqual(campaign.eventChoices, []);
  assert.equal(selectEvent(campaign, 'missing'), null);
});

test('event rewards are pure descriptors and recovery never harms full health', () => {
  assert.deepEqual(getEventReward({ kind: 'recovery' }, { health: 3, maxHealth: 3 }), { type: 'supply' });
  assert.deepEqual(getEventReward({ kind: 'recovery' }, { health: 2, maxHealth: 3 }), { type: 'heal', amount: 1 });
  assert.deepEqual(getEventReward({ kind: 'rest' }), { type: 'shield', charges: 1 });
});
