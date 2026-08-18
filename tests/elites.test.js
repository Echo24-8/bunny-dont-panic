import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEliteAffix, createEliteSpec, ELITE_AFFIXES } from '../src/core/elites.js';

test('elite specs accept exactly one authored affix', () => {
  assert.equal(createEliteSpec({ affix: 'unknown' }), null);
  for (const affix of ELITE_AFFIXES) {
    const elite = createEliteSpec({ affix, x: 10, y: 20, levelId: 3 });
    assert.equal(elite.affix, affix);
    assert.equal(elite.kind, 'elite');
  }
});

test('elite affixes change only their intended combat trait', () => {
  const swift = applyEliteAffix(createEliteSpec({ affix: 'swift' }), 'swift');
  assert.ok(swift.speed > 28);
  const armored = applyEliteAffix(createEliteSpec({ affix: 'armored' }), 'armored');
  assert.equal(armored.maxHp, 12);
  const splitter = applyEliteAffix(createEliteSpec({ affix: 'splitter' }), 'splitter');
  assert.equal(splitter.splitOnDeath, true);
});
