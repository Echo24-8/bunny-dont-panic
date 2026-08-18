export const ELITE_AFFIXES = Object.freeze(['swift', 'armored', 'splitter', 'summoner']);

export function createEliteSpec({ affix, x, y, levelId = 3 } = {}) {
  if (!ELITE_AFFIXES.includes(affix)) return null;
  return {
    kind: 'elite',
    affix,
    x: Number(x) || 180,
    y: Number(y) || 110,
    levelId,
    hp: 8,
    maxHp: 8,
    radius: 19,
    speed: 28,
    ageMs: 0,
    summonCooldownMs: affix === 'summoner' ? 4_000 : Infinity
  };
}

export function applyEliteAffix(enemy, affix) {
  if (!enemy || !ELITE_AFFIXES.includes(affix)) return enemy;
  enemy.affix = affix;
  if (affix === 'swift') enemy.speed = Math.round((enemy.speed ?? 28) * 1.55);
  else if (affix === 'armored') {
    enemy.hp = Math.max(enemy.hp ?? 8, 12);
    enemy.maxHp = enemy.hp;
  } else if (affix === 'splitter') enemy.splitOnDeath = true;
  else if (affix === 'summoner') enemy.summonCooldownMs = 4_000;
  return enemy;
}
