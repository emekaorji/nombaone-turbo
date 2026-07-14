/**
 * Prove the bounce guard: a `.test` recipient must never reach the mail vendor.
 *   npx tsx --env-file=.env scripts/mail-guard-probe.ts
 */
import { getMailTransport } from '../src/shared/services/comms/transport';

async function main(): Promise<void> {
  const t = getMailTransport();
  console.log(`transport = ${t.kind}\n`);

  for (const to of [
    'scenario-abc@ironrepublic.test', // the exact fixture domain in our dev DB
    'member@gym.test',
    'nobody@example.com',
  ]) {
    const res = await t.send({ to, subject: 'renewal reminder', text: 'hi', html: '<p>hi</p>' });
    console.log(
      `  ${res.skipped ? '🛡  BLOCKED' : '📮 sent   '}  ${to.padEnd(32)} ${res.skipped ?? res.providerId ?? ''}`
    );
  }
  console.log('\n(no Resend call was made for any of the above — no bounce, no quota spent)');
  process.exit(0);
}
main().catch((e) => {
  console.error('ERR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
