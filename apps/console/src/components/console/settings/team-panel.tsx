import { Plus } from 'lucide-react';

const members = [
  { initials: 'EO', name: 'Emeka Orji', role: 'owner', badge: 'bg-accent-muted', text: 'text-accent' },
  { initials: 'AN', name: 'Ada Nwosu', role: 'developer', badge: 'bg-surface-3', text: 'text-muted-foreground' },
  { initials: 'BA', name: 'Bola Ade', role: 'admin', badge: 'bg-info-bg', text: 'text-info' },
  { initials: 'CE', name: 'Chidi Eze', role: 'viewer', badge: 'bg-surface-3', text: 'text-muted-foreground' },
];

export function TeamPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 rounded-lg border border-border bg-surface-1 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-foreground">Team</span>
        <button className="flex items-center gap-[5px] text-[13px] font-medium text-accent hover:opacity-80">
          <Plus className="size-[14px]" strokeWidth={2} />
          Invite
        </button>
      </div>
      {members.map((m, i) => (
        <div
          key={m.name}
          className={`flex items-center gap-2.5 py-[9px] ${i < members.length - 1 ? 'border-b border-border' : ''}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-muted-foreground">
            {m.initials}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{m.name}</span>
          <span className={`rounded-full px-[9px] py-0.5 text-[11px] font-medium ${m.badge} ${m.text}`}>{m.role}</span>
        </div>
      ))}
    </div>
  );
}
