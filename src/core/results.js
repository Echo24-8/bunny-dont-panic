const BUILD_LABELS = Object.freeze({
  rapidFire: '连发',
  splitShot: '散射',
  pierce: '穿透',
  moveSpeed: '移速',
  shield: '护盾'
});

export function getClearBadge(attempt) {
  if (attempt <= 1) return '初见通关';
  if (attempt <= 3) return '逆袭通关';
  return '成长通关';
}

export function summarizeBuild(build, limit = 3) {
  const active = Object.entries(BUILD_LABELS)
    .filter(([id]) => (build[id] ?? 0) > 0)
    .map(([id, label]) => `${label} Lv${build[id]}`);
  if (active.length === 0) return '基础能力';
  const visible = active.slice(0, limit);
  if (active.length > limit) visible.push(`另有 ${active.length - limit} 项`);
  return visible.join(' · ');
}

export function isPublicShareUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return false;
    if (host.includes(':') && (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd'))) return false;

    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }

    url.searchParams.delete('debug');
    return url.toString();
  } catch {
    return false;
  }
}

export function createResultSummary(state) {
  const result = state.result ?? { kind: 'defeat', survivalMs: 0 };
  return {
    kind: result.kind,
    survivalMs: result.survivalMs,
    bestSurvivalMs: state.sessionBestSurvivalMs,
    attempt: state.level2Attempt,
    badge: result.kind === 'success' ? getClearBadge(state.level2Attempt) : '',
    build: { ...state.build },
    buildSummary: summarizeBuild(state.build)
  };
}

export function createSharePayload(summary, currentUrl = '') {
  const seconds = (summary.survivalMs / 1000).toFixed(1);
  const resultText = summary.kind === 'success'
    ? `我在《兔兔别慌》撑满了 60 秒，${summary.badge}！`
    : `我在《兔兔别慌》第二关存活了 ${seconds} 秒。`;
  return {
    title: '兔兔别慌战绩',
    text: `${resultText} ${summary.buildSummary}`,
    url: isPublicShareUrl(currentUrl) || ''
  };
}
