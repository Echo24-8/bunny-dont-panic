import { LEVELS, LOGICAL_HEIGHT, LOGICAL_WIDTH, PHASES } from '../core/constants.js';
import { getActiveSkillDefinition } from '../core/active-skills.js';
import { createResultSummary } from '../core/results.js';
import { upgradeThreshold } from '../core/upgrades.js';
import { WEAPON_DEFINITIONS } from '../core/weapons.js';

const ART = Object.freeze({
  paper: '#fff9e8',
  sticker: '#fffdf7',
  ink: '#344f5c',
  inkMuted: '#58706b',
  leaf: '#68bd7f',
  sky: '#a9dce7',
  coral: '#d94a56',
  bullet: '#f04e5c',
  gold: '#f2c451',
  tape: '#f3d98b',
  storm: '#647f91',
  chestnut: '#9a6648'
});

export const UI_RECTS = Object.freeze({
  start: { x: 72, y: 438, width: 216, height: 58 },
  settings: { x: 300, y: 16, width: 44, height: 44 },
  activeSkill: { x: 292, y: 564, width: 52, height: 52 },
  retry: { x: 72, y: 404, width: 216, height: 54 },
  share: { x: 36, y: 478, width: 136, height: 48 },
  menu: { x: 188, y: 478, width: 136, height: 48 },
  settingsMusic: { x: 52, y: 256, width: 256, height: 64 },
  settingsSfx: { x: 52, y: 336, width: 256, height: 64 },
  settingsClose: { x: 72, y: 448, width: 216, height: 54 }
});

export const WEAPON_SLOT_RECTS = Object.freeze([
  { x: 84, y: 72, width: 80, height: 30 },
  { x: 172, y: 72, width: 80, height: 30 },
  { x: 260, y: 72, width: 80, height: 30 }
]);

export function getUpgradeCardRect(index) {
  return { x: 24, y: 182 + index * 116, width: 312, height: 100 };
}

export function getEventCardRect(index) {
  return { x: 24, y: 190 + index * 142, width: 312, height: 122 };
}

export function hitRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function roundedRectPath(ctx, x, y, width, height, radius = 8) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawTape(ctx, x, y, width = 38, height = 12, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = 'rgba(243,217,139,.76)';
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeStyle = 'rgba(154,102,72,.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawPaperPanel(ctx, x, y, width, height, { fill = ART.paper, stroke = ART.ink, shadow = '#c8b879' } = {}) {
  fillRoundedRect(ctx, x + 3, y + 4, width, height, 7, shadow);
  fillRoundedRect(ctx, x, y, width, height, 7, fill, stroke, 2);
}

function drawHeart(ctx, x, y, size, filled = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.28);
  ctx.bezierCurveTo(0, -size * 0.08, -size * 0.52, -size * 0.08, -size * 0.52, size * 0.27);
  ctx.bezierCurveTo(-size * 0.52, size * 0.58, -size * 0.2, size * 0.78, 0, size);
  ctx.bezierCurveTo(size * 0.2, size * 0.78, size * 0.52, size * 0.58, size * 0.52, size * 0.27);
  ctx.bezierCurveTo(size * 0.52, -size * 0.08, 0, -size * 0.08, 0, size * 0.28);
  ctx.fillStyle = filled ? '#df4c5a' : 'rgba(255,255,255,.38)';
  ctx.strokeStyle = filled ? '#803840' : 'rgba(38,62,67,.38)';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, x, y, outerRadius, color = '#f2ca63') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : outerRadius * 0.46;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#765b2c';
  ctx.lineWidth = 1.25;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWeaponIcon(ctx, id, x, y, size, sticker = true) {
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 36;
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (sticker) {
    ctx.fillStyle = '#fffdf7';
    ctx.strokeStyle = 'rgba(52,79,92,.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = ART.ink;
  ctx.lineWidth = 2;
  if (id === 'carrot') {
    ctx.save();
    ctx.rotate(-0.55);
    ctx.fillStyle = '#ed7c42';
    ctx.beginPath();
    ctx.ellipse(0, 3, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ART.leaf;
    for (const angle of [-0.55, 0, 0.55]) {
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, -4, 2.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (id === 'dandelion') {
    ctx.fillStyle = ART.gold;
    ctx.beginPath();
    ctx.arc(-4, 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const [dx, dy] of [[-10, -8], [0, -12], [10, -7], [12, 3]]) {
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.lineTo(dx, dy);
      ctx.stroke();
      ctx.fillStyle = '#fffdf7';
      ctx.beginPath();
      ctx.ellipse(dx, dy, 2.2, 4, Math.atan2(dy, dx), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'boomerang') {
    drawStar(ctx, 0, 0, 13, ART.gold);
    ctx.fillStyle = '#4d7f91';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'bubble') {
    for (const [dx, dy, radius] of [[-5, 3, 8], [6, -4, 6], [8, 7, 4]]) {
      ctx.fillStyle = 'rgba(230,168,74,.62)';
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4f93a6';
      ctx.stroke();
    }
  } else if (id === 'lightning') {
    ctx.fillStyle = ART.sky;
    ctx.beginPath();
    ctx.arc(-7, -3, 7, Math.PI * .8, Math.PI * 2.1);
    ctx.arc(1, -7, 8, Math.PI, Math.PI * 2);
    ctx.arc(8, -2, 6, Math.PI * 1.35, Math.PI * 2.35);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ART.gold;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-3, 9);
    ctx.lineTo(2, 8);
    ctx.lineTo(-1, 16);
    ctx.lineTo(9, 5);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGearButton(ctx, rect) {
  fillRoundedRect(ctx, rect.x + 2, rect.y + 3, rect.width, rect.height, 7, 'rgba(52,79,92,.18)');
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 7, 'rgba(255,253,247,.94)', ART.ink, 2);
  ctx.save();
  ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.strokeStyle = '#31565c';
  ctx.fillStyle = '#31565c';
  ctx.lineWidth = 2.2;
  for (const y of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.lineTo(10, y);
    ctx.stroke();
  }
  for (const [x, y] of [[-3, -7], [5, 0], [-5, 7]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawButton(ctx, rect, label, variant = 'primary') {
  const palette = variant === 'primary'
    ? { fill: ART.coral, stroke: ART.ink, text: '#fffdf7', shadow: '#a73f49' }
    : { fill: ART.paper, stroke: ART.ink, text: ART.ink, shadow: '#c8b879' };
  fillRoundedRect(ctx, rect.x + 2, rect.y + 4, rect.width, rect.height, 7, palette.shadow);
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 7, palette.fill, '#fffdf7', 5);
  roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 7);
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = palette.text;
  ctx.font = '700 20px "Microsoft YaHei UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
}

function ensureResolution(canvas, dpr) {
  const width = Math.round(LOGICAL_WIDTH * dpr);
  const height = Math.round(LOGICAL_HEIGHT * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function drawBootScreen(canvas, dpr, mode = 'loading', detail = '') {
  ensureResolution(canvas, dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fff3c7';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.strokeStyle = 'rgba(92,139,158,.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= LOGICAL_WIDTH; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= LOGICAL_HEIGHT; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y); ctx.stroke();
  }
  ctx.fillStyle = '#79c99e';
  ctx.beginPath();
  ctx.arc(70, 590, 190, Math.PI, Math.PI * 2);
  ctx.arc(310, 610, 170, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.font = '800 38px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('兔兔别慌', 180, 190);
  ctx.font = '600 16px "Microsoft YaHei UI", sans-serif';
  if (mode === 'loading') {
    ctx.fillText('正在准备童话世界…', 180, 244);
    ctx.strokeStyle = ART.coral;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(180, 292, 18, -Math.PI / 2, Math.PI * 0.8);
    ctx.stroke();
  } else {
    ctx.fillText('素材没有加载完整', 180, 244);
    ctx.font = '400 13px "Microsoft YaHei UI", sans-serif';
    ctx.fillStyle = '#536d70';
    ctx.fillText(detail.slice(0, 36), 180, 276);
    drawButton(ctx, { x: 72, y: 322, width: 216, height: 56 }, '重新加载');
  }
}

function drawBackground(ctx, assets, levelId) {
  const background = levelId === LEVELS.TWO ? assets.background2 : assets.background1;
  if (background) ctx.drawImage(background, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  else {
    ctx.fillStyle = levelId === LEVELS.TWO ? '#7a9e99' : '#c8e4e1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }
}

function drawMenu(ctx, assets, now, reducedMotion) {
  drawBackground(ctx, assets, LEVELS.ONE);
  drawPaperPanel(ctx, 34, 40, 292, 116, { fill: 'rgba(255,249,232,.94)' });
  drawTape(ctx, 82, 43, 52, 13, -0.13);
  drawTape(ctx, 280, 44, 52, 13, 0.12);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 42px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('兔兔别慌', 180, 87);
  ctx.fillStyle = ART.inkMuted;
  ctx.font = '700 14px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('四关路线，每次选择都不一样。', 180, 129);

  const bob = reducedMotion ? 0 : Math.sin(now / 420) * 5;
  if (assets.bunny) ctx.drawImage(assets.bunny, 91, 176 + bob, 178, 178);
  drawButton(ctx, UI_RECTS.start, '开始冒险');
  drawGearButton(ctx, UI_RECTS.settings);
  ctx.fillStyle = 'rgba(52,79,92,.72)';
}

function drawEnemy(ctx, image, enemy) {
  const size = enemy.radius * 2.7;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(Math.sin(enemy.ageMs / 260 + enemy.poolIndex) * 0.08);
  if (enemy.kind === 'elite') {
    ctx.fillStyle = '#c95766';
    ctx.strokeStyle = ART.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9e8';
    ctx.font = '900 10px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('精英', 0, 1);
  } else if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
  else {
    ctx.fillStyle = enemy.kind === 'star' ? '#f2ca63' : enemy.kind === 'bell' ? '#6d9fc0' : '#e89a82';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPatternWarning(ctx, warning, now, reducedMotion) {
  if (!warning) return;
  const sources = {
    1: [[20, 180], [340, 180]],
    2: [[180, 100]],
    3: [[180, 96], [12, 260], [348, 260]],
    4: [[180, 92], [14, 190], [346, 190]]
  }[warning.nextBand] ?? [];
  const pulse = reducedMotion ? 1 : 0.78 + Math.sin(now / 70) * 0.16;
  ctx.beginPath();
  for (const [x, y] of sources) {
    ctx.moveTo(x + 16, y);
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    const edgeX = x < 60 ? 3 : x > LOGICAL_WIDTH - 60 ? LOGICAL_WIDTH - 3 : x;
    const edgeY = y < 120 ? 3 : y;
    ctx.moveTo(edgeX - 9, edgeY);
    ctx.lineTo(edgeX + 9, edgeY);
  }
  ctx.strokeStyle = 'rgba(231,85,96,.58)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,247,232,${pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawJoystickBase(ctx, joystick) {
  if (!joystick.active) return;
  const center = joystick.center;
  const knobX = center.x + joystick.vector.x * 28;
  const knobY = center.y + joystick.vector.y * 28;
  ctx.fillStyle = 'rgba(255,253,247,.28)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(52,79,92,.12)';
  ctx.beginPath();
  ctx.arc(center.x + 2, center.y + 3, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,253,247,.82)';
  ctx.beginPath();
  ctx.arc(knobX, knobY, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawPickupsEnemiesAndPlayerBullets(ctx, assets, world, now, reducedMotion) {
  world.pickups.forEachActive((pickup) => {
    const bob = reducedMotion ? 0 : Math.sin((now + pickup.poolIndex * 41) / 180) * 1.2;
    drawStar(ctx, pickup.x, pickup.y, 6 + bob);
  });
  world.enemies.forEachActive((enemy) => drawEnemy(ctx, assets[enemy.kind], enemy));
  world.playerBullets.forEachActive((bullet) => {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    if (bullet.weaponId === 'dandelion') {
      ctx.rotate(bullet.rotation + Math.PI / 2);
      ctx.fillStyle = '#fffdf7';
      ctx.strokeStyle = '#9a8050';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ART.gold;
      ctx.beginPath();
      ctx.arc(0, 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (bullet.weaponId === 'boomerang') {
      ctx.rotate(bullet.rotation);
      drawStar(ctx, 0, 0, 8, ART.gold);
      ctx.fillStyle = '#4d7f91';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(bullet.rotation + Math.PI / 2);
      ctx.fillStyle = '#ed7c42';
      ctx.strokeStyle = '#8a4a2d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ART.leaf;
      ctx.fillRect(-2, -9, 4, 4);
    }
    ctx.restore();
  });
  world.orbitals.forEachActive((orbital) => {
    ctx.save();
    ctx.globalAlpha = orbital.ready ? 1 : 0.28;
    ctx.fillStyle = 'rgba(230,168,74,.58)';
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(orbital.x, orbital.y, orbital.radius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#4f93a6';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.arc(orbital.x - 2.5, orbital.y - 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawWeaponEffects(ctx, effects) {
  effects.forEachActive((effect) => {
    if (effect.weaponId !== 'lightning' || effect.points.length < 2) return;
    const alpha = Math.max(0, Math.min(1, effect.lifeMs / 230));
    ctx.strokeStyle = `rgba(255,253,247,${alpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    effect.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else {
        const previous = effect.points[index - 1];
        const midX = (previous.x + point.x) / 2 + (index % 2 ? 5 : -5);
        const midY = (previous.y + point.y) / 2;
        ctx.lineTo(midX, midY);
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.strokeStyle = `rgba(242,196,81,${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawEnemyBulletsBatched(ctx, bullets) {
  ctx.fillStyle = ART.bullet;
  ctx.strokeStyle = '#fffdf7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  bullets.forEachActive((bullet) => {
    const radius = bullet.radius + 0.6;
    ctx.moveTo(bullet.x + radius, bullet.y);
    ctx.arc(bullet.x, bullet.y, radius, 0, Math.PI * 2);
  });
  ctx.fill();
  ctx.stroke();
}

function drawPlayerAndShield(ctx, assets, player, state, now, reducedMotion) {
  const invulnerableVisible = reducedMotion || state.invulnerableMs <= 0 || Math.floor(now / 80) % 2 === 0;
  if (invulnerableVisible) {
    const size = 54;
    if (assets.bunny) ctx.drawImage(assets.bunny, player.x - size / 2, player.y - size / 2 - 13, size, size);
    else {
      ctx.fillStyle = '#fff9ec';
      ctx.beginPath();
      ctx.arc(player.x, player.y - 9, 17, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (state.shieldReady) {
    ctx.strokeStyle = 'rgba(131,191,209,.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(ctx, particles, reducedMotion) {
  particles.forEachActive((particle) => {
    if (reducedMotion && particle.kind === 'graze') return;
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.lifeMs / 500));
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawHitCore(ctx, player) {
  ctx.strokeStyle = '#fffdf5';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#263e43';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawJoystickOutline(ctx, joystick) {
  if (!joystick.active) return;
  const center = joystick.center;
  const knobX = center.x + joystick.vector.x * 28;
  const knobY = center.y + joystick.vector.y * 28;
  ctx.strokeStyle = 'rgba(52,79,92,.68)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 43, 0, Math.PI * 2);
  ctx.moveTo(knobX + 18, knobY);
  ctx.arc(knobX, knobY, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawActiveSkillIcon(ctx, id, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = ART.ink;
  ctx.fillStyle = id === 'cottonGuard' ? ART.sky : id === 'forestEcho' ? ART.gold : ART.leaf;
  ctx.lineWidth = 2;
  if (id === 'cottonGuard') {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(9, -6);
    ctx.lineTo(7, 6);
    ctx.lineTo(0, 11);
    ctx.lineTo(-7, 6);
    ctx.lineTo(-9, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (id === 'forestEcho') {
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(2, -8);
    ctx.lineTo(2, -2);
    ctx.lineTo(11, -2);
    ctx.lineTo(0, 9);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawActiveSkillButton(ctx, state) {
  const rect = UI_RECTS.activeSkill;
  const skillState = state.activeSkill ?? { id: 'dash', cooldownMs: 0 };
  const definition = getActiveSkillDefinition(skillState.id);
  const cooling = skillState.cooldownMs > 0;
  fillRoundedRect(ctx, rect.x + 2, rect.y + 3, rect.width, rect.height, 8, '#c8b879');
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8, cooling ? 'rgba(255,253,247,.72)' : ART.sticker, cooling ? ART.inkMuted : ART.ink, 1.5);
  drawActiveSkillIcon(ctx, definition.id, rect.x + rect.width / 2, rect.y + 20);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 10px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(definition.id === 'cottonGuard' ? '护体' : definition.id === 'forestEcho' ? '回响' : '冲刺', rect.x + rect.width / 2, rect.y + 42);
  if (cooling) {
    ctx.fillStyle = 'rgba(52,79,92,.58)';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = '#fffdf7';
    ctx.font = '900 15px ui-monospace, monospace';
    ctx.fillText(`${Math.ceil(skillState.cooldownMs / 1000)}`, rect.x + rect.width / 2, rect.y + rect.height / 2);
  }
}

function drawWorld(ctx, assets, world, state, input, now, reducedMotion) {
  const joystick = input.getJoystickState();
  drawBackground(ctx, assets, state.levelId || LEVELS.ONE);
  drawPatternWarning(ctx, world.patternWarning, now, reducedMotion);
  drawJoystickBase(ctx, joystick);
  drawPickupsEnemiesAndPlayerBullets(ctx, assets, world, now, reducedMotion);
  drawWeaponEffects(ctx, world.weaponEffects);
  drawEnemyBulletsBatched(ctx, world.enemyBullets);
  drawPlayerAndShield(ctx, assets, world.player, state, now, reducedMotion);
  drawParticles(ctx, world.particles, reducedMotion);
  drawHitCore(ctx, world.player);
  drawHud(ctx, state, now, reducedMotion);
  if (world.bossState) {
    const progress = Math.max(0, Math.min(1, world.bossState.hp / world.bossState.maxHp));
    fillRoundedRect(ctx, 84, 108, 192, 12, 6, 'rgba(52,79,92,.38)', '#fffdf7', 1.5);
    if (progress > 0) fillRoundedRect(ctx, 84, 108, 192 * progress, 12, 6, world.bossState.phase === 2 ? ART.coral : ART.gold);
    ctx.fillStyle = ART.paper;
    ctx.textAlign = 'center';
    ctx.font = '800 10px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(`森林守护者 · 阶段 ${world.bossState.phase}`, 180, 114);
  }
  drawActiveSkillButton(ctx, state);
  drawJoystickOutline(ctx, joystick);
}

function drawWeaponSlot(ctx, rect, slot) {
  ctx.save();
  if (!slot) {
    fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 6, 'rgba(255,253,247,.5)');
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(52,79,92,.48)';
    ctx.lineWidth = 1.5;
    roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(52,79,92,.56)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px "Microsoft YaHei UI", sans-serif';
    ctx.fillText('空槽', rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
    ctx.restore();
    return;
  }
  fillRoundedRect(ctx, rect.x + 2, rect.y + 2, rect.width, rect.height, 6, 'rgba(52,79,92,.15)');
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 6, 'rgba(255,253,247,.9)', '#fffdf7', 3);
  roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 6);
  ctx.strokeStyle = ART.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawWeaponIcon(ctx, slot.id, rect.x + 17, rect.y + 15, 22, false);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '800 12px ui-monospace, monospace';
  ctx.fillText(`Lv.${slot.level}`, rect.x + 32, rect.y + 16);
  ctx.restore();
}

function drawHud(ctx, state, now, reducedMotion) {
  const criticalHealth = state.health === 1;
  fillRoundedRect(ctx, 10, 13, 112, 42, 7, 'rgba(52,79,92,.16)');
  fillRoundedRect(ctx, 10, 10, 112, 42, 7, 'rgba(255,253,247,.92)', criticalHealth ? ART.coral : ART.ink, criticalHealth ? 2.5 : 1.5);
  for (let index = 0; index < state.maxHealth; index += 1) drawHeart(ctx, 28 + index * 34, 19, 14, index < state.health);
  fillRoundedRect(ctx, 138, 13, 88, 42, 7, 'rgba(52,79,92,.16)');
  fillRoundedRect(ctx, 136, 10, 88, 42, 7, 'rgba(255,253,247,.94)', ART.ink, 1.5);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 22px ui-monospace, "Cascadia Mono", monospace';
  ctx.fillText(String(Math.ceil(state.remainingMs / 1000)).padStart(2, '0'), 180, 31);
  drawGearButton(ctx, UI_RECTS.settings);

  const threshold = upgradeThreshold(state.upgradeCount);
  const progress = Math.max(0, Math.min(1, state.xp / threshold));
  fillRoundedRect(ctx, 88, 59, 184, 9, 4.5, 'rgba(52,79,92,.28)', '#fffdf7', 1.5);
  if (progress > 0) fillRoundedRect(ctx, 88, 59, 184 * progress, 9, 4.5, ART.gold);
  fillRoundedRect(ctx, 10, 72, 64, 30, 6, 'rgba(255,253,247,.9)', ART.ink, 1.5);
  ctx.fillStyle = ART.ink;
  ctx.font = '800 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`第 ${state.levelId} 关`, 42, 87);
  WEAPON_SLOT_RECTS.forEach((rect, index) => drawWeaponSlot(ctx, rect, state.build.weaponSlots[index]));

  if (state.readyMs > 0) {
    const alpha = reducedMotion ? 1 : 0.84 + Math.sin(now / 100) * 0.12;
    fillRoundedRect(ctx, 120, 278, 120, 52, 7, `rgba(255,253,247,${alpha})`, ART.ink, 2);
    drawTape(ctx, 180, 277, 42, 11, -0.04);
    ctx.fillStyle = ART.ink;
    ctx.font = '900 22px "Microsoft YaHei UI", sans-serif';
    ctx.fillText('准备', 180, 304);
  }

  if (state.invulnerableMs > 820) {
    ctx.strokeStyle = '#e75560';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, LOGICAL_WIDTH - 4, LOGICAL_HEIGHT - 4);
  }
}

function drawUpgradeIcon(ctx, id, x, y) {
  if (WEAPON_DEFINITIONS.some((definition) => definition.id === id)) {
    drawWeaponIcon(ctx, id, x, y, 46);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = ART.ink;
  ctx.fillStyle = id === 'heart' ? ART.coral : id === 'shield' ? ART.sky : ART.gold;
  ctx.lineWidth = 2;
  if (id === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(13, -8);
    ctx.lineTo(10, 8);
    ctx.lineTo(0, 16);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-13, -8);
    ctx.closePath();
  } else if (id === 'heart') {
    drawHeart(ctx, 0, -8, 17, true);
    ctx.restore();
    return;
  } else if (id === 'moveSpeed') {
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.lineTo(-2, -9);
    ctx.lineTo(5, 2);
    ctx.lineTo(14, 7);
    ctx.lineTo(8, 13);
    ctx.lineTo(-10, 12);
    ctx.closePath();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeOverlay(ctx, choices) {
  ctx.fillStyle = 'rgba(35,58,64,.62)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = ART.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 28px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('挑一张贴纸', 180, 118);
  ctx.font = '600 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('战斗暂停中', 180, 148);
  drawTape(ctx, 126, 91, 48, 13, -0.12);
  drawTape(ctx, 234, 91, 48, 13, 0.11);

  choices.forEach((choice, index) => {
    const rect = getUpgradeCardRect(index);
    drawPaperPanel(ctx, rect.x, rect.y, rect.width, rect.height);
    drawUpgradeIcon(ctx, choice.id, rect.x + 49, rect.y + 53);
    const categoryLabel = choice.category === 'weapon'
      ? (choice.preview?.levelText === '解锁' ? '新武器' : '武器升级')
      : choice.category === 'consumable' ? '立即生效' : '辅助能力';
    const categoryFill = choice.category === 'weapon' ? '#d8eef1' : choice.category === 'consumable' ? '#f7d2d0' : '#f7e8a9';
    fillRoundedRect(ctx, rect.x + 80, rect.y + 10, 64, 22, 5, categoryFill, 'rgba(52,79,92,.24)', 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = ART.ink;
    ctx.font = '800 12px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(categoryLabel, rect.x + 112, rect.y + 21);
    ctx.textAlign = 'left';
    ctx.fillStyle = ART.ink;
    ctx.font = '800 18px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(choice.title, rect.x + 82, rect.y + 48, 148);
    ctx.textAlign = 'right';
    ctx.fillStyle = ART.chestnut;
    ctx.font = '800 12px ui-monospace, monospace';
    ctx.fillText(choice.preview?.levelText ?? '', rect.x + rect.width - 16, rect.y + 48, 78);
    ctx.textAlign = 'left';
    ctx.fillStyle = ART.inkMuted;
    ctx.font = '500 12px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(choice.preview?.valueText ?? choice.description, rect.x + 82, rect.y + 70, rect.width - 102);
    if (choice.roleLabel) {
      ctx.fillStyle = ART.chestnut;
      ctx.font = '700 10px "Microsoft YaHei UI", sans-serif';
      ctx.fillText(`定位：${choice.roleLabel}`, rect.x + 82, rect.y + 88, rect.width - 102);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = ART.chestnut;
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.fillText(String(index + 1), rect.x + rect.width - 14, rect.y + 18);
  });
}

function drawEventOverlay(ctx, choices) {
  ctx.fillStyle = 'rgba(35,58,64,.66)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = ART.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 28px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('选择一张事件卡', 180, 112);
  ctx.font = '600 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('下一关的路线由你决定', 180, 142);
  choices.forEach((choice, index) => {
    const rect = getEventCardRect(index);
    drawPaperPanel(ctx, rect.x, rect.y, rect.width, rect.height, { fill: index ? '#fffdf7' : ART.paper });
    fillRoundedRect(ctx, rect.x + 12, rect.y + 12, 70, 22, 5, index ? '#d8eef1' : '#f7e8a9', 'rgba(52,79,92,.24)', 1);
    ctx.fillStyle = ART.ink;
    ctx.font = '800 11px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`路线 ${index + 1}`, rect.x + 47, rect.y + 23);
    ctx.textAlign = 'left';
    ctx.font = '900 19px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(choice.title, rect.x + 96, rect.y + 28);
    ctx.fillStyle = ART.inkMuted;
    ctx.font = '600 13px "Microsoft YaHei UI", sans-serif';
    const description = String(choice.description ?? '').slice(0, 42);
    ctx.fillText(description.slice(0, 21), rect.x + 16, rect.y + 68);
    if (description.length > 21) ctx.fillText(description.slice(21, 42), rect.x + 16, rect.y + 88);
    ctx.fillStyle = ART.chestnut;
    ctx.font = '700 11px "Microsoft YaHei UI", sans-serif';
    ctx.fillText('点击选择', rect.x + 16, rect.y + 108);
    ctx.textAlign = 'right';
    ctx.fillText(String(index + 1), rect.x + rect.width - 14, rect.y + 20);
  });
}

function drawTransition(ctx, assets, state) {
  drawBackground(ctx, assets, LEVELS.TWO);
  ctx.fillStyle = 'rgba(24,42,45,.58)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  drawPaperPanel(ctx, 54, 232, 252, 126, { fill: 'rgba(255,249,232,.95)' });
  drawTape(ctx, 90, 237, 46, 12, -0.1);
  drawTape(ctx, 270, 237, 46, 12, 0.1);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 26px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('第 2 关', 180, 270);
  ctx.font = '700 18px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('难度略有提升', 180, 310);
  ctx.fillStyle = ART.gold;
  ctx.fillRect(94, 350, Math.max(0, 172 * (1 - state.transitionMs / 1200)), 5);
}

function shareStatusLabel(status) {
  return {
    shared: '已分享',
    cancelled: '已取消',
    copied: '战绩文字已复制',
    downloaded: '战绩图片已保存',
    'copied-and-downloaded': '文字已复制，图片已保存',
    failed: '分享失败，请手动发送图片'
  }[status] ?? '';
}

function drawResult(ctx, assets, state, shareStatus) {
  drawBackground(ctx, assets, LEVELS.TWO);
  drawPaperPanel(ctx, 28, 88, 304, 472, { fill: 'rgba(255,249,232,.94)' });
  drawTape(ctx, 78, 91, 54, 13, -0.12);
  drawTape(ctx, 282, 92, 54, 13, 0.11);
  const success = state.result?.kind === 'success';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ART.ink;
  ctx.font = '900 30px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '你居然撑住了' : '兔兔尽力了', 180, 142);
  ctx.fillStyle = success ? '#3e8562' : ART.coral;
  ctx.font = '900 48px ui-monospace, "Cascadia Mono", monospace';
  const summary = createResultSummary(state);
  const seconds = (summary.survivalMs / 1000).toFixed(1);
  ctx.fillText(`${seconds}s`, 180, 213);
  ctx.fillStyle = ART.inkMuted;
  ctx.font = '700 14px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '四关挑战完成' : '本次存活时间', 180, 255);

  const attemptLine = summary.badge
    ? `第 ${summary.attempt} 次挑战 · ${summary.badge}`
    : `第 ${summary.attempt} 次挑战`;
  const statisticLines = [
    `会话最佳 ${(summary.bestSurvivalMs / 1000).toFixed(1)} 秒`,
    attemptLine,
    summary.buildSummary
  ];
  ctx.fillStyle = ART.ink;
  ctx.font = '700 14px "Microsoft YaHei UI", sans-serif';
  statisticLines.forEach((line, index) => ctx.fillText(line, 180, 305 + index * 26, 260));
  ctx.fillStyle = '#8a4a50';
  ctx.font = '700 11px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(shareStatusLabel(shareStatus), 180, 390, 260);

  drawButton(ctx, UI_RECTS.retry, success ? '再玩一次' : '再试一次');
  drawButton(ctx, UI_RECTS.share, '分享战绩', 'secondary');
  drawButton(ctx, UI_RECTS.menu, '返回首页', 'secondary');
}

function drawToggle(ctx, rect, label, enabled) {
  fillRoundedRect(ctx, rect.x + 2, rect.y + 3, rect.width, rect.height, 7, '#c8b879');
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 7, ART.sticker, ART.ink, 1.5);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'left';
  ctx.font = '800 17px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(label, rect.x + 22, rect.y + rect.height / 2);
  const trackX = rect.x + rect.width - 70;
  const trackY = rect.y + 17;
  fillRoundedRect(ctx, trackX, trackY, 48, 30, 15, enabled ? ART.leaf : '#aab4ae');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(trackX + (enabled ? 33 : 15), trackY + 15, 11, 0, Math.PI * 2);
  ctx.fill();
}

function drawSettings(ctx, settings) {
  ctx.fillStyle = 'rgba(25,43,46,.64)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  drawPaperPanel(ctx, 28, 152, 304, 374);
  drawTape(ctx, 82, 156, 52, 13, -0.12);
  drawTape(ctx, 278, 156, 52, 13, 0.12);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.font = '900 27px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('声音设置', 180, 210);
  drawToggle(ctx, UI_RECTS.settingsMusic, '音乐', settings.music);
  drawToggle(ctx, UI_RECTS.settingsSfx, '音效', settings.sfx);
  drawButton(ctx, UI_RECTS.settingsClose, '完成', 'secondary');
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(25,43,46,.52)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  drawPaperPanel(ctx, 92, 270, 176, 88);
  drawTape(ctx, 180, 272, 48, 12, -0.05);
  ctx.fillStyle = ART.ink;
  ctx.textAlign = 'center';
  ctx.font = '900 24px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('已暂停', 180, 315);
}

function drawShareBackground(ctx, image) {
  ctx.fillStyle = '#9fc5bd';
  ctx.fillRect(0, 0, 1080, 1440);
  if (!image) return;
  const sourceWidth = image.naturalWidth || image.width || 1080;
  const sourceHeight = image.naturalHeight || image.height || 1440;
  const scale = Math.max(1080 / sourceWidth, 1440 / sourceHeight);
  const sourceCropWidth = 1080 / scale;
  const sourceCropHeight = 1440 / scale;
  const sourceX = (sourceWidth - sourceCropWidth) / 2;
  const sourceY = (sourceHeight - sourceCropHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceCropWidth, sourceCropHeight, 0, 0, 1080, 1440);
}

function createShareImage(assets, summary) {
  const offscreen = globalThis.document?.createElement?.('canvas');
  if (!offscreen) return Promise.reject(new Error('share-image-failed'));
  offscreen.width = 1080;
  offscreen.height = 1440;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return Promise.reject(new Error('share-image-failed'));

  drawShareBackground(ctx, assets.background2);
  ctx.fillStyle = 'rgba(248,251,241,.88)';
  fillRoundedRect(ctx, 72, 72, 936, 1296, 24, 'rgba(248,251,241,.88)', 'rgba(38,62,67,.28)', 5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#29474c';
  ctx.font = '900 86px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('兔兔别慌', 540, 184, 840);
  ctx.fillStyle = '#526c67';
  ctx.font = '700 34px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('四关生存挑战战绩', 540, 262);

  const success = summary.kind === 'success';
  ctx.fillStyle = success ? '#4f8c69' : '#c64552';
  ctx.font = '900 150px ui-monospace, "Cascadia Mono", monospace';
  ctx.fillText(`${(summary.survivalMs / 1000).toFixed(1)}s`, 540, 458, 820);
  ctx.fillStyle = '#526c67';
  ctx.font = '700 38px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '成功完成四关挑战' : '本次存活时间', 540, 570);

  ctx.fillStyle = '#29474c';
  ctx.font = '800 42px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`会话最佳 ${(summary.bestSurvivalMs / 1000).toFixed(1)} 秒`, 540, 704, 820);
  ctx.fillText(`第 ${summary.attempt} 次挑战`, 540, 786, 820);
  if (summary.badge) {
    ctx.fillStyle = '#9b6c3e';
    ctx.fillText(summary.badge, 540, 868, 820);
  }

  ctx.fillStyle = '#f2ca63';
  ctx.fillRect(200, 944, 680, 6);
  ctx.fillStyle = '#455f61';
  ctx.font = '700 40px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(summary.buildSummary, 540, 1038, 820);
  ctx.fillStyle = '#657b77';
  ctx.font = '600 32px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('当前能力构筑', 540, 1102);
  ctx.fillStyle = '#29474c';
  ctx.font = '800 36px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('四关生存挑战', 540, 1262);

  return new Promise((resolve, reject) => {
    if (typeof offscreen.toBlob !== 'function') {
      reject(new Error('share-image-failed'));
      return;
    }
    offscreen.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('share-image-failed'));
    }, 'image/png');
  });
}

export function createRenderer(canvas, assets, { reducedMotion = false, dpr = 1 } = {}) {
  ensureResolution(canvas, dpr);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  const debug = new URLSearchParams(globalThis.location?.search ?? '').has('debug');

  return {
    setDpr(nextDpr) {
      dpr = nextDpr;
      ensureResolution(canvas, dpr);
    },
    createShareImage(summary) {
      return createShareImage(assets, summary);
    },
    render({ state, world, choices, input, settings, now, fps, shareStatus = '' }) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      if (state.phase === PHASES.MENU) drawMenu(ctx, assets, now, reducedMotion);
      else if (state.phase === PHASES.TRANSITION) drawTransition(ctx, assets, state);
      else if (state.phase === PHASES.RESULT) drawResult(ctx, assets, state, shareStatus);
      else {
        drawWorld(ctx, assets, world, state, input, now, reducedMotion);
        if (state.phase === PHASES.UPGRADE) drawUpgradeOverlay(ctx, choices);
        if (state.phase === PHASES.EVENT) drawEventOverlay(ctx, state.pendingEventChoices ?? []);
      }
      if (state.paused && !state.settingsOpen && state.phase !== PHASES.MENU && state.phase !== PHASES.RESULT) drawPaused(ctx);
      if (state.settingsOpen) drawSettings(ctx, settings);
      if (debug) {
        ctx.fillStyle = 'rgba(20,35,36,.74)';
        ctx.fillRect(8, 604, 90, 26);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.fillText(`${fps.toFixed(0)} FPS · ${world.enemyBullets.activeCount}`, 14, 621);
      }
    }
  };
}
