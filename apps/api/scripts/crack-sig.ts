/* eslint-disable import/order */
// Byte-confirm the Nomba webhook signature scheme against a REAL captured webhook.
//   npx tsx scripts/crack-sig.ts
import { createHmac } from 'node:crypto';
import { env } from '../src/shared/config/env';

const B64 =
  'eyJldmVudF90eXBlIjoicGF5bWVudF9zdWNjZXNzIiwicmVxdWVzdElkIjoiNDdlNmI5MzYtNzMzZC00YTkxLWIzN2EtZGY0ZjMyNjg2NTBjIiwiZGF0YSI6eyJtZXJjaGFudCI6eyJ3YWxsZXRJZCI6IjZhM2JlMmZlYTNkYTU1M2MwZGE1MmEzYiIsIndhbGxldEJhbGFuY2UiOjk4LjYsInVzZXJJZCI6ImU1NzVhOTA2LTFlYjAtNDRlZi04OGM2LWE5Y2YwN2FkOTdlYSJ9LCJ0ZXJtaW5hbCI6e30sInRva2VuaXplZENhcmREYXRhIjp7InRva2VuS2V5IjoiTi9BIiwiY2FyZFR5cGUiOiJOL0EiLCJ0b2tlbkV4cGlyeVllYXIiOiJOL0EiLCJ0b2tlbkV4cGlyeU1vbnRoIjoiTi9BIiwiY2FyZFBhbiI6Ik4vQSJ9LCJ0cmFuc2FjdGlvbiI6eyJmZWUiOjEuNCwidHlwZSI6Im9ubGluZV9jaGVja291dCIsInRyYW5zYWN0aW9uSWQiOiJXRUItT05MSU5FX0MtRTU3NUEtYjllMjEwMTEtZGYyYi00MjFkLWIxYjUtOTk4MjliM2E2MjcwIiwicmVzcG9uc2VDb2RlIjoiIiwib3JpZ2luYXRpbmdGcm9tIjoid2ViIiwibWVyY2hhbnRUeFJlZiI6IjlQU0IyNjA3MDIwMjE4MTE4MzIwODcyMDEiLCJ0cmFuc2FjdGlvbkFtb3VudCI6MTAwLjAsInRpbWUiOiIyMDI2LTA3LTAyVDAxOjE4OjE2WiJ9LCJjdXN0b21lciI6eyJiaWxsZXJJZCI6IjExMDAxNDU0MjIiLCJzZW5kZXJOYW1lIjoiT3JqaSBFbWVrYSBQcmFpc2UgKEFOQ0hPUikiLCJwcm9kdWN0SWQiOiIxMjAwMDEifSwib3JkZXIiOnsiYW1vdW50IjoxMDAuMCwib3JkZXJJZCI6ImRkYzU5MTc0LWUwYmQtNDY3OC1hOThkLTA5ZmY4ZTMzYzFmOCIsImNhcmRUeXBlIjoiTi9BIiwib3JkZXJNZXRhRGF0YSI6eyJyZWdpb24iOiJORyJ9LCJhY2NvdW50SWQiOiJlNTc1YTkwNi0xZWIwLTQ0ZWYtODhjNi1hOWNmMDdhZDk3ZWEiLCJjYXJkTGFzdDREaWdpdHMiOiJOL0EiLCJjYXJkQ3VycmVuY3kiOiJOL0EiLCJjdXN0b21lckVtYWlsIjoibm9tYmFvbmUudGVzdC4xNzgyOTU0NTYyMTk4QGdtYWlsLmNvbSIsImN1c3RvbWVySWQiOiIxMTAwMTQ1NDIyIiwiaXNUb2tlbml6ZWRDYXJkUGF5bWVudCI6ImZhbHNlIiwib3JkZXJSZWZlcmVuY2UiOiJuYm8xNzgyOTU0NTYyMTk4bGl2ZXRlc3QiLCJwYXltZW50TWV0aG9kIjoiYmFua190cmFuc2ZlciIsImNhbGxiYWNrVXJsIjoiaHR0cHM6Ly90dW5uZWwubm9tYmFvbmUueHl6L2NhbGxiYWNrIiwiY3VycmVuY3kiOiJOR04ifX19';
const TS = '2026-07-02T01:18:16Z';
const TARGET = 'keIASzGly+P77/gM0MMmpfyXeAFgcniwBVt3DMJ5wDk=';

const raw = Buffer.from(B64, 'base64').toString('utf8');
const p = JSON.parse(raw) as Record<string, any>;
const d = p.data;
console.log('=== decoded payload ===');
console.log(JSON.stringify(p, null, 2));

const secretStr = env.NOMBA_LIVE_WEBHOOK_SIGNATURE_KEY ?? '';
const secretForms: Record<string, Buffer> = {
  utf8: Buffer.from(secretStr, 'utf8'),
};
try {
  secretForms.b64 = Buffer.from(secretStr, 'base64');
} catch {
  /* ignore */
}
try {
  if (/^[0-9a-fA-F]+$/.test(secretStr) && secretStr.length % 2 === 0)
    secretForms.hex = Buffer.from(secretStr, 'hex');
} catch {
  /* ignore */
}

// field values, pulled from the NESTED payload (this was the bug — we read them top-level).
const f = {
  event_type: p.event_type ?? '',
  requestId: p.requestId ?? '',
  userId: d?.merchant?.userId ?? '',
  walletId: d?.merchant?.walletId ?? '',
  transactionId: d?.transaction?.transactionId ?? '',
  transactionType: d?.transaction?.type ?? '',
  transactionTime: d?.transaction?.time ?? '',
  transactionResponseCode: d?.transaction?.responseCode ?? '',
  headerTs: TS,
  amount: String(d?.transaction?.transactionAmount ?? ''),
  merchantTxRef: d?.transaction?.merchantTxRef ?? '',
  orderRef: d?.order?.orderReference ?? '',
};
const docOrder = [
  f.event_type,
  f.requestId,
  f.userId,
  f.walletId,
  f.transactionId,
  f.transactionType,
  f.transactionTime,
  f.transactionResponseCode,
];

const candidates: Record<string, string> = {
  raw,
  'ts.raw': `${TS}.${raw}`,
  'ts_raw': `${TS}${raw}`,
  'raw.ts': `${raw}.${TS}`,
  'raw_ts': `${raw}${TS}`,
  'ts\nraw': `${TS}\n${raw}`,
  requestId: f.requestId,
  'requestId.ts': `${f.requestId}.${TS}`,
  'ts.requestId': `${TS}.${f.requestId}`,
  dataJson: JSON.stringify(d),
  'field(doc, colon)': docOrder.join(':'),
  'field(doc, colon)+ts': [...docOrder, f.headerTs].join(':'),
  'field(doc, colon)+txTime': [...docOrder, f.transactionTime].join(':'),
  'field(doc, comma)': docOrder.join(','),
  'field(doc, pipe)': docOrder.join('|'),
  'field(doc)concat': docOrder.join(''),
  'evt:reqId:amount:txId': [f.event_type, f.requestId, f.amount, f.transactionId].join(':'),
  'reqId:txId:amount': [f.requestId, f.transactionId, f.amount].join(':'),
  'evt:txId:amount:ts': [f.event_type, f.transactionId, f.amount, f.headerTs].join(':'),
  'merchantTxRef': f.merchantTxRef,
  'orderRef': f.orderRef,
  'reqId:ts': `${f.requestId}:${TS}`,
  'ts:reqId': `${TS}:${f.requestId}`,
};

let found = false;
for (const [sn, skey] of Object.entries(secretForms)) {
  for (const [cn, cstr] of Object.entries(candidates)) {
    for (const enc of ['base64', 'hex'] as const) {
      const sig = createHmac('sha256', skey).update(cstr, 'utf8').digest(enc);
      if (sig === TARGET) {
        console.log(`\n🎯 MATCH  secret=${sn}  candidate="${cn}"  enc=${enc}`);
        console.log(`   signing string = ${JSON.stringify(cstr).slice(0, 300)}`);
        found = true;
      }
    }
  }
}
if (!found) console.log('\n❌ no match among candidates — need more permutations');
console.log('\nTARGET =', TARGET);
process.exit(0);
