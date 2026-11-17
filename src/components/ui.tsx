"use client";

import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode }
>(function Button({ variant = "secondary", size = "md", icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-all",
        "disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-accent text-accent-fg shadow-sm hover:brightness-110",
        variant === "secondary" && "border border-border bg-panel-2 text-text hover:border-border-strong hover:bg-elev",
        variant === "ghost" && "text-muted hover:bg-panel-2 hover:text-text",
        variant === "danger" && "border border-border bg-panel-2 text-bad hover:bg-bad-soft",
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  active,
  className,
  children,
  shortcut,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; shortcut?: string }) {
  return (
    <button
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx(
        "group relative grid h-9 w-9 place-items-center rounded-lg transition-all",
        "disabled:pointer-events-none disabled:opacity-35",
        active ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:bg-panel-2 hover:text-text",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "ok" | "bad" | "warn" | "accent";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-panel-2 text-muted",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "accent" && "bg-accent-soft text-accent",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-panel-2 px-1 py-px font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}
