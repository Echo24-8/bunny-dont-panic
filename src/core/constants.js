export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;

export const PHASES = Object.freeze({
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  UPGRADE: 'upgrade',
  EVENT: 'event',
  EVENT_CHOICE: 'event',
  TRANSITION: 'transition',
  RESULT: 'result',
  ERROR: 'error'
});

export const LEVELS = Object.freeze({
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4
});

export const POOL_LIMITS = Object.freeze({
  ENEMIES: 48,
  PLAYER_BULLETS: 128,
  ENEMY_BULLETS: 450,
  ORBITALS: 3,
  WEAPON_EFFECTS: 24,
  PICKUPS: 96,
  PARTICLES: 160
});
