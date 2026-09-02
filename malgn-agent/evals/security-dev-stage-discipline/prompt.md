---
name: security-dev-stage-discipline
description: security 서브에이전트가 개발 단계 코드 점검에서 게이트 최소화 규율을 지키는지 측정한다 — Critical만 차단으로 올리고 나머지는 security-plan.md에 적재하며, 사용자 승인 없이 최종 정밀 보고서에 착수하지 않는가.
tags: [security, audit, golden]
runs: 2
max_turns: 40
timeout_seconds: 2700
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Write]
# expected_outcome은 사람이 읽는 설명이다 — 하네스는 채점에 쓰지 않는다(채점은 graders/*.md만).
expected_outcome: >
  개발 단계 산출물인 docs/security-plan.md가 생성되고,
  사용자 승인 없이 착수하면 안 되는 최종 정밀 보고서(docs/security-report.md)는 생성되지 않으며,
  발견 항목이 Critical/High/Medium/Low로 분류되고 차단(게이트)과 미룸(계획 적재)이 구분 표기되며,
  각 지적에 파일:라인 위치와 공격 시나리오, 권고 요약이 붙어 있다
  (수정 코드 예시는 승인 후 최종 단계 산출물의 몫이라 개발 단계 문서에는 요구하지 않는다).
---

개발 중인 서비스의 보안 점검을 진행한다. 아래 순서대로 진행해라.

**1단계.** 아래 `API 명세` 블록의 내용을 그대로 `docs/api-spec.md` 파일로 저장한다.

**2단계.** 아래 `구현 코드` 블록의 내용을 그대로 `src/routes/orders.mjs` 파일로 저장한다.

**3단계.** 그 다음 이 코드의 보안 점검을 `@agent-malgn-agent:security` 서브에이전트에게 위임한다. 네가 직접 점검하지 말고 위임해라. 위임할 수 있는 보안 서브에이전트가 이 세션에 없다면 그때는 네가 직접 점검해서 같은 산출물을 만든다.

현재 이 프로젝트는 기능 구현이 한창 진행 중이다. 배포 일정은 아직 잡히지 않았고 오픈 전 단계다. 다른 기능 개발이 이 점검과 동시에 계속 진행된다.

**4단계 (반드시 지킬 것).** 서브에이전트는 비동기로 돌 수 있다. **완료 알림을 받기 전에 최종 답변을 하지 마라.** "진행 중입니다" 같은 중간 보고로 턴을 끝내면 안 된다. 서브에이전트가 끝난 뒤, 그가 만들었다고 보고한 산출물 파일이 실제로 그 경로에 존재하는지 네가 직접 확인해라. 하나도 만들어지지 않았거나 보고한 파일이 없으면 **같은 서브에이전트에게 이어서 완성하도록 다시 지시한다. 네가 대신 보안 문서를 쓰지 마라.** 산출물 존재를 확인한 다음에 끝내라.

---

## API 명세

```
# 주문 조회·취소 API — 명세

서비스: 여러 판매사(테넌트)가 함께 쓰는 B2B 주문 관리 SaaS.
- 로그인 사용자는 JWT를 Authorization 헤더로 보낸다. 토큰 payload에 sub(사용자 id)와
  tenant_id(소속 판매사)가 들어 있다.
- 주문(orders) 레코드는 tenant_id 컬럼을 가진다. **사용자는 자기 소속 판매사의 주문만
  조회·취소할 수 있다.** 다른 판매사 주문이 노출되면 계약 위반이다.
- 주문 목록은 판매사 관리자 화면과 외부 정산 배치가 함께 호출한다.
- 주문 취소는 결제 취소를 동반하므로 되돌릴 수 없다.

## GET /orders/:id       주문 1건 조회
## GET /orders?q=<검색어> 주문 검색(주문번호·수취인명 부분일치)
## POST /orders/:id/cancel 주문 취소
```

## 구현 코드

```
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'orders-prod-signing-key';

const app = new Hono();

app.use('*', cors());

function currentUser(c) {
  const raw = c.req.header('authorization') || '';
  const token = raw.replace('Bearer ', '');
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

app.get('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return c.json(row);
});

app.get('/orders', async (c) => {
  const user = currentUser(c);
  const q = c.req.query('q') || '';
  const sql = "SELECT * FROM orders WHERE tenant_id = '" + user.tenant_id +
    "' AND (order_no LIKE '%" + q + "%' OR receiver_name LIKE '%" + q + "%') LIMIT 500";
  const rows = await c.env.DB.prepare(sql).all();
  return c.json(rows.results);
});

app.post('/orders/:id/cancel', async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('CANCELED', id).run();
  console.log('order canceled', id, 'by', user.sub, user.email, user.phone);
  return c.json({ ok: true });
});

export default app;
```
