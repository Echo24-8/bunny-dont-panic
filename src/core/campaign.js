const EVENT_DEFINITIONS = Object.freeze([
  { id: 'supply', kind: 'supply', title: '森林补给', description: '获得一次普通升级。' },
  { id: 'recovery', kind: 'recovery', title: '浆果疗愈', description: '恢复一颗心。' },
  { id: 'strengthen', kind: 'strengthen', title: '贴纸强化', description: '强化当前主动技能或武器。' },
  { id: 'rest', kind: 'rest', title: '林间休整', description: '下一关开始时获得短暂护盾。' },
  { id: 'exchange', kind: 'exchange', title: '交换贴纸', description: '放弃一项小增益，换取更高质量的升级。' },
  { id: 'adventure', kind: 'adventure', title: '冒险路线', description: '挑战精英敌人，成功后获得稀有奖励。' }
]);

export function getEventReward(event, state = {}) {
  if (!event) return null;
  if (event.kind === 'recovery') return state.health < state.maxHealth ? { type: 'heal', amount: 1 } : { type: 'supply' };
  if (event.kind === 'strengthen') return { type: 'skill-cooldown', amount: 2_000 };
  if (event.kind === 'rest') return { type: 'shield', charges: 1 };
  if (event.kind === 'exchange') return { type: 'upgrade', quality: 'rare' };
  if (event.kind === 'adventure') return { type: 'elite-reward', amount: 2 };
  return { type: 'supply' };
}

export const STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'forest-entry', durationMs: 45_000, levelId: 1, kind: 'tutorial' }),
  Object.freeze({ id: 'rain-barrage', durationMs: 60_000, levelId: 2, kind: 'barrage' }),
  Object.freeze({ id: 'elite-grove', durationMs: 75_000, levelId: 3, kind: 'elite' }),
  Object.freeze({ id: 'forest-guardian', durationMs: 90_000, levelId: 4, kind: 'boss' })
]);

function nextRandom(value) {
  let next = (value + 0x6d2b79f5) >>> 0;
  next = Math.imul(next ^ (next >>> 15), next | 1) >>> 0;
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return { value: next >>> 0, fraction: ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296 };
}

export function createCampaign(seed = 0) {
  return { seed: seed >>> 0, stageIndex: 0, eventChoices: [], selectedEventId: null };
}

export function getStageDefinition(stageIndex) {
  return STAGE_DEFINITIONS[stageIndex] ?? null;
}

export function createEventChoices(campaign, context = {}) {
  const stageIndex = Number.isInteger(context.stageIndex) ? context.stageIndex : campaign.stageIndex;
  const health = context.health ?? 0;
  const maxHealth = context.maxHealth ?? 3;
  const valid = EVENT_DEFINITIONS.filter((event) => event.kind !== 'recovery' || health < maxHealth);
  let cursor = (campaign.seed ^ Math.imul(stageIndex + 1, 0x45d9f3b)) >>> 0;
  const pool = valid.slice();
  const choices = [];
  while (choices.length < 2 && pool.length > 0) {
    const random = nextRandom(cursor);
    cursor = random.value;
    const index = Math.floor(random.fraction * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  if (choices.length < 2) {
    const fallback = EVENT_DEFINITIONS.find((event) => event.kind === 'supply');
    while (choices.length < 2) {
      const candidate = choices.some((event) => event.id === fallback.id)
        ? EVENT_DEFINITIONS.find((event) => !choices.some((entry) => entry.id === event.id))
        : fallback;
      if (!candidate) break;
      choices.push(candidate);
    }
  }
  campaign.stageIndex = stageIndex;
  campaign.eventChoices = choices;
  campaign.selectedEventId = null;
  return choices;
}

export function selectEvent(campaign, eventId) {
  const event = campaign.eventChoices.find((entry) => entry.id === eventId);
  if (!event) return null;
  campaign.selectedEventId = event.id;
  campaign.eventChoices = [];
  return event;
}
