import test from 'node:test';
import assert from 'node:assert/strict';

import { createBrowserSharingAdapter, executeShare } from '../src/platform/share-browser.js';

const payload = Object.freeze({
  title: '兔兔别慌',
  text: '我在第二关存活了 12.3 秒',
  url: 'https://example.com/game'
});

test('native share success returns shared', async () => {
  let sharedData = null;
  const api = {
    share: async (data) => { sharedData = data; },
    canShareFiles: () => false
  };

  assert.equal(await executeShare({ payload, image: null, api }), 'shared');
  assert.deepEqual(sharedData, payload);
});

test('cancelled native share is not reported as success', async () => {
  const api = {
    share: async () => { throw new DOMException('cancelled', 'AbortError'); },
    canShareFiles: () => false,
    writeText: async () => {},
    download: () => {}
  };

  assert.equal(
    await executeShare({ payload: { title: 't', text: 'x', url: '' }, image: null, api }),
    'cancelled'
  );
});

test('unsupported file sharing uses native text share without files', async () => {
  const image = { name: 'result.png', type: 'image/png' };
  let sharedData = null;
  const api = {
    share: async (data) => { sharedData = data; },
    canShareFiles: () => false
  };

  assert.equal(await executeShare({ payload, image, api }), 'shared');
  assert.equal('files' in sharedData, false);
  assert.equal(sharedData.url, payload.url);
});

test('supported file sharing includes the image in native share data', async () => {
  const image = { name: 'result.png', type: 'image/png' };
  let inspectedFiles = null;
  let sharedData = null;
  const api = {
    share: async (data) => { sharedData = data; },
    canShareFiles: (files) => {
      inspectedFiles = files;
      return true;
    }
  };

  assert.equal(await executeShare({ payload, image, api }), 'shared');
  assert.deepEqual(inspectedFiles, [image]);
  assert.deepEqual(sharedData.files, [image]);
});

test('clipboard and image download fallback reports both actions', async () => {
  const calls = [];
  const image = { name: 'result.png', type: 'image/png' };
  const api = {
    share: null,
    writeText: async (text) => { calls.push(['copy', text]); },
    download: (file) => { calls.push(['download', file]); }
  };

  assert.equal(await executeShare({ payload, image, api }), 'copied-and-downloaded');
  assert.deepEqual(calls, [
    ['copy', `${payload.text}\n${payload.url}`],
    ['download', image]
  ]);
});

test('rejected clipboard with an image falls back to download', async () => {
  let downloaded = null;
  const image = { name: 'result.png', type: 'image/png' };
  const api = {
    share: null,
    writeText: async () => { throw new Error('permission-denied'); },
    download: (file) => { downloaded = file; }
  };

  assert.equal(await executeShare({ payload, image, api }), 'downloaded');
  assert.equal(downloaded, image);
});

test('no successful share, copy, or download action reports failed', async () => {
  const api = {
    share: null,
    writeText: async () => { throw new Error('permission-denied'); },
    download: () => { throw new Error('download-blocked'); }
  };

  assert.equal(await executeShare({ payload, image: {}, api }), 'failed');
});

test('native result button aligns to the canvas and does not wait for its image', async () => {
  let clickHandler = null;
  let removed = false;
  let sharedData = null;
  const button = {
    style: {},
    hidden: false,
    disabled: false,
    className: '',
    textContent: '',
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(type, handler) {
      if (type === 'click') clickHandler = handler;
    },
    removeEventListener() {},
    remove() { removed = true; }
  };
  const windowRef = {
    location: { href: 'https://example.com/game' },
    navigator: {
      share: async (data) => { sharedData = data; },
      canShare: () => true,
      clipboard: { writeText: async () => {} }
    },
    URL: {
      createObjectURL: () => 'blob:result',
      revokeObjectURL: () => {}
    },
    setTimeout: (callback) => callback()
  };
  const documentRef = {
    defaultView: windowRef,
    createElement(tagName) {
      assert.equal(tagName, 'button');
      return button;
    }
  };
  const parentElement = {
    appendChild(child) { assert.equal(child, button); }
  };
  const canvas = { ownerDocument: documentRef, parentElement };
  const adapter = createBrowserSharingAdapter({ canvas });

  assert.equal(button.hidden, true);
  assert.equal(button.className, 'share-hit-target');
  assert.equal(button.textContent, '分享战绩');
  assert.equal(button.attributes.get('aria-label'), '分享战绩');
  assert.equal(adapter.currentUrl(), 'https://example.com/game');

  let resolveImage;
  const imagePromise = new Promise((resolve) => { resolveImage = resolve; });
  const statuses = [];
  adapter.presentResult({
    rect: { x: 36, y: 478, width: 136, height: 48 },
    payload,
    imagePromise,
    onStatus: (status) => statuses.push(status)
  });

  assert.equal(button.hidden, false);
  assert.equal(button.style.left, '10%');
  assert.equal(button.style.top, '74.6875%');
  assert.equal(button.style.width, '37.77777777777778%');
  assert.equal(button.style.height, '7.5%');

  await clickHandler();
  assert.deepEqual(sharedData, payload);
  assert.deepEqual(statuses, ['shared']);

  resolveImage(new Blob(['png'], { type: 'image/png' }));
  adapter.clearResult();
  assert.equal(button.hidden, true);
  adapter.destroy();
  assert.equal(removed, true);
});
