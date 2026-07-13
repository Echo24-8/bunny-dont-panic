import { shieldRechargeMs } from './state.js';

export const UPGRADE_DEFINITIONS = Object.freeze([
  { id: 'rapidFire', title: '胡萝卜连发', description: '射击间隔缩短 10%', maxLevel: 6 },
  { id: 'splitShot', title: '双生胡萝卜', description: '增加一枚散射弹', maxLevel: 3 },
  { id: 'pierce', title: '星星穿透', description: '额外穿透一个敌人', maxLevel: 3 },
  { id: 'moveSpeed', title: '兔耳轻步', description: '移动速度提高 8%', maxLevel: 6 },
  { id: 'shield', title: '棉花护盾', description: '定期抵挡一枚弹幕', maxLevel: 5 },
  { id: 'heart', title: '幸运红心', description: '立即恢复一颗心', maxLevel: 1, consumable: true }
]);

export function upgradeThreshold(upgradeCount) {
  return 8 + 6 * upgradeCount;
}

export function getUpgradeChoices({ build, health, rng = Math.random, count = 3 }) {
  const eligible = UPGRADE_DEFINITIONS.filter((definition) => {
    if (definition.id === 'heart') return health < 3;
    return (build[definition.id] ?? 0) < definition.maxLevel;
  });

  const choices = [];
  while (eligible.length > 0 && choices.length < count) {
    const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
    choices.push(eligible.splice(index, 1)[0]);
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

  const current = state.build[id] ?? 0;
  const nextBuild = { ...state.build, [id]: current + 1 };
  const before = derivePlayerStats(state.build);
  const after = derivePlayerStats(nextBuild);
  const levelText = `Lv ${current} → ${current + 1}`;
  const valueText = {
    rapidFire: `射击间隔 ${Math.round(before.fireIntervalMs)}ms → ${Math.round(after.fireIntervalMs)}ms`,
    splitShot: `弹丸 ${before.projectileCount} 发 → ${after.projectileCount} 发`,
    pierce: `额外穿透 ${before.pierce} → ${after.pierce}`,
    moveSpeed: `移速 ${Math.round(before.speed)} → ${Math.round(after.speed)}`,
    shield: `护盾 ${current === 0 ? '无' : `${(before.shieldRechargeMs / 1000).toFixed(1)}s`} → ${(after.shieldRechargeMs / 1000).toFixed(1)}s`
  }[id];
  return { levelText, valueText };
}

export function applyUpgrade(state, id) {
  const definition = UPGRADE_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) return false;
  if (id === 'heart') {
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
    projectileCount: 1 + build.splitShot,
    pierce: build.pierce,
    shieldRechargeMs: shieldRechargeMs(build.shield)
  };
}

