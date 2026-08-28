import test from 'node:test';
import assert from 'node:assert/strict';
import { shotCodeAt, extractShotCode, parseStatementText, reconcile } from '../src/core.mjs';

test('ShotCode follows the documented time plus jitter formula', () => {
  assert.equal(shotCodeAt(new Date('2026-08-28T14:03:00'), 0), '843');
  assert.equal(shotCodeAt(new Date('2026-08-28T14:03:00'), 9), '852');
  assert.equal(shotCodeAt(new Date('2026-08-28T23:59:00'), 9), '448');
});
test('extracts only a trailing three digit sender code', () => {
  assert.equal(extractShotCode('홍길동 843'), '843');
  assert.equal(extractShotCode('홍길동843'), '843');
  assert.equal(extractShotCode('홍길동 84'), null);
});
test('parses typical Korean bank export columns', () => {
  const { rows, rejected } = parseStatementText('일시,입금자명,금액,잔액\n2026-08-28 14:03,홍길동843,35000,1035000');
  assert.equal(rejected.length, 0); assert.equal(rows.length, 1); assert.equal(rows[0].amount, 35000); assert.equal(rows[0].sender, '홍길동843');
});
test('offers a candidate only where code, name, amount and time agree', () => {
  const expected=[{id:'p1',customerName:'홍길동',amount:35000,code:'843',issuedAt:'2026-08-28T14:03'}];
  const deposits=[{id:'d1',sender:'홍길동843',amount:35000,time:'2026-08-28T14:28'}];
  assert.equal(reconcile(expected,deposits).results[0].best.status,'candidate');
  assert.equal(reconcile(expected,[{...deposits[0],amount:36000}]).results[0].best.status,'review');
});
