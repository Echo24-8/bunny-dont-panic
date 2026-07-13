import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_RECTS } from '../src/render/renderer.js';

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
