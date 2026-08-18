const DEFAULT_DIRECTION = Object.freeze({ x: 0, y: -1 });

export const ACTIVE_SKILL_DEFINITIONS = Object.freeze({
  dash: Object.freeze({
    id: 'dash',
    title: '兔兔冲刺',
    cooldownMs: 8_000,
    activeMs: 260,
    effect: 'dash'
  }),
  cottonGuard: Object.freeze({
    id: 'cottonGuard',
    title: '棉花护体',
    cooldownMs: 12_000,
    activeMs: 2_200,
    effect: 'shield'
  }),
  forestEcho: Object.freeze({
    id: 'forestEcho',
    title: '森林回响',
    cooldownMs: 16_000,
    activeMs: 0,
    effect: 'clear-and-damage'
  })
});

export function getActiveSkillDefinition(id = 'dash') {
  return ACTIVE_SKILL_DEFINITIONS[id] ?? ACTIVE_SKILL_DEFINITIONS.dash;
}

export function createActiveSkillState(id = 'dash') {
  return { id: getActiveSkillDefinition(id).id, cooldownMs: 0, activeMs: 0 };
}

function normalizeDirection(direction) {
  const x = Number(direction?.x) || 0;
  const y = Number(direction?.y) || 0;
  const length = Math.hypot(x, y);
  if (length <= 0.001) return { ...DEFAULT_DIRECTION };
  return { x: x / length, y: y / length };
}

export function activateSkill(skillState, definition, context = {}) {
  if (!skillState || !definition || skillState.cooldownMs > 0) {
    return { accepted: false, effects: [] };
  }
  const direction = normalizeDirection(context.direction);
  const effect = definition.effect === 'dash'
    ? {
      type: 'dash',
      direction,
      distance: definition.distance ?? 86,
      invulnerableMs: definition.invulnerableMs ?? 260
    }
    : definition.effect === 'shield'
      ? { type: 'shield', shieldCharges: definition.shieldCharges ?? 2, activeMs: definition.activeMs }
      : {
        type: 'clear-and-damage',
        damage: definition.damage ?? 4,
        radius: definition.radius ?? 154,
        clearRadius: definition.clearRadius ?? 190
      };
  const cooldownReductionMs = Math.max(0, Number(skillState.cooldownReductionMs) || 0);
  skillState.cooldownMs = Math.max(0, definition.cooldownMs - cooldownReductionMs);
  skillState.cooldownReductionMs = 0;
  skillState.activeMs = definition.activeMs;
  return {
    accepted: true,
    effects: [effect],
    cooldownMs: skillState.cooldownMs,
    activeMs: skillState.activeMs
  };
}

export function updateActiveSkill(skillState, dtMs) {
  if (!skillState) return skillState;
  const elapsed = Math.max(0, Number(dtMs) || 0);
  skillState.cooldownMs = Math.max(0, skillState.cooldownMs - elapsed);
  skillState.activeMs = Math.max(0, skillState.activeMs - elapsed);
  return skillState;
}
