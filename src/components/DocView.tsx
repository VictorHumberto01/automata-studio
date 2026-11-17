"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Focus,
  LayoutGrid,
  MousePointer2,
  Redo2,
  ScanSearch,
  Undo2,
} from "lucide-react";
import { Doc, useStore } from "@/lib/store";
import { layeredLayout } from "@/lib/layout";
import { Canvas, Tool } from "./Canvas";
import { SimulatePanel } from "./SimulatePanel";
import { BatchPanel } from "./BatchPanel";
import { ConvertPanel } from "./ConvertPanel";
import { InfoPanel } from "./InfoPanel";
import { IconButton, cx } from "./ui";

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode; hint: string }[] = [
  { id: "select", label: "Selecionar e mover", key: "V", icon: <MousePointer2 size={17} />, hint: "Arraste estados · arraste no vazio para selecionar · duplo clique cria estado" },
  { id: "state", label: "Criar estado", key: "S", icon: <Circle size={17} />, hint: "Clique no canvas para criar um estado" },
  { id: "transition", label: "Criar transição", key: "T", icon: <ArrowUpRight size={17} />, hint: "Arraste de um estado para outro (ou para ele mesmo)" },
  { id: "delete", label: "Apagar", key: "D", icon: <Eraser size={17} />, hint: "Clique em um estado ou transição para apagar" },
];

type Tab = "sim" | "batch" | "convert" | "info";

export function DocView({ doc }: { doc: Doc }) {
  const [tool, setTool] = useState<Tool>(doc.automaton.states.length ? "select" : "state");
  const [tab, setTab] = useState<Tab>("sim");
  const [showNondet, setShowNondet] = useState(false);
  const { undo, redo, apply, requestFit } = useStore.getState();

  const tabs: { id: Tab; label: string }[] = [
    { id: "sim", label: "Simular" },
    { id: "batch", label: "Lote" },
    ...(doc.automaton.type === "fa" ? [{ id: "convert" as Tab, label: "Converter" }] : []),
    { id: "info", label: "Definição" },
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "sim";
  const hint = TOOLS.find((t) => t.id === tool)!.hint;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Toolbar */}
      <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-3">
        {TOOLS.map((t) => (
          <IconButton key={t.id} label={t.label} shortcut={t.key} active={tool === t.id} onClick={() => setTool(t.id)}>
            {t.icon}
          </IconButton>
        ))}
        <div className="my-2 h-px w-7 bg-border" />
        <IconButton label="Desfazer" shortcut="⌘Z" onClick={undo} disabled={!doc.past.length}>
          <Undo2 size={17} />
        </IconButton>
        <IconButton label="Refazer" shortcut="⇧⌘Z" onClick={redo} disabled={!doc.future.length}>
          <Redo2 size={17} />
        </IconButton>
        <div className="my-2 h-px w-7 bg-border" />
        <IconButton
          label="Organizar automaticamente"
          onClick={() => {
            apply((a) => layeredLayout(a));
            requestFit();
          }}
          disabled={!doc.automaton.states.length}
        >
          <LayoutGrid size={17} />
        </IconButton>
        <IconButton label="Ajustar à tela" shortcut="⌘0" onClick={requestFit}>
          <Focus size={17} />
        </IconButton>
        <IconButton label="Destacar não-determinismo" active={showNondet} onClick={() => setShowNondet((v) => !v)}>
          <ScanSearch size={17} />
        </IconButton>
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <Canvas doc={doc} tool={tool} setTool={setTool} showNondet={showNondet} />
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-border bg-panel/85 px-3 py-1 text-[11px] text-muted shadow-pop backdrop-blur">
          {hint}
        </div>
      </div>

      {/* Side panel */}
      <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-panel">
        <div className="flex gap-1 border-b border-border p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-colors",
                activeTab === t.id ? "bg-panel-2 text-text shadow-sm" : "text-muted hover:text-text"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "sim" && <SimulatePanel doc={doc} />}
          {activeTab === "batch" && <BatchPanel doc={doc} />}
          {activeTab === "convert" && <ConvertPanel doc={doc} />}
          {activeTab === "info" && <InfoPanel doc={doc} />}
        </div>
      </aside>
    </div>
  );
}
