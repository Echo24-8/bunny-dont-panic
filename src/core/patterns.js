const TAU = Math.PI * 2;
const LEVEL_TWO_PATTERN_BOUNDARIES = Object.freeze([10_000, 25_000, 40_000, 55_000]);

export function getLevelTwoPatternState(elapsedMs) {
  const band = elapsedMs < 10_000 ? 0 : elapsedMs < 25_000 ? 1 : elapsedMs < 40_000 ? 2 : elapsedMs < 55_000 ? 3 : 4;
  const nextBoundary = LEVEL_TWO_PATTERN_BOUNDARIES[band];
  const warning = nextBoundary !== undefined && elapsedMs >= nextBoundary - 800 && elapsedMs < nextBoundary
    ? { nextBand: band + 1, remainingMs: nextBoundary - elapsedMs }
    : null;
  return { band, warning };
}

export function getLevelTwoPatternSpec({ band, channel, shotIndex }) {
  const side = shotIndex % 2;
  if (band === 0 && channel === 'main') return {
    kind: 'ring', cooldownMs: 1_250, startDelayMs: 0,
    args: { x: 180, y: 92, count: 24, speed: 96, gapAngle: [1.25, 1.89][side], gapWidth: Math.PI / 5, rotation: 0 }
  };
  if (band === 1 && channel === 'main') return {
    kind: 'fan', cooldownMs: 550, startDelayMs: 0,
    args: { x: side ? 340 : 20, y: [140, 220, 290, 180][shotIndex % 4], targetX: side ? 72 : 288, targetY: 500, count: 7, spread: Math.PI * 0.54, speed: 112 }
  };
  if (band === 2 && channel === 'main') return {
    kind: 'spiral', cooldownMs: 70, startDelayMs: 0,
    args: { x: 180, y: 100, angle: shotIndex * 0.27, speed: 108 }
  };
  if (band === 2 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 1_100, startDelayMs: 550,
    args: { x: 180, y: 100, targetX: [90, 270, 180][shotIndex % 3], targetY: 520, count: 3, spread: 0.24, speed: 128 }
  };
  if (band === 3 && channel === 'main') return {
    kind: 'ring', cooldownMs: 1_000, startDelayMs: 0,
    args: { x: 180, y: 96, count: 28, speed: 110, gapAngle: [1.32, 1.82][side], gapWidth: Math.PI / 7, rotation: shotIndex * 0.15 }
  };
  if (band === 3 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 750, startDelayMs: 375,
    args: { x: side ? 348 : 12, y: 260, targetX: side ? 74 : 286, targetY: 500, count: 7, spread: 1.1, speed: 122 }
  };
  if (band === 4 && channel === 'main') return {
    kind: 'ring', cooldownMs: 700, startDelayMs: 0,
    args: { x: 180, y: 92, count: 36, speed: 126, gapAngle: [1.42, 1.72][side], gapWidth: Math.PI / 10, rotation: shotIndex * 0.168 }
  };
  if (band === 4 && channel === 'secondary') return {
    kind: 'fan', cooldownMs: 520, startDelayMs: 260,
    args: { x: side ? 346 : 14, y: 190, targetX: side ? 80 : 280, targetY: 520, count: 9, spread: 1.15, speed: 135 }
  };
  return null;
}

function angleDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export function makeRing({ x, y, count, speed, gapAngle = 0, gapWidth = 0, rotation = 0 }) {
  const bullets = [];
  for (let index = 0; index < count; index += 1) {
    const angle = rotation + (index / count) * TAU;
    if (gapWidth > 0 && angleDistance(angle, gapAngle) < gapWidth / 2) continue;
    bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4 });
  }
  return bullets;
}

export function makeFan({ x, y, targetX, targetY, count, spread, speed }) {
  const center = Math.atan2(targetY - y, targetX - x);
  if (count === 1) return [{ x, y, vx: Math.cos(center) * speed, vy: Math.sin(center) * speed, radius: 4 }];
  return Array.from({ length: count }, (_, index) => {
    const angle = center - spread / 2 + (spread * index) / (count - 1);
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4 };
  });
}

export function makeAimed({ x, y, targetX, targetY, speed }) {
  return makeFan({ x, y, targetX, targetY, count: 1, spread: 0, speed })[0];
}

export function makeSpiralBullet({ x, y, angle, speed }) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4 };
}

