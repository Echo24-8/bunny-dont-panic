import { LEVELS, PHASES } from '../core/constants.js';
import { activateSkill, getActiveSkillDefinition, updateActiveSkill } from '../core/active-skills.js';
import { createEventChoices, getEventReward, selectEvent } from '../core/campaign.js';
import {
  beginLevelTwoTransition,
  createInitialState,
  recordLevelTwoResult,
  retryLevelTwoState,
  startCampaignStage,
  startLevelTwo,
  startNewRun as resetRunState
} from '../core/state.js';
import { createResultSummary, createSharePayload } from '../core/results.js';
import { applyProgressEvent, evaluateChallenge } from '../core/progression.js';
import { applyUpgrade, getUpgradeChoices, getUpgradePreview, getUpgradeRoleLabel, upgradeThreshold } from '../core/upgrades.js';
import { applyActiveSkillEffects, createWorld, resetWorld, updateWorld } from '../core/world.js';
import { createRenderer, getEventCardRect, getUpgradeCardRect, hitRect, UI_RECTS } from '../render/renderer.js';

const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;

export function createGame({ canvas, platform, assets, rng = Math.random }) {
  const state = createInitialState();
  const world = createWorld(rng);
  const settings = { ...platform.settings };
  const renderer = createRenderer(canvas, assets, {
    reducedMotion: platform.preferences.reducedMotion,
    dpr: platform.viewport.devicePixelRatio()
  });
  let choices = [];
  let running = true;
  let animationFrameId = 0;
  let lastFrameTime = null;
  let accumulatorMs = 0;
  let transitionMusicStarted = false;
  let pausedBeforeSettings = false;
  let fps = 60;
  let fpsFrames = 0;
  let fpsWindowStart = performance.now();
  let lastDebugReport = 0;
  let shareStatus = '';
  let grazeCount = 0;
  let skillUseCount = 0;
  let damageTakenCount = 0;
  let progressRecorded = false;

  state.phase = PHASES.MENU;
  state.progression = platform.storage.loadProgression?.();
  platform.input.setJoystickEnabled(false);
  platform.a11y.announce('游戏已加载。选择开始冒险。');

  function saveSettings() {
    platform.storage.saveSettings(settings);
    platform.audio.setEnabled(settings);
  }

  function setPlayingInput() {
    platform.input.setJoystickEnabled(state.phase === PHASES.PLAYING && !state.paused && !state.settingsOpen);
  }

  function playMusic(id) {
    platform.audio.play(id, { loop: true, volume: id === 'music1' ? 0.42 : 0.48 });
  }

  function startNewRun() {
    platform.sharing.clearResult();
    shareStatus = '';
    grazeCount = 0;
    skillUseCount = 0;
    damageTakenCount = 0;
    progressRecorded = false;
    resetRunState(state);
    const unlockedSkills = state.progression?.unlockedSkills ?? ['dash'];
    state.activeSkill.id = unlockedSkills[unlockedSkills.length - 1] ?? 'dash';
    resetWorld(world);
    world.runEliteDefeated = false;
    choices = [];
    transitionMusicStarted = false;
    platform.audio.stop();
    playMusic('music1');
    platform.a11y.announce('第一关开始，生存四十五秒。主动技能已就绪。');
    setPlayingInput();
  }

  function retryLevel2() {
    platform.sharing.clearResult();
    shareStatus = '';
    grazeCount = 0;
    retryLevelTwoState(state);
    resetWorld(world);
    choices = [];
    platform.audio.stop();
    playMusic('music2');
    platform.a11y.announce('第二关重新开始，能力已保留。');
    setPlayingInput();
  }

  function returnToMenu() {
    platform.sharing.clearResult();
    shareStatus = '';
    state.phase = PHASES.MENU;
    state.result = null;
    state.settingsOpen = false;
    state.paused = false;
    choices = [];
    resetWorld(world);
    platform.audio.stop();
    platform.a11y.announce('返回首页。');
    setPlayingInput();
  }

  function openSettings() {
    pausedBeforeSettings = state.paused;
    state.settingsOpen = true;
    state.paused = true;
    platform.audio.pause();
    setPlayingInput();
    platform.a11y.announce('声音设置已打开。');
  }

  function closeSettings() {
    state.settingsOpen = false;
    state.paused = pausedBeforeSettings;
    if (!state.paused) platform.audio.resume();
    setPlayingInput();
    platform.a11y.announce('声音设置已关闭。');
  }

  function handleSettingsTap(point) {
    if (hitRect(point, UI_RECTS.settingsMusic)) {
      settings.music = !settings.music;
      saveSettings();
      platform.a11y.announce(`音乐已${settings.music ? '开启' : '关闭'}。`);
    } else if (hitRect(point, UI_RECTS.settingsSfx)) {
      settings.sfx = !settings.sfx;
      saveSettings();
      platform.a11y.announce(`音效已${settings.sfx ? '开启' : '关闭'}。`);
    } else if (hitRect(point, UI_RECTS.settingsClose)) closeSettings();
  }

  function chooseUpgrade(index) {
    const choice = choices[index];
    if (!choice || !applyUpgrade(state, choice.id)) return;
    platform.audio.play('upgrade', { volume: 0.72 });
    choices = [];
    state.phase = PHASES.PLAYING;
    platform.a11y.announce(`已选择${choice.title}。`);
    setPlayingInput();
  }

  function chooseCampaignEvent(index) {
    const choice = state.pendingEventChoices[index];
    if (!choice) return;
    const selected = selectEvent(state.campaign, choice.id);
    if (!selected) return;
    const reward = getEventReward(selected, state);
    state.pendingEventChoices = [];
    const nextStageIndex = Math.min(3, state.activeStageIndex + 1);
    startCampaignStage(state, nextStageIndex);
    if (reward?.type === 'heal') state.health = Math.min(state.maxHealth, state.health + reward.amount);
    else if (reward?.type === 'shield') state.activeShieldCharges = reward.charges;
    else if (reward?.type === 'skill-cooldown') state.activeSkill.cooldownReductionMs = reward.amount;
    else if (reward?.type === 'xp') state.xp += reward.amount;
    resetWorld(world);
    platform.a11y.announce(`已选择${selected.title}，进入第${nextStageIndex + 1}关。`);
    setPlayingInput();
  }

  function activateCurrentSkill() {
    if (state.phase !== PHASES.PLAYING || state.paused || state.settingsOpen) return false;
    const skillState = state.activeSkill;
    const definition = getActiveSkillDefinition(skillState?.id);
    const result = activateSkill(skillState, definition, { direction: platform.input.readVector() });
    if (!result.accepted) return false;
    skillUseCount += 1;
    handleWorldEvents(applyActiveSkillEffects(world, state, result.effects));
    platform.audio.play('shield', { volume: 0.42 });
    platform.haptics.pulse(12);
    platform.a11y.announce(`${definition.title}已释放。`);
    return true;
  }

  function handleTap(point) {
    platform.audio.unlock();
    if (state.settingsOpen) {
      handleSettingsTap(point);
      return;
    }
    if ((state.phase === PHASES.MENU || state.phase === PHASES.PLAYING) && hitRect(point, UI_RECTS.settings)) {
      openSettings();
      return;
    }
    if (state.phase === PHASES.PLAYING && hitRect(point, UI_RECTS.activeSkill)) {
      activateCurrentSkill();
      return;
    }
    if (state.phase === PHASES.MENU && hitRect(point, UI_RECTS.start)) startNewRun();
    else if (state.phase === PHASES.UPGRADE) {
      choices.forEach((_, index) => {
        if (hitRect(point, getUpgradeCardRect(index))) chooseUpgrade(index);
      });
    } else if (state.phase === PHASES.EVENT) {
      state.pendingEventChoices.forEach((_, index) => {
        if (hitRect(point, getEventCardRect(index))) chooseCampaignEvent(index);
      });
    } else if (state.phase === PHASES.RESULT) {
      if (hitRect(point, UI_RECTS.retry)) {
        if (state.result?.kind === 'success') startNewRun(); else retryLevel2();
      } else if (hitRect(point, UI_RECTS.menu)) returnToMenu();
    }
  }

  function handleDiscreteInput() {
    for (const tap of platform.input.consumeTaps()) handleTap(tap);
    if (platform.input.consumeActiveSkill?.()) activateCurrentSkill();
    const selection = platform.input.consumeSelection();
    if (selection !== null && state.phase === PHASES.UPGRADE) chooseUpgrade(selection);
    if (selection !== null && state.phase === PHASES.EVENT) chooseCampaignEvent(selection);
    const debugAction = platform.debug.enabled ? platform.input.consumeDebugAction() : null;
    if (debugAction === 'next-level' && state.phase === PHASES.PLAYING) {
      if (state.levelId === LEVELS.ONE) finishLevel(LEVELS.ONE);
      else state.remainingMs = Math.min(state.remainingMs, 120);
    }
    if (debugAction === 'upgrade' && state.phase === PHASES.PLAYING) state.xp = upgradeThreshold(state.upgradeCount);
    if (debugAction === 'stress-bullets' && state.phase === PHASES.PLAYING) {
      world.enemyBullets.clear();
      for (let index = 0; index < 450; index += 1) {
        world.enemyBullets.acquire({
          x: 6 + (index % 30) * 12,
          y: 92 + Math.floor(index / 30) * 12,
          vx: 0,
          vy: 0,
          radius: 4,
          ageMs: 0,
          grazed: false
        });
      }
    }
    if (!platform.input.consumeConfirm()) return;
    platform.audio.unlock();
    if (state.settingsOpen) closeSettings();
    else if (state.phase === PHASES.MENU) startNewRun();
    else if (state.phase === PHASES.RESULT) {
      if (state.result?.kind === 'success') startNewRun(); else retryLevel2();
    }
  }

  function finishLevel(levelId) {
    resetWorld(world);
    const stageIndex = state.activeStageIndex ?? Math.max(0, levelId - 1);
    if (stageIndex === 0) {
      beginLevelTwoTransition(state);
      transitionMusicStarted = false;
      platform.audio.stop();
      platform.input.setJoystickEnabled(false);
      platform.a11y.announce('第一关完成。第二关难度略有提升。');
    } else if (stageIndex >= 3) {
      showLevelTwoResult('success', state.elapsedMs);
      platform.audio.stop();
      platform.audio.play('success', { volume: 0.8 });
      platform.a11y.announce('挑战成功，四关完成。');
    } else {
      state.pendingEventChoices = createEventChoices(state.campaign, {
        stageIndex,
        health: state.health,
        maxHealth: state.maxHealth
      });
      state.phase = PHASES.EVENT;
      platform.input.setJoystickEnabled(false);
      platform.a11y.announce('关卡完成，请选择一张事件卡。');
    }
  }

  function showLevelTwoResult(kind, survivalMs) {
    state.phase = PHASES.RESULT;
    recordLevelTwoResult(state, kind, survivalMs);
    if (kind === 'success' && !progressRecorded) {
      const runSummary = {
        kind,
        stageIndex: state.activeStageIndex,
        skillUses: skillUseCount,
        damageTaken: damageTakenCount,
        eliteDefeated: world.runEliteDefeated
      };
      let nextProgress = state.progression ?? platform.storage.loadProgression?.();
      for (const challengeId of ['firstClear', 'eliteHunter', 'guardianBreaker', 'skillful', 'noDamage']) {
        if (evaluateChallenge(challengeId, runSummary)) {
          nextProgress = applyProgressEvent(nextProgress, { type: 'challenge-complete', id: challengeId });
          if (challengeId === 'firstClear') nextProgress = applyProgressEvent(nextProgress, { type: 'unlock-skill', id: 'cottonGuard' });
          if (challengeId === 'guardianBreaker') nextProgress = applyProgressEvent(nextProgress, { type: 'unlock-skill', id: 'forestEcho' });
        }
      }
      nextProgress = applyProgressEvent(nextProgress, { type: 'stage-complete', stageIndex: state.activeStageIndex });
      state.progression = nextProgress;
      platform.storage.saveProgression?.(nextProgress);
      progressRecorded = true;
    }
    choices = [];
    shareStatus = '';
    const summary = createResultSummary(state);
    const payload = createSharePayload(summary, platform.sharing.currentUrl());
    platform.sharing.presentResult({
      rect: UI_RECTS.share,
      payload,
      imagePromise: renderer.createShareImage(summary),
      onStatus(status) {
        shareStatus = status;
        platform.a11y.announce({
          shared: '战绩已分享。',
          cancelled: '已取消分享。',
          copied: '战绩文字已复制。',
          downloaded: '战绩图已保存。',
          'copied-and-downloaded': '战绩文字已复制，战绩图已保存。',
          failed: '分享失败，请重试。'
        }[status] ?? '分享状态已更新。');
      }
    });
    platform.input.setJoystickEnabled(false);
  }

  function handleWorldEvents(events) {
    for (const event of events) {
      if (event.type === 'sfx') platform.audio.play(event.id, { volume: event.volume });
      else if (event.type === 'shielded') {
        platform.audio.play('shield', { volume: 0.72 });
        platform.haptics.pulse(10);
      } else if (event.type === 'damaged') {
        damageTakenCount += 1;
        platform.audio.play('hurt', { volume: 0.8 });
        platform.haptics.pulse(22);
      } else if (event.type === 'grazed') {
        grazeCount += 1;
      } else if (event.type === 'pattern-warning') {
        platform.a11y.announce('弹幕即将变化。');
      } else if (event.type === 'elite-warning') {
        platform.audio.play('warning', { volume: 0.72 });
        platform.haptics.pulse(18);
        platform.a11y.announce('精英敌人即将出现。');
      } else if (event.type === 'elite-spawned') {
        platform.a11y.announce(`精英敌人出现：${event.affix}。`);
      } else if (event.type === 'boss-spawned') {
        platform.a11y.announce('森林守护者出现。');
      } else if (event.type === 'boss-warning') {
        platform.a11y.announce('Boss 攻击即将到来。');
      } else if (event.type === 'boss-phase') {
        platform.audio.play('warning', { volume: 0.68 });
        platform.a11y.announce(`Boss 进入第 ${event.phase} 阶段。`);
      } else if (event.type === 'boss-defeated') {
        platform.audio.play('success', { volume: 0.82 });
        platform.a11y.announce('森林守护者已击败。');
      } else if (event.type === 'defeated') {
        platform.audio.play('hurt', { volume: 0.85 });
        platform.haptics.pulse(30);
        showLevelTwoResult('defeat', state.elapsedMs);
        platform.audio.stop();
        platform.a11y.announce(`挑战失败，存活${(state.elapsedMs / 1000).toFixed(1)}秒。`);
      } else if (event.type === 'upgrade-ready' && state.phase === PHASES.PLAYING) {
        choices = getUpgradeChoices({ build: state.build, health: state.health, maxHealth: state.maxHealth, rng })
          .map((choice) => ({
            ...choice,
            preview: getUpgradePreview(state, choice.id),
            roleLabel: getUpgradeRoleLabel(choice.id)
          }));
        if (choices.length > 0) {
          state.phase = PHASES.UPGRADE;
          platform.input.setJoystickEnabled(false);
          platform.a11y.announce('升级，请选择一个武器或能力。');
        }
      } else if (event.type === 'level-complete') finishLevel(event.levelId);
    }
  }

  function updateFixedStep(dtMs) {
    if (state.paused || state.settingsOpen) return;
    if (state.phase === PHASES.TRANSITION) {
      state.transitionMs = Math.max(0, state.transitionMs - dtMs);
      if (!transitionMusicStarted && state.transitionMs <= 700) {
        transitionMusicStarted = true;
        playMusic('music2');
      }
      if (state.transitionMs <= 0) {
        startCampaignStage(state, 1);
        state.level2Attempt = 1;
        state.xp = 0;
        resetWorld(world);
        setPlayingInput();
        platform.a11y.announce('第二关开始，生存六十秒。');
      }
      return;
    }
    if (state.phase !== PHASES.PLAYING) return;
    const skillWasActive = state.activeSkill?.activeMs > 0;
    updateActiveSkill(state.activeSkill, dtMs);
    if (skillWasActive && state.activeSkill.activeMs <= 0) state.activeShieldCharges = 0;
    const input = platform.input.readVector();
    handleWorldEvents(updateWorld({ world, state, input, dtMs }));
  }

  function updateFps(now) {
    fpsFrames += 1;
    const elapsed = now - fpsWindowStart;
    if (elapsed >= 500) {
      fps = (fpsFrames * 1000) / elapsed;
      fpsFrames = 0;
      fpsWindowStart = now;
    }
  }

  function frame(now) {
    if (!running) return;
    if (lastFrameTime === null) lastFrameTime = now;
    const frameMs = Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrameTime));
    lastFrameTime = now;
    handleDiscreteInput();
    accumulatorMs += frameMs;
    let steps = 0;
    while (accumulatorMs >= FIXED_STEP_MS && steps < 5) {
      updateFixedStep(FIXED_STEP_MS);
      accumulatorMs -= FIXED_STEP_MS;
      steps += 1;
    }
    if (steps === 5) accumulatorMs = 0;
    updateFps(now);
    if (platform.debug.enabled && now - lastDebugReport >= 200) {
      lastDebugReport = now;
      const joystick = platform.input.getJoystickState();
      platform.debug.report({
        phase: state.phase,
        level: state.levelId,
        health: state.health,
        readyMs: state.readyMs.toFixed(0),
        remainingMs: state.remainingMs.toFixed(0),
        elapsedMs: state.elapsedMs.toFixed(0),
        level2Attempt: state.level2Attempt,
        sessionBestSurvivalMs: state.sessionBestSurvivalMs.toFixed(0),
        playerX: world.player.x.toFixed(2),
        playerY: world.player.y.toFixed(2),
        enemyBullets: world.enemyBullets.activeCount,
        patternBand: world.patternBand,
        patternWarningBand: world.patternWarning?.nextBand ?? 0,
        stageIndex: state.activeStageIndex,
        activeSkillId: state.activeSkill?.id ?? '',
        activeSkillCooldownMs: state.activeSkill?.cooldownMs?.toFixed(0) ?? '0',
        eventChoiceCount: state.pendingEventChoices?.length ?? 0,
        eliteCount: world.enemies.items.filter((enemy) => enemy.active && enemy.kind === 'elite').length,
        bossPhase: world.bossState?.phase ?? 0,
        grazeCount,
        fps: fps.toFixed(1),
        musicEnabled: settings.music,
        sfxEnabled: settings.sfx,
        joystickActive: joystick.active,
        joystickCenterX: joystick.center.x.toFixed(2),
        joystickCenterY: joystick.center.y.toFixed(2),
        joystickVectorX: joystick.vector.x.toFixed(3),
        joystickVectorY: joystick.vector.y.toFixed(3),
        weapons: state.build.weaponSlots.filter(Boolean).map((slot) => `${slot.id}:${slot.level}`).join('|')
      });
    }
    renderer.setDpr(platform.viewport.devicePixelRatio());
    renderer.render({ state, world, choices, input: platform.input, settings, now, fps, shareStatus });
    animationFrameId = requestAnimationFrame(frame);
  }

  function pause() {
    if (state.paused) return;
    state.paused = true;
    platform.audio.pause();
    setPlayingInput();
  }

  function resume() {
    if (state.settingsOpen) return;
    state.paused = false;
    lastFrameTime = null;
    accumulatorMs = 0;
    platform.audio.resume();
    setPlayingInput();
  }

  const unsubscribeLifecycle = platform.lifecycle.subscribe((event) => {
    if (event === 'pause') pause(); else resume();
  });
  animationFrameId = requestAnimationFrame(frame);

  return {
    startNewRun,
    retryLevel2,
    pause,
    resume,
    destroy() {
      running = false;
      cancelAnimationFrame(animationFrameId);
      unsubscribeLifecycle();
      platform.sharing.clearResult();
      platform.destroy();
    },
    debugSnapshot() {
      return {
        state: JSON.parse(JSON.stringify(state)),
        fps,
        pools: {
          enemies: world.enemies.activeCount,
          playerBullets: world.playerBullets.activeCount,
          enemyBullets: world.enemyBullets.activeCount,
          orbitals: world.orbitals.activeCount,
          weaponEffects: world.weaponEffects.activeCount,
          pickups: world.pickups.activeCount
        },
        droppedEnemyBullets: world.metrics.droppedEnemyBullets,
        droppedPlayerBullets: world.metrics.droppedPlayerBullets,
        readyMs: state.readyMs,
        patternBand: world.patternBand,
        patternWarningBand: world.patternWarning?.nextBand ?? 0,
        grazeCount,
        level2Attempt: state.level2Attempt,
        sessionBestSurvivalMs: state.sessionBestSurvivalMs
      };
    }
  };
}
