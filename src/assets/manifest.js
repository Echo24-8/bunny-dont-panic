export const IMAGE_MANIFEST = Object.freeze({
  background1: './assets/images/notebook-forest-day.png',
  background2: './assets/images/notebook-forest-storm.png',
  bunny: './assets/images/bunny-sticker.png',
  puff: './assets/images/enemy-cloud-bear.png',
  bell: './assets/images/enemy-acorn-mouse.png',
  star: './assets/images/enemy-star-chick.png'
});

export const AUDIO_MANIFEST = Object.freeze({
  music1: { src: './assets/audio/meadow-lullaby.mp3', kind: 'music' },
  music2: { src: './assets/audio/panic-waltz.mp3', kind: 'music' },
  shot: { src: './assets/audio/shot.wav', kind: 'sfx' },
  upgrade: { src: './assets/audio/upgrade.wav', kind: 'sfx' },
  hurt: { src: './assets/audio/hurt.wav', kind: 'sfx' },
  shield: { src: './assets/audio/shield.wav', kind: 'sfx' },
  success: { src: './assets/audio/success.wav', kind: 'sfx' }
});

export async function loadImageAssets(manifest = IMAGE_MANIFEST) {
  const assets = {};
  const failures = [];
  await Promise.all(Object.entries(manifest).map(([id, src]) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      assets[id] = image;
      resolve();
    };
    image.onerror = () => {
      failures.push(src);
      resolve();
    };
    image.src = src;
  })));
  if (failures.length > 0) throw new Error(`无法加载素材：${failures.join(', ')}`);
  return assets;
}
