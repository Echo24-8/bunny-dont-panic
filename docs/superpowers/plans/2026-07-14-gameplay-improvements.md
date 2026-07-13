# Full Browser Gameplay Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成《兔兔别慌》浏览器版的公平弹幕、视觉反馈、升级预览、结果复盘和本地战绩分享改进。

**Architecture:** 纯规则继续留在 `src/core/`，浏览器能力留在 `src/platform/`，Canvas 视觉留在 `src/render/`，`create-game.js` 只编排事件与场景。六个子 agent 分两批处理互不重叠的文件，主 agent 在每批后审查并提交，最后完成跨模块接线和浏览器验收。

**Tech Stack:** 原生 ES modules、Canvas 2D、Pointer Events、Web Share/Clipboard API、Node 内置 `node:test`、无依赖静态服务器。

## Global Constraints

- 逻辑画布保持 360×640，DPR 最高 2，竖屏 9:16 自适应。
- 第一关保持 30 秒且站立可通关；第二关保持 60 秒、五段弹幕和极难定位。
- 第二关现有弹速、弹量、池上限 450 和阶段间隔不得整体下调。
- 三颗心、1 秒受伤无敌、自动瞄准、升级三选一、重试恢复生命并保留全部能力与 `upgradeCount` 的规则不变。
- 浮动摇杆的 4px 死区、35% 起步、24px 全速、42px 弹性跟随和键盘行为不变。
- 刷新后仍只持久化音乐和音效设置；不得新增成绩或构筑存储键。
- 不引入框架、游戏引擎、第三方分享 SDK、后端、排行榜、百分位、公网部署或微信小游戏入口。
- 所有代码改动采用 TDD；每个任务独立通过相关测试后再提交。

## File Map

- Create `src/core/results.js`: 结果摘要、通关标签、构筑摘要、公开 URL 判断和分享 payload。
- Create `src/platform/share-browser.js`: 浏览器分享按钮、系统分享、剪贴板和下载降级。
- Create `tests/results.test.js`: 结果与分享纯逻辑测试。
- Create `tests/tutorial.test.js`: 第一关视觉教学测试。
- Create `tests/share-browser.test.js`: 分享降级决策测试。
- Create `tests/renderer.test.js`: 结果页按钮布局的纯几何测试。
- Modify `src/core/state.js`: 准备期、挑战次数、会话最佳和统一结果记录。
- Modify `src/core/upgrades.js`: 结构化升级前后值。
- Modify `src/core/patterns.js`: 确定性第二关阶段与弹幕规格。
- Modify `src/core/world.js`: 教学、准备期、固定弹幕、擦弹和反馈事件。
- Modify `src/render/renderer.js`: 分层渲染、核心点、结果页和战绩卡。
- Modify `src/platform/browser.js`: 挂载分享适配器，不改变输入算法。
- Modify `src/game/create-game.js`: 跨模块编排、分享生命周期和调试状态。
- Modify `styles.css`: Canvas 对齐的透明原生分享按钮。
- Modify `README.md`: 说明本地战绩分享和公网链接限制。

## Agent Coordination

- 第一批并行：Agent 1 执行 Task 1，Agent 2 执行 Task 2，Agent 3 执行 Task 3。
- 主 agent 审查第一批接口、运行全量测试并按任务分别提交。
- 第二批并行：Agent 4 执行 Task 4，Agent 5 执行 Task 5，Agent 6 执行 Task 6。
- 主 agent 审查第二批后执行 Task 7 和 Task 8。
- 当前环境最多同时运行 4 个 agent（包含主 agent），因此六个子 agent 必须分两批运行。
- `superpowers:subagent-driven-development` 当前未安装；执行时使用内置 collaboration 子 agent，并由主 agent承担两阶段审查。
- 子 agent 不直接暂存或提交；每个任务的 Commit 步骤由主 agent 在代码与测试审查通过后执行。

---

### Task 1: State, Result Summary, and Session Records (Agent 1)

**Files:**
- Create: `src/core/results.js`
- Modify: `src/core/state.js`
- Modify: `tests/state.test.js`
- Create: `tests/results.test.js`

**Interfaces:**
- Produces: `getClearBadge(attempt) -> string`
- Produces: `recordLevelTwoResult(state, kind, survivalMs) -> state.result`
- Produces: `createResultSummary(state) -> ResultSummary`
- Produces: `createSharePayload(summary, currentUrl) -> { title, text, url }`
- Produces state fields: `readyMs`, `level2Attempt`, `sessionBestSurvivalMs`

- [ ] **Step 1: Write failing state and result tests**

Add assertions with these exact contracts:

```js
test('level two starts with one second preparation and first attempt', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  assert.equal(state.readyMs, 1_000);
  assert.equal(state.remainingMs, 60_000);
  assert.equal(state.level2Attempt, 1);
});

test('retry increments attempt and preserves retained progression', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  state.build.splitShot = 2;
  state.upgradeCount = 4;
  retryLevelTwoState(state);
  assert.equal(state.readyMs, 1_000);
  assert.equal(state.level2Attempt, 2);
  assert.equal(state.health, 3);
  assert.equal(state.xp, 0);
  assert.equal(state.build.splitShot, 2);
  assert.equal(state.upgradeCount, 4);
});

test('session best only increases and survives a new run', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  recordLevelTwoResult(state, 'defeat', 12_300);
  recordLevelTwoResult(state, 'defeat', 8_000);
  assert.equal(state.sessionBestSurvivalMs, 12_300);
  startNewRun(state);
  assert.equal(state.sessionBestSurvivalMs, 12_300);
  assert.equal(state.level2Attempt, 0);
});

test('clear badges preserve first clear prestige', () => {
  assert.equal(getClearBadge(1), '初见通关');
  assert.equal(getClearBadge(2), '逆袭通关');
  assert.equal(getClearBadge(3), '逆袭通关');
  assert.equal(getClearBadge(4), '成长通关');
});
```

Test result summaries with a public HTTPS URL and rejected local/private URLs.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/state.test.js tests/results.test.js`

Expected: FAIL because `recordLevelTwoResult`, `getClearBadge`, result fields, and `src/core/results.js` do not exist.

- [ ] **Step 3: Implement result helpers and state transitions**

Create `src/core/results.js` with these public rules:

```js
const BUILD_LABELS = Object.freeze({
  rapidFire: '连发', splitShot: '散射', pierce: '穿透', moveSpeed: '移速', shield: '护盾'
});

export function getClearBadge(attempt) {
  if (attempt <= 1) return '初见通关';
  if (attempt <= 3) return '逆袭通关';
  return '成长通关';
}

export function summarizeBuild(build, limit = 3) {
  const active = Object.entries(BUILD_LABELS)
    .filter(([id]) => (build[id] ?? 0) > 0)
    .map(([id, label]) => `${label} Lv${build[id]}`);
  if (active.length === 0) return '基础能力';
  const visible = active.slice(0, limit);
  if (active.length > limit) visible.push(`另有 ${active.length - limit} 项`);
  return visible.join(' · ');
}

export function isPublicShareUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return false;
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false;
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      if (parts[0] === 10 || parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }
    url.searchParams.delete('debug');
    return url.toString();
  } catch {
    return false;
  }
}

export function createResultSummary(state) {
  const result = state.result ?? { kind: 'defeat', survivalMs: 0 };
  return {
    kind: result.kind,
    survivalMs: result.survivalMs,
    bestSurvivalMs: state.sessionBestSurvivalMs,
    attempt: state.level2Attempt,
    badge: result.kind === 'success' ? getClearBadge(state.level2Attempt) : '',
    build: { ...state.build },
    buildSummary: summarizeBuild(state.build)
  };
}

export function createSharePayload(summary, currentUrl = '') {
  const seconds = (summary.survivalMs / 1000).toFixed(1);
  const resultText = summary.kind === 'success'
    ? `我在《兔兔别慌》撑满了 60 秒，${summary.badge}！`
    : `我在《兔兔别慌》第二关存活了 ${seconds} 秒。`;
  return {
    title: '兔兔别慌战绩',
    text: `${resultText} ${summary.buildSummary}`,
    url: isPublicShareUrl(currentUrl) || ''
  };
}
```

In `state.js`, preserve `sessionBestSurvivalMs` across `startNewRun`, set `readyMs = 1_000` and `level2Attempt = 1` in `startLevelTwo`, increment the attempt in `retryLevelTwoState`, and add:

```js
export function recordLevelTwoResult(state, kind, survivalMs) {
  const boundedMs = Math.max(0, Math.min(60_000, survivalMs));
  state.sessionBestSurvivalMs = Math.max(state.sessionBestSurvivalMs, boundedMs);
  state.result = { kind, survivalMs: boundedMs };
  return state.result;
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/state.test.js tests/results.test.js`

Expected: PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/state.js src/core/results.js tests/state.test.js tests/results.test.js
git commit -m "feat: track level two results and attempts"
```

### Task 2: Structured Upgrade Previews (Agent 2)

**Files:**
- Modify: `src/core/upgrades.js`
- Modify: `tests/upgrades.test.js`

**Interfaces:**
- Produces: `getUpgradePreview(state, id) -> { levelText, valueText }`
- Consumes: existing `derivePlayerStats(build)` and `shieldRechargeMs(level)`

- [ ] **Step 1: Write the parameterized preview test**

```js
test('upgrade previews match the applied combat values', () => {
  const cases = [
    ['rapidFire', 'Lv 0 → 1', '射击间隔 420ms → 378ms'],
    ['splitShot', 'Lv 0 → 1', '弹丸 1 发 → 2 发'],
    ['pierce', 'Lv 0 → 1', '额外穿透 0 → 1'],
    ['moveSpeed', 'Lv 0 → 1', '移速 190 → 205'],
    ['shield', 'Lv 0 → 1', '护盾 无 → 14.0s']
  ];
  for (const [id, levelText, valueText] of cases) {
    const state = startNewRun(createInitialState());
    assert.deepEqual(getUpgradePreview(state, id), { levelText, valueText });
  }
  const damaged = startNewRun(createInitialState());
  damaged.health = 2;
  assert.deepEqual(getUpgradePreview(damaged, 'heart'), {
    levelText: '', valueText: '生命 2/3 → 3/3'
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/upgrades.test.js`

Expected: FAIL because `getUpgradePreview` is not exported.

- [ ] **Step 3: Implement preview generation without duplicating formulas in the renderer**

```js
export function getUpgradePreview(state, id) {
  if (id === 'heart') {
    return { levelText: '', valueText: `生命 ${state.health}/${state.maxHealth} → ${Math.min(state.maxHealth, state.health + 1)}/${state.maxHealth}` };
  }
  const current = state.build[id] ?? 0;
  const nextBuild = { ...state.build, [id]: current + 1 };
  const before = derivePlayerStats(state.build);
  const after = derivePlayerStats(nextBuild);
  const levelText = `Lv ${current} → ${current + 1}`;
  const valueText = {
    rapidFire: `射击间隔 ${Math.round(before.fireIntervalMs)}ms → ${Math.round(after.fireIntervalMs)}ms`,
    splitShot: `弹丸 ${before.projectileCount} 发 → ${after.projectileCount} 发`,
    pierce: `额外穿透 ${before.pierce} → ${after.pierce}`,
    moveSpeed: `移速 ${Math.round(before.speed)} → ${Math.round(after.speed)}`,
    shield: `护盾 ${current === 0 ? '无' : `${(before.shieldRechargeMs / 1000).toFixed(1)}s`} → ${(after.shieldRechargeMs / 1000).toFixed(1)}s`
  }[id];
  return { levelText, valueText };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/upgrades.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/upgrades.js tests/upgrades.test.js
git commit -m "feat: expose upgrade value previews"
```

### Task 3: Deterministic Level-Two Pattern Script (Agent 3)

**Files:**
- Modify: `src/core/patterns.js`
- Modify: `tests/patterns.test.js`

**Interfaces:**
- Produces: `getLevelTwoPatternState(elapsedMs) -> { band, warning }`
- Produces: `getLevelTwoPatternSpec({ band, channel, shotIndex }) -> PatternSpec | null`
- PatternSpec: `{ kind, args, cooldownMs, startDelayMs }`

- [ ] **Step 1: Write failing deterministic schedule tests**

```js
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
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/patterns.test.js`

Expected: FAIL because both schedule helpers are missing.

- [ ] **Step 3: Implement the exact authored table**

Keep `makeRing`, `makeFan`, `makeAimed`, and `makeSpiralBullet`. Add band boundaries `[10_000, 25_000, 40_000, 55_000]` and this exact specification:

```js
export function getLevelTwoPatternState(elapsedMs) {
  const boundaries = [10_000, 25_000, 40_000, 55_000];
  const band = elapsedMs < 10_000 ? 0 : elapsedMs < 25_000 ? 1 : elapsedMs < 40_000 ? 2 : elapsedMs < 55_000 ? 3 : 4;
  const nextBoundary = boundaries[band];
  const warning = nextBoundary !== undefined && elapsedMs >= nextBoundary - 800 && elapsedMs < nextBoundary
    ? { nextBand: band + 1, remainingMs: nextBoundary - elapsedMs }
    : null;
  return { band, warning };
}

export function getLevelTwoPatternSpec({ band, channel, shotIndex }) {
  const side = shotIndex % 2;
  if (band === 0 && channel === 'main') return {
    kind: 'ring', cooldownMs: 1_250, startDelayMs: 0,
    args: { x: 180, y: 92, count: 24, speed: 96, gapAngle: [1.38, 1.76][side], gapWidth: Math.PI / 5, rotation: shotIndex * 0.1 }
  };
  if (band === 1 && channel === 'main') return {
    kind: 'fan', cooldownMs: 550, startDelayMs: 0,
    args: { x: side ? 340 : 20, y: [140, 220, 290, 180][shotIndex % 4], targetX: side ? 72 : 288, targetY: 500, count: 7, spread: Math.PI * 0.54, speed: 112 }
  };
  if (band === 2 && channel === 'main') return {
    kind: 'spiral', cooldownMs: 70, startDelayMs: 0,
    args: { x: 180, y: 100, angle: shotIndex * 0.27, speed: 108 }
  };
  if (band === 2 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 1_100, startDelayMs: 550,
    args: { x: 180, y: 100, targetX: [90, 270, 180][shotIndex % 3], targetY: 520, count: 3, spread: 0.24, speed: 128 }
  };
  if (band === 3 && channel === 'main') return {
    kind: 'ring', cooldownMs: 1_000, startDelayMs: 0,
    args: { x: 180, y: 96, count: 28, speed: 110, gapAngle: [1.32, 1.82][side], gapWidth: Math.PI / 7, rotation: shotIndex * 0.15 }
  };
  if (band === 3 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 750, startDelayMs: 375,
    args: { x: side ? 348 : 12, y: 260, targetX: side ? 74 : 286, targetY: 500, count: 7, spread: 1.1, speed: 122 }
  };
  if (band === 4 && channel === 'main') return {
    kind: 'ring', cooldownMs: 700, startDelayMs: 0,
    args: { x: 180, y: 92, count: 36, speed: 126, gapAngle: [1.42, 1.72][side], gapWidth: Math.PI / 10, rotation: shotIndex * 0.168 }
  };
  if (band === 4 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 520, startDelayMs: 260,
    args: { x: side ? 346 : 14, y: 190, targetX: side ? 80 : 280, targetY: 520, count: 9, spread: 1.15, speed: 135 }
  };
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/patterns.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/patterns.js tests/patterns.test.js
git commit -m "feat: author deterministic level two patterns"
```

### Task 4: World Tutorial, Preparation, Graze, and Feedback (Agent 4)

**Files:**
- Modify: `src/core/world.js`
- Modify: `tests/world.test.js`
- Create: `tests/tutorial.test.js`

**Interfaces:**
- Consumes: `state.readyMs`, `getLevelTwoPatternState`, `getLevelTwoPatternSpec`
- Produces world fields: `patternWarning`, `mainShotIndex`, `secondaryShotIndex`, `grazeEffectCooldownMs`
- Produces events: `pattern-warning`, `grazed`, existing `shielded`, `damaged`, `defeated`

- [ ] **Step 1: Write failing world and tutorial tests**

Cover these exact contracts:

```js
test('level two preparation freezes survival and suppresses hostile activity', () => {
  const state = startNewRun(createInitialState());
  startLevelTwo(state);
  const world = createWorld(() => 0.5);
  updateWorld({ world, state, input: { x: 1, y: 0 }, dtMs: 500 });
  assert.equal(state.remainingMs, 60_000);
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.readyMs, 500);
  assert.equal(world.enemies.activeCount, 0);
  assert.equal(world.enemyBullets.activeCount, 0);
  assert.ok(world.player.x > 180);
});

test('tutorial pickup reaches the first upgrade after a short move', () => {
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  const events = [];
  for (let frame = 0; frame < 480; frame += 1) {
    events.push(...updateWorld({ world, state, input: { x: 1, y: 0 }, dtMs: 1000 / 60 }));
    if (events.some((event) => event.type === 'upgrade-ready')) break;
  }
  assert.equal(events.some((event) => event.type === 'upgrade-ready'), true);
  assert.ok(state.elapsedMs < 8_000);
});
```

Add a graze test that acquires one bullet at distance `12` from the player, verifies a single `grazed` event and no health loss, runs another frame with the same bullet and verifies no second event, then releases/reacquires the pooled object and verifies `grazed === false`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/world.test.js tests/tutorial.test.js`

Expected: FAIL because preparation still consumes time, no tutorial exists, and bullets have no graze state.

- [ ] **Step 3: Implement tutorial and preparation**

Add `grazed: false` to enemy bullet entities and reset it in `acquireEnemyBullet`. Add tutorial flags to `world` and reset them in `resetWorld`. During level one:

```js
function updateLevelOneTutorial(world, state) {
  if (!world.tutorialEnemySpawned) {
    world.tutorialEnemySpawned = true;
    world.enemies.acquire({ x: 304, y: 500, vx: 0, vy: 0, ageMs: 0, rotation: 0, kind: 'tutorial', hp: 1, maxHp: 1, radius: 12, speed: 0, xpValue: 8, shotCooldownMs: Infinity });
  }
  if (!world.tutorialBulletFired && state.elapsedMs >= 3_600) {
    world.tutorialBulletFired = true;
    acquireEnemyBullet(world, makeAimed({ x: 180, y: 260, targetX: world.player.x, targetY: world.player.y, speed: 60 }));
  }
}
```

Suppress regular enemy spawning and existing level-one patterns while `state.elapsedMs < 8_000`. In `updateWorld`, handle `readyMs` before decrementing survival time:

```js
if (state.readyMs > 0) {
  state.readyMs = Math.max(0, state.readyMs - dtMs);
  updatePlayer(world, state, input, dtMs);
  return events;
}
```

- [ ] **Step 4: Replace player-tracking level-two scheduling**

On band entry reset shot indices, set main delay to zero, and initialize secondary delay from `getLevelTwoPatternSpec({ band, channel: 'secondary', shotIndex: 0 })?.startDelayMs`. Emit specifications through one helper:

```js
function emitPatternSpec(world, spec) {
  if (!spec) return;
  if (spec.kind === 'ring') emitBullets(world, makeRing(spec.args));
  else if (spec.kind === 'fan') emitBullets(world, makeFan(spec.args));
  else if (spec.kind === 'spiral') acquireEnemyBullet(world, makeSpiralBullet(spec.args));
}
```

Update `world.patternWarning` every frame from `getLevelTwoPatternState(state.elapsedMs)`. Emit `pattern-warning` only when `nextBand` changes. Prevent second-level enemies from firing their own aimed bullets; first-level bell behavior remains.

- [ ] **Step 5: Add graze and visual particle events**

In projectile/enemy collision, spawn 3 yellow particles on every player-bullet hit. In player collision, test hit first, then use this annulus for graze:

```js
const distance = Math.hypot(bullet.x - world.player.x, bullet.y - world.player.y);
const hitDistance = bullet.radius + world.player.radius;
if (!bullet.grazed && distance > hitDistance && distance <= hitDistance + 8) {
  bullet.grazed = true;
  if (world.grazeEffectCooldownMs <= 0) {
    events.push({ type: 'grazed', x: bullet.x, y: bullet.y });
    world.grazeEffectCooldownMs = 100;
  }
}
```

Spawn 12 cyan particles on `shielded` and 8 coral particles on `damaged`/`defeated`. Decrement `grazeEffectCooldownMs` with other cooldowns.

- [ ] **Step 6: Run tests**

Run: `node --test tests/world.test.js tests/tutorial.test.js tests/patterns.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/core/world.js tests/world.test.js tests/tutorial.test.js
git commit -m "feat: teach movement and make bullet hell learnable"
```

### Task 5: Layered Renderer, Hit Core, Results, and Share Card (Agent 5)

**Files:**
- Modify: `src/render/renderer.js`
- Create: `tests/renderer.test.js`

**Interfaces:**
- Consumes: choice objects with `preview`, state result/session fields, `world.patternWarning`, renderer input `shareStatus`
- Produces: `UI_RECTS.share`, revised `UI_RECTS.retry` and `UI_RECTS.menu`
- Produces: `renderer.createShareImage(summary) -> Promise<Blob>`

- [ ] **Step 1: Write failing layout tests**

```js
test('result actions have mobile hit targets and do not overlap', () => {
  for (const id of ['retry', 'share', 'menu']) {
    assert.ok(UI_RECTS[id].width >= 44);
    assert.ok(UI_RECTS[id].height >= 44);
  }
  assert.ok(UI_RECTS.share.x + UI_RECTS.share.width < UI_RECTS.menu.x);
  assert.ok(UI_RECTS.retry.y + UI_RECTS.retry.height < UI_RECTS.share.y);
  assert.ok(UI_RECTS.menu.y + UI_RECTS.menu.height <= 560);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/renderer.test.js`

Expected: FAIL because `UI_RECTS.share` is missing.

- [ ] **Step 3: Implement exact result layout and upgrade text**

Use:

```js
retry: { x: 72, y: 404, width: 216, height: 54 },
share: { x: 36, y: 478, width: 136, height: 48 },
menu: { x: 188, y: 478, width: 136, height: 48 }
```

Result statistics occupy at most three lines between `y=300` and `y=376`. Draw `shareStatus` as an 11px short status line at `y=390`, then draw share and menu as separate secondary buttons. Upgrade cards draw `choice.preview.levelText` beside the title and `choice.preview.valueText` on the second line.

- [ ] **Step 4: Split rendering into ordered layers**

Refactor the current monolithic world drawing into helpers and call them in this exact order:

```js
drawBackground(ctx, assets, state.levelId);
drawPatternWarning(ctx, world.patternWarning, now, reducedMotion);
drawJoystickBase(ctx, input.getJoystickState());
drawPickupsEnemiesAndPlayerBullets(ctx, assets, world, now, reducedMotion);
drawEnemyBulletsBatched(ctx, world.enemyBullets);
drawPlayerAndShield(ctx, assets, world.player, state, now, reducedMotion);
drawParticles(ctx, world.particles);
drawHitCore(ctx, world.player);
drawHud(ctx, state, now, reducedMotion);
drawJoystickOutline(ctx, input.getJoystickState());
```

Batch all enemy-bullet arcs into one path, one fill and one stroke. Move the bunny bitmap 9px upward relative to its current offset. Draw a 2.5px dark core and 7px white ring at the exact collision center. During the first 180ms after damage (`state.invulnerableMs > 820`) draw a static coral screen-edge line; when `health === 1`, outline the heart HUD panel in coral. Reduced-motion mode must not hide the hit core or warning outline.

- [ ] **Step 5: Implement the 1080×1440 share image**

Add `createShareImage(summary)` to the renderer. It creates an offscreen 1080×1440 canvas, draws the level-two watercolor background with a legible light overlay, then draws game title, result time, best time, attempt, badge and build summary. Convert with `canvas.toBlob('image/png')`; reject with `Error('share-image-failed')` when no blob is produced. Do not draw interactive buttons or fabricated ranking data.

- [ ] **Step 6: Run tests**

Run: `node --test tests/renderer.test.js tests/upgrades.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/render/renderer.js tests/renderer.test.js
git commit -m "feat: clarify hitbox and result presentation"
```

### Task 6: Browser Sharing Adapter and Native Hit Target (Agent 6)

**Files:**
- Create: `src/platform/share-browser.js`
- Modify: `src/platform/browser.js`
- Modify: `styles.css`
- Create: `tests/share-browser.test.js`

**Interfaces:**
- Produces: `executeShare({ payload, image, api }) -> Promise<ShareStatus>`
- Produces: `createBrowserSharingAdapter({ canvas })`
- Adapter methods: `currentUrl()`, `presentResult({ rect, payload, imagePromise, onStatus })`, `clearResult()`, `destroy()`

- [ ] **Step 1: Write failing degradation tests**

Test these exact statuses: native success returns `shared`; `AbortError` returns `cancelled`; unsupported file share sends text only; absent native share with working clipboard and image returns `copied-and-downloaded`; rejected clipboard with image returns `downloaded`; no successful action returns `failed`.

```js
test('cancelled native share is not reported as success', async () => {
  const api = {
    share: async () => { throw new DOMException('cancelled', 'AbortError'); },
    canShareFiles: () => false,
    writeText: async () => {},
    download: () => {}
  };
  assert.equal(await executeShare({ payload: { title: 't', text: 'x', url: '' }, image: null, api }), 'cancelled');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/share-browser.test.js`

Expected: FAIL because `src/platform/share-browser.js` does not exist.

- [ ] **Step 3: Implement pure share execution**

`executeShare` must call native share synchronously before any unrelated `await`. Include `url` only when non-empty. Include the PNG file only when `image` exists and `api.canShareFiles([image])` is true. On non-cancel native failure, continue to clipboard/download fallback. Return one of:

```js
export const SHARE_STATUS = Object.freeze({
  SHARED: 'shared', CANCELLED: 'cancelled', COPIED: 'copied',
  DOWNLOADED: 'downloaded', COPIED_AND_DOWNLOADED: 'copied-and-downloaded', FAILED: 'failed'
});
```

- [ ] **Step 4: Implement the Canvas-aligned native button**

Create one `button` appended to `canvas.parentElement`, class `share-hit-target`, text `分享战绩`, and `aria-label="分享战绩"`. Position it with percentages derived from the logical rect:

```js
button.style.left = `${(rect.x / 360) * 100}%`;
button.style.top = `${(rect.y / 640) * 100}%`;
button.style.width = `${(rect.width / 360) * 100}%`;
button.style.height = `${(rect.height / 640) * 100}%`;
```

`currentUrl()` returns `window.location.href`. `presentResult` starts `imagePromise` immediately and caches the resolved PNG `File`. The click handler uses a cached image when ready; otherwise it shares text without waiting. `clearResult` hides the button and clears payload/status callbacks. `destroy` removes it.

Add CSS that keeps the button visually transparent while preserving pointer events and a visible `:focus-visible` outline. It must be hidden with `[hidden]` and use at least the Canvas 136×48 logical hit area.

- [ ] **Step 5: Mount adapter in browser platform**

Import `createBrowserSharingAdapter`, construct it beside audio/lifecycle, expose it as `sharing`, and call `sharing.destroy()` from platform destruction. Do not modify `createInputAdapter`, joystick calculations, storage keys, or audio behavior.

- [ ] **Step 6: Run tests**

Run: `node --test tests/share-browser.test.js tests/input.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/platform/share-browser.js src/platform/browser.js styles.css tests/share-browser.test.js
git commit -m "feat: add browser result sharing fallbacks"
```

### Task 7: Game Orchestration and Documentation (Main Agent)

**Files:**
- Modify: `src/game/create-game.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: all interfaces from Tasks 1-6
- Produces: integrated result lifecycle, share status, upgrade previews, warnings, and debug fields

- [ ] **Step 1: Wire upgrade previews**

When handling `upgrade-ready`, transform definitions before storing choices:

```js
choices = getUpgradeChoices({ build: state.build, health: state.health, rng })
  .map((choice) => ({ ...choice, preview: getUpgradePreview(state, choice.id) }));
```

- [ ] **Step 2: Centralize result creation and sharing**

Add `shareStatus = ''` and one helper used by defeat and success:

```js
function showLevelTwoResult(kind, survivalMs) {
  state.phase = PHASES.RESULT;
  recordLevelTwoResult(state, kind, survivalMs);
  const summary = createResultSummary(state);
  const payload = createSharePayload(summary, platform.sharing.currentUrl());
  shareStatus = '';
  platform.sharing.presentResult({
    rect: UI_RECTS.share,
    payload,
    imagePromise: renderer.createShareImage(summary),
    onStatus(status) {
      shareStatus = status;
      platform.a11y.announce({
        shared: '战绩已分享。', cancelled: '已取消分享。', copied: '战绩文字已复制。',
        downloaded: '战绩图已保存。', 'copied-and-downloaded': '战绩文字已复制，战绩图已保存。', failed: '分享失败，请重试。'
      }[status]);
    }
  });
  platform.input.setJoystickEnabled(false);
}
```

Call `platform.sharing.clearResult()` from new run, retry, return menu, settings transitions that leave result, and destroy. Pass `shareStatus` to `renderer.render`.

- [ ] **Step 3: Integrate warnings and debug state**

Handle `pattern-warning` with one `aria-live` announcement per transition. Add `readyMs`, `patternBand`, warning band, `level2Attempt`, `sessionBestSurvivalMs`, and graze event count to debug reporting/snapshot. Do not announce every graze.

- [ ] **Step 4: Update documentation**

Add a README section stating that the result page can share/save a local PNG and copy truthful result text; local and LAN URLs are intentionally omitted; sending a playable link to WeChat still requires later HTTPS deployment.

- [ ] **Step 5: Run all tests and syntax checks**

Run: `npm test`

Expected: all tests PASS.

Run:

```powershell
Get-ChildItem src -Recurse -Include *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

Expected: every syntax check exits 0 and `git diff --check` reports no errors.

- [ ] **Step 6: Commit**

```powershell
git add src/game/create-game.js README.md
git commit -m "feat: integrate improved browser game flow"
```

### Task 8: Full Browser Verification and Final Regression (Main Agent)

**Files:**
- Modify only files required by observed regressions.

**Interfaces:**
- Verifies the complete `createGame` and browser platform contract.

- [ ] **Step 1: Start the static server**

Run: `npm run dev -- --host 0.0.0.0 --port 4173`

Expected: local URL responds with HTTP 200. If 4173 is occupied, choose the next free port and report it.

- [ ] **Step 2: Validate three viewports**

Use the in-app browser at 360×640, 390×844, and 1280×800. Verify nonblank Canvas, no HUD overlap, three upgrade cards fit, result statistics stay within three lines, and retry/share/menu hit targets fit the panel.

- [ ] **Step 3: Validate gameplay contracts**

Verify the first tutorial upgrade occurs after moving toward the right pickup. Enter level two twice with the same input path and compare debug pattern band/bullet counts at fixed timestamps. Verify the 1000ms preparation freezes the timer, the four warnings appear once, standing still fails in 7-15 seconds, and learned movement can survive materially longer.

- [ ] **Step 4: Validate controls and feedback**

Verify WASD, arrow keys, floating touch origin, 5px quick start, 42px elastic follow, and immediate release stop. Confirm bullets remain visible over the joystick, the 7px core aligns with collisions, and graze/damage/shield/last-heart visuals remain distinct with sound disabled and reduced motion enabled.

- [ ] **Step 5: Validate sharing and performance**

Trigger failure and verify result time, session best, attempt, build summary, and buttons. Exercise native sharing when available and fallback copy/download otherwise. Verify generated PNG is 1080×1440 and contains no fake ranking. In `?debug=1`, inject 450 bullets with `B`, move for 10 seconds, and confirm warmed Chromium reports at least 55 FPS.

- [ ] **Step 6: Final automated verification**

Run:

```powershell
npm test
Get-ChildItem src -Recurse -Include *.js | ForEach-Object { node --check $_.FullName }
git diff --check
git status --short
```

Expected: tests and syntax checks pass, diff check is clean, and only intentional regression fixes remain before the final commit.

- [ ] **Step 7: Commit any verification fixes**

```powershell
git add -u
git commit -m "fix: resolve browser gameplay regressions"
```

Skip this commit when verification requires no code changes.
