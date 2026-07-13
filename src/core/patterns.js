const TAU = Math.PI * 2;

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

