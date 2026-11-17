import { Automaton, State, Transition, transitionLabel } from "./types";

export const R = 24;
export const LINE_H = 17;

export interface Pt {
  x: number;
  y: number;
}

export interface LabelPos extends Pt {
  anchor: "start" | "middle" | "end";
}

export interface EdgeGeom {
  key: string;
  from: string;
  to: string;
  transitions: Transition[];
  path: string;
  labels: LabelPos[];
}

const unit = (dx: number, dy: number): Pt => {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

const CHAR_W = 7.9;

/**
 * Places a vertical stack of labels next to `apex`, pushed along `out` far enough
 * that the label block's bounding box clears the edge line.
 */
function placeLabels(apex: Pt, out: Pt, texts: string[]): LabelPos[] {
  const w = Math.max(...texts.map((t) => [...t].length)) * CHAR_W;
  const h = texts.length * LINE_H;
  const dist = (w / 2) * Math.abs(out.x) + (h / 2) * Math.abs(out.y) + 5;
  const cx = apex.x + out.x * dist;
  const cy = apex.y + out.y * dist;
  return texts.map((_, i) => ({ x: cx, y: cy - h / 2 + LINE_H / 2 + i * LINE_H, anchor: "middle" as const }));
}

export function computeEdges(a: Automaton): EdgeGeom[] {
  const byId = new Map<string, State>(a.states.map((s) => [s.id, s]));
  const groups = new Map<string, Transition[]>();
  for (const t of a.transitions) {
    const k = `${t.from}->${t.to}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const label = (t: Transition) => transitionLabel(t, a.type);
  const out: EdgeGeom[] = [];
  for (const [key, ts] of groups) {
    const s1 = byId.get(ts[0].from);
    const s2 = byId.get(ts[0].to);
    if (!s1 || !s2) continue;
    if (s1.id === s2.id) {
      const c = s1;
      const a1 = (-115 * Math.PI) / 180;
      const a2 = (-65 * Math.PI) / 180;
      const ps = { x: c.x + R * Math.cos(a1), y: c.y + R * Math.sin(a1) };
      const pe = { x: c.x + R * Math.cos(a2), y: c.y + R * Math.sin(a2) };
      const top = c.y - R - 52;
      const path = `M ${ps.x} ${ps.y} C ${c.x - 36} ${top}, ${c.x + 36} ${top}, ${pe.x} ${pe.y}`;
      const apexY = 0.125 * ps.y + 0.75 * top + 0.125 * pe.y;
      out.push({ key, from: s1.id, to: s2.id, transitions: ts, path, labels: placeLabels({ x: c.x, y: apexY }, { x: 0, y: -1 }, ts.map(label).reverse()).reverse() });
      continue;
    }
    const hasReverse = groups.has(`${s2.id}->${s1.id}`);
    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;
    const n = unit(-dy, dx);
    const curv = hasReverse ? 26 : 0;
    const mid = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
    const ctrl = { x: mid.x + n.x * curv * 2, y: mid.y + n.y * curv * 2 };
    const u1 = unit(ctrl.x - s1.x, ctrl.y - s1.y);
    const u2 = unit(ctrl.x - s2.x, ctrl.y - s2.y);
    const p1 = { x: s1.x + u1.x * R, y: s1.y + u1.y * R };
    const p2 = { x: s2.x + u2.x * (R + 1), y: s2.y + u2.y * (R + 1) };
    const path = curv
      ? `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`
      : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    const apex = { x: mid.x + n.x * curv, y: mid.y + n.y * curv };
    // Labels go on the outer side of a curve, or above a straight edge
    let outward = n;
    if (!curv && (n.y > 0 || (n.y === 0 && n.x < 0))) outward = { x: -n.x, y: -n.y };
    out.push({ key, from: s1.id, to: s2.id, transitions: ts, path, labels: placeLabels(apex, outward, ts.map(label)) });
  }
  return out;
}

/** World-space position of the label for a given transition. */
export function labelOf(edges: EdgeGeom[], tid: string): LabelPos | null {
  for (const e of edges) {
    const i = e.transitions.findIndex((t) => t.id === tid);
    if (i >= 0) return e.labels[i];
  }
  return null;
}

export function stateAt(a: Automaton, p: Pt): State | undefined {
  for (let i = a.states.length - 1; i >= 0; i--) {
    const s = a.states[i];
    if (Math.hypot(s.x - p.x, s.y - p.y) <= R + 2) return s;
  }
}
