import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../core/constants.js';

const SETTINGS_KEY = 'bunny-dont-panic.settings.v1';
const MOVEMENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export function joystickVectorFromPoint(point, center, deadZone = 4, fullSpeedDistance = 24) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= deadZone) return { x: 0, y: 0 };
  const strength = distance >= fullSpeedDistance
    ? 1
    : 0.35 + 0.65 * ((distance - deadZone) / (fullSpeedDistance - deadZone));
  return { x: (dx / distance) * strength, y: (dy / distance) * strength };
}

export function followJoystickCenter(point, center, radius = 42) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return { ...center };
  const overflow = distance - radius;
  return {
    x: center.x + (dx / distance) * overflow,
    y: center.y + (dy / distance) * overflow
  };
}

export function isJoystickTrigger(point, enabled) {
  return enabled && point.y >= LOGICAL_HEIGHT / 2;
}

function createInputAdapter(canvas) {
  const keys = new Set();
  const keyPulseUntil = new Map();
  const taps = [];
  const selections = [];
  const debugActions = [];
  let confirmCount = 0;
  let joystickPointerId = null;
  let joystickVector = { x: 0, y: 0 };
  let joystickPulseVector = { x: 0, y: 0 };
  let joystickPulseUntil = 0;
  let joystickActive = false;
  let joystickEnabled = false;
  const joystickCenter = { x: 68, y: 548 };

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT
    };
  }

  function updateJoystick(point) {
    joystickVector = joystickVectorFromPoint(point, joystickCenter);
  }

  function onPointerDown(event) {
    const point = toLogical(event);
    canvas.focus({ preventScroll: true });
    if (joystickEnabled && point.x <= 150 && point.y >= 420 && joystickPointerId === null) {
      joystickPointerId = event.pointerId;
      joystickActive = true;
      updateJoystick(point);
      canvas.setPointerCapture?.(event.pointerId);
    } else {
      taps.push(point);
    }
  }

  function onPointerMove(event) {
    if (event.pointerId !== joystickPointerId) return;
    updateJoystick(toLogical(event));
  }

  function releasePointer(event) {
    if (event.pointerId !== joystickPointerId) return;
    joystickPulseVector = { ...joystickVector };
    joystickPulseUntil = performance.now() + 90;
    joystickPointerId = null;
    joystickVector = { x: 0, y: 0 };
    joystickActive = false;
  }

  function onKeyDown(event) {
    if (MOVEMENT_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
    keys.add(event.code);
    if (MOVEMENT_KEYS.has(event.code)) keyPulseUntil.set(event.code, performance.now() + 90);
    if (!event.repeat && (event.code === 'Enter' || event.code === 'Space')) confirmCount += 1;
    if (!event.repeat && /^Digit[1-3]$/.test(event.code)) selections.push(Number(event.code.at(-1)) - 1);
    if (!event.repeat && event.code === 'KeyL') debugActions.push('next-level');
    if (!event.repeat && event.code === 'KeyU') debugActions.push('upgrade');
    if (!event.repeat && event.code === 'KeyB') debugActions.push('stress-bullets');
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function clear() {
    keys.clear();
    keyPulseUntil.clear();
    taps.length = 0;
    selections.length = 0;
    debugActions.length = 0;
    confirmCount = 0;
    joystickPointerId = null;
    joystickVector = { x: 0, y: 0 };
    joystickPulseVector = { x: 0, y: 0 };
    joystickPulseUntil = 0;
    joystickActive = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);

  return {
    readVector() {
      const active = (code) => keys.has(code) || (keyPulseUntil.get(code) ?? 0) > performance.now();
      const keyboard = normalizeVector(
        Number(active('ArrowRight') || active('KeyD')) - Number(active('ArrowLeft') || active('KeyA')),
        Number(active('ArrowDown') || active('KeyS')) - Number(active('ArrowUp') || active('KeyW'))
      );
      if (Math.hypot(keyboard.x, keyboard.y) > 0) return keyboard;
      if (joystickActive) return joystickVector;
      return joystickPulseUntil > performance.now() ? joystickPulseVector : { x: 0, y: 0 };
    },
    consumeTaps() {
      return taps.splice(0, taps.length);
    },
    consumeConfirm() {
      if (confirmCount === 0) return false;
      confirmCount -= 1;
      return true;
    },
    consumeSelection() {
      return selections.shift() ?? null;
    },
    consumeDebugAction() {
      return debugActions.shift() ?? null;
    },
    getJoystickState() {
      return { active: joystickActive, center: { ...joystickCenter }, vector: { ...joystickVector } };
    },
    setJoystickEnabled(enabled) {
      joystickEnabled = enabled;
      if (!enabled) clear();
    },
    clear,
    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', releasePointer);
      canvas.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
    }
  };
}

function createStorageAdapter() {
  return {
    loadSettings() {
      try {
        const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
        return { music: value.music !== false, sfx: value.sfx !== false };
      } catch {
        return { music: true, sfx: true };
      }
    },
    saveSettings(settings) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
    }
  };
}

function createAudioAdapter(manifest, initialSettings) {
  const sources = new Map();
  const activeSfx = new Set();
  let settings = { ...initialSettings };
  let currentMusicId = null;
  let musicElement = null;
  let pausedByLifecycle = false;

  for (const [id, definition] of Object.entries(manifest)) {
    const audio = new Audio(definition.src);
    audio.preload = definition.kind === 'music' ? 'auto' : 'metadata';
    sources.set(id, { ...definition, audio });
  }

  function safePlay(audio) {
    const result = audio.play();
    if (result?.catch) result.catch(() => {});
  }

  return {
    unlock() {
      const first = sources.values().next().value?.audio;
      if (!first) return;
      first.volume = 0;
      safePlay(first);
      first.pause();
      first.currentTime = 0;
      first.volume = 1;
    },
    play(id, options = {}) {
      const source = sources.get(id);
      if (!source) return;
      if (source.kind === 'music') {
        currentMusicId = id;
        musicElement?.pause();
        musicElement = source.audio;
        musicElement.loop = options.loop !== false;
        musicElement.currentTime = 0;
        musicElement.volume = options.volume ?? 0.46;
        if (settings.music && !pausedByLifecycle) safePlay(musicElement);
        return;
      }
      if (!settings.sfx || pausedByLifecycle) return;
      const instance = source.audio.cloneNode();
      instance.volume = options.volume ?? 0.68;
      activeSfx.add(instance);
      instance.addEventListener('ended', () => activeSfx.delete(instance), { once: true });
      safePlay(instance);
    },
    stop(id) {
      if (id && id !== currentMusicId) return;
      musicElement?.pause();
      if (musicElement) musicElement.currentTime = 0;
      if (!id || id === currentMusicId) currentMusicId = null;
    },
    pause() {
      pausedByLifecycle = true;
      musicElement?.pause();
      for (const audio of activeSfx) audio.pause();
    },
    resume() {
      pausedByLifecycle = false;
      if (settings.music && currentMusicId && musicElement) safePlay(musicElement);
    },
    setEnabled(nextSettings) {
      settings = { ...settings, ...nextSettings };
      if (!settings.music) musicElement?.pause();
      else if (!pausedByLifecycle && currentMusicId && musicElement) safePlay(musicElement);
      if (!settings.sfx) {
        for (const audio of activeSfx) audio.pause();
        activeSfx.clear();
      }
    },
    destroy() {
      musicElement?.pause();
      for (const audio of activeSfx) audio.pause();
      activeSfx.clear();
      sources.clear();
    }
  };
}

function createLifecycleAdapter(input) {
  const subscribers = new Set();
  const notify = (event) => {
    if (event === 'pause') input.clear();
    for (const subscriber of subscribers) subscriber(event);
  };
  const onVisibility = () => notify(document.hidden ? 'pause' : 'resume');
  const onBlur = () => notify('pause');
  const onFocus = () => { if (!document.hidden) notify('resume'); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  return {
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      subscribers.clear();
    }
  };
}

export function createBrowserPlatform({ canvas, statusElement, audioManifest }) {
  const input = createInputAdapter(canvas);
  const storage = createStorageAdapter();
  const settings = storage.loadSettings();
  const lifecycle = createLifecycleAdapter(input);
  const audio = createAudioAdapter(audioManifest, settings);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const debugEnabled = new URLSearchParams(window.location.search).has('debug');

  return {
    input,
    storage,
    audio,
    lifecycle,
    haptics: { pulse: (duration = 18) => navigator.vibrate?.(duration) },
    preferences: { reducedMotion },
    viewport: { devicePixelRatio: () => Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1))) },
    a11y: {
      announce(message) {
        if (statusElement) statusElement.textContent = message;
      }
    },
    debug: {
      enabled: debugEnabled,
      report(values) {
        if (!debugEnabled) return;
        for (const [key, value] of Object.entries(values)) canvas.dataset[key] = String(value);
      }
    },
    settings,
    destroy() {
      input.destroy();
      lifecycle.destroy();
      audio.destroy();
    }
  };
}
