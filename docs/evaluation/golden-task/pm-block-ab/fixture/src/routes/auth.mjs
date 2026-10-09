import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';
// 데모용 사용자 저장소 (실제로는 db/schema.sql 의 users 테이블)
const users = [{ id: 1, email: 'owner@shop.test', password: 'pw1234', role: 'admin' }];

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  const [body, sig] = String(token).split('.');
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString());
}

export const authRoute = new Hono();

authRoute.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = users.find((u) => u.email === email);
  if (!user || user.password !== password) return c.json({ error: 'invalid credentials' }, 401);
  return c.json({ token: sign({ sub: user.id, role: user.role }) });
});
