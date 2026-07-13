import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLevelTwoPatternSpec,
  getLevelTwoPatternState,
  makeFan,
  makeRing
} from '../src/core/patterns.js';

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

test('pattern bands and warnings use the authored timeline', () => {
  assert.deepEqual(getLevelTwoPatternState(9_199), { band: 0, warning: null });
  assert.deepEqual(getLevelTwoPatternState(9_200), { band: 0, warning: { nextBand: 1, remainingMs: 800 } });
  assert.equal(getLevelTwoPatternState(10_000).band, 1);
  assert.equal(getLevelTwoPatternState(25_000).band, 2);
  assert.equal(getLevelTwoPatternState(40_000).band, 3);
  assert.equal(getLevelTwoPatternState(55_000).band, 4);
});

test('pattern specifications depend only on band channel and shot index', () => {
  const first = getLevelTwoPatternSpec({ band: 3, channel: 'main', shotIndex: 4 });
  const again = getLevelTwoPatternSpec({ band: 3, channel: 'main', shotIndex: 4 });
  assert.deepEqual(first, again);
  assert.equal(first.kind, 'ring');
  assert.equal(first.args.gapWidth, Math.PI / 7);
});

test('secondary patterns start staggered instead of double firing at a boundary', () => {
  assert.equal(getLevelTwoPatternSpec({ band: 3, channel: 'secondary', shotIndex: 0 }).startDelayMs, 375);
  assert.equal(getLevelTwoPatternSpec({ band: 4, channel: 'secondary', shotIndex: 0 }).startDelayMs, 260);
});
