"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useActiveDoc, useStore } from "@/lib/store";
import { electron, exportJff, exportSvg, openFile, saveFile } from "@/lib/platform";
import { TopBar } from "@/components/TopBar";
import { Home } from "@/components/Home";
import { DocView } from "@/components/DocView";
import { cx } from "@/components/ui";
import { DEFAULT_ACCENT, ThemeMode } from "@/lib/theme";

function runCommand(cmd: string) {
  const s = useStore.getState();
  if (cmd.startsWith("mode:")) return s.setThemeMode(cmd.slice(5) as ThemeMode);
  if (cmd.startsWith("accent:")) return s.setAccent(cmd.slice(7));
  switch (cmd) {
    case "new":
      return s.setActive(null);
    case "open":
      return openFile();
    case "save":
      return saveFile();
    case "saveAs":
      return saveFile(true);
    case "exportJff":
      return exportJff();
    case "exportSvg":
      return exportSvg();
    case "closeTab": {
      const d = s.docs.find((x) => x.id === s.activeId);
      if (d && (!d.dirty || confirm(`Fechar “${d.title}” sem salvar?`))) s.closeDoc(d.id);
      return;
    }
    case "undo":
    case "redo":
      // Inside text fields, keep the native text undo
      if (document.activeElement?.closest("input, textarea")) return document.execCommand(cmd);
      return cmd === "undo" ? s.undo() : s.redo();
    case "toggleTheme":
      return s.toggleTheme();
    case "fit":
      return s.requestFit();
  }
}

export default function Page() {
  const doc = useActiveDoc();
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    // Adopt what the pre-paint script applied, then sync Electron's native theme and menu
    const root = document.documentElement;
    const mode = (["system", "light", "dark"].includes(root.dataset.mode ?? "") ? root.dataset.mode : "system") as ThemeMode;
    useStore.setState({
      themeMode: mode,
      resolvedTheme: root.classList.contains("dark") ? "dark" : "light",
      accent: root.dataset.accent ?? DEFAULT_ACCENT,
    });
    useStore.getState().setThemeMode(mode);

    const api = electron();
    if (api) return api.onMenu(runCommand);

    // Browser: handle shortcuts ourselves (Electron menu accelerators do it natively)
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const inField = (e.target as HTMLElement | null)?.closest?.("input, textarea");
      const k = e.key.toLowerCase();
      const map: Record<string, string> = { o: "open", s: e.shiftKey ? "saveAs" : "save", "0": "fit" };
      if (!inField) Object.assign(map, { z: e.shiftKey ? "redo" : "undo", y: "redo" });
      if (k === "l" && e.shiftKey) map.l = "toggleTheme";
      if (map[k]) {
        e.preventDefault();
        runCommand(map[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Follow the OS appearance live while in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => useStore.getState().syncSystemTheme();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().docs.some((d) => d.dirty) && !electron()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      {doc ? <DocView key={doc.id} doc={doc} /> : <Home />}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div
            key={toast.id}
            className={cx(
              "animate-pop flex items-center gap-2 rounded-xl border bg-elev px-3.5 py-2 text-[13px] font-medium shadow-pop",
              toast.kind === "error" ? "border-bad/40 text-bad" : toast.kind === "ok" ? "border-ok/30 text-text" : "border-border text-text"
            )}
          >
            {toast.kind === "error" ? (
              <AlertCircle size={15} />
            ) : toast.kind === "ok" ? (
              <CheckCircle2 size={15} className="text-ok" />
            ) : (
              <Info size={15} className="text-accent" />
            )}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
