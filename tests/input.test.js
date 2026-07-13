import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickVectorFromPoint } from '../src/platform/browser.js';

test('joystick vector is zero at its center', () => {
  assert.deepEqual(joystickVectorFromPoint({ x: 68, y: 548 }), { x: 0, y: 0 });
});

test('joystick vector scales inside its radius and clamps outside', () => {
  const half = joystickVectorFromPoint({ x: 89, y: 548 });
  const clamped = joystickVectorFromPoint({ x: 168, y: 548 });
  assert.equal(half.x, 0.5);
  assert.equal(half.y, 0);
  assert.equal(clamped.x, 1);
  assert.equal(clamped.y, 0);
});

