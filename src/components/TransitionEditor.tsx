"use client";

import { useRef, useState } from "react";
import { MachineType, Move, Transition, normBlank, normEps, BLANK } from "@/lib/types";
import { Pt } from "@/lib/geometry";
import { cx } from "./ui";

export function TransitionEditor({
  type,
  transition,
  pos,
  onCommit,
  onCancel,
}: {
  type: MachineType;
  transition: Transition;
  pos: Pt;
  onCommit: (patch: Partial<Transition>) => void;
  onCancel: () => void;
}) {
  const show = (s: string | undefined) => (type === "tm" ? (s === BLANK ? "" : (s ?? "")) : (s ?? ""));
  const [read, setRead] = useState(show(transition.read));
  const [pop, setPop] = useState(transition.pop ?? "");
  const [push, setPush] = useState(transition.push ?? "");
  const [write, setWrite] = useState(show(transition.write));
  const [move, setMove] = useState<Move>(transition.move ?? "R");
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    if (type === "fa") onCommit({ read: normEps(read) });
    else if (type === "pda") onCommit({ read: normEps(read), pop: normEps(pop), push: normEps(push) });
    else {
      const r = normBlank(read);
      const w = normBlank(write);
      onCommit({ read: [...r][0] ?? BLANK, write: [...w][0] ?? BLANK, move });
    }
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (type === "tm" && (e.target as HTMLElement).dataset.move !== undefined) {
      const k = e.key.toUpperCase();
      if (k === "L" || k === "R" || k === "S") setMove(k);
    }
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, autoFocus = false, width = "w-16") => (
    <input
      autoFocus={autoFocus}
      className={cx("field h-8 px-2 text-center", width)}
      value={value}
      placeholder={placeholder}
      onChange={(e) => set(e.target.value)}
      onFocus={(e) => e.target.select()}
      spellCheck={false}
    />
  );

  return (
    <div
      ref={ref}
      className="animate-pop absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) commit();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-elev p-1.5 shadow-pop">
        {type === "fa" && field(read, setRead, "ε", true, "w-24")}
        {type === "pda" && (
          <>
            {field(read, setRead, "ε", true)}
            <span className="text-faint">,</span>
            {field(pop, setPop, "ε")}
            <span className="text-faint">→</span>
            {field(push, setPush, "ε", false, "w-20")}
          </>
        )}
        {type === "tm" && (
          <>
            {field(read, setRead, BLANK, true, "w-12")}
            <span className="text-faint">→</span>
            {field(write, setWrite, BLANK, false, "w-12")}
            <span className="text-faint">,</span>
            <div className="flex rounded-lg border border-border bg-panel-2 p-0.5" data-move tabIndex={0}>
              {(["L", "R", "S"] as Move[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cx(
                    "h-6 w-7 rounded-md font-mono text-xs font-semibold transition-colors",
                    move === m ? "bg-accent text-accent-fg" : "text-muted hover:text-text"
                  )}
                  onClick={() => setMove(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mx-auto mt-1 w-max rounded-md bg-elev/95 px-1.5 py-0.5 text-center text-[10px] text-faint shadow-pop">
        {type === "tm" ? "vazio = □ (branco)" : "vazio = ε"} · Enter confirma · Esc cancela
      </div>
    </div>
  );
}
