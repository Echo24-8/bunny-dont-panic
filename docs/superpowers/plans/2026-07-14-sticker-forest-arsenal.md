# Sticker Forest Arsenal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the game under the approved scrapbook-sticker forest art direction and add five automatic weapons with three retained weapon slots and mixed upgrade choices.

**Architecture:** Keep the existing state machine, fixed timestep, object pools, and Canvas renderer. Add weapon definitions in a focused core module, store weapon slots inside the retained build with explicit deep cloning, and let `world.js` own weapon runtimes and collision order. Keep six image manifest entries but replace them with locally generated original sticker assets; draw small weapon icons directly in Canvas.

**Tech Stack:** Native ES modules, Canvas 2D, PowerShell/System.Drawing asset generation, Node built-in test runner, dependency-free static server.

## Global Constraints

- Logical canvas remains exactly 360×640 with device pixel ratio capped at 2.
- Level one remains 30 seconds; level two remains 60 seconds with the authored extreme bullet patterns unchanged.
- Enemy bullet pool remains capped at 450 and player bullet pool remains capped at 128.
- No framework, game engine, third-party runtime dependency, long-term unlock system, or WeChat entry point.
- Touch controls remain the responsive lower-half elastic-follow joystick; keyboard controls remain WASD and arrow keys.
- Second-level retry restores three hearts, clears current XP and entities, and retains all selected weapon and ability progression.

---

### Task 1: Weapon Data Model and Upgrade Pool

**Files:**
- Create: `src/core/weapons.js`
- Modify: `src/core/state.js`
- Modify: `src/core/upgrades.js`
- Modify: `src/core/results.js`
- Test: `tests/weapons.test.js`
- Test: `tests/state.test.js`
- Test: `tests/upgrades.test.js`
- Test: `tests/results.test.js`

**Interfaces:**
- Produces: `WEAPON_IDS`, `WEAPON_DEFINITIONS`, `MAX_WEAPON_SLOTS`, `MAX_WEAPON_LEVEL`, `createDefaultWeaponSlots()`, `cloneWeaponSlots(slots)`, `getWeaponSlot(build, id)`, `getWeaponLevel(build, id)`, `deriveWeaponStats(build, id)`.
- Preserves: `getUpgradeChoices`, `getUpgradePreview`, `applyUpgrade`, `derivePlayerStats`, `createResultSummary` public names.

- [ ] **Step 1: Write failing state and weapon tests**

```js
const state = startNewRun(createInitialState());
assert.deepEqual(state.build.weaponSlots, [{ id: 'carrot', level: 1 }, null, null]);
assert.equal('splitShot' in state.build, false);
assert.equal('pierce' in state.build, false);
assert.equal(deriveWeaponStats(state.build, 'dandelion').projectileCount, 0);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/weapons.test.js tests/state.test.js tests/upgrades.test.js tests/results.test.js`

Expected: FAIL because `src/core/weapons.js` and `weaponSlots` do not exist.

- [ ] **Step 3: Implement weapon definitions and deep-cloned retained state**

```js
export const WEAPON_IDS = Object.freeze(['carrot', 'dandelion', 'boomerang', 'bubble', 'lightning']);
export const MAX_WEAPON_SLOTS = 3;
export const MAX_WEAPON_LEVEL = 3;

export function createDefaultWeaponSlots() {
  return [{ id: 'carrot', level: 1 }, null, null];
}

export function cloneWeaponSlots(slots = []) {
  return Array.from({ length: MAX_WEAPON_SLOTS }, (_, index) => slots[index] ? { ...slots[index] } : null);
}
```

`createBuild()` returns only `rapidFire`, `moveSpeed`, `shield`, and `weaponSlots`. `retryLevelTwoState()` retains `cloneBuild(state.build)`, while `startNewRun()` creates a new default build.

- [ ] **Step 4: Implement mixed, unique upgrade candidates**

```js
export function getUpgradeChoices({ build, health, maxHealth = 3, rng = Math.random, count = 3 }) {
  const candidates = getEligibleUpgradeDefinitions({ build, health, maxHealth });
  const forced = build.weaponSlots.filter(Boolean).length === 1
    ? pickOne(candidates.filter((entry) => entry.category === 'weapon' && getWeaponLevel(build, entry.id) === 0), rng)
    : [];
  return sampleUnique([...forced, ...candidates.filter((entry) => !forced.some((item) => item.id === entry.id))], count, rng);
}
```

Weapon selection fills the first `null` slot at level 1; selecting an owned weapon increments that slot to a maximum of 3. Three full slots exclude unowned weapons. Ability candidates are `rapidFire`, `moveSpeed`, `shield`, and conditional `heart`.

- [ ] **Step 5: Update build previews and result summaries**

Weapon previews use `解锁` for level zero and `Lv N → N+1` for upgrades. Result snapshots clone `weaponSlots`, and summaries list weapon names before ability levels.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/weapons.test.js tests/state.test.js tests/upgrades.test.js tests/results.test.js`

Expected: all focused tests PASS.

- [ ] **Step 7: Commit the data model**

```bash
git add src/core/weapons.js src/core/state.js src/core/upgrades.js src/core/results.js tests/weapons.test.js tests/state.test.js tests/upgrades.test.js tests/results.test.js
git commit -m "feat: add retained three-slot weapon arsenal"
```

### Task 2: Five Automatic Weapon Runtimes

**Files:**
- Modify: `src/core/constants.js`
- Modify: `src/core/world.js`
- Modify: `src/game/create-game.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: `deriveWeaponStats(build, id)` and `getWeaponLevel(build, id)` from `src/core/weapons.js`.
- Produces: `world.weaponCooldownMs`, `world.orbitals`, `world.weaponEffects`, `world.metrics.droppedPlayerBullets`.

- [ ] **Step 1: Write failing world tests for independent cooldowns and pool safety**

```js
const world = createWorld(() => 0.5);
assert.deepEqual(Object.keys(world.weaponCooldownMs), WEAPON_IDS);
assert.equal(world.orbitals.items.length, 3);
assert.equal(world.weaponEffects.items.length, 24);
```

Add tests that equip each weapon, advance the fixed timestep, and assert its projectile/effect kind; verify boomerangs do not damage the same enemy on adjacent frames, bubbles intercept enemy bullets before player damage, lightning chooses distinct targets, and a full player pool increments `droppedPlayerBullets` without exceeding 128.

- [ ] **Step 2: Run world tests and verify failure**

Run: `node --test tests/world.test.js`

Expected: FAIL because per-weapon runtimes and new pools do not exist.

- [ ] **Step 3: Add explicit pooled projectile initialization**

```js
function acquirePlayerProjectile(world, specification) {
  const projectile = world.playerBullets.acquire({
    weaponId: 'carrot', mode: 'linear', phase: 'outbound', damage: 1,
    pierceLeft: 0, lastHitPoolIndex: -1, lastHitAgeMs: -Infinity,
    maxAgeMs: 2200, rotation: 0, ageMs: 0, ...specification
  });
  if (!projectile) world.metrics.droppedPlayerBullets += 1;
  return projectile;
}
```

Reset all cooldowns, orbitals, effects, and metrics in `resetWorld()`.

- [ ] **Step 4: Implement weapon firing and motion**

`updateWeapons()` iterates equipped slots and independently fires carrot, dandelion, boomerang, bubble, and lightning using `deriveWeaponStats()`. Carrot and dandelion target the nearest enemy or fire upward; boomerang switches to a return phase; bubbles synchronize one orbital per level; lightning directly damages 2/3/4 distinct targets and writes short-lived line effects.

- [ ] **Step 5: Enforce collision order and reusable damage handling**

```js
function damageEnemy(world, enemy, damage, x = enemy.x, y = enemy.y) {
  enemy.hp -= damage;
  spawnParticleBurst(world, x, y, '#f4d45f', 3);
  if (enemy.hp > 0) return false;
  spawnPickup(world, enemy);
  spawnParticleBurst(world, enemy.x, enemy.y, '#f4d45f', 8);
  world.enemies.release(enemy);
  return true;
}
```

Resolve player projectiles, then bubble interception, then player damage. Keep all enemy bullet-pattern code unchanged.

- [ ] **Step 6: Run world and full tests**

Run: `node --test tests/world.test.js && npm test`

Expected: all tests PASS; level-one stationary survival and level-two stationary failure remain valid.

- [ ] **Step 7: Commit weapon runtimes**

```bash
git add src/core/constants.js src/core/world.js src/game/create-game.js tests/world.test.js
git commit -m "feat: implement five automatic weapon patterns"
```

### Task 3: Original Sticker Art Assets

**Files:**
- Modify: `tools/generate-art.ps1`
- Modify: `src/assets/manifest.js`
- Create: `assets/images/bunny-sticker.png`
- Create: `assets/images/enemy-cloud-bear.png`
- Create: `assets/images/enemy-acorn-mouse.png`
- Create: `assets/images/enemy-star-chick.png`
- Create: `assets/images/notebook-forest-day.png`
- Create: `assets/images/notebook-forest-storm.png`

**Interfaces:**
- Preserves manifest IDs: `background1`, `background2`, `bunny`, `puff`, `bell`, `star`.

- [ ] **Step 1: Rewrite deterministic drawing helpers**

Add reusable paper grid, torn-paper polygon, tape, sticker outline, blush face, and centered character helpers. All transparent character pixels must fit inside stable 8% margins and contain no ground shadow.

- [ ] **Step 2: Generate six new assets**

Run: `npm run generate:art`

Expected: six new filenames are written under `assets/images/`; backgrounds are 1080×1920 RGB and characters are 512×512 or 384×384 ARGB.

- [ ] **Step 3: Update the manifest without adding asset IDs**

```js
export const IMAGE_MANIFEST = Object.freeze({
  background1: './assets/images/notebook-forest-day.png',
  background2: './assets/images/notebook-forest-storm.png',
  bunny: './assets/images/bunny-sticker.png',
  puff: './assets/images/enemy-cloud-bear.png',
  bell: './assets/images/enemy-acorn-mouse.png',
  star: './assets/images/enemy-star-chick.png'
});
```

- [ ] **Step 4: Validate dimensions, transparency, and visual centering**

Use `System.Drawing.Bitmap` to assert exact dimensions and alpha-capable pixel formats. Inspect a contact sheet and confirm each enemy remains readable around 40px and backgrounds avoid coral-red circular details.

- [ ] **Step 5: Commit the art pass**

```bash
git add tools/generate-art.ps1 src/assets/manifest.js assets/images
git commit -m "feat: replace art with scrapbook sticker forest assets"
```

### Task 4: Sticker HUD, Upgrade Cards, and Weapon Effects

**Files:**
- Modify: `src/render/renderer.js`
- Modify: `styles.css`
- Test: `tests/renderer.test.js`
- Test: `tests/results.test.js`

**Interfaces:**
- Consumes: weapon candidate `category`, weapon slots, projectile `weaponId`, orbitals, and weapon effects.
- Produces: `drawWeaponIcon(ctx, weaponId, x, y, size)` and a stable three-slot HUD layout.

- [ ] **Step 1: Add renderer geometry tests**

Assert all result and upgrade targets remain at least 44×44 and non-overlapping. Add a weapon-slot rectangle contract that stays below the XP bar and above the gameplay region.

- [ ] **Step 2: Run renderer tests and verify failure**

Run: `node --test tests/renderer.test.js tests/results.test.js`

Expected: FAIL because weapon slot geometry and weapon-aware summaries do not exist.

- [ ] **Step 3: Add a single Canvas weapon icon system**

Implement `drawWeaponIcon(ctx, weaponId, x, y, size)` with a white sticker outline and stable icon geometry for carrot, dandelion, boomerang, bubble, and lightning. Reuse it in HUD slots and upgrade cards.

- [ ] **Step 4: Redraw HUD and overlays with approved tokens**

Use paper white, ink green, mint, coral, lemon, sky blue, and chestnut tokens. Add three 40px weapon slots with dashed empty states and level labels. Upgrade cards display category labels (`新武器`, `武器升级`, `辅助能力`, `立即生效`) and remain fully readable inside 296×92 rectangles.

- [ ] **Step 5: Draw weapon-specific projectiles and effects**

Render carrots, dandelion seeds, rotating star boomerangs, translucent honey bubbles, and short cloud-lightning chains. Enemy bullets remain coral circles with white outlines and use batched paths.

- [ ] **Step 6: Update result, settings, menu, and share composition**

Use taped-paper panels and sticker buttons without nesting cards. Ensure result summaries prioritize weapon names and the menu rabbit remains the first visual signal.

- [ ] **Step 7: Run focused and full tests**

Run: `node --test tests/renderer.test.js tests/results.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit the UI pass**

```bash
git add src/render/renderer.js styles.css tests/renderer.test.js tests/results.test.js
git commit -m "feat: apply sticker forest UI and weapon presentation"
```

### Task 5: Browser Verification and Final Review

**Files:**
- Modify: `README.md`
- Modify: only files directly implicated by failed verification.

**Interfaces:**
- Verifies the public `createGame()` API and browser prototype behavior; creates no new runtime API.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests PASS with no skipped tests.

- [ ] **Step 2: Start the static server**

Run: `npm run dev`

Expected: server listens on `0.0.0.0:4173` or the next available port and prints desktop and LAN URLs.

- [ ] **Step 3: Verify desktop and mobile viewports**

At 1280×800, 390×844, and 360×640, confirm the canvas is nonblank; HUD, weapon slots, upgrade text, joystick, and result buttons do not overlap; the lower-half joystick follows immediately without startup lag.

- [ ] **Step 4: Verify gameplay contracts**

Use debug controls to trigger upgrades and level transition. Confirm all five weapon cards can appear, three slots cap correctly, distinct effects render, level-one remains easy, standing still in level two fails, and retry retains weapon levels while clearing current XP.

- [ ] **Step 5: Stress and lifecycle verification**

Render 450 hostile bullets with the debug stress action and verify at least 55 FPS on the available Chromium environment. Hide and restore the page and confirm no elapsed-time jump.

- [ ] **Step 6: Update README and commit final verification fixes**

Document the five weapons and unchanged launch commands. Run `npm test` once more, then commit only verification-driven changes.

```bash
git add README.md
git commit -m "docs: describe sticker arsenal prototype"
```

