"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { BLANK, normEps, showSym } from "@/lib/types";
import { RunResult, runToEnd } from "@/lib/simulate";
import { Doc, useStore } from "@/lib/store";
import { Button, Section, cx } from "./ui";
import { StatusBadge } from "./SimulatePanel";

export function BatchPanel({ doc }: { doc: Doc }) {
  const a = doc.automaton;
  const patchDoc = useStore((s) => s.patchDoc);
  const [results, setResults] = useState<{ input: string; r: RunResult }[] | null>(null);
  const [stale, setStale] = useState(false);

  const lines = useMemo(
    () =>
      doc.batch
        .split("\n")
        .map((l) => l.replace(/\r$/, ""))
        .filter((l) => l.trim() !== ""),
    [doc.batch]
  );

  const run = () => {
    setResults(
      lines.map((l) => {
        const input = a.type === "tm" ? (l.trim() === BLANK ? "" : l.trim()) : normEps(l);
        return { input, r: runToEnd(a, input) };
      })
    );
    setStale(false);
  };

  const accepted = results?.filter((x) => x.r.status === "accepted").length ?? 0;

  return (
    <div>
      <Section title="Entradas · uma por linha">
        <textarea
          className="field min-h-36"
          spellCheck={false}
          placeholder={a.type === "tm" ? "1011\n111\n□" : "ab\naab\nε\nba"}
          value={doc.batch}
          onChange={(e) => {
            patchDoc(doc.id, { batch: e.target.value });
            setStale(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
        />
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="primary" icon={<ListChecks size={14} />} onClick={run} disabled={!lines.length}>
            Executar todas
          </Button>
          <span className="text-[11px] text-faint">{a.type === "tm" ? "□ = fita vazia" : "ε ou λ = cadeia vazia"} · ⌘↵</span>
        </div>
      </Section>
      {results && (
        <Section
          title={`Resultados${stale ? " (desatualizado)" : ""}`}
          right={
            <span className="text-[11px] text-muted">
              <b className="text-ok">{accepted}</b> aceitas · <b className="text-bad">{results.length - accepted}</b> rejeitadas
            </span>
          }
        >
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-panel-2 text-left text-[11px] text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Entrada</th>
                  {a.type === "tm" && <th className="px-3 py-2 font-medium">Saída</th>}
                  <th className="px-3 py-2 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ input, r }, i) => (
                  <tr key={i} className={cx("border-t border-border", i % 2 === 1 && "bg-panel-2/40")}>
                    <td className="px-3 py-1.5 font-mono text-text">{a.type === "tm" ? input || BLANK : showSym(input)}</td>
                    {a.type === "tm" && (
                      <td className="px-3 py-1.5 font-mono text-muted">{r.output !== undefined ? r.output || BLANK : "—"}</td>
                    )}
                    <td className="px-3 py-1.5 text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
