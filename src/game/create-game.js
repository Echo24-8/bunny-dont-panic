import { LEVELS, PHASES } from '../core/constants.js';
import {
  beginLevelTwoTransition,
  createInitialState,
  recordLevelTwoResult,
  retryLevelTwoState,
  startLevelTwo,
  startNewRun as resetRunState
} from '../core/state.js';
import { createResultSummary, createSharePayload } from '../core/results.js';
import { applyUpgrade, getUpgradeChoices, getUpgradePreview, upgradeThreshold } from '../core/upgrades.js';
import { createWorld, resetWorld, updateWorld } from '../core/world.js';
import { createRenderer, getUpgradeCardRect, hitRect, UI_RECTS } from '../render/renderer.js';

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

  state.phase = PHASES.MENU;
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
    resetRunState(state);
    resetWorld(world);
    choices = [];
    transitionMusicStarted = false;
    platform.audio.stop();
    playMusic('music1');
    platform.a11y.announce('第一关开始，生存三十秒。');
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
    if (state.phase === PHASES.MENU && hitRect(point, UI_RECTS.start)) startNewRun();
    else if (state.phase === PHASES.UPGRADE) {
      choices.forEach((_, index) => {
        if (hitRect(point, getUpgradeCardRect(index))) chooseUpgrade(index);
      });
    } else if (state.phase === PHASES.RESULT) {
      if (hitRect(point, UI_RECTS.retry)) {
        if (state.result?.kind === 'success') startNewRun(); else retryLevel2();
      } else if (hitRect(point, UI_RECTS.menu)) returnToMenu();
    }
  }

  function handleDiscreteInput() {
    for (const tap of platform.input.consumeTaps()) handleTap(tap);
    const selection = platform.input.consumeSelection();
    if (selection !== null && state.phase === PHASES.UPGRADE) chooseUpgrade(selection);
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
    if (levelId === LEVELS.ONE) {
      beginLevelTwoTransition(state);
      transitionMusicStarted = false;
      platform.audio.stop();
      platform.input.setJoystickEnabled(false);
      platform.a11y.announce('第一关完成。第二关难度略有提升。');
    } else {
      showLevelTwoResult('success', 60_000);
      platform.audio.stop();
      platform.audio.play('success', { volume: 0.8 });
      platform.a11y.announce('挑战成功，第二关完成。');
    }
  }

  function showLevelTwoResult(kind, survivalMs) {
    state.phase = PHASES.RESULT;
    recordLevelTwoResult(state, kind, survivalMs);
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
        platform.audio.play('hurt', { volume: 0.8 });
        platform.haptics.pulse(22);
      } else if (event.type === 'grazed') {
        grazeCount += 1;
      } else if (event.type === 'pattern-warning') {
        platform.a11y.announce('弹幕即将变化。');
      } else if (event.type === 'defeated') {
        platform.audio.play('hurt', { volume: 0.85 });
        platform.haptics.pulse(30);
        showLevelTwoResult('defeat', state.elapsedMs);
        platform.audio.stop();
        platform.a11y.announce(`挑战失败，存活${(state.elapsedMs / 1000).toFixed(1)}秒。`);
      } else if (event.type === 'upgrade-ready' && state.phase === PHASES.PLAYING) {
        choices = getUpgradeChoices({ build: state.build, health: state.health, rng })
          .map((choice) => ({ ...choice, preview: getUpgradePreview(state, choice.id) }));
        if (choices.length > 0) {
          state.phase = PHASES.UPGRADE;
          platform.input.setJoystickEnabled(false);
          platform.a11y.announce('升级，请选择一个能力。');
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
        startLevelTwo(state);
        resetWorld(world);
        setPlayingInput();
        platform.a11y.announce('第二关开始，生存六十秒。');
      }
      return;
    }
    if (state.phase !== PHASES.PLAYING) return;
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
        level2Attempt: state.level2Attempt,
        sessionBestSurvivalMs: state.sessionBestSurvivalMs.toFixed(0),
        playerX: world.player.x.toFixed(2),
        playerY: world.player.y.toFixed(2),
        enemyBullets: world.enemyBullets.activeCount,
        patternBand: world.patternBand,
        patternWarningBand: world.patternWarning?.nextBand ?? 0,
        grazeCount,
        fps: fps.toFixed(1),
        musicEnabled: settings.music,
        sfxEnabled: settings.sfx,
        joystickActive: joystick.active,
        joystickCenterX: joystick.center.x.toFixed(2),
        joystickCenterY: joystick.center.y.toFixed(2),
        joystickVectorX: joystick.vector.x.toFixed(3),
        joystickVectorY: joystick.vector.y.toFixed(3)
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
          pickups: world.pickups.activeCount
        },
        droppedEnemyBullets: world.metrics.droppedEnemyBullets,
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
