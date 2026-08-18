export const PROGRESSION_VERSION = 1;

export const CHALLENGES = Object.freeze({
  firstClear: { id: 'firstClear', title: '第一次通关' },
  eliteHunter: { id: 'eliteHunter', title: '精英猎手' },
  guardianBreaker: { id: 'guardianBreaker', title: '守护者终结者' },
  skillful: { id: 'skillful', title: '技能留存' },
  noDamage: { id: 'noDamage', title: '无伤穿林' }
});

export function createProgressionState() {
  return { version: PROGRESSION_VERSION, unlockedSkills: ['dash'], seenEnemies: [], completedChallenges: [], highestStage: 0, cosmetics: [] };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function applyProgressEvent(progress, event = {}) {
  const next = { ...createProgressionState(), ...clone(progress ?? {}) };
  next.unlockedSkills = [...new Set(next.unlockedSkills ?? ['dash'])];
  next.seenEnemies = [...new Set(next.seenEnemies ?? [])];
  next.completedChallenges = [...new Set(next.completedChallenges ?? [])];
  next.cosmetics = [...new Set(next.cosmetics ?? [])];
  if (event.type === 'unlock-skill' && event.id) next.unlockedSkills.push(event.id);
  if (event.type === 'enemy-seen' && event.id) next.seenEnemies.push(event.id);
  if (event.type === 'challenge-complete' && event.id) next.completedChallenges.push(event.id);
  if (event.type === 'stage-complete') next.highestStage = Math.max(next.highestStage, Number(event.stageIndex) || 0);
  if (event.type === 'cosmetic-unlock' && event.id) next.cosmetics.push(event.id);
  next.unlockedSkills = [...new Set(next.unlockedSkills)];
  next.seenEnemies = [...new Set(next.seenEnemies)];
  next.completedChallenges = [...new Set(next.completedChallenges)];
  next.cosmetics = [...new Set(next.cosmetics)];
  return next;
}

export function evaluateChallenge(challengeId, summary = {}) {
  if (challengeId === 'firstClear') return summary.kind === 'success';
  if (challengeId === 'eliteHunter') return Boolean(summary.eliteDefeated);
  if (challengeId === 'guardianBreaker') return summary.kind === 'success' && (summary.stageIndex ?? 0) >= 3;
  if (challengeId === 'skillful') return summary.kind === 'success' && (summary.skillUses ?? 0) >= 1;
  if (challengeId === 'noDamage') return summary.kind === 'success' && (summary.damageTaken ?? 1) === 0;
  return false;
}

export function serializeProgression(progress) {
  return JSON.stringify({ ...createProgressionState(), ...progress, version: PROGRESSION_VERSION });
}

export function parseProgression(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || parsed.version !== PROGRESSION_VERSION) return createProgressionState();
    return applyProgressEvent(parsed, {});
  } catch {
    return createProgressionState();
  }
}
