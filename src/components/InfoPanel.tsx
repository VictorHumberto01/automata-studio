"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BLANK, EPSILON, STACK_START, TYPE_LABEL, showSym } from "@/lib/types";
import { analyze } from "@/lib/analyze";
import { Doc, useStore } from "@/lib/store";
import { Badge, Section, cx } from "./ui";

export function InfoPanel({ doc }: { doc: Doc }) {
  const a = doc.automaton;
  const info = analyze(a);
  const apply = useStore((s) => s.apply);
  const name = (id: string) => a.states.find((s) => s.id === id)?.name ?? "?";
  const set = (xs: string[]) => `{${xs.join(", ")}}`;
  const Q = a.states.map((s) => s.name);
  const F = a.states.filter((s) => s.final).map((s) => s.name);
  const q0 = a.states.find((s) => s.initial)?.name ?? "—";

  return (
    <div>
      <Section title="Resumo">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">{TYPE_LABEL[a.type]}</Badge>
          {info.deterministic ? <Badge tone="ok">Determinístico</Badge> : <Badge tone="warn">Não determinístico</Badge>}
          {a.type === "fa" && info.deterministic && (info.complete ? <Badge>Completo</Badge> : <Badge>Parcial</Badge>)}
          <Badge>{a.states.length} estados</Badge>
          <Badge>{a.transitions.length} transições</Badge>
        </div>
        {a.type === "pda" && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-muted">Aceitação por</span>
            <div className="flex rounded-lg border border-border bg-panel-2 p-0.5">
              {(["final", "empty"] as const).map((m) => (
                <button
                  key={m}
                  className={cx(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    (a.acceptance ?? "final") === m ? "bg-accent text-accent-fg" : "text-muted hover:text-text"
                  )}
                  onClick={() => apply((x) => ({ ...x, acceptance: m }))}
                >
                  {m === "final" ? "estado final" : "pilha vazia"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 space-y-1.5">
          {info.warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-ok">
              <CheckCircle2 size={14} /> Nenhum problema encontrado.
            </div>
          ) : (
            info.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Definição formal">
        <div className="space-y-1 font-mono text-xs leading-relaxed text-muted">
          <div className="text-text">
            M = (
            {a.type === "fa" && "Q, Σ, δ, q₀, F"}
            {a.type === "pda" && "Q, Σ, Γ, δ, q₀, Z, F"}
            {a.type === "tm" && "Q, Σ, Γ, δ, q₀, □, F"})
          </div>
          <Row k="Q" v={set(Q)} />
          <Row k="Σ" v={set(info.alphabet)} />
          {a.type === "pda" && <Row k="Γ" v={set([...new Set([STACK_START, ...info.stackAlphabet])])} />}
          {a.type === "tm" && <Row k="Γ" v={set([...new Set([...info.tapeAlphabet, BLANK])])} />}
          <Row k="q₀" v={q0} />
          {a.type === "pda" && <Row k="Z" v={STACK_START} />}
          <Row k="F" v={set(F)} />
        </div>
      </Section>

      <Section title="Função de transição δ">
        {a.type === "fa" ? (
          <FaTable doc={doc} alphabet={info.alphabet} />
        ) : (
          <div className="max-h-96 space-y-0.5 overflow-auto font-mono text-xs">
            {a.transitions.length === 0 && <div className="text-faint">Nenhuma transição.</div>}
            {a.transitions.map((t) => (
              <div key={t.id} className="rounded px-1.5 py-0.5 text-muted hover:bg-panel-2">
                {a.type === "pda" ? (
                  <>
                    δ(<b className="text-text">{name(t.from)}</b>, {showSym(t.read)}, {showSym(t.pop)}) ∋ (
                    <b className="text-text">{name(t.to)}</b>, {showSym(t.push)})
                  </>
                ) : (
                  <>
                    δ(<b className="text-text">{name(t.from)}</b>, {showSym(t.read, true)}) = (
                    <b className="text-text">{name(t.to)}</b>, {showSym(t.write, true)}, {t.move ?? "R"})
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-6 shrink-0 text-accent">{k}</span>
      <span className="text-faint">=</span>
      <span className="break-all text-text">{v}</span>
    </div>
  );
}

function FaTable({ doc, alphabet }: { doc: Doc; alphabet: string[] }) {
  const a = doc.automaton;
  const hasMulti = a.transitions.some((t) => t.read.length > 1);
  const cols = [...alphabet];
  if (a.transitions.some((t) => t.read === "")) cols.push("");
  if (!a.states.length) return <div className="text-xs text-faint">Nenhum estado.</div>;
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full font-mono text-xs">
        <thead className="bg-panel-2 text-faint">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-medium">δ</th>
            {cols.map((c) => (
              <th key={c} className="px-2.5 py-1.5 text-center font-medium">
                {c === "" ? EPSILON : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {a.states.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="whitespace-nowrap px-2.5 py-1.5 text-text">
                {s.initial && <span className="text-accent">→</span>}
                {s.final && <span className="text-ok">*</span>}
                {s.name}
              </td>
              {cols.map((c) => {
                const targets = a.transitions
                  .filter((t) => t.from === s.id && t.read === c)
                  .map((t) => a.states.find((x) => x.id === t.to)?.name);
                return (
                  <td key={c} className={cx("px-2.5 py-1.5 text-center", targets.length ? "text-text" : "text-faint")}>
                    {targets.length === 0 ? "∅" : targets.length === 1 ? targets[0] : `{${targets.join(",")}}`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMulti && (
        <div className="border-t border-border px-2.5 py-1.5 text-[11px] text-faint">
          Transições com múltiplos símbolos não aparecem na tabela.
        </div>
      )}
    </div>
  );
}
