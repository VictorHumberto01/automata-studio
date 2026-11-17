/**
 * Regular expressions: parser, printer with simplification, and the Glushkov
 * (position) construction, which yields an ε-free NFA.
 *
 * Syntax (JFLAP-compatible): union with `+` or `|`, implicit concatenation,
 * Kleene star `*`, optional `?`, parentheses, ε with `ε`, `λ` or `!`,
 * empty language with `∅`. Use `\` to escape a metacharacter.
 */
import { Automaton, State, Transition, uid } from "./types";
import { layeredLayout } from "./layout";

export type Re =
  | { k: "empty" }
  | { k: "eps" }
  | { k: "sym"; s: string }
  | { k: "union"; a: Re[] }
  | { k: "cat"; a: Re[] }
  | { k: "star"; r: Re };

export const EMPTY: Re = { k: "empty" };
export const EPS: Re = { k: "eps" };
export const sym = (s: string): Re => (s === "" ? EPS : s.length === 1 ? { k: "sym", s } : cat(...[...s].map(sym)));

export function nullable(r: Re): boolean {
  switch (r.k) {
    case "empty":
    case "sym":
      return false;
    case "eps":
    case "star":
      return true;
    case "union":
      return r.a.some(nullable);
    case "cat":
      return r.a.every(nullable);
  }
}

export function union(...rs: Re[]): Re {
  const items: Re[] = [];
  const keys = new Set<string>();
  for (const r of rs) {
    const parts = r.k === "union" ? r.a : [r];
    for (const p of parts) {
      if (p.k === "empty") continue;
      const key = print(p);
      if (keys.has(key)) continue;
      keys.add(key);
      items.push(p);
    }
  }
  // ε + r where r is nullable → r
  const hasNullable = items.some((p) => p.k !== "eps" && nullable(p));
  const filtered = hasNullable ? items.filter((p) => p.k !== "eps") : items;
  if (filtered.length === 0) return EMPTY;
  if (filtered.length === 1) return filtered[0];
  return { k: "union", a: filtered };
}

export function cat(...rs: Re[]): Re {
  const items: Re[] = [];
  for (const r of rs) {
    if (r.k === "empty") return EMPTY;
    if (r.k === "eps") continue;
    if (r.k === "cat") items.push(...r.a);
    else items.push(r);
  }
  // r* r* → r*
  const merged: Re[] = [];
  for (const it of items) {
    const prev = merged[merged.length - 1];
    if (prev && prev.k === "star" && it.k === "star" && print(prev) === print(it)) continue;
    merged.push(it);
  }
  if (merged.length === 0) return EPS;
  if (merged.length === 1) return merged[0];
  return { k: "cat", a: merged };
}

export function star(r: Re): Re {
  if (r.k === "empty" || r.k === "eps") return EPS;
  if (r.k === "star") return r;
  if (r.k === "union") {
    const inner = union(...r.a.filter((p) => p.k !== "eps").map((p) => (p.k === "star" ? p.r : p)));
    return inner.k === "empty" || inner.k === "eps" ? EPS : { k: "star", r: inner };
  }
  return { k: "star", r };
}

const PREC = { union: 0, cat: 1, star: 2, atom: 3 } as const;

export function print(r: Re, ctx = 0): string {
  switch (r.k) {
    case "empty":
      return "∅";
    case "eps":
      return "ε";
    case "sym":
      return /[+|*?()\\ελ!∅]/.test(r.s) ? `\\${r.s}` : r.s;
    case "union": {
      const s = r.a.map((p) => print(p, PREC.union)).join("+");
      return ctx > PREC.union ? `(${s})` : s;
    }
    case "cat": {
      const s = r.a.map((p) => print(p, PREC.cat + 1)).join("");
      return ctx > PREC.cat ? `(${s})` : s;
    }
    case "star":
      return `${print(r.r, PREC.atom)}*`;
  }
}

export class RegexError extends Error {
  constructor(
    message: string,
    public pos: number
  ) {
    super(message);
  }
}

export function parse(src: string): Re {
  const chars = [...src];
  let i = 0;
  const skip = () => {
    while (i < chars.length && /\s/.test(chars[i])) i++;
  };
  const peek = () => {
    skip();
    return chars[i];
  };

  function parseUnion(): Re {
    const parts = [parseCat()];
    while (peek() === "+" || peek() === "|") {
      i++;
      parts.push(parseCat());
    }
    return parts.length === 1 ? parts[0] : { k: "union", a: parts };
  }

  function parseCat(): Re {
    const parts: Re[] = [];
    for (;;) {
      const c = peek();
      if (c === undefined || c === ")" || c === "+" || c === "|") break;
      parts.push(parsePostfix());
    }
    if (parts.length === 0) return EPS;
    return parts.length === 1 ? parts[0] : { k: "cat", a: parts };
  }

  function parsePostfix(): Re {
    let r = parseAtom();
    for (;;) {
      const c = peek();
      if (c === "*") {
        i++;
        r = { k: "star", r };
      } else if (c === "?") {
        i++;
        r = { k: "union", a: [r, EPS] };
      } else break;
    }
    return r;
  }

  function parseAtom(): Re {
    const c = peek();
    if (c === "(") {
      i++;
      const r = parseUnion();
      if (peek() !== ")") throw new RegexError("Parêntese ')' esperado", i);
      i++;
      return r;
    }
    if (c === "*" || c === "?") throw new RegexError(`Operador '${c}' sem operando`, i);
    i++;
    if (c === "\\") {
      if (i >= chars.length) throw new RegexError("Escape incompleto", i);
      return { k: "sym", s: chars[i++] };
    }
    if (c === "ε" || c === "λ" || c === "!") return EPS;
    if (c === "∅") return EMPTY;
    return { k: "sym", s: c };
  }

  const r = parseUnion();
  if (i < chars.length) throw new RegexError(`Caractere inesperado '${chars[i]}'`, i);
  return r;
}

/** Glushkov construction: one state per symbol occurrence plus a start state, no ε-transitions. */
export function glushkov(r: Re): Automaton {
  const positions: string[] = [];
  const follow: Set<number>[] = [];

  interface Info {
    n: boolean;
    first: Set<number>;
    last: Set<number>;
  }

  function go(r: Re): Info {
    switch (r.k) {
      case "empty":
        return { n: false, first: new Set(), last: new Set() };
      case "eps":
        return { n: true, first: new Set(), last: new Set() };
      case "sym": {
        const p = positions.length;
        positions.push(r.s);
        follow.push(new Set());
        return { n: false, first: new Set([p]), last: new Set([p]) };
      }
      case "union": {
        const infos = r.a.map(go);
        return {
          n: infos.some((x) => x.n),
          first: new Set(infos.flatMap((x) => [...x.first])),
          last: new Set(infos.flatMap((x) => [...x.last])),
        };
      }
      case "cat": {
        let acc = go(r.a[0]);
        for (let k = 1; k < r.a.length; k++) {
          const y = go(r.a[k]);
          for (const l of acc.last) for (const f of y.first) follow[l].add(f);
          acc = {
            n: acc.n && y.n,
            first: acc.n ? new Set([...acc.first, ...y.first]) : acc.first,
            last: y.n ? new Set([...y.last, ...acc.last]) : y.last,
          };
        }
        return acc;
      }
      case "star": {
        const x = go(r.r);
        for (const l of x.last) for (const f of x.first) follow[l].add(f);
        return { n: true, first: x.first, last: x.last };
      }
    }
  }

  const info = go(r);
  const states: State[] = [];
  const startId = uid("s");
  states.push({ id: startId, name: "q0", x: 0, y: 0, initial: true, final: info.n });
  const ids = positions.map((_, p) => {
    const id = uid("s");
    states.push({ id, name: `q${p + 1}`, x: 0, y: 0, initial: false, final: info.last.has(p) });
    return id;
  });
  const transitions: Transition[] = [];
  for (const f of info.first) transitions.push({ id: uid("t"), from: startId, to: ids[f], read: positions[f] });
  follow.forEach((set, p) => {
    for (const q of set) transitions.push({ id: uid("t"), from: ids[p], to: ids[q], read: positions[q] });
  });
  const a: Automaton = { type: "fa", states, transitions, notes: [] };
  return layeredLayout(a);
}
