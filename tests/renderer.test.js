import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_RECTS, WEAPON_SLOT_RECTS, getEventCardRect, getUpgradeCardRect } from '../src/render/renderer.js';

test('result actions have mobile hit targets and do not overlap', () => {
  assert.deepEqual(UI_RECTS.retry, { x: 72, y: 404, width: 216, height: 54 });
  assert.deepEqual(UI_RECTS.share, { x: 36, y: 478, width: 136, height: 48 });
  assert.deepEqual(UI_RECTS.menu, { x: 188, y: 478, width: 136, height: 48 });
  for (const id of ['retry', 'share', 'menu']) {
    assert.ok(UI_RECTS[id].width >= 44);
    assert.ok(UI_RECTS[id].height >= 44);
  }
  assert.ok(UI_RECTS.share.x + UI_RECTS.share.width < UI_RECTS.menu.x);
  assert.ok(UI_RECTS.retry.y + UI_RECTS.retry.height < UI_RECTS.share.y);
  assert.ok(UI_RECTS.menu.y + UI_RECTS.menu.height <= 560);
});

test('active skill button has a compact touch target in the lower right', () => {
  const rect = UI_RECTS.activeSkill;
  assert.deepEqual(rect, { x: 292, y: 564, width: 52, height: 52 });
  assert.ok(rect.width >= 44);
  assert.ok(rect.height >= 44);
  assert.ok(rect.x + rect.width <= 360);
  assert.ok(rect.y + rect.height <= 640);
  assert.ok(rect.x > 180);
});

test('three weapon slots remain inside the compact top HUD', () => {
  assert.equal(WEAPON_SLOT_RECTS.length, 3);
  for (const rect of WEAPON_SLOT_RECTS) {
    assert.ok(rect.x >= 0);
    assert.ok(rect.x + rect.width <= 360);
    assert.ok(rect.y >= 70);
    assert.ok(rect.y + rect.height <= 108);
  }
  for (let index = 1; index < WEAPON_SLOT_RECTS.length; index += 1) {
    const previous = WEAPON_SLOT_RECTS[index - 1];
    assert.ok(previous.x + previous.width < WEAPON_SLOT_RECTS[index].x);
  }
});

test('upgrade cards are large, separated, and fit the logical canvas', () => {
  const rects = Array.from({ length: 3 }, (_, index) => getUpgradeCardRect(index));
  assert.deepEqual(rects[0], { x: 24, y: 182, width: 312, height: 100 });
  for (const rect of rects) {
    assert.ok(rect.width >= 44);
    assert.ok(rect.height >= 44);
    assert.ok(rect.x + rect.width <= 360);
    assert.ok(rect.y + rect.height <= 640);
  }
  for (let index = 1; index < rects.length; index += 1) {
    assert.ok(rects[index - 1].y + rects[index - 1].height < rects[index].y);
  }
});

test('event cards and boss bar leave stable HUD space', () => {
  const rects = [getEventCardRect(0), getEventCardRect(1)];
  for (const rect of rects) {
    assert.ok(rect.width >= 44 && rect.height >= 44);
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 360);
    assert.ok(rect.y >= 160 && rect.y + rect.height <= 640);
  }
  assert.ok(rects[0].y + rects[0].height < rects[1].y);
  assert.ok(UI_RECTS.activeSkill.y >= 560);
});
