import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = join(root, 'assets', 'audio');
const temp = join(root, 'tmp', 'audio');
mkdirSync(output, { recursive: true });
mkdirSync(temp, { recursive: true });

const sampleRate = 22_050;

function findFfmpeg() {
  const located = spawnSync('where.exe', ['ffmpeg'], { encoding: 'utf8' });
  const candidates = (located.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('No working ffmpeg executable was found');
}

function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function envelope(time, duration, attack = 0.02, release = 0.12) {
  return Math.min(1, time / attack) * Math.min(1, (duration - time) / release);
}

function addTone(buffer, start, duration, frequency, volume, wave = 'sine') {
  const startSample = Math.floor(start * sampleRate);
  const sampleCount = Math.floor(duration * sampleRate);
  for (let index = 0; index < sampleCount && startSample + index < buffer.length; index += 1) {
    const time = index / sampleRate;
    const phase = 2 * Math.PI * frequency * time;
    let value = Math.sin(phase);
    if (wave === 'triangle') value = (2 / Math.PI) * Math.asin(Math.sin(phase));
    if (wave === 'square') value = Math.sign(Math.sin(phase));
    buffer[startSample + index] += value * volume * envelope(time, duration);
  }
}

function addNoise(buffer, start, duration, volume, seed = 1) {
  const startSample = Math.floor(start * sampleRate);
  const count = Math.floor(duration * sampleRate);
  let state = seed >>> 0;
  for (let index = 0; index < count && startSample + index < buffer.length; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    const value = (state / 0xffffffff) * 2 - 1;
    buffer[startSample + index] += value * volume * (1 - index / count);
  }
}

function normalize(buffer, peak = 0.86) {
  let max = 0;
  for (const sample of buffer) max = Math.max(max, Math.abs(sample));
  const scale = max > 0 ? peak / max : 1;
  for (let index = 0; index < buffer.length; index += 1) buffer[index] *= scale;
  return buffer;
}

function writeWav(path, samples) {
  const dataSize = samples.length * 2;
  const file = Buffer.alloc(44 + dataSize);
  file.write('RIFF', 0);
  file.writeUInt32LE(36 + dataSize, 4);
  file.write('WAVE', 8);
  file.write('fmt ', 12);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write('data', 36);
  file.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    file.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  writeFileSync(path, file);
}

function makeMusic({ duration, bpm, melody, bass, frantic = false }) {
  const buffer = new Float32Array(Math.floor(duration * sampleRate));
  const beat = 60 / bpm;
  const step = beat / 2;
  let index = 0;
  for (let time = 0; time < duration; time += step, index += 1) {
    const note = melody[index % melody.length];
    addTone(buffer, time, step * 0.88, midiFrequency(note), frantic ? 0.17 : 0.2, 'triangle');
    addTone(buffer, time, step * 0.74, midiFrequency(note + 12), frantic ? 0.055 : 0.07, 'sine');
    if (index % 4 === 0) {
      const bassNote = bass[Math.floor(index / 4) % bass.length];
      addTone(buffer, time, beat * 1.7, midiFrequency(bassNote), frantic ? 0.14 : 0.12, 'sine');
      addNoise(buffer, time, 0.045, frantic ? 0.08 : 0.025, index + 9);
    }
    if (frantic && index % 8 === 6) addTone(buffer, time, step * 0.55, midiFrequency(note + 1), 0.065, 'square');
  }
  return normalize(buffer, 0.72);
}

function makeSfx(duration, draw) {
  const buffer = new Float32Array(Math.floor(duration * sampleRate));
  draw(buffer);
  return normalize(buffer, 0.82);
}

const meadow = makeMusic({ duration: 30, bpm: 120, melody: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 81, 77, 74, 71], bass: [48, 53, 50, 55] });
const panic = makeMusic({ duration: 60, bpm: 184, melody: [76, 79, 83, 78, 81, 84, 77, 82, 75, 80, 84, 79, 83, 86, 78, 81], bass: [43, 46, 41, 48], frantic: true });

const meadowWav = join(temp, 'meadow-lullaby.wav');
const panicWav = join(temp, 'panic-waltz.wav');
writeWav(meadowWav, meadow);
writeWav(panicWav, panic);

const ffmpeg = findFfmpeg();
for (const [source, target] of [[meadowWav, 'meadow-lullaby.mp3'], [panicWav, 'panic-waltz.mp3']]) {
  const result = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', source, '-codec:a', 'libmp3lame', '-b:a', '96k', join(output, target)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${target}`);
}

writeWav(join(output, 'shot.wav'), makeSfx(0.11, (buffer) => {
  for (let index = 0; index < buffer.length; index += 1) {
    const time = index / sampleRate;
    buffer[index] = Math.sin(2 * Math.PI * (720 - time * 2800) * time) * (1 - time / 0.11);
  }
}));

writeWav(join(output, 'upgrade.wav'), makeSfx(0.56, (buffer) => {
  [72, 76, 79, 84].forEach((note, index) => addTone(buffer, index * 0.11, 0.22, midiFrequency(note), 0.5, 'triangle'));
}));

writeWav(join(output, 'hurt.wav'), makeSfx(0.28, (buffer) => {
  addTone(buffer, 0, 0.28, 116, 0.6, 'square');
  addNoise(buffer, 0, 0.2, 0.55, 442);
}));

writeWav(join(output, 'shield.wav'), makeSfx(0.38, (buffer) => {
  addTone(buffer, 0, 0.34, 660, 0.5, 'sine');
  addTone(buffer, 0.04, 0.3, 990, 0.32, 'sine');
}));

writeWav(join(output, 'success.wav'), makeSfx(1.18, (buffer) => {
  [72, 76, 79, 84, 88].forEach((note, index) => addTone(buffer, index * 0.16, 0.38, midiFrequency(note), 0.45, 'triangle'));
}));

console.log(`Generated audio assets in ${output}`);
