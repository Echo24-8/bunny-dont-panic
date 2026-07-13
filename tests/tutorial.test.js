import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, startNewRun } from '../src/core/state.js';
import { createWorld, updateWorld } from '../src/core/world.js';

test('tutorial pickup reaches the first upgrade after a short move', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  const events = [];
  for (let frame = 0; frame < 480; frame += 1) {
    events.push(...updateWorld({ world, state, input: { x: 1, y: 0 }, dtMs: 1000 / 60 }));
    if (events.some((event) => event.type === 'upgrade-ready')) break;
  }
  assert.equal(events.some((event) => event.type === 'upgrade-ready'), true);
  assert.ok(state.elapsedMs < 8_000);
});
