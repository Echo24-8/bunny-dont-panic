import { LEVELS, PHASES } from './constants.js';

export function createBuild() {
  return { rapidFire: 0, splitShot: 0, pierce: 0, moveSpeed: 0, shield: 0 };
}

export function createInitialState() {
  return {
    phase: PHASES.LOADING,
    levelId: 0,
    remainingMs: 0,
    elapsedMs: 0,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: 0,
    build: createBuild(),
    invulnerableMs: 0,
    shieldReady: false,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false
  };
}

export function startNewRun(state) {
  Object.assign(state, {
    phase: PHASES.PLAYING,
    levelId: LEVELS.ONE,
    remainingMs: 30_000,
    elapsedMs: 0,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: 0,
    build: createBuild(),
    invulnerableMs: 0,
    shieldReady: false,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false
  });
  return state;
}

export function beginLevelTwoTransition(state) {
  state.phase = PHASES.TRANSITION;
  state.transitionMs = 1_200;
  state.result = null;
  return state;
}

export function startLevelTwo(state) {
  state.phase = PHASES.PLAYING;
  state.levelId = LEVELS.TWO;
  state.remainingMs = 60_000;
  state.elapsedMs = 0;
  state.xp = 0;
  state.invulnerableMs = 0;
  state.shieldReady = state.build.shield > 0;
  state.shieldCooldownMs = 0;
  state.transitionMs = 0;
  return state;
}

export function retryLevelTwoState(state) {
  const retainedBuild = { ...state.build };
  const retainedUpgradeCount = state.upgradeCount;
  Object.assign(state, {
    phase: PHASES.PLAYING,
    levelId: LEVELS.TWO,
    remainingMs: 60_000,
    elapsedMs: 0,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: retainedUpgradeCount,
    build: retainedBuild,
    invulnerableMs: 0,
    shieldReady: retainedBuild.shield > 0,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false
  });
  return state;
}

export function takeDamage(state) {
  if (state.invulnerableMs > 0 || state.phase !== PHASES.PLAYING) return 'ignored';
  if (state.shieldReady) {
    state.shieldReady = false;
    state.shieldCooldownMs = shieldRechargeMs(state.build.shield);
    return 'shielded';
  }
  state.health = Math.max(0, state.health - 1);
  state.invulnerableMs = 1_000;
  return state.health === 0 ? 'defeated' : 'damaged';
}

export function shieldRechargeMs(level) {
  return [0, 14_000, 12_000, 10_000, 8_000, 6_000][Math.min(5, Math.max(0, level))];
}

