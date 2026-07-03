 
// Replay the REAL captured webhook against the (debug-off) receiver to prove verify.ts
// now accepts the genuine signature and rejects tampering.  npx tsx scripts/replay.ts
const B64 =
  'eyJldmVudF90eXBlIjoicGF5bWVudF9zdWNjZXNzIiwicmVxdWVzdElkIjoiNDdlNmI5MzYtNzMzZC00YTkxLWIzN2EtZGY0ZjMyNjg2NTBjIiwiZGF0YSI6eyJtZXJjaGFudCI6eyJ3YWxsZXRJZCI6IjZhM2JlMmZlYTNkYTU1M2MwZGE1MmEzYiIsIndhbGxldEJhbGFuY2UiOjk4LjYsInVzZXJJZCI6ImU1NzVhOTA2LTFlYjAtNDRlZi04OGM2LWE5Y2YwN2FkOTdlYSJ9LCJ0ZXJtaW5hbCI6e30sInRva2VuaXplZENhcmREYXRhIjp7InRva2VuS2V5IjoiTi9BIiwiY2FyZFR5cGUiOiJOL0EiLCJ0b2tlbkV4cGlyeVllYXIiOiJOL0EiLCJ0b2tlbkV4cGlyeU1vbnRoIjoiTi9BIiwiY2FyZFBhbiI6Ik4vQSJ9LCJ0cmFuc2FjdGlvbiI6eyJmZWUiOjEuNCwidHlwZSI6Im9ubGluZV9jaGVja291dCIsInRyYW5zYWN0aW9uSWQiOiJXRUItT05MSU5FX0MtRTU3NUEtYjllMjEwMTEtZGYyYi00MjFkLWIxYjUtOTk4MjliM2E2MjcwIiwicmVzcG9uc2VDb2RlIjoiIiwib3JpZ2luYXRpbmdGcm9tIjoid2ViIiwibWVyY2hhbnRUeFJlZiI6IjlQU0IyNjA3MDIwMjE4MTE4MzIwODcyMDEiLCJ0cmFuc2FjdGlvbkFtb3VudCI6MTAwLjAsInRpbWUiOiIyMDI2LTA3LTAyVDAxOjE4OjE2WiJ9LCJjdXN0b21lciI6eyJiaWxsZXJJZCI6IjExMDAxNDU0MjIiLCJzZW5kZXJOYW1lIjoiT3JqaSBFbWVrYSBQcmFpc2UgKEFOQ0hPUikiLCJwcm9kdWN0SWQiOiIxMjAwMDEifSwib3JkZXIiOnsiYW1vdW50IjoxMDAuMCwib3JkZXJJZCI6ImRkYzU5MTc0LWUwYmQtNDY3OC1hOThkLTA5ZmY4ZTMzYzFmOCIsImNhcmRUeXBlIjoiTi9BIiwib3JkZXJNZXRhRGF0YSI6eyJyZWdpb24iOiJORyJ9LCJhY2NvdW50SWQiOiJlNTc1YTkwNi0xZWIwLTQ0ZWYtODhjNi1hOWNmMDdhZDk3ZWEiLCJjYXJkTGFzdDREaWdpdHMiOiJOL0EiLCJjYXJkQ3VycmVuY3kiOiJOL0EiLCJjdXN0b21lckVtYWlsIjoibm9tYmFvbmUudGVzdC4xNzgyOTU0NTYyMTk4QGdtYWlsLmNvbSIsImN1c3RvbWVySWQiOiIxMTAwMTQ1NDIyIiwiaXNUb2tlbml6ZWRDYXJkUGF5bWVudCI6ImZhbHNlIiwib3JkZXJSZWZlcmVuY2UiOiJuYm8xNzgyOTU0NTYyMTk4bGl2ZXRlc3QiLCJwYXltZW50TWV0aG9kIjoiYmFua190cmFuc2ZlciIsImNhbGxiYWNrVXJsIjoiaHR0cHM6Ly90dW5uZWwubm9tYmFvbmUueHl6L2NhbGxiYWNrIiwiY3VycmVuY3kiOiJOR04ifX19';
const raw = Buffer.from(B64, 'base64').toString('utf8');
const SIG = 'keIASzGly+P77/gM0MMmpfyXeAFgcniwBVt3DMJ5wDk=';
const TS = '2026-07-02T01:18:16Z';
const ENDPOINT = 'http://localhost:8000/webhooks/v1/nomba';

const post = async (body: string, signature: string): Promise<number> => {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'nomba-signature': signature, 'nomba-timestamp': TS },
    body,
  });
  return res.status;
};

async function main(): Promise<void> {
  const genuine = await post(raw, SIG);
  const parsed = JSON.parse(raw) as { data: { transaction: Record<string, unknown> } };
  parsed.data.transaction.transactionId = 'HACKED';
  const tampered = await post(JSON.stringify(parsed), SIG);
  const bogus = await post(raw, 'not-a-real-signature');
  console.log('GENUINE  sig →', genuine, genuine === 200 ? 'ACCEPTED ✅' : '❌');
  console.log('TAMPERED body →', tampered, tampered === 401 ? 'REJECTED ✅' : '❌');
  console.log('BOGUS    sig →', bogus, bogus === 401 ? 'REJECTED ✅' : '❌');
  process.exit(0);
}
main().catch((e) => {
  console.error('REPLAY_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
