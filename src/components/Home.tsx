"use client";

import { useState } from "react";
import { ArrowRight, FolderOpen, Layers, Regex, Workflow, Cpu, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { EXAMPLES } from "@/lib/examples";
import { openFile } from "@/lib/platform";
import { MachineType, TYPE_SHORT } from "@/lib/types";
import { RegexToFa } from "./ConvertPanel";
import { ChomskyDiagram, LevelId, MiniVenn, levelName } from "./ChomskyDiagram";
import { Badge, Button, Kbd } from "./ui";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" style={{ fill: "var(--accent)" }} />
      <circle cx="10" cy="19" r="4.2" stroke="white" strokeWidth="1.8" />
      <circle cx="22" cy="19" r="4.2" stroke="white" strokeWidth="1.8" />
      <circle cx="22" cy="19" r="2" fill="white" />
      <path d="M12.5 15.6 Q16 11 19.5 15.6" stroke="white" strokeWidth="1.6" fill="none" />
      <path d="M18.3 13.9 L19.7 15.8 L17.4 16.1" stroke="white" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

const KINDS: { type: MachineType; title: string; desc: string; icon: React.ReactNode; tags: string[]; level: LevelId }[] = [
  {
    type: "fa",
    title: "Autômato Finito",
    desc: "AFD, AFN e AFN-ε. Converta, minimize e gere expressões regulares.",
    icon: <Workflow size={20} />,
    tags: ["AFD", "AFN", "ε"],
    level: "reg",
  },
  {
    type: "pda",
    title: "Autômato de Pilha",
    desc: "Não determinístico, com aceitação por estado final ou pilha vazia.",
    icon: <Layers size={20} />,
    tags: ["AP", "pilha"],
    level: "cfl",
  },
  {
    type: "tm",
    title: "Máquina de Turing",
    desc: "Fita infinita em ambos os sentidos, movimentos L, R e S.",
    icon: <Cpu size={20} />,
    tags: ["MT", "fita"],
    level: "re",
  },
];

export function Home() {
  const { newDoc, openDoc, patchDoc } = useStore.getState();
  const [regexOpen, setRegexOpen] = useState(false);
  const [hl, setHl] = useState<LevelId | null>(null);

  const openExample = (title: string) => {
    const ex = EXAMPLES.find((e) => e.title === title);
    if (!ex) return;
    const a = ex.make();
    const id = openDoc(a, ex.title);
    patchDoc(id, { batch: ex.tests.map((t) => (t === "" ? (a.type === "tm" ? "□" : "ε") : t)).join("\n") });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-14">
        <div className="animate-pop flex items-center gap-4">
          <Logo size={48} />
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-text">Automata Studio</h1>
            <p className="text-[14px] text-muted">Projete, simule e converta autômatos — de AFDs a Máquinas de Turing.</p>
          </div>
        </div>

        <h2 className="mb-3 mt-12 text-[11px] font-semibold uppercase tracking-wider text-faint">Novo</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {KINDS.map((k) => (
            <button
              key={k.type}
              onClick={() => newDoc(k.type)}
              onMouseEnter={() => setHl(k.level)}
              onMouseLeave={() => setHl(null)}
              className="group flex flex-col rounded-2xl border border-border bg-panel p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop"
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">{k.icon}</span>
                <MiniVenn level={k.level} className="h-10 w-[60px]" />
              </div>
              <div className="text-[15px] font-semibold text-text">{k.title}</div>
              <div className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{k.desc}</div>
              <Recognizes level={k.level} />
              <div className="mt-3 flex items-center gap-1">
                {k.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
                <ArrowRight size={14} className="ml-auto text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
            </button>
          ))}
          <button
            onClick={() => setRegexOpen(true)}
            onMouseEnter={() => setHl("reg")}
            onMouseLeave={() => setHl(null)}
            className="group flex flex-col rounded-2xl border border-border bg-panel p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop"
          >
            <div className="mb-4 flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <Regex size={20} />
              </span>
              <MiniVenn level="reg" className="h-10 w-[60px]" />
            </div>
            <div className="text-[15px] font-semibold text-text">Expressão Regular</div>
            <div className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">
              Escreva uma ER e gere o AFN equivalente para simular e converter.
            </div>
            <Recognizes level="reg" />
            <div className="mt-3 flex items-center gap-1">
              <Badge>ER</Badge>
              <Badge>→ AFN</Badge>
              <ArrowRight size={14} className="ml-auto text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button icon={<FolderOpen size={14} />} onClick={openFile}>
            Abrir arquivo…
          </Button>
          <span className="text-[12px] text-faint">
            Suporta <span className="font-mono text-muted">.automata</span> e arquivos <span className="font-mono text-muted">.jff</span> do JFLAP · <Kbd>⌘O</Kbd>
          </span>
        </div>

        <h2 className="mb-3 mt-12 text-[11px] font-semibold uppercase tracking-wider text-faint">Exemplos</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.title}
              onClick={() => openExample(ex.title)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-left transition-all hover:border-accent/50 hover:bg-elev"
            >
              <span className="mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg bg-panel-2 font-mono text-[10px] font-bold text-muted group-hover:text-accent">
                {TYPE_SHORT[ex.make().type]}
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-text">{ex.title}</span>
                <span className="block text-[12px] text-muted">{ex.description}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mb-3 mt-12 flex items-baseline justify-between gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Hierarquia de Chomsky · o que cada máquina reconhece</h2>
          <span className="text-[11px] text-faint">passe o mouse nos cards de “Novo” ou no diagrama</span>
        </div>
        <ChomskyDiagram highlight={hl} onHover={setHl} onOpen={openExample} />

        <h2 className="mb-3 mt-12 text-[11px] font-semibold uppercase tracking-wider text-faint">Atalhos</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-muted md:grid-cols-3">
          {[
            ["V", "Selecionar / mover"],
            ["S", "Criar estado"],
            ["T", "Criar transição"],
            ["D", "Apagar"],
            ["Del", "Excluir seleção"],
            ["⌘Z", "Desfazer"],
            ["⇧⌘Z", "Refazer"],
            ["Espaço + arrastar", "Mover a vista"],
            ["⌘ + rolar", "Zoom"],
            ["Duplo clique", "Renomear / editar"],
            ["Clique direito", "Inicial, final, rótulo…"],
            ["⇧⌘L", "Alternar tema"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <Kbd>{k}</Kbd>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {regexOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-sm" onPointerDown={() => setRegexOpen(false)}>
          <div className="animate-pop w-[480px] rounded-2xl border border-border bg-panel p-5 shadow-pop" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[15px] font-semibold text-text">Expressão regular → AFN</div>
              <button className="text-muted hover:text-text" onClick={() => setRegexOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <RegexToFa autoFocus />
          </div>
        </div>
      )}
    </div>
  );
}

function Recognizes({ level }: { level: LevelId }) {
  return (
    <div className="mt-3 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[11px] text-muted">
      Reconhece: <span className="font-semibold text-accent" title={levelName(level)}>{levelName(level, true)}</span>
    </div>
  );
}
