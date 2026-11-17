export type MachineType = "fa" | "pda" | "tm";

export interface State {
  id: string;
  name: string;
  x: number;
  y: number;
  initial: boolean;
  final: boolean;
  /** Optional label shown under the state (e.g. the subset a DFA state stands for) */
  label?: string;
}

export type Move = "L" | "R" | "S";

export interface Transition {
  id: string;
  from: string;
  to: string;
  /** Symbol read from input (FA/PDA) or tape (TM). "" = ε (FA/PDA). For TM, BLANK is used for blank. */
  read: string;
  /** PDA: symbol popped ("" = ε) */
  pop?: string;
  /** PDA: string pushed, leftmost char ends up on top ("" = ε) */
  push?: string;
  /** TM: symbol written */
  write?: string;
  /** TM: head move */
  move?: Move;
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
}

export type PdaAcceptance = "final" | "empty";

export interface Automaton {
  type: MachineType;
  states: State[];
  transitions: Transition[];
  notes: Note[];
  /** PDA only */
  acceptance?: PdaAcceptance;
}

export const EPSILON = "ε";
export const BLANK = "□";
export const STACK_START = "Z";

export const TYPE_LABEL: Record<MachineType, string> = {
  fa: "Autômato Finito",
  pda: "Autômato de Pilha",
  tm: "Máquina de Turing",
};

export const TYPE_SHORT: Record<MachineType, string> = {
  fa: "AF",
  pda: "AP",
  tm: "MT",
};

export function emptyAutomaton(type: MachineType): Automaton {
  return { type, states: [], transitions: [], notes: [], acceptance: type === "pda" ? "final" : undefined };
}

let counter = 0;
export function uid(prefix = "id"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Display a symbol, rendering empty strings as ε (or □ for TM blanks). */
export function showSym(s: string | undefined, blank = false): string {
  if (s === undefined || s === "") return blank ? BLANK : EPSILON;
  return s;
}

export function transitionLabel(t: Transition, type: MachineType): string {
  if (type === "fa") return showSym(t.read);
  if (type === "pda") return `${showSym(t.read)}, ${showSym(t.pop)} → ${showSym(t.push)}`;
  return `${showSym(t.read, true)} → ${showSym(t.write, true)}, ${t.move ?? "R"}`;
}

/** Normalise user-typed symbols: "", "e", "ε", "λ", "lambda", "eps" → "" */
export function normEps(s: string): string {
  const t = s.trim();
  if (t === "" || t === "ε" || t === "λ" || t === "eps" || t === "lambda") return "";
  return t;
}

/** Normalise TM tape symbols: "", "_", "□", "B", "☐" → BLANK */
export function normBlank(s: string): string {
  const t = s.trim();
  if (t === "" || t === "_" || t === "□" || t === "☐" || t === "B") return BLANK;
  return t;
}

export function nextStateName(states: State[]): string {
  const used = new Set(states.map((s) => s.name));
  let i = 0;
  while (used.has(`q${i}`)) i++;
  return `q${i}`;
}
