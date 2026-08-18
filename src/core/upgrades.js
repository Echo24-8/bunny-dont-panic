import { shieldRechargeMs } from './state.js';
import {
  MAX_WEAPON_LEVEL,
  WEAPON_DEFINITIONS,
  deriveWeaponStats,
  getWeaponSynergyLabel,
  getWeaponLevel,
  getWeaponSlot
} from './weapons.js';

const ABILITY_DEFINITIONS = Object.freeze([
  { id: 'rapidFire', title: '胡萝卜发条', description: '所有武器冷却缩短 10%', maxLevel: 6, category: 'ability' },
  { id: 'moveSpeed', title: '兔耳轻步', description: '移动速度提高 8%', maxLevel: 6, category: 'ability' },
  { id: 'shield', title: '棉花护盾', description: '定期抵挡一枚弹幕', maxLevel: 5, category: 'ability' },
  { id: 'heart', title: '幸运红心', description: '立即恢复一颗心', maxLevel: 1, category: 'consumable', consumable: true }
]);

const UPGRADE_ROLE_LABELS = Object.freeze({
  carrot: '单体追踪',
  dandelion: '范围清场',
  boomerang: '穿透回收',
  bubble: '拦截防守',
  lightning: '链式爆发',
  rapidFire: '全武器增幅',
  moveSpeed: '走位强化',
  shield: '容错防守',
  heart: '立即恢复'
});

export const UPGRADE_DEFINITIONS = Object.freeze([...WEAPON_DEFINITIONS, ...ABILITY_DEFINITIONS]);

export function getUpgradeRoleLabel(id) {
  return UPGRADE_ROLE_LABELS[id] ?? '';
}

export function upgradeThreshold(upgradeCount) {
  return 8 + 6 * upgradeCount;
}

function sampleOne(entries, rng) {
  if (entries.length === 0) return null;
  return entries[Math.min(entries.length - 1, Math.floor(rng() * entries.length))];
}

function getEligibleDefinitions({ build, health, maxHealth }) {
  const hasEmptyWeaponSlot = build.weaponSlots.some((slot) => slot === null);
  return UPGRADE_DEFINITIONS.filter((definition) => {
    if (definition.category === 'weapon') {
      const level = getWeaponLevel(build, definition.id);
      return level > 0 ? level < MAX_WEAPON_LEVEL : hasEmptyWeaponSlot;
    }
    if (definition.id === 'heart') return health < maxHealth;
    return (build[definition.id] ?? 0) < definition.maxLevel;
  });
}

export function getUpgradeChoices({ build, health, maxHealth = 3, rng = Math.random, count = 3 }) {
  const eligible = getEligibleDefinitions({ build, health, maxHealth });
  const choices = [];
  const equippedCount = build.weaponSlots.filter(Boolean).length;
  if (equippedCount === 1 && count > 0) {
    const unowned = eligible.filter((definition) => (
      definition.category === 'weapon' && getWeaponLevel(build, definition.id) === 0
    ));
    const forcedWeapon = sampleOne(unowned, rng);
    if (forcedWeapon) choices.push(forcedWeapon);
  }

  const remaining = eligible.filter((definition) => !choices.some((choice) => choice.id === definition.id));
  const categories = ['weapon', 'ability', 'consumable'];
  for (const category of categories) {
    if (choices.length >= count || choices.some((choice) => choice.category === category)) continue;
    const categoryEntries = remaining.filter((definition) => definition.category === category);
    const selected = sampleOne(categoryEntries, rng);
    if (!selected) continue;
    choices.push(selected);
    remaining.splice(remaining.indexOf(selected), 1);
  }
  while (remaining.length > 0 && choices.length < count) {
    const index = Math.min(remaining.length - 1, Math.floor(rng() * remaining.length));
    choices.push(remaining.splice(index, 1)[0]);
  }
  return choices;
}

export function getUpgradePreview(state, id) {
  if (id === 'heart') {
    return {
      levelText: '',
      valueText: `生命 ${state.health}/${state.maxHealth} → ${Math.min(state.maxHealth, state.health + 1)}/${state.maxHealth}`
    };
  }

  const weaponDefinition = WEAPON_DEFINITIONS.find((definition) => definition.id === id);
  if (weaponDefinition) {
    const current = getWeaponLevel(state.build, id);
    const synergy = getWeaponSynergyLabel(state.build, id);
    return {
      levelText: current === 0 ? '解锁' : `Lv ${current} → ${current + 1}`,
      valueText: synergy
        ? `${weaponDefinition.levelDescriptions[current]} · ${synergy}`
        : weaponDefinition.levelDescriptions[current]
    };
  }

  const current = state.build[id] ?? 0;
  const nextBuild = { ...state.build, [id]: current + 1 };
  const before = derivePlayerStats(state.build);
  const after = derivePlayerStats(nextBuild);
  const levelText = `Lv ${current} → ${current + 1}`;
  const valueText = {
    rapidFire: `射击间隔 ${Math.round(before.fireIntervalMs)}ms → ${Math.round(after.fireIntervalMs)}ms`,
    moveSpeed: `移速 ${Math.round(before.speed)} → ${Math.round(after.speed)}`,
    shield: `护盾 ${current === 0 ? '无' : `${(before.shieldRechargeMs / 1000).toFixed(1)}s`} → ${(after.shieldRechargeMs / 1000).toFixed(1)}s`
  }[id];
  return { levelText, valueText };
}

export function applyUpgrade(state, id) {
  const definition = UPGRADE_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) return false;
  if (definition.category === 'weapon') {
    const slot = getWeaponSlot(state.build, id);
    if (slot) {
      if (slot.level >= MAX_WEAPON_LEVEL) return false;
      slot.level += 1;
    } else {
      const emptyIndex = state.build.weaponSlots.findIndex((entry) => entry === null);
      if (emptyIndex < 0) return false;
      state.build.weaponSlots[emptyIndex] = { id, level: 1 };
    }
  } else if (id === 'heart') {
    if (state.health >= state.maxHealth) return false;
    state.health += 1;
  } else {
    const current = state.build[id] ?? 0;
    if (current >= definition.maxLevel) return false;
    state.build[id] = current + 1;
    if (id === 'shield' && !state.shieldReady) {
      state.shieldCooldownMs = Math.min(state.shieldCooldownMs || Infinity, shieldRechargeMs(state.build.shield));
    }
  }
  state.upgradeCount += 1;
  return true;
}

export function derivePlayerStats(build) {
  return {
    speed: 190 * (1 + 0.08 * build.moveSpeed),
    fireIntervalMs: 420 * 0.9 ** build.rapidFire,
    fireRateMultiplier: 0.9 ** build.rapidFire,
    shieldRechargeMs: shieldRechargeMs(build.shield)
  };
}
