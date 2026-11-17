import { Automaton, BLANK, MachineType, Move, State, Transition, uid } from "./types";

const FORMAT = "automata-studio";

export function toJson(a: Automaton): string {
  return JSON.stringify({ format: FORMAT, version: 1, automaton: a }, null, 2);
}

export function parseFile(content: string, name = ""): Automaton {
  const trimmed = content.trim();
  if (trimmed.startsWith("<") || name.toLowerCase().endsWith(".jff")) return fromJff(trimmed);
  const data = JSON.parse(trimmed);
  const a: Automaton = data.automaton ?? data;
  if (!a || !Array.isArray(a.states) || !Array.isArray(a.transitions) || !["fa", "pda", "tm"].includes(a.type))
    throw new Error("Arquivo não reconhecido.");
  return { ...a, notes: a.notes ?? [] };
}

// ── JFLAP .jff (XML) ──────────────────────────────────────────────

const JFF_TYPE: Record<MachineType, string> = { fa: "fa", pda: "pda", tm: "turing" };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tag(name: string, value: string | undefined) {
  return value ? `<${name}>${esc(value)}</${name}>` : `<${name}/>`;
}

export function toJff(a: Automaton): string {
  const idx = new Map(a.states.map((s, i) => [s.id, i]));
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?><!--Created with Automata Studio-->');
  lines.push("<structure>");
  lines.push(`\t<type>${JFF_TYPE[a.type]}</type>`);
  lines.push("\t<automaton>");
  for (const s of a.states) {
    lines.push(`\t\t<state id="${idx.get(s.id)}" name="${esc(s.name)}">`);
    lines.push(`\t\t\t<x>${s.x.toFixed(1)}</x>`);
    lines.push(`\t\t\t<y>${s.y.toFixed(1)}</y>`);
    if (s.label) lines.push(`\t\t\t<label>${esc(s.label)}</label>`);
    if (s.initial) lines.push("\t\t\t<initial/>");
    if (s.final) lines.push("\t\t\t<final/>");
    lines.push("\t\t</state>");
  }
  for (const t of a.transitions) {
    lines.push("\t\t<transition>");
    lines.push(`\t\t\t<from>${idx.get(t.from)}</from>`);
    lines.push(`\t\t\t<to>${idx.get(t.to)}</to>`);
    if (a.type === "tm") {
      lines.push(`\t\t\t${tag("read", t.read === BLANK ? "" : t.read)}`);
      lines.push(`\t\t\t${tag("write", t.write === BLANK ? "" : t.write)}`);
      lines.push(`\t\t\t<move>${t.move ?? "R"}</move>`);
    } else {
      lines.push(`\t\t\t${tag("read", t.read)}`);
      if (a.type === "pda") {
        lines.push(`\t\t\t${tag("pop", t.pop)}`);
        lines.push(`\t\t\t${tag("push", t.push)}`);
      }
    }
    lines.push("\t\t</transition>");
  }
  for (const n of a.notes) {
    lines.push(`\t\t<note><text>${esc(n.text)}</text><x>${n.x.toFixed(1)}</x><y>${n.y.toFixed(1)}</y></note>`);
  }
  lines.push("\t</automaton>");
  lines.push("</structure>");
  return lines.join("\n");
}

export function fromJff(xml: string): Automaton {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido.");
  const typeText = doc.querySelector("structure > type")?.textContent?.trim() ?? "fa";
  const type: MachineType = typeText === "pda" ? "pda" : typeText === "turing" ? "tm" : typeText === "fa" ? "fa" : "fa";
  if (!["fa", "pda", "turing"].includes(typeText))
    throw new Error(`Tipo JFLAP "${typeText}" não suportado (apenas fa, pda e turing).`);
  const tapes = Number(doc.querySelector("structure > tapes")?.textContent ?? "1");
  if (type === "tm" && tapes > 1) throw new Error("Máquinas de Turing com múltiplas fitas não são suportadas.");

  const root = doc.querySelector("structure > automaton") ?? doc.querySelector("structure");
  if (!root) throw new Error("Estrutura .jff inválida.");
  const text = (el: Element, name: string) => el.getElementsByTagName(name)[0]?.textContent ?? "";
  const has = (el: Element, name: string) => el.getElementsByTagName(name).length > 0;

  const idMap = new Map<string, string>();
  const states: State[] = [];
  for (const el of Array.from(root.children).filter((e) => e.tagName === "state" || e.tagName === "block")) {
    const id = uid("s");
    idMap.set(el.getAttribute("id") ?? "", id);
    states.push({
      id,
      name: el.getAttribute("name") ?? `q${states.length}`,
      x: Number(text(el, "x")) || 100 + states.length * 120,
      y: Number(text(el, "y")) || 200,
      initial: has(el, "initial"),
      final: has(el, "final"),
      label: text(el, "label") || undefined,
    });
  }
  // Only one initial state is allowed
  let seenInitial = false;
  for (const s of states) {
    if (s.initial && seenInitial) s.initial = false;
    if (s.initial) seenInitial = true;
  }

  const transitions: Transition[] = [];
  for (const el of Array.from(root.children).filter((e) => e.tagName === "transition")) {
    const from = idMap.get(text(el, "from").trim());
    const to = idMap.get(text(el, "to").trim());
    if (!from || !to) continue;
    const t: Transition = { id: uid("t"), from, to, read: text(el, "read") };
    if (type === "pda") {
      t.pop = text(el, "pop");
      t.push = text(el, "push");
    } else if (type === "tm") {
      t.read = t.read || BLANK;
      t.write = text(el, "write") || BLANK;
      const mv = text(el, "move").trim().toUpperCase();
      t.move = (mv === "L" || mv === "S" ? mv : "R") as Move;
    }
    transitions.push(t);
  }

  const notes = Array.from(root.children)
    .filter((e) => e.tagName === "note")
    .map((el) => ({ id: uid("n"), text: text(el, "text"), x: Number(text(el, "x")) || 0, y: Number(text(el, "y")) || 0 }));

  return { type, states, transitions, notes, acceptance: type === "pda" ? "final" : undefined };
}
