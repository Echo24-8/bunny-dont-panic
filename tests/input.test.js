import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputAdapter,
  followJoystickCenter,
  isJoystickTrigger,
  joystickVectorFromPoint
} from '../src/platform/browser.js';

function createInputHarness() {
  const listeners = new Map();
  const canvas = {
    addEventListener(type, callback) { listeners.set(`canvas:${type}`, callback); },
    removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 640 }; },
    focus() {},
    setPointerCapture() {}
  };
  const previousWindow = globalThis.window;
  globalThis.window = {
    addEventListener(type, callback) { listeners.set(`window:${type}`, callback); },
    removeEventListener() {}
  };
  return {
    canvas,
    listeners,
    restore() { globalThis.window = previousWindow; }
  };
}

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

test('active skill action is available from Space and the lower-right touch button', () => {
  const harness = createInputHarness();
  const input = createInputAdapter(harness.canvas);
  const keydown = harness.listeners.get('window:keydown');
  keydown({ code: 'Space', repeat: false, preventDefault() {} });
  assert.equal(input.consumeActiveSkill(), true);
  assert.equal(input.consumeActiveSkill(), false);
  harness.listeners.get('canvas:pointerdown')({ clientX: 318, clientY: 590, pointerId: 4 });
  assert.equal(input.consumeActiveSkill(), true);
  assert.equal(input.consumeActiveSkill(), false);
  harness.listeners.get('canvas:pointerdown')({ clientX: 318, clientY: 590, pointerId: 5 });
  harness.listeners.get('canvas:pointercancel')({ pointerId: 5 });
  assert.equal(input.consumeActiveSkill(), false);
  input.destroy();
  harness.restore();
});
