/**
 * Send a REAL renewal-reminder through the application's own transport + template.
 * Proves the whole comms path end to end — not a curl against Resend.
 *
 *   npx tsx --env-file=.env scripts/send-test-email.ts <to-address>
 */
import { getMailTransport } from '../src/shared/services/comms/transport';

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to) {
    console.error('usage: npx tsx --env-file=.env scripts/send-test-email.ts <to-address>');
    process.exit(1);
  }
  const transport = getMailTransport();
  console.log(`transport = ${transport.kind}`);

  const res = await transport.send({
    to,
    subject: 'Iron Republic Gym — your membership renews in 1 minute',
    text: 'Your ₦5,000 membership renews shortly. We will charge your saved card automatically.',
    html: '<p>Your <b>₦5,000</b> Iron Republic Gym membership renews shortly.</p><p>We will charge your saved card automatically — nothing to do.</p>',
  });

  console.log('delivered =', res.delivered, res.providerId ?? '');
  process.exit(res.delivered ? 0 : 1);
}
main().catch((e) => {
  console.error('ERR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
