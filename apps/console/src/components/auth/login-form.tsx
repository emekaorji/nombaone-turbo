'use client';

import { useState } from 'react';
import { Eye, EyeOff, Globe, Shield } from 'lucide-react';

export function LoginForm() {
  const [show, setShow] = useState(false);

  return (
    <form className="flex w-full max-w-[400px] flex-col gap-[18px]">
      {/* Heading */}
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">
          Sign in to your console
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Welcome back. Manage your subscriptions.
        </p>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-[7px]">
        <label htmlFor="email" className="text-[12.5px] font-medium text-foreground">
          Email
        </label>
        <div className="flex items-center rounded border border-border bg-surface-2 px-[13px] py-[11px]">
          <input
            id="email"
            type="email"
            placeholder="emeka@acme.io"
            className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-[7px]">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[12.5px] font-medium text-foreground">
            Password
          </label>
          <button type="button" className="text-[12.5px] text-accent hover:underline">
            Forgot?
          </button>
        </div>
        <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-[13px] py-[11px]">
          <input
            id="password"
            type={show ? 'text' : 'password'}
            placeholder="••••••••••••"
            className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="shrink-0 text-subtle-foreground transition-colors hover:text-muted-foreground"
          >
            {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Sign in */}
      <button
        type="submit"
        className="flex w-full items-center justify-center rounded bg-accent px-4 py-[11px] text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        Sign in
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-subtle-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Google */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-[9px] rounded border border-border bg-surface-2 px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-border-strong"
      >
        <Globe className="size-4 text-muted-foreground" strokeWidth={1.75} />
        Continue with Google
      </button>

      {/* Note */}
      <div className="flex items-center gap-[7px] pt-0.5">
        <Shield className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
        <span className="text-[11.5px] text-subtle-foreground">
          Two-factor is required for owners and admins.
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-[5px] pt-2">
        <span className="text-[13px] text-muted-foreground">New to Nomba One?</span>
        <button type="button" className="text-[13px] font-medium text-accent hover:underline">
          Start building
        </button>
      </div>
    </form>
  );
}
