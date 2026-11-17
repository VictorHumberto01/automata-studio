"use client";

import { ArrowRight } from "lucide-react";
import { cx } from "./ui";

export type LevelId = "all" | "re" | "rec" | "cs" | "cfl" | "dcfl" | "reg";

export interface Level {
  id: LevelId;
  name: string;
  short: string;
  machine: string;
  examples: string;
  /** Machine kind available in the app that recognises this class */
  inApp: boolean;
  /** Title of an entry in EXAMPLES that lives in this class */
  example?: string;
}

/** Outermost first. Each class contains all the ones after it. */
export const LEVELS: Level[] = [
  { id: "all", name: "Todas as linguagens", short: "Todas", machine: "nenhuma máquina", examples: "complemento de HALT", inApp: false },
  { id: "re", name: "Recursivamente enumeráveis", short: "Rec. enumeráveis", machine: "Máquina de Turing", examples: "HALT (problema da parada)", inApp: true },
  { id: "rec", name: "Recursivas (decidíveis)", short: "Decidíveis", machine: "MT que sempre para", examples: "todo problema decidível", inApp: true },
  { id: "cs", name: "Sensíveis ao contexto", short: "Sensíveis ao contexto", machine: "Autômato linearmente limitado", examples: "aⁿbⁿcⁿ, ww", inApp: false, example: "MT — aⁿbⁿcⁿ" },
  { id: "cfl", name: "Livres de contexto", short: "Livres de contexto", machine: "AP não determinístico", examples: "wwᴿ (palíndromos)", inApp: true, example: "AP — palíndromos wwᴿ" },
  { id: "dcfl", name: "Livres de contexto determinísticas", short: "LLC determinísticas", machine: "AP determinístico", examples: "aⁿbⁿ, parênteses balanceados", inApp: true, example: "AP — aⁿbⁿ" },
  { id: "reg", name: "Regulares", short: "Regulares", machine: "AFD · AFN · ER", examples: "(ab)*, termina em ab", inApp: true, example: "AFD — termina em “ab”" },
];

const depth = (id: LevelId) => LEVELS.findIndex((l) => l.id === id);

// ── Big diagram geometry (viewBox 640×400): ellipses share a common bottom so
// each ring leaves a band at the top for its label. ──
const W = 640;
const H = 480;
const RINGS: Record<Exclude<LevelId, "all">, { rx: number; ry: number }> = {
  re: { rx: 302, ry: 222 },
  rec: { rx: 264, ry: 188 },
  cs: { rx: 224, ry: 154 },
  cfl: { rx: 184, ry: 120 },
  dcfl: { rx: 144, ry: 88 },
  reg: { rx: 102, ry: 54 },
};

function ring(id: Exclude<LevelId, "all">) {
  const d = depth(id);
  const { rx, ry } = RINGS[id];
  const bottom = H - 12 - d * 4;
  return { cx: W / 2, cy: bottom - ry, rx, ry, top: bottom - 2 * ry, bottom };
}

/** Whether the class `id` is contained in the highlighted class. */
const inside = (id: LevelId, hl: LevelId | null) => hl !== null && depth(id) >= depth(hl);

function tint(d: number) {
  return `color-mix(in srgb, var(--accent) ${4 + d * 3.5}%, var(--panel))`;
}
const HL_FILL = "color-mix(in srgb, var(--accent) 30%, var(--panel))";

export function ChomskyDiagram({
  highlight,
  onHover,
  onOpen,
}: {
  highlight: LevelId | null;
  onHover: (id: LevelId | null) => void;
  onOpen: (exampleTitle: string) => void;
}) {
  const ringIds = LEVELS.filter((l) => l.id !== "all").map((l) => l.id as Exclude<LevelId, "all">);

  return (
    <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div className="rounded-2xl border border-border bg-panel p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" onMouseLeave={() => onHover(null)}>
          {/* Universe */}
          <rect
            x={2}
            y={2}
            width={W - 4}
            height={H - 4}
            rx={16}
            style={{
              fill: highlight === "all" ? HL_FILL : "var(--panel-2)",
              stroke: highlight === "all" ? "var(--accent)" : "var(--border-strong)",
              transition: "fill .2s, stroke .2s",
            }}
            strokeWidth={highlight === "all" ? 2 : 1}
            onMouseEnter={() => onHover("all")}
          />
          <text x={16} y={28} style={labelStyle(highlight, "all")}>
            Todas
          </text>

          {ringIds.map((id) => {
            const g = ring(id);
            const d = depth(id);
            const lv = LEVELS[d];
            const isHl = highlight === id;
            const filled = inside(id, highlight);
            const dashed = !lv.inApp;
            return (
              <g key={id} onMouseEnter={() => onHover(id)} style={{ cursor: lv.example ? "pointer" : "default" }} onClick={() => lv.example && onOpen(lv.example)}>
                <ellipse
                  cx={g.cx}
                  cy={g.cy}
                  rx={g.rx}
                  ry={g.ry}
                  style={{
                    fill: filled ? HL_FILL : highlight ? "var(--panel)" : tint(d),
                    stroke: isHl ? "var(--accent)" : filled ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border-strong)",
                    transition: "fill .2s, stroke .2s",
                  }}
                  strokeWidth={isHl ? 2.2 : 1.2}
                  strokeDasharray={dashed && !isHl ? "5 4" : undefined}
                />
                {id === "reg" ? (
                  <>
                    <text x={g.cx} y={g.cy - 3} textAnchor="middle" style={labelStyle(highlight, id)}>
                      {lv.short}
                    </text>
                    <text x={g.cx} y={g.cy + 16} textAnchor="middle" style={subStyle(highlight, id)}>
                      {lv.machine}
                    </text>
                  </>
                ) : (
                  <>
                    <text x={g.cx} y={g.top + 25} textAnchor="middle" style={labelStyle(highlight, id)}>
                      {lv.short}
                    </text>
                    <text x={g.cx} y={g.top + 44} textAnchor="middle" style={subStyle(highlight, id)}>
                      {lv.machine}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-col gap-1">
        {LEVELS.slice()
          .reverse()
          .map((lv) => {
            const isHl = highlight === lv.id;
            const d = depth(lv.id);
            return (
              <div
                key={lv.id}
                onMouseEnter={() => onHover(lv.id)}
                onMouseLeave={() => onHover(null)}
                className={cx(
                  "group flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors",
                  isHl ? "border-accent/50 bg-elev" : "border-transparent hover:bg-panel"
                )}
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    background: lv.id === "all" ? "var(--panel-2)" : tint(d + 3),
                    border: `1.5px ${lv.inApp || lv.id === "all" ? "solid" : "dashed"} ${isHl ? "var(--accent)" : "var(--border-strong)"}`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cx("text-[13px] font-semibold", isHl ? "text-accent" : "text-text")}>{lv.name}</span>
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {lv.machine}
                    {lv.id === "cs" && <span className="text-faint"> · simulado aqui por uma MT</span>}
                  </div>
                  <div className="font-mono text-[11px] text-faint">ex.: {lv.examples}</div>
                </div>
                {lv.example && (
                  <button
                    onClick={() => onOpen(lv.example!)}
                    className="mt-0.5 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted opacity-0 transition-opacity hover:bg-panel-2 hover:text-accent group-hover:opacity-100"
                  >
                    Exemplo <ArrowRight size={11} />
                  </button>
                )}
              </div>
            );
          })}
        <p className="mt-1 px-3 text-[11px] leading-relaxed text-faint">
          Cada conjunto contém os de dentro: toda linguagem regular é livre de contexto, toda livre de contexto é
          decidível, e assim por diante. Contornos tracejados indicam classes sem editor próprio no app.
        </p>
      </div>
    </div>
  );
}

function labelStyle(hl: LevelId | null, id: LevelId): React.CSSProperties {
  const dim = hl !== null && !inside(id, hl) && hl !== id;
  return {
    fill: hl === id ? "var(--accent)" : dim ? "var(--faint)" : "var(--text)",
    fontWeight: 650,
    fontSize: 15.5,
    transition: "fill .2s",
    pointerEvents: "none",
  };
}

function subStyle(hl: LevelId | null, id: LevelId): React.CSSProperties {
  const dim = hl !== null && !inside(id, hl) && hl !== id;
  return { fill: dim ? "var(--faint)" : "var(--muted)", fontSize: 12.5, transition: "fill .2s", pointerEvents: "none" };
}

// ── Mini Venn used on the "Novo" cards: 4 main classes, target area filled ──

const MINI: { id: LevelId; rx: number; ry: number }[] = [
  { id: "re", rx: 34, ry: 21 },
  { id: "cs", rx: 26, ry: 15.5 },
  { id: "cfl", rx: 18.5, ry: 10.5 },
  { id: "reg", rx: 11, ry: 6 },
];

export function MiniVenn({ level, className }: { level: LevelId; className?: string }) {
  const bottom = 46;
  return (
    <svg viewBox="0 0 72 48" className={className} aria-hidden>
      {MINI.map((m, i) => {
        const filled = inside(m.id, level);
        const isTarget = m.id === level;
        return (
          <ellipse
            key={m.id}
            cx={36}
            cy={bottom - i * 1.5 - m.ry}
            rx={m.rx}
            ry={m.ry}
            style={{
              fill: filled ? "color-mix(in srgb, var(--accent) 34%, var(--panel))" : "var(--panel)",
              stroke: isTarget ? "var(--accent)" : filled ? "color-mix(in srgb, var(--accent) 50%, transparent)" : "var(--border-strong)",
              transition: "fill .2s, stroke .2s",
            }}
            strokeWidth={isTarget ? 1.6 : 1}
          />
        );
      })}
    </svg>
  );
}

export function levelName(id: LevelId, short = false) {
  const lv = LEVELS[depth(id)];
  return short ? lv.short : lv.name;
}
