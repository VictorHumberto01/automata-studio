"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Plus, Save, X, Home as HomeIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { electron, exportJff, exportSvg, openFile, saveFile } from "@/lib/platform";
import { TYPE_SHORT } from "@/lib/types";
import { Logo } from "./Home";
import { ThemeMenu } from "./ThemeMenu";
import { cx } from "./ui";

export function TopBar() {
  const docs = useStore((s) => s.docs);
  const activeId = useStore((s) => s.activeId);
  const { setActive, closeDoc } = useStore.getState();
  const [mac, setMac] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMac(electron()?.platform === "darwin"), []);
  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: PointerEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, [exportOpen]);

  const close = (id: string) => {
    const d = docs.find((x) => x.id === id);
    if (d?.dirty && !confirm(`Fechar “${d.title}” sem salvar?`)) return;
    closeDoc(id);
  };

  return (
    <header className={cx("drag-region flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel pr-2", mac ? "pl-20" : "pl-3")}>
      <button className="no-drag flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-panel-2" onClick={() => setActive(null)} title="Início">
        <Logo size={22} />
        {!docs.length && <span className="text-[13px] font-semibold text-text">Automata Studio</span>}
      </button>

      <nav className="no-drag flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {docs.length > 0 && (
          <button
            className={cx(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
              activeId === null ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2 hover:text-text"
            )}
            onClick={() => setActive(null)}
            title="Início"
          >
            <HomeIcon size={14} />
          </button>
        )}
        {docs.map((d) => (
          <div
            key={d.id}
            onClick={() => setActive(d.id)}
            onAuxClick={(e) => e.button === 1 && close(d.id)}
            className={cx(
              "group flex h-7 max-w-56 shrink-0 cursor-default items-center gap-2 rounded-lg pl-2 pr-1 text-[12px] transition-colors",
              d.id === activeId ? "bg-panel-2 text-text shadow-sm ring-1 ring-border" : "text-muted hover:bg-panel-2/60 hover:text-text"
            )}
          >
            <span
              className={cx(
                "rounded px-1 font-mono text-[9px] font-bold",
                d.id === activeId ? "bg-accent-soft text-accent" : "bg-panel-2 text-faint"
              )}
            >
              {TYPE_SHORT[d.automaton.type]}
            </span>
            <span className="truncate font-medium">{d.title}</span>
            <button
              className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint hover:bg-border hover:text-text"
              onClick={(e) => {
                e.stopPropagation();
                close(d.id);
              }}
            >
              {d.dirty ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent group-hover:hidden" />
                  <X size={12} className="hidden group-hover:block" />
                </>
              ) : (
                <X size={12} className="opacity-0 group-hover:opacity-100" />
              )}
            </button>
          </div>
        ))}
        {docs.length > 0 && (
          <button
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text"
            onClick={() => setActive(null)}
            title="Novo"
          >
            <Plus size={14} />
          </button>
        )}
      </nav>

      <div className="no-drag flex items-center gap-0.5">
        <TopIcon label="Abrir (⌘O)" onClick={openFile}>
          <FolderOpen size={15} />
        </TopIcon>
        <TopIcon label="Salvar (⌘S)" onClick={() => saveFile()} disabled={!activeId}>
          <Save size={15} />
        </TopIcon>
        <div className="relative" ref={exportRef}>
          <TopIcon label="Exportar" onClick={() => setExportOpen((v) => !v)} disabled={!activeId}>
            <Download size={15} />
          </TopIcon>
          {exportOpen && (
            <div className="animate-pop absolute right-0 top-9 z-40 w-56 rounded-xl border border-border bg-elev p-1 shadow-pop">
              {[
                ["Arquivo JFLAP (.jff)", exportJff],
                ["Imagem vetorial (.svg)", exportSvg],
                ["Salvar como… (.automata)", () => saveFile(true)],
              ].map(([label, fn]) => (
                <button
                  key={label as string}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-panel-2"
                  onClick={() => {
                    setExportOpen(false);
                    (fn as () => void)();
                  }}
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <ThemeMenu />
      </div>
    </header>
  );
}

function TopIcon({
  label,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-text disabled:pointer-events-none disabled:opacity-35"
      {...rest}
    >
      {children}
    </button>
  );
}
