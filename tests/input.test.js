import test from 'node:test';
import assert from 'node:assert/strict';
import {
  followJoystickCenter,
  isJoystickTrigger,
  joystickVectorFromPoint
} from '../src/platform/browser.js';

test('floating joystick has a four pixel dead zone and a fast start', () => {
  const center = { x: 68, y: 548 };
  assert.deepEqual(joystickVectorFromPoint({ x: 72, y: 548 }, center), { x: 0, y: 0 });
  const started = joystickVectorFromPoint({ x: 73, y: 548 }, center);
  assert.ok(Math.abs(started.x - 0.3825) < 0.0001);
  assert.equal(started.y, 0);
});

test('floating joystick reaches full speed at twenty four pixels', () => {
  assert.deepEqual(joystickVectorFromPoint({ x: 92, y: 548 }, { x: 68, y: 548 }), { x: 1, y: 0 });
});

test('floating joystick center follows only beyond forty two pixels', () => {
  assert.deepEqual(followJoystickCenter({ x: 100, y: 548 }, { x: 68, y: 548 }), { x: 68, y: 548 });
  assert.deepEqual(followJoystickCenter({ x: 120, y: 548 }, { x: 68, y: 548 }), { x: 78, y: 548 });
});

test('floating joystick only triggers in the lower half', () => {
  assert.equal(isJoystickTrigger({ x: 180, y: 319 }, true), false);
  assert.equal(isJoystickTrigger({ x: 180, y: 320 }, true), true);
  assert.equal(isJoystickTrigger({ x: 180, y: 500 }, false), false);
});
