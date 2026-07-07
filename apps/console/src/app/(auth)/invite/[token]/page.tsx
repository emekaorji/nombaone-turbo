import Link from 'next/link';

import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import { getInvitationByToken } from '@/lib/team';

const REASON_COPY: Record<string, { title: string; body: string }> = {
  not_found: { title: 'Invite not found', body: 'This invite link is invalid. Ask your admin to send a new one.' },
  expired: { title: 'Invite expired', body: 'This invite has expired. Ask your admin to send a fresh link.' },
  used: { title: 'Invite already used', body: 'This invite has already been accepted. Try signing in instead.' },
  revoked: { title: 'Invite revoked', body: 'This invite was revoked by your admin. Ask them for a new one.' },
};

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(decodeURIComponent(token));

  if (!invitation.valid) {
    const copy = REASON_COPY[invitation.reason ?? 'not_found'] ?? REASON_COPY.not_found;
    return (
      <div className="flex w-full max-w-[400px] flex-col gap-3">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">{copy.title}</h1>
        <p className="text-[13.5px] text-muted-foreground">{copy.body}</p>
        <Link href="/login" className="mt-2 text-[13px] font-medium text-accent hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">Join {invitation.orgName}</h1>
        <p className="text-[13.5px] text-muted-foreground">
          You&apos;ve been invited as {invitation.role}. Set a password to create your account.
        </p>
      </div>
      <AcceptInviteForm token={decodeURIComponent(token)} email={invitation.email!} role={invitation.role!} />
    </div>
  );
}
