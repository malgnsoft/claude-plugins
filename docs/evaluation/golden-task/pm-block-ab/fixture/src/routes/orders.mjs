import { Hono } from 'hono';
import { calcPrice } from '../utils/price.js';

const orders = [
  { id: 1, item: '아메리카노', unitPrice: 3000, quantity: 2 },
  { id: 2, item: '라떼', unitPrice: 3500, quantity: 12 },
];

export const ordersRoute = new Hono();

ordersRoute.get('/orders', (c) => {
  return c.json(orders.map((o) => ({ ...o, total: calcPrice(o.unitPrice, o.quantity) })));
});

ordersRoute.get('/orders/:id', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')));
  if (!order) return c.json({ error: 'not found' }, 404);
  return c.json({ ...order, total: calcPrice(order.unitPrice, order.quantity) });
});
