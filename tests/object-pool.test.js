import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectPool } from '../src/core/object-pool.js';

test('pool enforces capacity and reuses released items', () => {
  const pool = new ObjectPool(2, () => ({ x: 0 }));
  const first = pool.acquire({ x: 1 });
  const second = pool.acquire({ x: 2 });
  assert.equal(pool.acquire(), null);
  assert.equal(pool.activeCount, 2);
  pool.release(first);
  const reused = pool.acquire({ x: 3 });
  assert.equal(reused.poolIndex, first.poolIndex);
  assert.equal(reused.x, 3);
  assert.equal(second.active, true);
});

test('clear releases every active item', () => {
  const pool = new ObjectPool(450);
  for (let index = 0; index < 450; index += 1) pool.acquire({ x: index });
  assert.equal(pool.activeCount, 450);
  pool.clear();
  assert.equal(pool.activeCount, 0);
  assert.notEqual(pool.acquire(), null);
});

