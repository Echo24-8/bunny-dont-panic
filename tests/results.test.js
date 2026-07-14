import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, recordLevelTwoResult, startLevelTwo, startNewRun } from '../src/core/state.js';
import {
  createResultSummary,
  createSharePayload,
  getClearBadge,
  isPublicShareUrl,
  summarizeBuild
} from '../src/core/results.js';

test('clear badges preserve first clear prestige', () => {
  assert.equal(getClearBadge(1), '初见通关');
  assert.equal(getClearBadge(2), '逆袭通关');
  assert.equal(getClearBadge(3), '逆袭通关');
  assert.equal(getClearBadge(4), '成长通关');
});

test('build summary lists weapons before abilities and folds overflow', () => {
  assert.equal(summarizeBuild({}), '基础能力');
  assert.equal(
    summarizeBuild({
      rapidFire: 2,
      moveSpeed: 3,
      shield: 0,
      weaponSlots: [{ id: 'carrot', level: 1 }, { id: 'dandelion', level: 2 }, null]
    }),
    '胡萝卜飞镖 Lv1 · 蒲公英散射 Lv2 · 连发 Lv2 · 另有 1 项'
  );
});

test('result summary captures result record attempt badge and build', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.build.rapidFire = 2;
  recordLevelTwoResult(state, 'success', 60_000);
  assert.deepEqual(createResultSummary(state), {
    kind: 'success',
    survivalMs: 60_000,
    bestSurvivalMs: 60_000,
    attempt: 1,
    badge: '初见通关',
    build: {
      rapidFire: 2,
      moveSpeed: 0,
      shield: 0,
      weaponSlots: [{ id: 'carrot', level: 1 }, null, null]
    },
    buildSummary: '胡萝卜飞镖 Lv1 · 连发 Lv2'
  });
});

test('result summary deep-clones weapon slots', () => {
  const state = startNewRun(createInitialState());
  state.build.weaponSlots[1] = { id: 'bubble', level: 2 };
  recordLevelTwoResult(state, 'defeat', 12_000);

  const summary = createResultSummary(state);
  assert.notStrictEqual(summary.build.weaponSlots, state.build.weaponSlots);
  assert.notStrictEqual(summary.build.weaponSlots[1], state.build.weaponSlots[1]);

  state.build.weaponSlots[1].level = 3;
  assert.equal(summary.build.weaponSlots[1].level, 2);
});

test('public share URL requires public HTTPS and removes debug mode', () => {
  assert.equal(isPublicShareUrl('https://game.example/play?debug=1&from=wechat'), 'https://game.example/play?from=wechat');
  assert.equal(isPublicShareUrl('https://fcgame.example/play'), 'https://fcgame.example/play');
  for (const value of [
    'http://game.example/play',
    'https://localhost:4173/',
    'https://bunny.local/',
    'https://127.0.0.1/',
    'https://10.0.0.8/',
    'https://169.254.1.2/',
    'https://172.16.1.2/',
    'https://172.31.1.2/',
    'https://192.168.1.8/',
    'https://[::1]/',
    'https://[fe80::1]/',
    'https://[fc00::1]/',
    'https://[fd00::1]/',
    'not-a-url'
  ]) {
    assert.equal(isPublicShareUrl(value), false, value);
  }
});

test('share payload uses truthful result text and omits private URLs', () => {
  const defeat = {
    kind: 'defeat', survivalMs: 12_340, bestSurvivalMs: 12_340, attempt: 2,
    badge: '', buildSummary: '蒲公英散射 Lv1'
  };
  assert.deepEqual(createSharePayload(defeat, 'http://localhost:4173/?debug=1'), {
    title: '兔兔别慌战绩',
    text: '我在《兔兔别慌》第二关存活了 12.3 秒。 蒲公英散射 Lv1',
    url: ''
  });

  const success = { ...defeat, kind: 'success', survivalMs: 60_000, badge: '逆袭通关' };
  assert.deepEqual(createSharePayload(success, 'https://game.example/?debug=1'), {
    title: '兔兔别慌战绩',
    text: '我在《兔兔别慌》撑满了 60 秒，逆袭通关！ 蒲公英散射 Lv1',
    url: 'https://game.example/'
  });
});
