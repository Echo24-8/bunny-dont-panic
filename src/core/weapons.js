export const WEAPON_IDS = Object.freeze([
  'carrot',
  'dandelion',
  'boomerang',
  'bubble',
  'lightning'
]);

export const MAX_WEAPON_SLOTS = 3;
export const MAX_WEAPON_LEVEL = 3;

export const WEAPON_DEFINITIONS = Object.freeze([
  {
    id: 'carrot',
    title: '胡萝卜飞镖',
    description: '自动追踪最近的敌人',
    category: 'weapon',
    maxLevel: MAX_WEAPON_LEVEL,
    color: '#ed7c42',
    levelDescriptions: ['自动追踪，稳定单发', '伤害提升，射击更快', '双发胡萝卜']
  },
  {
    id: 'dandelion',
    title: '蒲公英散射',
    description: '扇形种子覆盖前方敌人',
    category: 'weapon',
    maxLevel: MAX_WEAPON_LEVEL,
    color: '#f4d45f',
    levelDescriptions: ['3 枚扇形种子', '5 枚扇形种子', '7 枚扇形种子']
  },
  {
    id: 'boomerang',
    title: '星星回旋镖',
    description: '飞出后返回并连续穿透',
    category: 'weapon',
    maxLevel: MAX_WEAPON_LEVEL,
    color: '#f2c451',
    levelDescriptions: ['往返命中 3 个目标', '往返命中 5 个目标', '往返命中 7 个目标']
  },
  {
    id: 'bubble',
    title: '蜂蜜泡泡',
    description: '环绕兔兔并拦截危险',
    category: 'weapon',
    maxLevel: MAX_WEAPON_LEVEL,
    color: '#e6a84a',
    levelDescriptions: ['1 枚环绕泡泡', '2 枚环绕泡泡', '3 枚环绕泡泡']
  },
  {
    id: 'lightning',
    title: '云朵闪电',
    description: '低频连锁打击不同敌人',
    category: 'weapon',
    maxLevel: MAX_WEAPON_LEVEL,
    color: '#83bfd1',
    levelDescriptions: ['连锁 2 个敌人', '连锁 3 个敌人', '连锁 4 个敌人']
  }
]);

export function createDefaultWeaponSlots() {
  return [{ id: 'carrot', level: 1 }, null, null];
}

export function cloneWeaponSlots(slots = []) {
  return Array.from(
    { length: MAX_WEAPON_SLOTS },
    (_, index) => slots[index] ? { ...slots[index] } : null
  );
}

export function getWeaponSlot(build, id) {
  return build?.weaponSlots?.find((slot) => slot?.id === id) ?? null;
}

export function getWeaponLevel(build, id) {
  return getWeaponSlot(build, id)?.level ?? 0;
}

export function getWeaponSynergyLabel(build, id) {
  if (id === 'boomerang' && (build?.moveSpeed ?? 0) > 0) return '兔耳轻步：回收更快';
  if (id === 'bubble' && (build?.shield ?? 0) > 0) return '棉花护盾：覆盖更广';
  return '';
}

export function deriveWeaponStats(build, id) {
  const level = Math.min(MAX_WEAPON_LEVEL, Math.max(0, getWeaponLevel(build, id)));
  const rapidMultiplier = 0.9 ** (build?.rapidFire ?? 0);
  const moveSpeedLevel = Math.min(6, Math.max(0, build?.moveSpeed ?? 0));
  const shieldLevel = Math.min(5, Math.max(0, build?.shield ?? 0));
  const definitions = {
    carrot: {
      projectileCount: [0, 1, 1, 2][level],
      fireIntervalMs: [Infinity, 420, 360, 300][level] * rapidMultiplier,
      speed: 520,
      damage: [0, 1, 1.35, 1.6][level],
      spread: 0.13
    },
    dandelion: {
      projectileCount: [0, 3, 5, 7][level],
      fireIntervalMs: [Infinity, 1100, 950, 820][level] * rapidMultiplier,
      speed: 360,
      damage: [0, 0.8, 0.85, 0.9][level],
      spread: [0, 0.62, 0.82, 1.02][level]
    },
    boomerang: {
      projectileCount: level > 0 ? 1 : 0,
      fireIntervalMs: [Infinity, 1350, 1150, 950][level] * rapidMultiplier,
      speed: [0, 300, 330, 360][level],
      damage: [0, 1.3, 1.6, 1.9][level],
      maxTargets: [0, 3, 5, 7][level],
      returnAfterMs: [0, 620, 570, 520][level] * Math.max(0.76, 1 - moveSpeedLevel * 0.04)
    },
    bubble: {
      projectileCount: level,
      fireIntervalMs: [Infinity, 2400, 2100, 1800][level] * rapidMultiplier,
      damage: [0, 0.7, 0.85, 1][level],
      orbitRadius: level > 0 ? 31 + shieldLevel * 3 : 31,
      hitCooldownMs: 380
    },
    lightning: {
      projectileCount: 0,
      fireIntervalMs: [Infinity, 2200, 1850, 1550][level] * rapidMultiplier,
      damage: [0, 1.4, 1.7, 2][level],
      chainCount: [0, 2, 3, 4][level]
    }
  };
  return { id, level, ...(definitions[id] ?? { projectileCount: 0, fireIntervalMs: Infinity }) };
}
