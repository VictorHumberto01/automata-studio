import { Automaton } from "./types";

const GAP_X = 170;
const GAP_Y = 120;

/** Places states in columns by BFS distance from the initial state. */
export function layeredLayout(a: Automaton, originX = 120, originY = 140): Automaton {
  const init = a.states.find((s) => s.initial) ?? a.states[0];
  if (!init) return a;
  const layer = new Map<string, number>([[init.id, 0]]);
  const queue = [init.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const t of a.transitions)
      if (t.from === id && !layer.has(t.to)) {
        layer.set(t.to, layer.get(id)! + 1);
        queue.push(t.to);
      }
  }
  let maxLayer = Math.max(0, ...layer.values());
  for (const s of a.states) if (!layer.has(s.id)) layer.set(s.id, ++maxLayer);

  const columns = new Map<number, string[]>();
  for (const s of a.states) {
    const l = layer.get(s.id)!;
    if (!columns.has(l)) columns.set(l, []);
    columns.get(l)!.push(s.id);
  }
  const tallest = Math.max(...[...columns.values()].map((c) => c.length));
  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, ids] of columns) {
    const offset = ((tallest - ids.length) * GAP_Y) / 2;
    ids.forEach((id, i) => pos.set(id, { x: originX + l * GAP_X, y: originY + offset + i * GAP_Y }));
  }
  return { ...a, states: a.states.map((s) => ({ ...s, ...pos.get(s.id)! })) };
}

export function circleLayout(a: Automaton, cx = 420, cy = 320): Automaton {
  const n = a.states.length;
  if (n === 0) return a;
  const r = Math.max(120, (n * 90) / (2 * Math.PI));
  const initIdx = Math.max(
    0,
    a.states.findIndex((s) => s.initial)
  );
  return {
    ...a,
    states: a.states.map((s, i) => {
      const k = (i - initIdx + n) % n;
      const ang = Math.PI + (2 * Math.PI * k) / n;
      return { ...s, x: Math.round(cx + r * Math.cos(ang)), y: Math.round(cy + r * Math.sin(ang)) };
    }),
  };
}
