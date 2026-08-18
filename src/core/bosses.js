export const BOSS_DEFINITION = Object.freeze({
  maxHp: 120,
  phaseThreshold: 0.5,
  phaseDurations: Object.freeze([0, 45_000, 45_000]),
  attacks: Object.freeze(['ring', 'fan', 'spiral'])
});

export function createBossState() {
  return { phase: 1, hp: BOSS_DEFINITION.maxHp, maxHp: BOSS_DEFINITION.maxHp, attackIndex: 0, warning: null };
}

export function advanceBossPhase(boss, remainingHpRatio) {
  if (boss.phase === 1 && remainingHpRatio <= BOSS_DEFINITION.phaseThreshold) {
    boss.phase = 2;
    boss.attackIndex = 0;
    return true;
  }
  return false;
}

export function getBossAttackSpec({ phase = 1, attackIndex = 0, seed = 0 } = {}) {
  const index = Math.abs((seed | 0) + attackIndex + phase * 3) % BOSS_DEFINITION.attacks.length;
  const kind = BOSS_DEFINITION.attacks[index];
  const base = { kind, warningMs: 650, cooldownMs: phase === 2 ? 950 : 1_250 };
  if (kind === 'ring') return { ...base, args: { x: 180, y: 154, count: phase === 2 ? 18 : 14, speed: phase === 2 ? 86 : 72, gapIndex: (attackIndex + 3) % 10 } };
  if (kind === 'fan') return { ...base, args: { x: 180, y: 154, targetX: 180, targetY: 520, count: phase === 2 ? 9 : 7, spread: 1.25, speed: phase === 2 ? 92 : 76 } };
  return { ...base, args: { x: 180, y: 154, angle: -Math.PI / 2, speed: phase === 2 ? 82 : 68, angularSpeed: phase === 2 ? 1.25 : 0.9 } };
}
