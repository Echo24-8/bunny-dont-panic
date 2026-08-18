import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBossPhase, createBossState, getBossAttackSpec } from '../src/core/bosses.js';

test('boss phase changes once at half health', () => {
  const boss = createBossState();
  assert.equal(advanceBossPhase(boss, 0.5), true);
  assert.equal(boss.phase, 2);
  assert.equal(advanceBossPhase(boss, 0.2), false);
  assert.equal(boss.phase, 2);
});

test('boss attacks are deterministic and always warn first', () => {
  const first = getBossAttackSpec({ phase: 2, attackIndex: 3, seed: 12 });
  const second = getBossAttackSpec({ phase: 2, attackIndex: 3, seed: 12 });
  assert.deepEqual(first, second);
  assert.ok(first.warningMs > 0);
});
