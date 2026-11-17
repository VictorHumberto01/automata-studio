"use client";

import { create } from "zustand";
import { Automaton, MachineType, TYPE_LABEL, emptyAutomaton, uid } from "./types";
import { SimState } from "./simulate";
import { ACCENTS, ACCENT_KEY, DEFAULT_ACCENT, MODE_KEY, Resolved, ThemeMode, applyToDocument, systemPrefersDark } from "./theme";

export interface Doc {
  id: string;
  title: string;
  filePath?: string;
  automaton: Automaton;
  past: Automaton[];
  future: Automaton[];
  dirty: boolean;
  sim: SimState | null;
  /** Inputs used in the multiple-run panel */
  batch: string;
  /** Bumped to ask the canvas to fit content into view */
  fitNonce: number;
}

interface Store {
  docs: Doc[];
  activeId: string | null;
  /** User preference */
  themeMode: ThemeMode;
  /** What is actually shown */
  resolvedTheme: Resolved;
  accent: string;
  toast: { id: number; text: string; kind: "info" | "error" | "ok" } | null;

  openDoc: (a: Automaton, title?: string, extra?: Partial<Doc>) => string;
  newDoc: (type: MachineType) => string;
  closeDoc: (id: string) => void;
  setActive: (id: string | null) => void;
  /** Mutate with an undo snapshot */
  apply: (fn: (a: Automaton) => Automaton) => void;
  /** Push an undo snapshot without changing anything (before a drag) */
  snapshot: () => void;
  /** Mutate without recording history (during a drag) */
  mutate: (fn: (a: Automaton) => Automaton) => void;
  undo: () => void;
  redo: () => void;
  patchDoc: (id: string, patch: Partial<Doc>) => void;
  setSim: (sim: SimState | null) => void;
  requestFit: () => void;
  setThemeMode: (m: ThemeMode) => void;
  setAccent: (id: string) => void;
  /** Re-resolve "system" after the OS appearance changed */
  syncSystemTheme: () => void;
  /** Switch to the opposite of what is currently shown */
  toggleTheme: () => void;
  showToast: (text: string, kind?: "info" | "error" | "ok") => void;
}

const HISTORY = 200;
let untitled = 0;

function updateActive(s: Store, fn: (d: Doc) => Partial<Doc>): Partial<Store> {
  return { docs: s.docs.map((d) => (d.id === s.activeId ? { ...d, ...fn(d) } : d)) };
}

export const useStore = create<Store>((set, get) => ({
  docs: [],
  activeId: null,
  themeMode: "system",
  resolvedTheme: "dark",
  accent: DEFAULT_ACCENT,
  toast: null,

  openDoc: (automaton, title, extra) => {
    const id = uid("doc");
    const doc: Doc = {
      id,
      title: title ?? `Sem título ${++untitled}`,
      automaton,
      past: [],
      future: [],
      dirty: false,
      sim: null,
      batch: "",
      fitNonce: 1,
      ...extra,
    };
    set((s) => ({ docs: [...s.docs, doc], activeId: id }));
    return id;
  },

  newDoc: (type) => get().openDoc(emptyAutomaton(type), `${TYPE_LABEL[type]} ${++untitled}`, { fitNonce: 0 }),

  closeDoc: (id) =>
    set((s) => {
      const idx = s.docs.findIndex((d) => d.id === id);
      const docs = s.docs.filter((d) => d.id !== id);
      let activeId = s.activeId;
      if (activeId === id) activeId = docs[Math.min(idx, docs.length - 1)]?.id ?? null;
      return { docs, activeId };
    }),

  setActive: (id) => set({ activeId: id }),

  apply: (fn) =>
    set((s) =>
      updateActive(s, (d) => {
        const next = fn(d.automaton);
        if (next === d.automaton) return {};
        return {
          automaton: next,
          past: [...d.past.slice(-HISTORY), d.automaton],
          future: [],
          dirty: true,
          sim: null,
        };
      })
    ),

  snapshot: () =>
    set((s) => updateActive(s, (d) => ({ past: [...d.past.slice(-HISTORY), d.automaton], future: [] }))),

  mutate: (fn) => set((s) => updateActive(s, (d) => ({ automaton: fn(d.automaton), dirty: true }))),

  undo: () =>
    set((s) =>
      updateActive(s, (d) => {
        if (!d.past.length) return {};
        return {
          automaton: d.past[d.past.length - 1],
          past: d.past.slice(0, -1),
          future: [d.automaton, ...d.future],
          dirty: true,
          sim: null,
        };
      })
    ),

  redo: () =>
    set((s) =>
      updateActive(s, (d) => {
        if (!d.future.length) return {};
        return {
          automaton: d.future[0],
          past: [...d.past, d.automaton],
          future: d.future.slice(1),
          dirty: true,
          sim: null,
        };
      })
    ),

  patchDoc: (id, patch) => set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

  setSim: (sim) => set((s) => updateActive(s, () => ({ sim }))),

  requestFit: () => set((s) => updateActive(s, (d) => ({ fitNonce: d.fitNonce + 1 }))),

  setThemeMode: async (themeMode) => {
    try {
      localStorage.setItem(MODE_KEY, themeMode);
    } catch {}
    set({ themeMode });
    // In Electron the native theme decides what prefers-color-scheme reports, so set it first
    const nativeDark = await electronTheme(themeMode, get().accent);
    if (get().themeMode !== themeMode) return;
    const resolved: Resolved =
      themeMode === "system" ? ((nativeDark ?? systemPrefersDark()) ? "dark" : "light") : themeMode;
    setResolved(resolved, get().accent, themeMode);
    set({ resolvedTheme: resolved });
  },

  setAccent: (accent) => {
    if (!ACCENTS.some((a) => a.id === accent)) accent = DEFAULT_ACCENT;
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {}
    const { resolvedTheme, themeMode } = get();
    setResolved(resolvedTheme, accent, themeMode);
    set({ accent });
    electronTheme(themeMode, accent);
  },

  syncSystemTheme: () => {
    const { themeMode, accent, resolvedTheme } = get();
    if (themeMode !== "system") return;
    const resolved: Resolved = systemPrefersDark() ? "dark" : "light";
    if (resolved === resolvedTheme) return;
    setResolved(resolved, accent, themeMode);
    set({ resolvedTheme: resolved });
  },

  toggleTheme: () => get().setThemeMode(get().resolvedTheme === "dark" ? "light" : "dark"),

  showToast: (text, kind = "info") => {
    const id = Date.now();
    set({ toast: { id, text, kind } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3200);
  },
}));

function setResolved(resolved: Resolved, accent: string, mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  applyToDocument(resolved, accent, mode);
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove("theme-transition"), 320);
}
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

/** Tells Electron (if present) about the theme; resolves to whether the native theme is dark. */
async function electronTheme(mode: ThemeMode, accent: string): Promise<boolean | null> {
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  if (!api?.setTheme) return null;
  try {
    return await api.setTheme({ mode, accent, accents: ACCENTS.map(({ id, name }) => ({ id, name })) });
  } catch {
    return null;
  }
}

export function useActiveDoc(): Doc | null {
  return useStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null);
}
