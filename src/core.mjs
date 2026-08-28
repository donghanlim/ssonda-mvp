export const JITTER = 10;

export function shotCodeAt(date = new Date(), jitter = Math.floor(Math.random() * JITTER)) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) throw new Error('유효한 발급 시각이 필요합니다.');
  if (!Number.isInteger(jitter) || jitter < 0 || jitter >= JITTER) throw new Error(`지터는 0~${JITTER - 1} 정수여야 합니다.`);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return String((minutes + jitter) % 1000).padStart(3, '0');
}

export function normalizeName(value = '') {
  return String(value).replace(/\s+/g, '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();
}

export function extractShotCode(sender = '') {
  const result = String(sender).trim().match(/(?:\s|[-_])?(\d{3})$/);
  return result ? result[1] : null;
}

export function withoutShotCode(sender = '') {
  return String(sender).trim().replace(/(?:\s|[-_])?\d{3}$/, '').trim();
}

export function toMoney(value) {
  const number = Number(String(value ?? '').replace(/[^0-9-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

export function parseLocalDate(value = '') {
  const text = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  const parsed = new Date(text.replace(/(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}:\d{2})(?::\d{2})?/, '$1T$2'));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function parseStatementText(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], rejected: [] };
  const split = line => line.includes('\t') ? line.split('\t') : line.split(',');
  const first = split(lines[0]).map(v => v.trim().toLowerCase());
  const hasHeader = first.some(v => /이름|입금|보낸|sender|amount|금액|일시|시간|balance|잔액/.test(v));
  const headers = hasHeader ? first : ['일시', '입금자명', '금액', '잔액'];
  const aliases = patterns => headers.findIndex(h => patterns.test(h));
  const timeIndex = aliases(/일시|시간|date|time/);
  const senderIndex = aliases(/입금자|보낸|보낸분|sender|name|성명/);
  const amountIndex = aliases(/^금액$|입금액|amount/);
  const balanceIndex = aliases(/잔액|balance/);
  const data = hasHeader ? lines.slice(1) : lines;
  const rows = [], rejected = [];
  data.forEach((line, index) => {
    const cells = split(line).map(v => v.trim());
    const fallback = !hasHeader;
    const sender = cells[senderIndex >= 0 ? senderIndex : (fallback ? 1 : 0)] || '';
    const amount = toMoney(cells[amountIndex >= 0 ? amountIndex : (fallback ? 2 : 1)]);
    const time = cells[timeIndex >= 0 ? timeIndex : (fallback ? 0 : 2)] || '';
    const balance = toMoney(cells[balanceIndex >= 0 ? balanceIndex : (fallback ? 3 : 3)]);
    if (!sender || amount <= 0) { rejected.push({ line: index + (hasHeader ? 2 : 1), reason: '입금자명 또는 양수 금액이 없습니다.' }); return; }
    rows.push({ id: crypto.randomUUID(), sender, amount, time, balance: balance || null, source: 'paste' });
  });
  return { rows, rejected };
}

export function minutesBetween(a, b) {
  const first = parseLocalDate(a), second = parseLocalDate(b);
  return first && second ? Math.abs(first.valueOf() - second.valueOf()) / 60000 : null;
}

export function evaluateMatch(expected, deposit) {
  const code = extractShotCode(deposit.sender);
  const sameCode = code === expected.code;
  const sameAmount = Number(expected.amount) === Number(deposit.amount);
  const payer = normalizeName(withoutShotCode(deposit.sender));
  const expectedName = normalizeName(expected.customerName);
  const sameName = payer === expectedName || payer.includes(expectedName) || expectedName.includes(payer);
  const timing = minutesBetween(expected.issuedAt, deposit.time);
  const timeOk = timing === null || timing <= 60;
  const score = [sameCode, sameAmount, sameName, timeOk].filter(Boolean).length;
  let status = 'unmatched';
  if (sameCode && sameAmount && sameName && timeOk) status = 'candidate';
  else if (sameCode && (sameName || sameAmount)) status = 'review';
  const flags = [];
  if (!sameCode) flags.push('코드 불일치');
  if (!sameAmount) flags.push('금액 불일치');
  if (!sameName) flags.push('이름 불일치');
  if (!timeOk) flags.push('발급 시각과 60분 초과');
  return { ...deposit, expectedId: expected.id, status, score, code, timing, flags };
}

export function reconcile(expectedPayments, deposits) {
  const used = new Set();
  const results = expectedPayments.map(expected => {
    const candidates = deposits.filter(deposit => !used.has(deposit.id)).map(deposit => evaluateMatch(expected, deposit)).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best?.status === 'candidate') used.add(best.id);
    return { expected, best: best || null, alternatives: candidates.slice(1, 3) };
  });
  return { results, unmatchedDeposits: deposits.filter(d => !used.has(d.id)) };
}

export function balanceFlags(deposits) {
  const ordered = [...deposits].sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return ordered.map((item, index) => {
    if (!index || item.balance == null || ordered[index - 1].balance == null) return { id: item.id, ok: true };
    const previous = ordered[index - 1];
    return { id: item.id, ok: Number(previous.balance) + Number(item.amount) === Number(item.balance), expectedBalance: Number(previous.balance) + Number(item.amount) };
  });
}
