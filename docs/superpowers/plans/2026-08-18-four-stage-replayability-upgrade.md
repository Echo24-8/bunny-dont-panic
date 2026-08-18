# Four-Stage Replayability Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax and must be completed task-by-task.

**Goal:** 将《兔兔别慌》从固定两关流程升级为四关、带随机事件、一个主动技能、精英/Boss、局外解锁和挑战目标的小型浏览器肉鸽游戏。

**Architecture:** 纯规则继续放在 `src/core/`，浏览器输入和本地进度放在 `src/platform/`，Canvas 只负责渲染，`src/game/create-game.js` 负责编排。新增系统通过事件和明确的数据接口接入现有状态机，不重写现有武器、对象池和固定步长循环。

**Tech Stack:** 原生 JavaScript ES modules、Canvas 2D、Pointer Events、Node 内置 `node:test`、现有无依赖开发服务器。

## Global Constraints

- 采用四关线性流程：45s、60s、75s、75-90s。
- 每局只装备一个主动技能，自动武器继续自动瞄准和释放。
- 每关结束从两张随机事件卡中选择一张；事件由固定种子生成。
- 第三关加入精英敌人，第四关加入两阶段 Boss。
- 逻辑继续使用固定步长和现有对象池；敌弹池保持 450、玩家弹池保持 128。
- 逻辑画布保持 360×640，新增按钮命中区域至少 44×44。
- 局外进度使用版本化本地存储；存储失败、损坏或版本不匹配时回退默认状态。
- 不引入引擎、后端、账号、云存档、联网排行榜、广告、付费或微信小游戏入口。
- 每个任务先写失败测试，再实现最小代码，完成后运行相关测试和 `npm test`。

---

### Task 1: Campaign State and Four-Stage Flow

**Files:**
- Create: `src/core/campaign.js`
- Modify: `src/core/constants.js`
- Modify: `src/core/state.js`
- Modify: `src/game/create-game.js`
- Test: `tests/campaign.test.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Produces `STAGE_DEFINITIONS`, `createCampaign(seed)`, `getStageDefinition(stageIndex)`, `createEventChoices(campaign, context)`, and `selectEvent(campaign, eventId)`.
- `createCampaign(seed)` returns `{ seed, stageIndex: 0, eventChoices: [], selectedEventId: null }`.
- `getStageDefinition(index)` returns `{ id, durationMs, levelId, kind }` for indexes 0-3 and `null` otherwise.
- `createEventChoices(campaign, context)` returns two distinct event objects with `{ id, kind, title, description }`.
- `selectEvent(campaign, eventId)` returns the selected event and clears `eventChoices`.

- [ ] **Step 1: Write failing campaign tests**

```js
test('campaign exposes four authored stages', () => {
  assert.deepEqual(STAGE_DEFINITIONS.map(({ durationMs }) => durationMs), [45_000, 60_000, 75_000, 90_000]);
  assert.equal(getStageDefinition(4), null);
});

test('same seed creates repeatable distinct event choices', () => {
  const first = createEventChoices(createCampaign(42), { stageIndex: 1, health: 3 });
  const second = createEventChoices(createCampaign(42), { stageIndex: 1, health: 3 });
  assert.deepEqual(first, second);
  assert.notEqual(first[0].id, first[1].id);
});
```

- [ ] **Step 2: Run `node --test tests/campaign.test.js` and confirm the missing exports fail.**
- [ ] **Step 3: Implement deterministic seeded selection.** Use a local integer PRNG inside `campaign.js`; never call `Math.random()` in the pure helpers. Filter recovery events when `health === maxHealth`, and fall back to `supply` when fewer than two valid events remain.

```js
export function createCampaign(seed = 0) {
  return { seed: seed >>> 0, stageIndex: 0, eventChoices: [], selectedEventId: null };
}

export function selectEvent(campaign, eventId) {
  const event = campaign.eventChoices.find((entry) => entry.id === eventId);
  if (!event) return null;
  campaign.selectedEventId = event.id;
  campaign.eventChoices = [];
  return event;
}
```
- [ ] **Step 4: Add campaign fields to state and transition helpers.** `createInitialState()` adds `campaign: createCampaign(0)`, `activeStageIndex: 0`, and `pendingEventChoices: []`. `startNewRun(state, seed = Date.now())` initializes the campaign. Add `startCampaignStage(state, stageIndex)` to set `remainingMs` from `STAGE_DEFINITIONS[stageIndex]` and reset `elapsedMs`.
- [ ] **Step 5: Connect stage completion in `create-game.js`.** Replace the hard-coded level-two completion branch with `startCampaignStage` and an event-choice phase; preserve the existing two-stage behavior until Tasks 2-4 provide stage content.
- [ ] **Step 6: Run `node --test tests/campaign.test.js tests/state.test.js` and `npm test`.** Expected: all existing tests pass and new campaign tests pass.
- [ ] **Step 7: Commit with `git add src/core/campaign.js src/core/constants.js src/core/state.js src/game/create-game.js tests/campaign.test.js tests/state.test.js && git commit -m "feat: add four-stage campaign state"`.

### Task 2: Active Skill Core, Input, and HUD

**Files:**
- Create: `src/core/active-skills.js`
- Modify: `src/platform/browser.js`
- Modify: `src/game/create-game.js`
- Modify: `src/render/renderer.js`
- Test: `tests/active-skills.test.js`
- Test: `tests/input.test.js`
- Test: `tests/renderer.test.js`

**Interfaces:**
- `ACTIVE_SKILL_DEFINITIONS` contains `dash`, `cottonGuard`, and `forestEcho`.
- `createActiveSkillState(id = 'dash')` returns `{ id, cooldownMs: 0, activeMs: 0 }`.
- `activateSkill(skillState, definition, context)` returns `{ accepted, effects }` and only accepts when `cooldownMs <= 0`.
- `updateActiveSkill(skillState, dtMs)` decreases cooldown and active time without going below zero.
- `input.consumeActiveSkill()` returns a boolean action, mapped to `Space` and a 44x44 touch button.

- [ ] **Step 1: Add failing tests for cooldown and effects.** Assert dash returns `invulnerableMs: 260` and `cooldownMs: 8_000`, cotton guard returns `shieldCharges: 2`, and a second activation during cooldown returns `accepted: false`.
- [ ] **Step 2: Run `node --test tests/active-skills.test.js tests/input.test.js` and confirm failure.**
- [ ] **Step 3: Implement pure active-skill definitions and update functions.** Keep effects as data; `world.js` will apply movement, shield, or clear-bullet effects later.

```js
export const ACTIVE_SKILL_DEFINITIONS = Object.freeze({
  dash: { id: 'dash', title: '兔兔冲刺', cooldownMs: 8_000, activeMs: 260, effect: 'dash' },
  cottonGuard: { id: 'cottonGuard', title: '棉花护体', cooldownMs: 12_000, activeMs: 2_200, effect: 'shield' },
  forestEcho: { id: 'forestEcho', title: '森林回响', cooldownMs: 16_000, activeMs: 0, effect: 'clear-and-damage' }
});

export function activateSkill(skill, definition, context) {
  if (!definition || skill.cooldownMs > 0) return { accepted: false, effects: [] };
  return {
    accepted: true,
    effects: [{ type: definition.effect, direction: context.direction ?? { x: 0, y: -1 } }],
    cooldownMs: definition.cooldownMs,
    activeMs: definition.activeMs
  };
}
```
- [ ] **Step 4: Extend browser input abstraction.** Add `consumeActiveSkill()` and map `Space` plus a touch hit target. Clear the pending action on pause, blur, pointer cancel, and non-playing phases.
- [ ] **Step 5: Connect skill activation in `create-game.js`.** Consume the action once per fixed update, call `activateSkill`, and route effects to the world. Announce accepted skills through the existing accessibility adapter.
- [ ] **Step 6: Render the skill button and cooldown.** Export `UI_RECTS.activeSkill` with a stable 52x52 rectangle; draw the icon, name, and remaining seconds without covering the joystick or HUD.
- [ ] **Step 7: Run focused tests, renderer tests, and `npm test`; commit with `git commit -m "feat: add one-slot active skill system"`.

### Task 3: Event Choices and Elite Enemies

**Files:**
- Create: `src/core/elites.js`
- Modify: `src/core/campaign.js`
- Modify: `src/core/world.js`
- Modify: `src/game/create-game.js`
- Modify: `src/render/renderer.js`
- Test: `tests/elites.test.js`
- Test: `tests/campaign.test.js`
- Test: `tests/world.test.js`

**Interfaces:**
- `ELITE_AFFIXES` contains `swift`, `armored`, `splitter`, and `summoner`.
- `createEliteSpec({ affix, x, y, levelId })` returns a complete enemy specification with one affix.
- `applyEliteAffix(enemy, affix)` mutates only the enemy's speed, hp, death behavior, or summon timer.
- `getEventReward(event, state)` returns a pure reward descriptor consumed by the game coordinator.

- [ ] **Step 1: Write failing tests for affix exclusivity, elite caps, and event rewards.** Assert one elite cannot contain two affixes, third-level stages can spawn at most one active elite, and a full-health supply event does not return recovery.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement `elites.js` with fixed specs.** Splitter and summoner must use the existing enemy pool; no new per-frame allocations in the hot loop.

```js
export const ELITE_AFFIXES = Object.freeze(['swift', 'armored', 'splitter', 'summoner']);

export function createEliteSpec({ affix, x, y, levelId }) {
  if (!ELITE_AFFIXES.includes(affix)) return null;
  return { kind: 'elite', affix, x, y, levelId, hp: 8, maxHp: 8, radius: 19, speed: 28, ageMs: 0 };
}
```
- [ ] **Step 4: Add event-choice phase to the state machine.** Pause combat while the two cards are visible; selecting a card applies the reward once and starts the next stage.
- [ ] **Step 5: Integrate elite generation in stage three.** Add one warning event before an elite enters, and release all elite-owned references during `resetWorld`.
- [ ] **Step 6: Render event cards, elite warnings, and reward feedback.** Keep card hit areas at least 44px and cap event text at two lines.
- [ ] **Step 7: Run `node --test tests/campaign.test.js tests/elites.test.js tests/world.test.js` and `npm test`; commit with `git commit -m "feat: add event choices and elite enemies"`.

### Task 4: Two-Phase Boss and Fourth Stage

**Files:**
- Create: `src/core/bosses.js`
- Modify: `src/core/campaign.js`
- Modify: `src/core/patterns.js`
- Modify: `src/core/world.js`
- Modify: `src/game/create-game.js`
- Modify: `src/render/renderer.js`
- Test: `tests/bosses.test.js`
- Test: `tests/patterns.test.js`
- Test: `tests/world.test.js`

**Interfaces:**
- `BOSS_DEFINITION` returns phase durations, hp thresholds, and attack channels.
- `createBossState()` returns `{ phase: 1, hp, maxHp, attackIndex: 0, warning: null }`.
- `getBossAttackSpec({ phase, attackIndex, seed })` returns a deterministic ring, fan, or spiral specification.
- `advanceBossPhase(boss, remainingHpRatio)` returns the new phase exactly once at the threshold.

- [ ] **Step 1: Write failing tests for phase boundaries and deterministic attacks.** Assert phase two starts once at 50% hp, the same seed and attack index produce the same spec, and every attack has a warning window.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement fixed boss definitions and attack specs.** Reuse `makeRing`, `makeFan`, and `makeSpiralBullet`; add no new collision model.

```js
export function createBossState() {
  return { phase: 1, hp: 120, maxHp: 120, attackIndex: 0, warning: null };
}

export function advanceBossPhase(boss, remainingHpRatio) {
  if (boss.phase === 1 && remainingHpRatio <= 0.5) {
    boss.phase = 2;
    boss.attackIndex = 0;
    return true;
  }
  return false;
}
```
- [ ] **Step 4: Integrate the fourth stage into `world.js`.** Spawn the boss after the opening delay, update its state on fixed steps, and emit `boss-phase`, `boss-warning`, `boss-defeated`, and `level-complete` events.
- [ ] **Step 5: Render the boss health bar, phase warning, and final reward.** Preserve the existing HUD bounds and reduced-motion behavior.
- [ ] **Step 6: Run boss, pattern, world, and full tests; commit with `git commit -m "feat: add two-phase final boss"`.

### Task 5: Local Unlocks, Challenges, and Results

**Files:**
- Create: `src/core/progression.js`
- Modify: `src/platform/browser.js`
- Modify: `src/core/results.js`
- Modify: `src/game/create-game.js`
- Modify: `src/render/renderer.js`
- Test: `tests/progression.test.js`
- Test: `tests/results.test.js`
- Test: `tests/share-browser.test.js`

**Interfaces:**
- `createProgressionState()` returns default unlocks, `seenEnemies`, `completedChallenges`, and `highestStage`.
- `applyProgressEvent(progress, event)` is idempotent and returns a new progression state.
- `evaluateChallenge(challengeId, runSummary)` returns a boolean without reading browser state.
- `serializeProgression(progress)` and `parseProgression(value)` implement versioned storage and safe fallback.
- Browser storage exposes `loadProgression()` and `saveProgression(progress)` without changing existing settings behavior.

- [ ] **Step 1: Write failing tests for unlock idempotence, challenge boundaries, corrupted JSON, and version mismatch.**
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement pure progression helpers and five fixed challenge definitions.** Rewards unlock `cottonGuard`, `forestEcho`, enemy/Boss entries, or cosmetic IDs; do not add permanent damage multipliers.

```js
export function createProgressionState() {
  return {
    version: 1,
    unlockedSkills: ['dash'],
    seenEnemies: [],
    completedChallenges: [],
    highestStage: 0,
    cosmetics: []
  };
}

export function applyProgressEvent(progress, event) {
  const next = structuredClone(progress);
  if (event.type === 'unlock-skill' && !next.unlockedSkills.includes(event.id)) next.unlockedSkills.push(event.id);
  if (event.type === 'challenge-complete' && !next.completedChallenges.includes(event.id)) next.completedChallenges.push(event.id);
  return next;
}
```
- [ ] **Step 4: Add a versioned browser storage key with try/catch fallback.** A failed read returns `createProgressionState()` and a failed write is ignored.

```js
function loadProgression() {
  try {
    return parseProgression(localStorage.getItem(PROGRESSION_KEY));
  } catch {
    return createProgressionState();
  }
}
```
- [ ] **Step 5: Record progress only after a completed result, never every frame.** Prevent duplicate challenge rewards when a result screen is revisited.
- [ ] **Step 6: Add result-page challenge summary and a compact collection view.** Use existing result layout limits and share only truthful run data.
- [ ] **Step 7: Run progression, results, sharing, and full tests; commit with `git commit -m "feat: add local progression and challenges"`.

### Task 6: Browser Integration, Accessibility, and Final Verification

**Files:**
- Modify: `src/game/create-game.js`
- Modify: `src/platform/browser.js`
- Modify: `src/render/renderer.js`
- Modify: `README.md`
- Test: `tests/renderer.test.js`
- Test: `tests/renderer-smoke.test.js`
- Test: `tests/input.test.js`

**Interfaces:**
- `debug.report` includes `stageIndex`, `activeSkillId`, `activeSkillCooldownMs`, `eventChoiceCount`, `eliteCount`, and `bossPhase`.
- `renderer.render()` accepts the existing state shape plus campaign, skill, event, elite, and Boss fields without direct browser access.

- [ ] **Step 1: Add failing geometry tests.** Assert the skill button, event cards, Boss health bar, and existing settings/share buttons do not overlap at 360x640 logical coordinates.
- [ ] **Step 2: Run focused renderer/input tests and confirm failures.**
- [ ] **Step 3: Wire all event handlers through the existing input abstraction.** Ensure pause, blur, visibility change, pointer cancel, and result transitions clear active skill input and joystick state.
- [ ] **Step 4: Add accessible labels and announcements.** Announce stage changes, event choices, active-skill readiness, Boss phase changes, and challenge completion without exposing debug text in production.
- [ ] **Step 5: Update README controls, four-stage flow, active skill, local progression, and limitations.**
- [ ] **Step 6: Run `node --check` on changed modules, `npm test`, `git diff --check`, and the local server smoke test with `npm run dev -- --host 0.0.0.0 --port 4173`. Verify `/` returns HTTP 200.
- [ ] **Step 7: Perform browser checks at 360x640, 390x844, and 1280x800. Verify a complete four-stage run, active skill keyboard/touch input, event selection, Boss phase transition, retry, refresh persistence, and storage fallback.
- [ ] **Step 8: Commit the integration and documentation with `git commit -m "feat: ship four-stage replayability upgrade"`.

## Self-Review

- Campaign, four durations, event seed, event fallback, stage transition, and result flow are covered by Tasks 1 and 3.
- Active skill definitions, cooldown, keyboard/touch input, rendering, and accessibility are covered by Tasks 2 and 6.
- Elite affixes, pool limits, warnings, and stage-three behavior are covered by Task 3.
- Boss phases, deterministic attacks, warnings, health bar, and final completion are covered by Task 4.
- Local persistence, corrupted data fallback, idempotent challenges, and result integration are covered by Task 5.
- Performance, fixed timestep, object pooling, viewport geometry, and browser lifecycle constraints are repeated in Global Constraints and Task 6.
- No placeholders or undefined cross-task names remain; every later task consumes interfaces produced by an earlier task.
