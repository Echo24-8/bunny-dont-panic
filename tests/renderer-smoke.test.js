import test from 'node:test';
import { PHASES } from '../src/core/constants.js';
import { recordLevelTwoResult, startNewRun, createInitialState } from '../src/core/state.js';
import { getUpgradeChoices, getUpgradePreview } from '../src/core/upgrades.js';
import { createWorld } from '../src/core/world.js';
import { createRenderer } from '../src/render/renderer.js';

function createContextProxy() {
  const target = {};
  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      const method = () => {};
      object[property] = method;
      return method;
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    }
  });
}

test('renderer executes menu combat upgrade settings and result branches', () => {
  const context = createContextProxy();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const renderer = createRenderer(canvas, {}, { dpr: 1, reducedMotion: true });
  const state = startNewRun(createInitialState());
  const world = createWorld(() => 0.5);
  const input = {
    getJoystickState: () => ({
      active: true,
      center: { x: 80, y: 540 },
      vector: { x: 0.5, y: -0.25 }
    })
  };
  const render = (choices = []) => renderer.render({
    state,
    world,
    choices,
    input,
    settings: { music: true, sfx: true },
    now: 1_000,
    fps: 60
  });

  state.build.weaponSlots = [
    { id: 'carrot', level: 3 },
    { id: 'bubble', level: 2 },
    { id: 'lightning', level: 1 }
  ];
  world.playerBullets.acquire({ x: 100, y: 180, rotation: 0, weaponId: 'carrot', radius: 4 });
  world.playerBullets.acquire({ x: 120, y: 180, rotation: 0, weaponId: 'dandelion', radius: 3 });
  world.playerBullets.acquire({ x: 140, y: 180, rotation: 0, weaponId: 'boomerang', radius: 7 });
  world.orbitals.acquire({ x: 180, y: 470, radius: 7, weaponId: 'bubble', ready: true });
  world.weaponEffects.acquire({
    weaponId: 'lightning',
    points: [{ x: 180, y: 490 }, { x: 160, y: 220 }, { x: 260, y: 180 }],
    lifeMs: 200,
    ageMs: 0
  });
  render();

  const choices = getUpgradeChoices({ build: state.build, health: state.health, rng: () => 0 })
    .map((choice) => ({ ...choice, preview: getUpgradePreview(state, choice.id) }));
  state.phase = PHASES.UPGRADE;
  render(choices);

  state.settingsOpen = true;
  render(choices);
  state.settingsOpen = false;

  state.phase = PHASES.RESULT;
  recordLevelTwoResult(state, 'defeat', 12_300);
  render();

  state.phase = PHASES.MENU;
  render();
});
