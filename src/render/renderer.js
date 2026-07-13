import { LEVELS, LOGICAL_HEIGHT, LOGICAL_WIDTH, PHASES } from '../core/constants.js';
import { createResultSummary } from '../core/results.js';
import { upgradeThreshold } from '../core/upgrades.js';

export const UI_RECTS = Object.freeze({
  start: { x: 72, y: 438, width: 216, height: 58 },
  settings: { x: 300, y: 16, width: 44, height: 44 },
  retry: { x: 72, y: 404, width: 216, height: 54 },
  share: { x: 36, y: 478, width: 136, height: 48 },
  menu: { x: 188, y: 478, width: 136, height: 48 },
  settingsMusic: { x: 52, y: 256, width: 256, height: 64 },
  settingsSfx: { x: 52, y: 336, width: 256, height: 64 },
  settingsClose: { x: 72, y: 448, width: 216, height: 54 }
});

export function getUpgradeCardRect(index) {
  return { x: 32, y: 190 + index * 108, width: 296, height: 92 };
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

function drawGearButton(ctx, rect) {
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8, 'rgba(250,253,247,.84)', 'rgba(38,62,67,.24)', 1);
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
    ? { fill: '#e75560', stroke: '#873942', text: '#fffaf2', shadow: '#ad3e49' }
    : { fill: '#f9f4df', stroke: '#526c67', text: '#29474c', shadow: '#d0c79e' };
  fillRoundedRect(ctx, rect.x, rect.y + 4, rect.width, rect.height, 8, palette.shadow);
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8, palette.fill, palette.stroke, 2);
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
  ctx.fillStyle = '#d8edf0';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = '#8bb99c';
  ctx.beginPath();
  ctx.arc(70, 590, 190, Math.PI, Math.PI * 2);
  ctx.arc(310, 610, 170, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#29474c';
  ctx.textAlign = 'center';
  ctx.font = '800 38px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('兔兔别慌', 180, 190);
  ctx.font = '600 16px "Microsoft YaHei UI", sans-serif';
  if (mode === 'loading') {
    ctx.fillText('正在准备童话世界…', 180, 244);
    ctx.strokeStyle = '#e75560';
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
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let index = 0; index < 26; index += 1) {
    const x = (index * 83) % LOGICAL_WIDTH;
    const y = (index * 137) % LOGICAL_HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMenu(ctx, assets, now, reducedMotion) {
  drawBackground(ctx, assets, LEVELS.ONE);
  ctx.fillStyle = 'rgba(246,250,238,.84)';
  ctx.beginPath();
  ctx.ellipse(180, 98, 146, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#29474c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 42px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('兔兔别慌', 180, 88);
  ctx.fillStyle = '#526c67';
  ctx.font = '700 14px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('两关。真的只有两关。', 180, 128);

  const bob = reducedMotion ? 0 : Math.sin(now / 420) * 5;
  if (assets.bunny) ctx.drawImage(assets.bunny, 98, 186 + bob, 164, 164);
  drawButton(ctx, UI_RECTS.start, '开始冒险');
  drawGearButton(ctx, UI_RECTS.settings);
  ctx.fillStyle = 'rgba(38,62,67,.72)';
}

function drawEnemy(ctx, image, enemy) {
  const size = enemy.radius * 2.7;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation * 0.22);
  if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
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
  ctx.fillStyle = 'rgba(38,62,67,.14)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(250,253,247,.52)';
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
    ctx.rotate(bullet.rotation + Math.PI / 2);
    ctx.fillStyle = '#ed7c42';
    ctx.strokeStyle = '#8a4a2d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5d9d70';
    ctx.fillRect(-2, -9, 4, 4);
    ctx.restore();
  });
}

function drawEnemyBulletsBatched(ctx, bullets) {
  ctx.fillStyle = '#e64f5c';
  ctx.strokeStyle = '#fff7e8';
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
    ctx.strokeStyle = 'rgba(111,190,204,.9)';
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
  ctx.strokeStyle = 'rgba(255,255,255,.72)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 43, 0, Math.PI * 2);
  ctx.moveTo(knobX + 18, knobY);
  ctx.arc(knobX, knobY, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWorld(ctx, assets, world, state, input, now, reducedMotion) {
  const joystick = input.getJoystickState();
  drawBackground(ctx, assets, state.levelId || LEVELS.ONE);
  drawPatternWarning(ctx, world.patternWarning, now, reducedMotion);
  drawJoystickBase(ctx, joystick);
  drawPickupsEnemiesAndPlayerBullets(ctx, assets, world, now, reducedMotion);
  drawEnemyBulletsBatched(ctx, world.enemyBullets);
  drawPlayerAndShield(ctx, assets, world.player, state, now, reducedMotion);
  drawParticles(ctx, world.particles, reducedMotion);
  drawHitCore(ctx, world.player);
  drawHud(ctx, state, now, reducedMotion);
  drawJoystickOutline(ctx, joystick);
}

function drawHud(ctx, state, now, reducedMotion) {
  const criticalHealth = state.health === 1;
  fillRoundedRect(
    ctx,
    10,
    12,
    118,
    44,
    8,
    'rgba(250,253,247,.84)',
    criticalHealth ? '#e75560' : 'rgba(38,62,67,.18)',
    criticalHealth ? 2.5 : 1
  );
  for (let index = 0; index < state.maxHealth; index += 1) drawHeart(ctx, 31 + index * 33, 23, 14, index < state.health);
  fillRoundedRect(ctx, 138, 12, 96, 44, 8, 'rgba(250,253,247,.9)', 'rgba(38,62,67,.18)');
  ctx.fillStyle = '#29474c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 22px ui-monospace, "Cascadia Mono", monospace';
  ctx.fillText(String(Math.ceil(state.remainingMs / 1000)).padStart(2, '0'), 186, 34);
  drawGearButton(ctx, UI_RECTS.settings);

  const threshold = upgradeThreshold(state.upgradeCount);
  const progress = Math.max(0, Math.min(1, state.xp / threshold));
  fillRoundedRect(ctx, 104, 64, 152, 10, 5, 'rgba(34,65,66,.28)');
  if (progress > 0) fillRoundedRect(ctx, 104, 64, 152 * progress, 10, 5, '#f2ca63');
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = '700 11px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`第 ${state.levelId} 关`, 180, 88);

  if (state.readyMs > 0) {
    const alpha = reducedMotion ? 1 : 0.84 + Math.sin(now / 100) * 0.12;
    fillRoundedRect(ctx, 120, 278, 120, 52, 8, `rgba(250,253,247,${alpha})`, '#526c67', 2);
    ctx.fillStyle = '#29474c';
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
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#31565c';
  ctx.fillStyle = id === 'heart' ? '#df4c5a' : id === 'shield' ? '#74b9c6' : '#f2ca63';
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
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawUpgradeOverlay(ctx, choices) {
  ctx.fillStyle = 'rgba(25,43,46,.58)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = '#fffaf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 28px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('选一个，别想太久', 180, 126);
  ctx.font = '600 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('战斗已暂停', 180, 156);

  choices.forEach((choice, index) => {
    const rect = getUpgradeCardRect(index);
    fillRoundedRect(ctx, rect.x, rect.y + 3, rect.width, rect.height, 8, '#b9ad85');
    fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8, '#fffaf0', '#5a706d', 2);
    drawUpgradeIcon(ctx, choice.id, rect.x + 48, rect.y + 46);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#29474c';
    ctx.font = '800 18px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(choice.title, rect.x + 82, rect.y + 34, 132);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9b6c3e';
    ctx.font = '800 11px ui-monospace, monospace';
    ctx.fillText(choice.preview?.levelText ?? '', rect.x + rect.width - 18, rect.y + 35, 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5b706e';
    ctx.font = '500 13px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(choice.preview?.valueText ?? choice.description, rect.x + 82, rect.y + 61, rect.width - 104);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9b6c3e';
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.fillText(String(index + 1), rect.x + rect.width - 18, rect.y + 18);
  });
}

function drawTransition(ctx, assets, state) {
  drawBackground(ctx, assets, LEVELS.TWO);
  ctx.fillStyle = 'rgba(24,42,45,.58)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = '#fffaf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 26px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('第 2 关', 180, 270);
  ctx.font = '700 18px "Microsoft YaHei UI", sans-serif';
  ctx.fillText('难度略有提升', 180, 310);
  ctx.fillStyle = '#f2ca63';
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
  ctx.fillStyle = 'rgba(246,250,238,.9)';
  roundedRectPath(ctx, 28, 88, 304, 472, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(38,62,67,.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const success = state.result?.kind === 'success';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#29474c';
  ctx.font = '900 30px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '你居然撑住了' : '兔兔尽力了', 180, 142);
  ctx.fillStyle = success ? '#4f8c69' : '#c64552';
  ctx.font = '900 48px ui-monospace, "Cascadia Mono", monospace';
  const summary = createResultSummary(state);
  const seconds = (summary.survivalMs / 1000).toFixed(1);
  ctx.fillText(`${seconds}s`, 180, 213);
  ctx.fillStyle = '#5b706e';
  ctx.font = '700 14px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '第二关完成' : '本次存活时间', 180, 255);

  const attemptLine = summary.badge
    ? `第 ${summary.attempt} 次挑战 · ${summary.badge}`
    : `第 ${summary.attempt} 次挑战`;
  const statisticLines = [
    `会话最佳 ${(summary.bestSurvivalMs / 1000).toFixed(1)} 秒`,
    attemptLine,
    summary.buildSummary
  ];
  ctx.fillStyle = '#455f61';
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
  fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8, '#fffaf0', '#607671', 1.5);
  ctx.fillStyle = '#29474c';
  ctx.textAlign = 'left';
  ctx.font = '800 17px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(label, rect.x + 22, rect.y + rect.height / 2);
  const trackX = rect.x + rect.width - 70;
  const trackY = rect.y + 17;
  fillRoundedRect(ctx, trackX, trackY, 48, 30, 15, enabled ? '#4f9471' : '#aab4ae');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(trackX + (enabled ? 33 : 15), trackY + 15, 11, 0, Math.PI * 2);
  ctx.fill();
}

function drawSettings(ctx, settings) {
  ctx.fillStyle = 'rgba(25,43,46,.64)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  fillRoundedRect(ctx, 28, 152, 304, 374, 8, '#f3ead0', '#4d6763', 2);
  ctx.fillStyle = '#29474c';
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
  fillRoundedRect(ctx, 92, 270, 176, 88, 8, '#fffaf0', '#58706b', 2);
  ctx.fillStyle = '#29474c';
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
  ctx.fillText('极难第二关战绩', 540, 262);

  const success = summary.kind === 'success';
  ctx.fillStyle = success ? '#4f8c69' : '#c64552';
  ctx.font = '900 150px ui-monospace, "Cascadia Mono", monospace';
  ctx.fillText(`${(summary.survivalMs / 1000).toFixed(1)}s`, 540, 458, 820);
  ctx.fillStyle = '#526c67';
  ctx.font = '700 38px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(success ? '成功撑满 60 秒' : '本次存活时间', 540, 570);

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
  ctx.fillText('两关生存挑战', 540, 1262);

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
