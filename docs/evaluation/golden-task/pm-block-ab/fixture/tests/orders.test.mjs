import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersRoute } from '../src/routes/orders.mjs';

test('GET /orders 는 목록을 돌려준다', async () => {
  const res = await ordersRoute.request('/orders');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.length >= 1);
});

test('GET /orders/:id 없는 주문은 404', async () => {
  const res = await ordersRoute.request('/orders/999');
  assert.equal(res.status, 404);
});
