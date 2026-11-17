"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { ACCENTS, ThemeMode } from "@/lib/theme";
import { Kbd, cx } from "./ui";

const MODES: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { id: "system", label: "Sistema", icon: <Monitor size={14} /> },
  { id: "light", label: "Claro", icon: <Sun size={14} /> },
  { id: "dark", label: "Escuro", icon: <Moon size={14} /> },
];

export function ThemeMenu() {
  const themeMode = useStore((s) => s.themeMode);
  const resolved = useStore((s) => s.resolvedTheme);
  const accent = useStore((s) => s.accent);
  const { setThemeMode, setAccent } = useStore.getState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Icon = themeMode === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        title="Aparência"
        aria-label="Aparência"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex h-8 items-center gap-1.5 rounded-lg px-2 transition-colors",
          open ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2 hover:text-text"
        )}
      >
        <Icon size={15} />
        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-border" style={{ background: "var(--accent)" }} />
      </button>

      {open && (
        <div className="animate-pop absolute right-0 top-10 z-40 w-72 rounded-2xl border border-border bg-elev p-3 shadow-pop">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Aparência</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-panel-2 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setThemeMode(m.id)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-[12px] font-medium transition-all",
                  themeMode === m.id ? "bg-elev text-text shadow-sm ring-1 ring-border" : "text-muted hover:text-text"
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            {themeMode === "system"
              ? `Seguindo o sistema operacional · agora ${resolved === "dark" ? "escuro" : "claro"}`
              : "Alternar claro/escuro rapidamente:"}{" "}
            {themeMode !== "system" && <Kbd>⇧⌘L</Kbd>}
          </p>

          <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-faint">Tema de cor</div>
          <div className="grid grid-cols-4 gap-1.5">
            {ACCENTS.map((a) => {
              const active = a.id === accent;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  title={a.name}
                  className={cx(
                    "flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-[11px] transition-colors",
                    active ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2/60 hover:text-text"
                  )}
                >
                  <span
                    className={cx(
                      "grid h-7 w-7 place-items-center rounded-full transition-transform",
                      active ? "scale-110 ring-2 ring-offset-2 ring-offset-elev" : "ring-1 ring-border"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${a.light} 0 50%, ${a.dark} 50% 100%)`,
                      ["--tw-ring-color" as string]: active ? (resolved === "dark" ? a.dark : a.light) : undefined,
                    }}
                  >
                    {active && <Check size={13} strokeWidth={3} className="text-white drop-shadow" />}
                  </span>
                  {a.name}
                </button>
              );
            })}
          </div>

          <ThemePreview />
        </div>
      )}
    </div>
  );
}

/** A tiny automaton drawn with the live theme tokens. */
function ThemePreview() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-canvas">
      <svg viewBox="0 0 260 70" className="block w-full">
        <defs>
          <marker id="pv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0.5 L10,5 L0,9.5 L2.5,5 z" style={{ fill: "var(--edge)" }} />
          </marker>
          <marker id="pv-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0.5 L10,5 L0,9.5 L2.5,5 z" style={{ fill: "var(--accent)" }} />
          </marker>
        </defs>
        <path d="M14 38 L39 38" style={{ stroke: "var(--edge)" }} strokeWidth={1.5} markerEnd="url(#pv-arrow)" />
        <path d="M70 38 L114 38" style={{ stroke: "var(--accent)" }} strokeWidth={2} markerEnd="url(#pv-arrow-a)" />
        <path d="M146 38 L190 38" style={{ stroke: "var(--edge)" }} strokeWidth={1.5} markerEnd="url(#pv-arrow)" />
        <text x="92" y="30" textAnchor="middle" className="edge-label" style={{ fill: "var(--accent)", fontWeight: 700, fontSize: 11 }}>
          a
        </text>
        <text x="168" y="30" textAnchor="middle" className="edge-label" style={{ fontSize: 11 }}>
          b
        </text>
        <circle cx="55" cy="38" r="15" style={{ fill: "var(--state-fill)", stroke: "var(--state-stroke)" }} strokeWidth={1.5} />
        <circle cx="130" cy="38" r="15" style={{ fill: "var(--active-fill)", stroke: "var(--accent)" }} strokeWidth={2} />
        <circle cx="205" cy="38" r="15" style={{ fill: "color-mix(in srgb, var(--ok) 22%, var(--state-fill))", stroke: "var(--ok)" }} strokeWidth={1.5} />
        <circle cx="205" cy="38" r="11" fill="none" style={{ stroke: "var(--ok)" }} strokeWidth={1.2} />
        {[
          [55, "q0"],
          [130, "q1"],
          [205, "q2"],
        ].map(([x, t]) => (
          <text key={t} x={x} y={38} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--text)", fontSize: 10, fontWeight: 600 }}>
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}
