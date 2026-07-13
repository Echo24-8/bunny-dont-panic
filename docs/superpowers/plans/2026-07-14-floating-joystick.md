# Floating Joystick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed lower-left virtual joystick with a lower-half floating joystick that elastically follows the controlling finger and starts moving promptly.

**Architecture:** Keep all pointer ownership and joystick math inside the browser platform adapter. Export pure math helpers for unit tests, expose the resulting dynamic center/vector through the existing `getJoystickState()` interface, and keep the battle core unchanged.

**Tech Stack:** Native JavaScript ES modules, Pointer Events, Canvas 2D, Node built-in test runner, in-app Chromium browser verification.

## Global Constraints

- Only the first pointer landing at logical `y >= 320` while joystick input is enabled may control movement.
- Dead zone is 4 logical pixels; output starts at 35% and reaches 100% at 24 pixels.
- Elastic follow radius is 42 logical pixels.
- Release, pointer cancellation, blur, or disabled input must stop movement immediately and hide the joystick.
- Keyboard input, combat code, upgrade screens, settings, and result screens must remain unchanged.

---

### Task 1: Floating joystick math

**Files:**
- Modify: `src/platform/browser.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces: `joystickVectorFromPoint(point, center, deadZone = 4, fullSpeedDistance = 24) -> { x, y }`
- Produces: `followJoystickCenter(point, center, radius = 42) -> { x, y }`

- [ ] **Step 1: Replace the existing linear-vector tests with failing response and follow tests**

```js
test('floating joystick has a four pixel dead zone and a fast start', () => {
  assert.deepEqual(joystickVectorFromPoint({ x: 72, y: 548 }, { x: 68, y: 548 }), { x: 0, y: 0 });
  const started = joystickVectorFromPoint({ x: 73, y: 548 }, { x: 68, y: 548 });
  assert.ok(Math.abs(started.x - 0.3825) < 0.0001);
});

test('floating joystick reaches full speed at twenty four pixels', () => {
  assert.deepEqual(joystickVectorFromPoint({ x: 92, y: 548 }, { x: 68, y: 548 }), { x: 1, y: 0 });
});

test('floating joystick center follows only beyond forty two pixels', () => {
  assert.deepEqual(followJoystickCenter({ x: 100, y: 548 }, { x: 68, y: 548 }), { x: 68, y: 548 });
  assert.deepEqual(followJoystickCenter({ x: 120, y: 548 }, { x: 68, y: 548 }), { x: 78, y: 548 });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/input.test.js`

Expected: FAIL because the current vector is linear and `followJoystickCenter` is not exported.

- [ ] **Step 3: Implement the exact response curve and elastic center helper**

```js
export function joystickVectorFromPoint(point, center, deadZone = 4, fullSpeedDistance = 24) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= deadZone) return { x: 0, y: 0 };
  const strength = distance >= fullSpeedDistance
    ? 1
    : 0.35 + 0.65 * ((distance - deadZone) / (fullSpeedDistance - deadZone));
  return { x: (dx / distance) * strength, y: (dy / distance) * strength };
}

export function followJoystickCenter(point, center, radius = 42) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return { ...center };
  const overflow = distance - radius;
  return { x: center.x + (dx / distance) * overflow, y: center.y + (dy / distance) * overflow };
}
```

- [ ] **Step 4: Run the focused and complete test suites**

Run: `node --test tests/input.test.js`

Expected: 3 input tests PASS.

Run: `npm test`

Expected: all existing tests PASS.

- [ ] **Step 5: Commit the pure joystick math**

```bash
git add src/platform/browser.js tests/input.test.js
git commit -m "test: define floating joystick response"
```

### Task 2: Pointer ownership and dynamic center

**Files:**
- Modify: `src/platform/browser.js`
- Modify: `src/render/renderer.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Consumes: `joystickVectorFromPoint()` and `followJoystickCenter()` from Task 1.
- Preserves: `input.readVector()` and `input.getJoystickState()` consumed by the game and renderer.

- [ ] **Step 1: Add a failing trigger-boundary test**

```js
test('floating joystick only triggers in the lower half', () => {
  assert.equal(isJoystickTrigger({ x: 180, y: 319 }, true), false);
  assert.equal(isJoystickTrigger({ x: 180, y: 320 }, true), true);
  assert.equal(isJoystickTrigger({ x: 180, y: 500 }, false), false);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing helper failure**

Run: `node --test tests/input.test.js`

Expected: FAIL because `isJoystickTrigger` is not exported.

- [ ] **Step 3: Replace the fixed center and release pulse with floating state**

```js
export function isJoystickTrigger(point, enabled) {
  return enabled && point.y >= LOGICAL_HEIGHT / 2;
}

let joystickCenter = { x: 68, y: 548 };

function onPointerDown(event) {
  const point = toLogical(event);
  canvas.focus({ preventScroll: true });
  if (joystickPointerId !== null) return;
  if (isJoystickTrigger(point, joystickEnabled)) {
    joystickPointerId = event.pointerId;
    joystickCenter = { ...point };
    joystickVector = { x: 0, y: 0 };
    joystickActive = true;
    canvas.setPointerCapture?.(event.pointerId);
  } else {
    taps.push(point);
  }
}

function onPointerMove(event) {
  if (event.pointerId !== joystickPointerId) return;
  const point = toLogical(event);
  joystickCenter = followJoystickCenter(point, joystickCenter);
  joystickVector = joystickVectorFromPoint(point, joystickCenter);
}

function releasePointer(event) {
  if (event.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  joystickVector = { x: 0, y: 0 };
  joystickActive = false;
}
```

Remove `joystickPulseVector` and `joystickPulseUntil` completely. `clear()` must also zero the vector and deactivate the joystick. `readVector()` must return the active joystick vector or `{ x: 0, y: 0 }` after keyboard handling.

- [ ] **Step 4: Hide the joystick while inactive**

```js
function drawJoystick(ctx, joystick) {
  if (!joystick.active) return;
  // Keep the existing base and knob drawing, using joystick.center and joystick.vector.
}
```

- [ ] **Step 5: Run syntax and test checks**

Run: `node --check src/platform/browser.js && node --check src/render/renderer.js`

Expected: both commands exit 0.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit the floating pointer behavior**

```bash
git add src/platform/browser.js src/render/renderer.js tests/input.test.js
git commit -m "feat: add elastic floating joystick"
```

### Task 3: Browser interaction and regression verification

**Files:**
- Modify: `src/game/create-game.js`
- Modify: `README.md`

**Interfaces:**
- Extend debug-only reporting with `joystickActive`, `joystickCenterX`, `joystickCenterY`, `joystickVectorX`, and `joystickVectorY`.
- Do not change the production game controller API.

- [ ] **Step 1: Report joystick state for read-only browser verification**

```js
const joystick = platform.input.getJoystickState();
platform.debug.report({
  joystickActive: joystick.active,
  joystickCenterX: joystick.center.x.toFixed(2),
  joystickCenterY: joystick.center.y.toFixed(2),
  joystickVectorX: joystick.vector.x.toFixed(3),
  joystickVectorY: joystick.vector.y.toFixed(3)
});
```

- [ ] **Step 2: Update the README control description**

Replace “手机使用左下虚拟摇杆” with “手机触摸战斗画面下半部分即可生成浮动摇杆”。Do not add new visible in-game instructions.

- [ ] **Step 3: Verify lower-half placement and fast start in the browser**

Run: `npm run dev -- --host 0.0.0.0 --port 4173`

Open: `http://localhost:4173/?debug=1`

Acceptance checks:

- Touch at logical `(240, 460)` sets the reported center to `(240, 460)`.
- A 5-pixel right drag reports vector X approximately `0.3825`.
- A drag beyond 42 pixels moves the reported center while keeping the vector at full strength.
- Player X increases after a small right drag within one rendered frame.
- Release sets `joystickActive=false` and two later player-X samples remain equal.
- A second pointer does not replace the controlling pointer.
- The upper settings button still opens, keyboard right still moves the player, and browser logs contain no errors.

- [ ] **Step 4: Run the complete regression suite**

Run: `npm test`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Commit documentation and debug verification support**

```bash
git add src/game/create-game.js README.md
git commit -m "docs: describe floating touch controls"
```

