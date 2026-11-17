import { Automaton, BLANK, STACK_START, State, Transition } from "./types";

export interface Config {
  key: string;
  state: string;
  /** FA/PDA: input position */
  pos: number;
  /** PDA: stack, index 0 is top */
  stack: string;
  /** TM: tape cells (missing = blank) */
  tape: Record<number, string>;
  head: number;
  parent: Config | null;
  via: Transition | null;
  depth: number;
}

export type RunStatus = "running" | "accepted" | "rejected" | "limit";

export interface SimState {
  input: string;
  active: Config[];
  accepted: Config[];
  /** Configurations that died on the last step (no applicable transition) */
  dead: Config[];
  visited: Set<string>;
  status: RunStatus;
  steps: number;
}

export const MAX_ACTIVE = 5000;
export const MAX_STEPS = 20000;

function tapeKey(tape: Record<number, string>): string {
  const keys = Object.keys(tape)
    .map(Number)
    .sort((a, b) => a - b);
  return keys.map((k) => `${k}:${tape[k]}`).join(",");
}

function makeKey(a: Automaton, c: Pick<Config, "state" | "pos" | "stack" | "tape" | "head">): string {
  if (a.type === "fa") return `${c.state}|${c.pos}`;
  if (a.type === "pda") return `${c.state}|${c.pos}|${c.stack}`;
  return `${c.state}|${c.head}|${tapeKey(c.tape)}`;
}

export function initialState(a: Automaton): State | undefined {
  return a.states.find((s) => s.initial);
}

export function startSim(a: Automaton, input: string): SimState {
  const init = initialState(a);
  const sim: SimState = {
    input,
    active: [],
    accepted: [],
    dead: [],
    visited: new Set(),
    status: "running",
    steps: 0,
  };
  if (!init) {
    sim.status = "rejected";
    return sim;
  }
  const tape: Record<number, string> = {};
  if (a.type === "tm") [...input].forEach((ch, i) => ch !== BLANK && (tape[i] = ch));
  const base = {
    state: init.id,
    pos: 0,
    stack: a.type === "pda" ? STACK_START : "",
    tape,
    head: 0,
  };
  const c: Config = { ...base, key: makeKey(a, base), parent: null, via: null, depth: 0 };
  sim.visited.add(c.key);
  sim.active = [c];
  checkAccept(a, sim);
  return sim;
}

export function isAccepting(a: Automaton, c: Config, input: string, finals: Set<string>): boolean {
  if (a.type === "tm") return finals.has(c.state);
  if (c.pos !== input.length) return false;
  if (a.type === "pda" && a.acceptance === "empty") return c.stack.length === 0;
  return finals.has(c.state);
}

function checkAccept(a: Automaton, sim: SimState) {
  const finals = new Set(a.states.filter((s) => s.final).map((s) => s.id));
  const acc = sim.active.filter((c) => isAccepting(a, c, sim.input, finals));
  if (acc.length) {
    sim.accepted = acc;
    sim.status = "accepted";
  } else if (sim.active.length === 0) {
    sim.status = "rejected";
  }
}

/** All configurations reachable from c in exactly one transition. */
export function successors(a: Automaton, c: Config, input: string, byFrom: Map<string, Transition[]>): Config[] {
  const out: Config[] = [];
  const ts = byFrom.get(c.state) ?? [];
  for (const t of ts) {
    let next: Omit<Config, "key" | "parent" | "via" | "depth"> | null = null;
    if (a.type === "fa") {
      if (input.startsWith(t.read, c.pos)) next = { ...c, state: t.to, pos: c.pos + t.read.length };
    } else if (a.type === "pda") {
      const pop = t.pop ?? "";
      const push = t.push ?? "";
      if (input.startsWith(t.read, c.pos) && c.stack.startsWith(pop)) {
        next = { ...c, state: t.to, pos: c.pos + t.read.length, stack: push + c.stack.slice(pop.length) };
      }
    } else {
      const cur = c.tape[c.head] ?? BLANK;
      if ((t.read || BLANK) === cur) {
        const tape = { ...c.tape };
        const w = t.write || BLANK;
        if (w === BLANK) delete tape[c.head];
        else tape[c.head] = w;
        const head = c.head + (t.move === "L" ? -1 : t.move === "S" ? 0 : 1);
        next = { ...c, state: t.to, tape, head };
      }
    }
    if (next) {
      out.push({ ...next, key: makeKey(a, next), parent: c, via: t, depth: c.depth + 1 });
    }
  }
  return out;
}

export function groupByFrom(a: Automaton): Map<string, Transition[]> {
  const m = new Map<string, Transition[]>();
  for (const t of a.transitions) {
    if (!m.has(t.from)) m.set(t.from, []);
    m.get(t.from)!.push(t);
  }
  return m;
}

/** Advance every active configuration by one transition. Returns a new SimState. */
export function stepSim(a: Automaton, prev: SimState): SimState {
  if (prev.status !== "running") return prev;
  const byFrom = groupByFrom(a);
  const visited = new Set(prev.visited);
  const next: Config[] = [];
  const dead: Config[] = [];
  for (const c of prev.active) {
    const succ = successors(a, c, prev.input, byFrom);
    let alive = false;
    for (const s of succ) {
      if (visited.has(s.key)) continue;
      visited.add(s.key);
      next.push(s);
      alive = true;
    }
    if (!alive) dead.push(c);
  }
  const sim: SimState = {
    ...prev,
    active: next.slice(0, MAX_ACTIVE),
    dead,
    visited,
    steps: prev.steps + 1,
  };
  checkAccept(a, sim);
  if (sim.status === "running" && (next.length > MAX_ACTIVE || sim.steps >= MAX_STEPS)) sim.status = "limit";
  return sim;
}

export interface RunResult {
  status: Exclude<RunStatus, "running">;
  steps: number;
  path: Config[];
  /** TM: final tape contents */
  output?: string;
}

export function runToEnd(a: Automaton, input: string, maxSteps = MAX_STEPS): RunResult {
  let sim = startSim(a, input);
  while (sim.status === "running" && sim.steps < maxSteps) sim = stepSim(a, sim);
  const status = sim.status === "running" ? "limit" : sim.status;
  const last = sim.accepted[0] ?? null;
  const res: RunResult = { status, steps: sim.steps, path: last ? tracePath(last) : [] };
  if (a.type === "tm" && last) res.output = tapeString(last.tape).text;
  return res;
}

export function tracePath(c: Config): Config[] {
  const out: Config[] = [];
  let cur: Config | null = c;
  while (cur) {
    out.unshift(cur);
    cur = cur.parent;
  }
  return out;
}

/** Non-blank region of a tape as string, plus the index offset of its first cell. */
export function tapeString(tape: Record<number, string>): { text: string; start: number } {
  const keys = Object.keys(tape).map(Number);
  if (!keys.length) return { text: "", start: 0 };
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  let s = "";
  for (let i = min; i <= max; i++) s += tape[i] ?? BLANK;
  return { text: s, start: min };
}

export function stateName(a: Automaton, id: string): string {
  return a.states.find((s) => s.id === id)?.name ?? "?";
}
