import { Automaton, State, Transition, nextStateName, uid } from "./types";
import { analyze } from "./analyze";
import { layeredLayout } from "./layout";
import { EMPTY, EPS, Re, cat, print, star, sym, union } from "./regex";

export class ConvertError extends Error {}

function requireInitial(a: Automaton): State {
  const init = a.states.find((s) => s.initial);
  if (!init) throw new ConvertError("O autômato precisa de um estado inicial.");
  return init;
}

/** Replaces transitions reading multi-character strings with chains of single-symbol transitions. */
export function splitMultiChar(a: Automaton): Automaton {
  const states = [...a.states];
  const transitions: Transition[] = [];
  for (const t of a.transitions) {
    if (t.read.length <= 1) {
      transitions.push(t);
      continue;
    }
    const chars = [...t.read];
    let from = t.from;
    chars.forEach((ch, i) => {
      const last = i === chars.length - 1;
      let to = t.to;
      if (!last) {
        const id = uid("s");
        const src = a.states.find((s) => s.id === t.from)!;
        const dst = a.states.find((s) => s.id === t.to)!;
        const f = (i + 1) / chars.length;
        states.push({
          id,
          name: nextStateName(states),
          x: src.x + (dst.x - src.x) * f,
          y: src.y + (dst.y - src.y) * f + 40,
          initial: false,
          final: false,
        });
        to = id;
      }
      transitions.push({ id: uid("t"), from, to, read: ch });
      from = to;
    });
  }
  return { ...a, states, transitions };
}

function closure(ids: Iterable<string>, trans: Transition[]): Set<string> {
  const out = new Set(ids);
  const stack = [...out];
  while (stack.length) {
    const id = stack.pop()!;
    for (const t of trans)
      if (t.from === id && t.read === "" && !out.has(t.to)) {
        out.add(t.to);
        stack.push(t.to);
      }
  }
  return out;
}

/** Subset construction (AFN → AFD). The empty subset is omitted (no trap state). */
export function nfaToDfa(src: Automaton): Automaton {
  const a = splitMultiChar(src);
  const init = requireInitial(a);
  const alphabet = analyze(a).alphabet;
  const names = new Map(a.states.map((s) => [s.id, s.name]));
  const order = new Map(a.states.map((s, i) => [s.id, i]));
  const finals = new Set(a.states.filter((s) => s.final).map((s) => s.id));
  const keyOf = (set: Set<string>) => [...set].sort((x, y) => order.get(x)! - order.get(y)!).join(",");

  const states: State[] = [];
  const transitions: Transition[] = [];
  const idByKey = new Map<string, string>();
  const queue: Set<string>[] = [];

  const add = (set: Set<string>) => {
    const key = keyOf(set);
    if (idByKey.has(key)) return idByKey.get(key)!;
    const id = uid("s");
    idByKey.set(key, id);
    const members = key.split(",").filter(Boolean);
    states.push({
      id,
      name: `q${states.length}`,
      label: `{${members.map((m) => names.get(m)).join(",")}}`,
      x: 0,
      y: 0,
      initial: states.length === 0,
      final: members.some((m) => finals.has(m)),
    });
    queue.push(set);
    return id;
  };

  add(closure([init.id], a.transitions));
  while (queue.length) {
    const set = queue.shift()!;
    const fromId = idByKey.get(keyOf(set))!;
    for (const c of alphabet) {
      const moved = new Set<string>();
      for (const t of a.transitions) if (set.has(t.from) && t.read === c) moved.add(t.to);
      if (!moved.size) continue;
      const toId = add(closure(moved, a.transitions));
      transitions.push({ id: uid("t"), from: fromId, to: toId, read: c });
    }
  }
  return layeredLayout({ type: "fa", states, transitions, notes: [] });
}

function requireDfa(a: Automaton) {
  requireInitial(a);
  if (!analyze(a).deterministic)
    throw new ConvertError("Esta operação exige um AFD. Converta o AFN para AFD primeiro.");
}

/** Adds a trap state so every state has a transition on every alphabet symbol. */
export function completeDfa(a: Automaton, extraAlphabet: string[] = []): Automaton {
  requireDfa(a);
  const alphabet = [...new Set([...analyze(a).alphabet, ...extraAlphabet])];
  const missing: { from: string; c: string }[] = [];
  for (const s of a.states) {
    const have = new Set(a.transitions.filter((t) => t.from === s.id).map((t) => t.read));
    for (const c of alphabet) if (!have.has(c)) missing.push({ from: s.id, c });
  }
  if (!missing.length) return a;
  const maxX = Math.max(...a.states.map((s) => s.x));
  const avgY = a.states.reduce((sum, s) => sum + s.y, 0) / a.states.length;
  const trap: State = {
    id: uid("s"),
    name: nextStateName(a.states),
    label: "armadilha",
    x: maxX + 170,
    y: avgY,
    initial: false,
    final: false,
  };
  return {
    ...a,
    states: [...a.states, trap],
    transitions: [
      ...a.transitions,
      ...missing.map((m) => ({ id: uid("t"), from: m.from, to: trap.id, read: m.c })),
      ...alphabet.map((c) => ({ id: uid("t"), from: trap.id, to: trap.id, read: c })),
    ],
  };
}

/** Complement of a DFA's language (over its own alphabet). */
export function complementDfa(a: Automaton): Automaton {
  const c = completeDfa(a);
  return { ...c, states: c.states.map((s) => ({ ...s, final: !s.final })) };
}

/** DFA minimisation by partition refinement (Moore). Unreachable and dead states are removed. */
export function minimizeDfa(src: Automaton): Automaton {
  requireDfa(src);
  const init = requireInitial(src);
  const reach = analyze(src).unreachable;
  const a: Automaton = {
    ...src,
    states: src.states.filter((s) => !reach.has(s.id)),
    transitions: src.transitions.filter((t) => !reach.has(t.from) && !reach.has(t.to)),
  };
  const alphabet = analyze(a).alphabet;
  const TRAP = "__trap__";
  const ids = [...a.states.map((s) => s.id), TRAP];
  const delta = new Map<string, string>();
  for (const t of a.transitions) delta.set(`${t.from}|${t.read}`, t.to);
  const go = (id: string, c: string) => (id === TRAP ? TRAP : (delta.get(`${id}|${c}`) ?? TRAP));
  const finals = new Set(a.states.filter((s) => s.final).map((s) => s.id));

  let cls = new Map(ids.map((id) => [id, finals.has(id) ? 1 : 0]));
  for (;;) {
    const sigs = new Map<string, number>();
    const next = new Map<string, number>();
    for (const id of ids) {
      const sig = `${cls.get(id)}|${alphabet.map((c) => cls.get(go(id, c))).join(",")}`;
      if (!sigs.has(sig)) sigs.set(sig, sigs.size);
      next.set(id, sigs.get(sig)!);
    }
    const stable = new Set(next.values()).size === new Set(cls.values()).size;
    cls = next;
    if (stable) break;
  }

  const trapClass = cls.get(TRAP)!;
  const groups = new Map<number, State[]>();
  for (const s of a.states) {
    const k = cls.get(s.id)!;
    if (k === trapClass) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  const newId = new Map<number, string>();
  const states: State[] = [];
  let n = 0;
  // Initial state's group first so it becomes q0
  const sortedGroups = [...groups.entries()].sort(
    ([, x], [, y]) => Number(y.some((s) => s.id === init.id)) - Number(x.some((s) => s.id === init.id))
  );
  for (const [k, members] of sortedGroups) {
    const id = uid("s");
    newId.set(k, id);
    states.push({
      id,
      name: `q${n++}`,
      label: members.length > 1 || members[0].label ? `{${members.map((m) => m.name).join(",")}}` : undefined,
      x: Math.round(members.reduce((s, m) => s + m.x, 0) / members.length),
      y: Math.round(members.reduce((s, m) => s + m.y, 0) / members.length),
      initial: members.some((m) => m.initial),
      final: members.some((m) => m.final),
    });
  }
  if (!states.length) {
    // Empty language: single non-final initial state
    return { type: "fa", states: [{ ...init, final: false }], transitions: [], notes: [] };
  }
  const transitions: Transition[] = [];
  for (const [k, members] of groups) {
    const rep = members[0].id;
    for (const c of alphabet) {
      const target = cls.get(go(rep, c))!;
      if (target === trapClass) continue;
      transitions.push({ id: uid("t"), from: newId.get(k)!, to: newId.get(target)!, read: c });
    }
  }
  const out: Automaton = { type: "fa", states, transitions, notes: [] };
  // Overlapping merged states → re-layout
  const overlaps = states.some((s, i) => states.some((o, j) => i < j && Math.hypot(s.x - o.x, s.y - o.y) < 60));
  return overlaps ? layeredLayout(out) : out;
}

/** AF → ER by state elimination on a generalised NFA. */
export function faToRegex(a: Automaton): string {
  const init = requireInitial(a);
  const S = "__S__";
  const F = "__F__";
  const R = new Map<string, Map<string, Re>>();
  const get = (i: string, j: string) => R.get(i)?.get(j) ?? EMPTY;
  const set = (i: string, j: string, r: Re) => {
    if (!R.has(i)) R.set(i, new Map());
    if (r.k === "empty") R.get(i)!.delete(j);
    else R.get(i)!.set(j, r);
  };
  set(S, init.id, EPS);
  for (const s of a.states) if (s.final) set(s.id, F, union(get(s.id, F), EPS));
  for (const t of a.transitions) set(t.from, t.to, union(get(t.from, t.to), sym(t.read)));

  const remaining = new Set(a.states.map((s) => s.id));
  while (remaining.size) {
    // Pick the state with the fewest in×out paths
    let best = "";
    let bestScore = Infinity;
    for (const k of remaining) {
      let ins = 0;
      for (const [i, row] of R) if (i !== k && row.has(k)) ins++;
      const outs = [...(R.get(k)?.keys() ?? [])].filter((j) => j !== k).length;
      if (ins * outs < bestScore) {
        bestScore = ins * outs;
        best = k;
      }
    }
    const k = best;
    remaining.delete(k);
    const loop = star(get(k, k));
    const sources = [...R.keys()].filter((i) => i !== k && R.get(i)!.has(k));
    const targets = [...(R.get(k)?.keys() ?? [])].filter((j) => j !== k);
    for (const i of sources)
      for (const j of targets) set(i, j, union(get(i, j), cat(get(i, k), loop, get(k, j))));
    for (const i of sources) R.get(i)!.delete(k);
    R.delete(k);
  }
  return print(get(S, F));
}
