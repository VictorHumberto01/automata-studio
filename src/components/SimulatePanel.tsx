"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FastForward, Play, RotateCcw, Square, StepForward } from "lucide-react";
import { Automaton, BLANK, normEps, showSym, transitionLabel } from "@/lib/types";
import { Config, RunResult, runToEnd, startSim, stateName, stepSim, tapeString, MAX_STEPS } from "@/lib/simulate";
import { Doc, useStore } from "@/lib/store";
import { Badge, Button, Section, cx } from "./ui";

export function SimulatePanel({ doc }: { doc: Doc }) {
  const a = doc.automaton;
  const setSim = useStore((s) => s.setSim);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const sim = doc.sim;

  useEffect(() => setResult(null), [a]);

  const realInput = a.type === "tm" ? input : normEps(input) === "" ? "" : input;

  const start = () => {
    setResult(null);
    setSim(startSim(a, realInput));
  };
  const step = () => sim && setSim(stepSim(a, sim));
  const finish = () => {
    if (!sim) return;
    let s = sim;
    while (s.status === "running" && s.steps < MAX_STEPS) s = stepSim(a, s);
    setSim(s);
  };
  const fast = () => {
    setSim(null);
    setResult(runToEnd(a, realInput));
  };

  const noInitial = !a.states.some((s) => s.initial);

  return (
    <div>
      <Section title="Entrada">
        <div className="flex gap-2">
          <input
            className="field"
            placeholder={a.type === "tm" ? "conteúdo inicial da fita" : "cadeia de entrada (vazio = ε)"}
            value={input}
            spellCheck={false}
            onChange={(e) => {
              setInput(e.target.value);
              if (sim) setSim(null);
              setResult(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.shiftKey ? start : fast)();
            }}
          />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Button variant="primary" icon={<Play size={14} />} onClick={fast} disabled={noInitial}>
            Executar
          </Button>
          <Button icon={<StepForward size={14} />} onClick={start} disabled={noInitial}>
            Passo a passo
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-faint">
          Enter executa · Shift+Enter inicia passo a passo
          {noInitial && <span className="text-warn"> · defina um estado inicial</span>}
        </p>
      </Section>

      {result && <ResultView a={a} result={result} input={realInput} />}

      {sim && (
        <Section
          title={`Simulação · passo ${sim.steps}`}
          right={<StatusBadge status={sim.status} />}
        >
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Button size="sm" variant="primary" icon={<StepForward size={13} />} onClick={step} disabled={sim.status !== "running"}>
              Passo
            </Button>
            <Button size="sm" icon={<FastForward size={13} />} onClick={finish} disabled={sim.status !== "running"}>
              Concluir
            </Button>
            <Button size="sm" icon={<RotateCcw size={13} />} onClick={start}>
              Reiniciar
            </Button>
          </div>
          <div className="mb-2 text-[11px] text-muted">
            {sim.status === "accepted"
              ? "Configuração de aceitação encontrada."
              : sim.status === "rejected"
                ? "Nenhuma configuração restante — entrada rejeitada."
                : sim.status === "limit"
                  ? "Limite de configurações/passos atingido (possível laço infinito)."
                  : `${sim.active.length} configuraç${sim.active.length === 1 ? "ão ativa" : "ões ativas"}`}
          </div>
          <div className="space-y-2">
            {(sim.status === "accepted" ? sim.accepted : sim.status === "rejected" ? sim.dead : sim.active)
              .slice(0, 40)
              .map((c) => (
                <ConfigCard
                  key={c.key + c.depth}
                  a={a}
                  c={c}
                  input={sim.input}
                  tone={sim.status === "accepted" ? "ok" : sim.status === "rejected" ? "bad" : "accent"}
                />
              ))}
          </div>
          <div className="mt-3">
            <Button size="sm" variant="ghost" icon={<Square size={12} />} onClick={() => setSim(null)}>
              Encerrar simulação
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "accepted") return <Badge tone="ok">ACEITA</Badge>;
  if (status === "rejected") return <Badge tone="bad">REJEITADA</Badge>;
  if (status === "limit") return <Badge tone="warn">LIMITE</Badge>;
  return <Badge tone="accent">EXECUTANDO</Badge>;
}

function ResultView({ a, result, input }: { a: Automaton; result: RunResult; input: string }) {
  const tone = result.status === "accepted" ? "ok" : result.status === "rejected" ? "bad" : "warn";
  return (
    <Section title="Resultado" right={<StatusBadge status={result.status} />}>
      <div
        className={cx(
          "rounded-xl border p-3",
          tone === "ok" && "border-ok/30 bg-ok-soft",
          tone === "bad" && "border-bad/30 bg-bad-soft",
          tone === "warn" && "border-warn/30 bg-warn-soft"
        )}
      >
        <div
          className={cx(
            "text-[15px] font-semibold",
            tone === "ok" && "text-ok",
            tone === "bad" && "text-bad",
            tone === "warn" && "text-warn"
          )}
        >
          {result.status === "accepted"
            ? "Entrada aceita"
            : result.status === "rejected"
              ? "Entrada rejeitada"
              : "Execução interrompida"}
        </div>
        <div className="mt-0.5 font-mono text-xs text-muted">
          “{showSym(input)}” · {result.steps} passo{result.steps === 1 ? "" : "s"}
        </div>
        {result.output !== undefined && (
          <div className="mt-2 text-xs">
            <span className="text-muted">Saída na fita: </span>
            <span className="font-mono font-semibold text-text">{result.output || BLANK}</span>
          </div>
        )}
      </div>
      {result.path.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-medium text-muted">Caminho de aceitação</div>
          <div className="max-h-72 space-y-1 overflow-auto pr-1">
            {result.path.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2 py-1.5 font-mono text-xs">
                <span className="w-5 text-right text-faint">{i}</span>
                {c.via && (
                  <>
                    <span className="text-accent">{transitionLabel(c.via, a.type)}</span>
                    <ChevronRight size={12} className="text-faint" />
                  </>
                )}
                <span className="font-semibold text-text">{stateName(a, c.state)}</span>
                <span className="ml-auto truncate text-faint">{configSummary(a, c, input)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function configSummary(a: Automaton, c: Config, input: string) {
  if (a.type === "fa") return showSym(input.slice(c.pos));
  if (a.type === "pda") return `${showSym(input.slice(c.pos))} | ${c.stack || "ε"}`;
  const t = tapeString(c.tape);
  return t.text || BLANK;
}

export function ConfigCard({ a, c, input, tone }: { a: Automaton; c: Config; input: string; tone: "ok" | "bad" | "accent" }) {
  return (
    <div
      className={cx(
        "rounded-xl border bg-panel-2 p-2.5",
        tone === "ok" ? "border-ok/40" : tone === "bad" ? "border-bad/40" : "border-border"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cx(
            "grid h-6 min-w-6 place-items-center rounded-full border px-1.5 text-[11px] font-bold",
            tone === "ok" ? "border-ok text-ok" : tone === "bad" ? "border-bad text-bad" : "border-accent text-accent"
          )}
        >
          {stateName(a, c.state)}
        </span>
        {c.via && <span className="truncate font-mono text-[11px] text-faint">via {transitionLabel(c.via, a.type)}</span>}
      </div>
      {a.type !== "tm" && <InputTape input={input} pos={c.pos} />}
      {a.type === "pda" && <StackView stack={c.stack} />}
      {a.type === "tm" && <TapeView tape={c.tape} head={c.head} />}
    </div>
  );
}

function InputTape({ input, pos }: { input: string; pos: number }) {
  const chars = [...input];
  if (!chars.length) return <div className="font-mono text-xs text-faint">entrada: ε</div>;
  return (
    <div className="flex flex-wrap gap-0.5 font-mono text-[13px]">
      {chars.map((ch, i) => (
        <span
          key={i}
          className={cx(
            "grid h-6 w-5 place-items-center rounded",
            i < pos && "text-faint line-through decoration-faint/50",
            i === pos && "bg-accent text-accent-fg font-bold",
            i > pos && "text-text"
          )}
        >
          {ch}
        </span>
      ))}
      {pos >= chars.length && <span className="ml-1 self-center text-[10px] text-ok">✓ consumida</span>}
    </div>
  );
}

function StackView({ stack }: { stack: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-faint">Pilha</span>
      <div className="flex flex-wrap gap-0.5 font-mono text-xs">
        {stack.length === 0 && <span className="text-faint">vazia</span>}
        {[...stack].map((ch, i) => (
          <span
            key={i}
            className={cx(
              "grid h-6 min-w-5 place-items-center rounded border px-1",
              i === 0 ? "border-accent bg-accent-soft font-bold text-accent" : "border-border text-text"
            )}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TapeView({ tape, head }: { tape: Record<number, string>; head: number }) {
  const keys = Object.keys(tape).map(Number);
  const min = Math.min(head - 3, ...keys.map((k) => k - 1));
  const max = Math.max(head + 3, ...keys.map((k) => k + 1));
  const cells: number[] = [];
  for (let i = min; i <= max; i++) cells.push(i);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max">
        {cells.map((i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className={cx(
                "grid h-7 w-7 place-items-center border-y border-r border-border font-mono text-[13px] first:border-l",
                i === head ? "bg-accent-soft font-bold text-accent" : tape[i] ? "bg-panel text-text" : "bg-panel text-faint"
              )}
            >
              {tape[i] ?? BLANK}
            </div>
            <div className={cx("h-3 text-[10px] leading-3", i === head ? "text-accent" : "text-transparent")}>▲</div>
          </div>
        ))}
      </div>
    </div>
  );
}
