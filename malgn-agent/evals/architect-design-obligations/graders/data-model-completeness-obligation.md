---
type: regex
target: { source: file, path: docs/data-model.md }
pattern: '^(?=[\s\S]*인덱스)(?=[\s\S]*(?:UNIQUE|FOREIGN KEY|외래키|FK))'
weight: 1
---

④완결성 의무(DB). "DB 테이블마다 인덱스 + 근거 + 제약(FK/UNIQUE/CHECK) 필수"를
데이터 모델 문서가 지켰는지 본다.
