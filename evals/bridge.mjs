// 골든셋을 실제 엔진(src/core.mjs)의 reconcile로 돌려 케이스별 예측 매칭을 내보낸다.
// run_evals.py가 표준 라이브러리만으로 돌 수 있도록 JS 호출을 이 파일로 격리한다.
import { readFileSync } from 'node:fs';
import { reconcile } from '../src/core.mjs';

const cases = readFileSync(process.argv[2], 'utf8')
  .split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));

const out = cases.map(c => {
  const expected = c.input.expected_payments.map(p => ({
    id: p.id, customerName: p.customerName, amount: p.amount, code: p.code, issuedAt: p.issuedAt,
  }));
  const d = c.input.deposit;
  const { results } = reconcile(expected, [{ id: 'D', sender: d.sender, amount: d.amount, time: d.time }]);
  const hit = results.find(r => r.best && r.best.id === 'D' && r.best.status === 'candidate');
  return { id: c.id, predicted: hit ? hit.expected.id : null };
});

process.stdout.write(JSON.stringify(out));
