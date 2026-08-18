import { LEVELS, PHASES } from './constants.js';
import { createCampaign, getStageDefinition } from './campaign.js';
import { createActiveSkillState } from './active-skills.js';
import { cloneWeaponSlots, createDefaultWeaponSlots } from './weapons.js';

export function createBuild() {
  return { rapidFire: 0, moveSpeed: 0, shield: 0, weaponSlots: createDefaultWeaponSlots() };
}

export function cloneBuild(build = createBuild()) {
  return {
    rapidFire: build.rapidFire ?? 0,
    moveSpeed: build.moveSpeed ?? 0,
    shield: build.shield ?? 0,
    weaponSlots: cloneWeaponSlots(build.weaponSlots ?? createDefaultWeaponSlots())
  };
}

export function createInitialState() {
  return {
    phase: PHASES.LOADING,
    levelId: 0,
    remainingMs: 0,
    elapsedMs: 0,
    readyMs: 0,
    level2Attempt: 0,
    sessionBestSurvivalMs: 0,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: 0,
    build: createBuild(),
    invulnerableMs: 0,
    activeSkill: { ...createActiveSkillState(), cooldownReductionMs: 0 },
    activeShieldCharges: 0,
    shieldReady: false,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false,
    campaign: createCampaign(0),
    activeStageIndex: 0,
    pendingEventChoices: []
  };
}

export function startNewRun(state, seed = Date.now()) {
  const sessionBestSurvivalMs = state.sessionBestSurvivalMs ?? 0;
  const campaign = createCampaign(seed);
  Object.assign(state, {
    phase: PHASES.PLAYING,
    levelId: LEVELS.ONE,
    remainingMs: 45_000,
    elapsedMs: 0,
    readyMs: 0,
    level2Attempt: 0,
    sessionBestSurvivalMs,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: 0,
    build: createBuild(),
    invulnerableMs: 0,
    activeSkill: { ...createActiveSkillState(), cooldownReductionMs: 0 },
    activeShieldCharges: 0,
    shieldReady: false,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false,
    campaign,
    activeStageIndex: 0,
    pendingEventChoices: []
  });
  startCampaignStage(state, 0);
  return state;
}

export function startCampaignStage(state, stageIndex) {
  const definition = getStageDefinition(stageIndex);
  if (!definition) return null;
  state.activeStageIndex = stageIndex;
  state.campaign ??= createCampaign(0);
  state.campaign.stageIndex = stageIndex;
  state.campaign.eventChoices = [];
  state.campaign.selectedEventId = null;
  state.pendingEventChoices = [];
  state.phase = PHASES.PLAYING;
  state.levelId = definition.levelId;
  state.remainingMs = definition.durationMs;
  state.elapsedMs = 0;
  state.readyMs = stageIndex === 1 ? 1_000 : 0;
  state.transitionMs = 0;
  state.result = null;
  state.invulnerableMs = 0;
  state.activeSkill ??= createActiveSkillState();
  state.activeSkill.cooldownMs = 0;
  state.activeSkill.activeMs = 0;
  state.activeSkill.cooldownReductionMs = state.activeSkill.cooldownReductionMs ?? 0;
  state.activeShieldCharges = 0;
  state.shieldReady = state.build.shield > 0;
  state.shieldCooldownMs = 0;
  return state;
}

export function beginLevelTwoTransition(state) {
  state.phase = PHASES.TRANSITION;
  state.transitionMs = 1_200;
  state.readyMs = 0;
  state.result = null;
  return state;
}

export function startLevelTwo(state) {
  startCampaignStage(state, 1);
  state.level2Attempt = 1;
  state.xp = 0;
  return state;
}

export function retryLevelTwoState(state) {
  const retainedBuild = cloneBuild(state.build);
  const retainedUpgradeCount = state.upgradeCount;
  Object.assign(state, {
    phase: PHASES.PLAYING,
    levelId: LEVELS.TWO,
    remainingMs: 60_000,
    elapsedMs: 0,
    readyMs: 1_000,
    level2Attempt: state.level2Attempt + 1,
    health: 3,
    maxHealth: 3,
    xp: 0,
    upgradeCount: retainedUpgradeCount,
    build: retainedBuild,
    invulnerableMs: 0,
    activeSkill: { ...createActiveSkillState(state.activeSkill?.id ?? 'dash'), cooldownReductionMs: 0 },
    activeShieldCharges: 0,
    shieldReady: retainedBuild.shield > 0,
    shieldCooldownMs: 0,
    result: null,
    transitionMs: 0,
    settingsOpen: false,
    paused: false
  });
  state.activeStageIndex = 1;
  state.campaign ??= createCampaign(0);
  state.campaign.stageIndex = 1;
  state.campaign.eventChoices = [];
  state.campaign.selectedEventId = null;
  state.pendingEventChoices = [];
  return state;
}

export function recordLevelTwoResult(state, kind, survivalMs) {
  const maxDurationMs = (state.activeStageIndex ?? 1) >= 3 ? 90_000 : 60_000;
  const boundedMs = Math.max(0, Math.min(maxDurationMs, survivalMs));
  state.sessionBestSurvivalMs = Math.max(state.sessionBestSurvivalMs ?? 0, boundedMs);
  state.result = { kind, survivalMs: boundedMs };
  return state.result;
}

export function takeDamage(state) {
  if (state.invulnerableMs > 0 || state.phase !== PHASES.PLAYING) return 'ignored';
  if (state.shieldReady) {
    state.shieldReady = false;
    state.shieldCooldownMs = shieldRechargeMs(state.build.shield);
    return 'shielded';
  }
  if ((state.activeShieldCharges ?? 0) > 0) {
    state.activeShieldCharges -= 1;
    return 'shielded';
  }
  state.health = Math.max(0, state.health - 1);
  state.invulnerableMs = 1_000;
  return state.health === 0 ? 'defeated' : 'damaged';
}

export function shieldRechargeMs(level) {
  return [0, 14_000, 12_000, 10_000, 8_000, 6_000][Math.min(5, Math.max(0, level))];
}
