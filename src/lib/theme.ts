/** Appearance: light/dark mode (optionally following the OS) and accent colour themes. */

export type ThemeMode = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

export interface Accent {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** Text colour on top of the accent */
  fgLight?: string;
  fgDark?: string;
}

export const ACCENTS: Accent[] = [
  { id: "violet", name: "Violeta", light: "#5b4cf0", dark: "#8b7dff" },
  { id: "ocean", name: "Oceano", light: "#2563eb", dark: "#60a5fa" },
  { id: "teal", name: "Ciano", light: "#0e7490", dark: "#22d3ee" },
  { id: "forest", name: "Floresta", light: "#0f8a5f", dark: "#34d399" },
  { id: "amber", name: "Âmbar", light: "#b45309", dark: "#fbbf24" },
  { id: "rose", name: "Rosa", light: "#db2777", dark: "#f472b6" },
  { id: "graphite", name: "Grafite", light: "#27272a", dark: "#e4e4e7" },
];

export const DEFAULT_ACCENT = "violet";
export const MODE_KEY = "themeMode";
export const ACCENT_KEY = "accent";

export const BG: Record<Resolved, string> = { light: "#f6f6f8", dark: "#0a0b0f" };

/** CSS rules for every accent, in both modes. Rendered once in <head>. */
export function accentCss(): string {
  return ACCENTS.map(
    (a) =>
      `:root[data-accent="${a.id}"]{--accent:${a.light};--accent-fg:${a.fgLight ?? "#ffffff"}}` +
      `:root.dark[data-accent="${a.id}"]{--accent:${a.dark};--accent-fg:${a.fgDark ?? "#0b0a12"}}`
  ).join("\n");
}

/** Runs before first paint so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{
var m=localStorage.getItem("${MODE_KEY}");
if(!m){var legacy=localStorage.getItem("theme");m=legacy==="light"||legacy==="dark"?legacy:"system";}
var a=localStorage.getItem("${ACCENT_KEY}")||"${DEFAULT_ACCENT}";
var dark=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
d.classList.toggle("dark",dark);d.dataset.accent=a;d.dataset.mode=m;
}catch(e){d.classList.add("dark");d.dataset.accent="${DEFAULT_ACCENT}";}})()`;

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyToDocument(resolved: Resolved, accent: string, mode: ThemeMode) {
  const d = document.documentElement;
  d.classList.toggle("dark", resolved === "dark");
  d.dataset.accent = accent;
  d.dataset.mode = mode;
}
