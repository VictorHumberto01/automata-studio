import { Automaton, BLANK, showSym } from "./types";

export interface Analysis {
  alphabet: string[];
  stackAlphabet: string[];
  tapeAlphabet: string[];
  hasInitial: boolean;
  /** FA is deterministic (DFA) */
  deterministic: boolean;
  /** FA is a complete DFA */
  complete: boolean;
  /** States that cause nondeterminism */
  nondetStates: Set<string>;
  /** States not reachable from the initial state */
  unreachable: Set<string>;
  warnings: string[];
}

export function analyze(a: Automaton): Analysis {
  const alphabet = new Set<string>();
  const stack = new Set<string>();
  const tape = new Set<string>();
  const warnings: string[] = [];
  const nondet = new Set<string>();

  for (const t of a.transitions) {
    if (a.type === "tm") {
      tape.add(t.read || BLANK);
      tape.add(t.write || BLANK);
      if (t.read && t.read !== BLANK) alphabet.add(t.read);
    } else {
      for (const ch of t.read) alphabet.add(ch);
      if (a.type === "pda") {
        for (const ch of t.pop ?? "") stack.add(ch);
        for (const ch of t.push ?? "") stack.add(ch);
      }
    }
  }

  const initials = a.states.filter((s) => s.initial);
  const hasInitial = initials.length > 0;
  if (!a.states.length) warnings.push("Nenhum estado criado.");
  else if (!hasInitial) warnings.push("Defina um estado inicial (clique direito → Inicial).");
  if (a.states.length && !a.states.some((s) => s.final) && !(a.type === "pda" && a.acceptance === "empty"))
    warnings.push("Nenhum estado final definido.");

  // Nondeterminism
  for (const s of a.states) {
    const out = a.transitions.filter((t) => t.from === s.id);
    if (a.type === "fa") {
      const seen = new Set<string>();
      for (const t of out) {
        if (t.read.length !== 1 || seen.has(t.read)) nondet.add(s.id);
        seen.add(t.read);
      }
    } else if (a.type === "pda") {
      for (let i = 0; i < out.length; i++)
        for (let j = i + 1; j < out.length; j++) {
          const x = out[i];
          const y = out[j];
          const readClash = x.read === "" || y.read === "" || x.read === y.read;
          const px = x.pop ?? "";
          const py = y.pop ?? "";
          const popClash = px.startsWith(py) || py.startsWith(px);
          if (readClash && popClash) nondet.add(s.id);
        }
    } else {
      const seen = new Set<string>();
      for (const t of out) {
        const r = t.read || BLANK;
        if (seen.has(r)) nondet.add(s.id);
        seen.add(r);
      }
    }
  }

  const deterministic = a.type === "fa" ? nondet.size === 0 && initials.length <= 1 : nondet.size === 0;
  let complete = false;
  if (a.type === "fa" && deterministic && a.states.length) {
    complete = a.states.every((s) => {
      const syms = new Set(a.transitions.filter((t) => t.from === s.id).map((t) => t.read));
      return [...alphabet].every((c) => syms.has(c));
    });
  }

  // Reachability
  const unreachable = new Set(a.states.map((s) => s.id));
  if (initials[0]) {
    const stackIds = [initials[0].id];
    unreachable.delete(initials[0].id);
    while (stackIds.length) {
      const id = stackIds.pop()!;
      for (const t of a.transitions)
        if (t.from === id && unreachable.has(t.to)) {
          unreachable.delete(t.to);
          stackIds.push(t.to);
        }
    }
  } else unreachable.clear();
  if (unreachable.size)
    warnings.push(
      `Estados inalcançáveis: ${a.states
        .filter((s) => unreachable.has(s.id))
        .map((s) => s.name)
        .join(", ")}`
    );

  return {
    alphabet: [...alphabet].sort(),
    stackAlphabet: [...stack].sort(),
    tapeAlphabet: [...tape].sort().map((s) => showSym(s, true)),
    hasInitial,
    deterministic,
    complete,
    nondetStates: nondet,
    unreachable,
    warnings,
  };
}
