"use client";

import { useStore } from "./store";
import { parseFile, toJff, toJson } from "./fileio";

interface ElectronAPI {
  isElectron: true;
  platform: string;
  openFile: () => Promise<{ filePath: string; name: string; content: string } | null>;
  saveFile: (opts: {
    filePath?: string;
    defaultName?: string;
    content: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ filePath: string; name: string } | null>;
  onMenu: (cb: (channel: string) => void) => () => void;
  /** Sets the native theme source; resolves to whether the native theme is now dark */
  setTheme?: (opts: { mode: string; accent: string; accents: { id: string; name: string }[] }) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const electron = () => (typeof window !== "undefined" ? window.electronAPI : undefined);

function baseName(name: string) {
  return name.replace(/\.(automata|jff|json)$/i, "");
}

function browserDownload(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function browserPick(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".automata,.jff,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, content: await f.text() } : null);
    };
    input.click();
  });
}

export async function openFile() {
  const { openDoc, showToast } = useStore.getState();
  try {
    const api = electron();
    const res = api ? await api.openFile() : await browserPick();
    if (!res) return;
    const a = parseFile(res.content, res.name);
    const isJff = res.name.toLowerCase().endsWith(".jff");
    openDoc(a, baseName(res.name), {
      filePath: api && !isJff && "filePath" in res ? (res as { filePath: string }).filePath : undefined,
    });
    showToast(`Aberto: ${res.name}`, "ok");
  } catch (e) {
    showToast(`Erro ao abrir: ${(e as Error).message}`, "error");
  }
}

export async function saveFile(as = false) {
  const { docs, activeId, patchDoc, showToast } = useStore.getState();
  const doc = docs.find((d) => d.id === activeId);
  if (!doc) return;
  const content = toJson(doc.automaton);
  const api = electron();
  if (!api) {
    browserDownload(`${doc.title}.automata`, content, "application/json");
    patchDoc(doc.id, { dirty: false });
    return;
  }
  const res = await api.saveFile({
    filePath: as ? undefined : doc.filePath,
    defaultName: `${doc.title}.automata`,
    content,
    filters: [{ name: "Automata Studio", extensions: ["automata"] }],
  });
  if (res) {
    patchDoc(doc.id, { filePath: res.filePath, title: baseName(res.name), dirty: false });
    showToast("Salvo", "ok");
  }
}

export async function exportJff() {
  const { docs, activeId, showToast } = useStore.getState();
  const doc = docs.find((d) => d.id === activeId);
  if (!doc) return;
  const content = toJff(doc.automaton);
  const api = electron();
  if (!api) return browserDownload(`${doc.title}.jff`, content, "application/xml");
  const res = await api.saveFile({
    defaultName: `${doc.title}.jff`,
    content,
    filters: [{ name: "JFLAP", extensions: ["jff"] }],
  });
  if (res) showToast(`Exportado: ${res.name}`, "ok");
}

const SVG_VARS = [
  "--canvas",
  "--state-fill",
  "--state-stroke",
  "--edge",
  "--edge-label",
  "--accent",
  "--active-fill",
  "--ok",
  "--bad",
  "--warn",
  "--muted",
  "--text",
  "--font-mono",
  "--font-sans",
];

export async function exportSvg() {
  const { docs, activeId, showToast } = useStore.getState();
  const doc = docs.find((d) => d.id === activeId);
  const svg = document.querySelector<SVGSVGElement>("svg[data-canvas]");
  const world = svg?.querySelector<SVGGElement>("g[data-world]");
  if (!doc || !svg || !world) return;
  const bbox = world.getBBox();
  const pad = 30;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector("[data-grid]")?.remove();
  clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
  clone.querySelector("g[data-world]")?.setAttribute("transform", "");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
  clone.setAttribute("width", String(Math.ceil(bbox.width + pad * 2)));
  clone.setAttribute("height", String(Math.ceil(bbox.height + pad * 2)));
  clone.removeAttribute("class");
  const cs = getComputedStyle(document.documentElement);
  const vars = SVG_VARS.map((v) => `${v}:${cs.getPropertyValue(v)};`).join("");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `svg{${vars}background:var(--canvas)} .edge-label{fill:var(--edge-label);paint-order:stroke;stroke:var(--canvas);stroke-width:5px;stroke-linejoin:round;font-family:var(--font-mono);font-size:13px}`;
  clone.insertBefore(style, clone.firstChild);
  const content = new XMLSerializer().serializeToString(clone);
  const api = electron();
  if (!api) return browserDownload(`${doc.title}.svg`, content, "image/svg+xml");
  const res = await api.saveFile({
    defaultName: `${doc.title}.svg`,
    content,
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
  if (res) showToast(`Imagem exportada: ${res.name}`, "ok");
}
