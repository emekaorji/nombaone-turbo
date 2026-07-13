import 'server-only';

import { createMailTransport, type MailTransport } from '@nombaone/sara/mail';

/**
 * The console's mail transport — the SAME shared transport the API uses
 * (`@nombaone/sara/mail`), bound to this app's env.
 *
 * The console had no mail at all. A team invitation created a row, minted a token, and
 * handed the raw link back to the *inviter* to copy and send by hand. The person being
 * invited never heard from us. That is a stub wearing a feature's clothes: it looks like
 * an invite system, and the invitee's experience is that nothing happened.
 *
 * The rules (a missing key throws; `log` is forbidden in production; Resend's sandbox
 * sender is refused in production) live in sara, so the console and the API cannot drift
 * into disagreeing about what "sent" means.
 */
let cached: MailTransport | null = null;

export function getMailTransport(): MailTransport {
  if (cached) return cached;
  cached = createMailTransport({
    transport: (process.env.COMMS_TRANSPORT as 'resend' | 'log') ?? 'log',
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.COMMS_FROM ?? 'Nomba One <billing@mail.nombaone.xyz>',
    environment: process.env.INFRA_ENVIRONMENT ?? 'development',
  });
  return cached;
}

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Invite a teammate into an organization.
 *
 * Throws on a send failure rather than swallowing it — the server action surfaces the
 * error, so an owner learns immediately that the invite did not go out instead of
 * believing they invited someone who never heard from us.
 */
export async function sendTeamInviteEmail(input: {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): Promise<{ delivered: boolean; providerId?: string }> {
  const { to, organizationName, inviterName, role, acceptUrl } = input;

  const subject = `${inviterName} invited you to ${organizationName} on Nomba One`;

  const text = [
    `${inviterName} has invited you to join ${organizationName} on Nomba One as ${role}.`,
    '',
    'Accept the invitation:',
    acceptUrl,
    '',
    'This link expires in 7 days. If you were not expecting this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#101010">
      <p style="font-size:15px;line-height:1.5">
        <b>${escape(inviterName)}</b> has invited you to join
        <b>${escape(organizationName)}</b> on Nomba One as <b>${escape(role)}</b>.
      </p>
      <p style="margin:26px 0">
        <a href="${escape(acceptUrl)}"
           style="background:#101010;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12.5px;color:#6b6b6b;line-height:1.5">
        This link expires in 7 days. If you were not expecting this, you can ignore this email.
      </p>
    </div>
  `.trim();

  return getMailTransport().send({ to, subject, html, text });
}

/**
 * Password reset. Sent to a merchant who is currently locked out of their own revenue —
 * before this flow existed, that lockout was permanent.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ delivered: boolean; providerId?: string }> {
  const { to, name, resetUrl } = input;

  const subject = 'Reset your Nomba One password';

  const text = [
    `Hi ${name},`,
    '',
    'Use this link to set a new password:',
    resetUrl,
    '',
    'The link expires in 1 hour and can only be used once.',
    'If you did not ask for this, ignore this email — your password will not change.',
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;color:#101010">
      <p style="font-size:15px;line-height:1.5">Hi ${escape(name)},</p>
      <p style="font-size:15px;line-height:1.5">Use the button below to set a new password.</p>
      <p style="margin:26px 0">
        <a href="${escape(resetUrl)}"
           style="background:#101010;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block">
          Set a new password
        </a>
      </p>
      <p style="font-size:12.5px;color:#6b6b6b;line-height:1.5">
        This link expires in 1 hour and can only be used once. If you did not ask for it,
        ignore this email — your password will not change.
      </p>
    </div>
  `.trim();

  return getMailTransport().send({ to, subject, html, text });
}
