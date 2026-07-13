import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFan, makeRing } from '../src/core/patterns.js';

test('ring pattern leaves an explicit safe gap', () => {
  const full = makeRing({ x: 10, y: 10, count: 24, speed: 100 });
  const withGap = makeRing({ x: 10, y: 10, count: 24, speed: 100, gapAngle: 0, gapWidth: Math.PI / 3 });
  assert.equal(full.length, 24);
  assert.ok(withGap.length < full.length);
});

test('fan pattern aims around the target direction', () => {
  const bullets = makeFan({ x: 0, y: 0, targetX: 0, targetY: 10, count: 7, spread: Math.PI / 2, speed: 100 });
  assert.equal(bullets.length, 7);
  assert.ok(bullets[3].vy > 99);
  assert.ok(Math.abs(bullets[3].vx) < 0.001);
});

