"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Automaton, Transition, nextStateName, transitionLabel, uid } from "@/lib/types";
import { R, computeEdges, labelOf, stateAt, Pt } from "@/lib/geometry";
import { Doc, useStore } from "@/lib/store";
import { analyze } from "@/lib/analyze";
import { buildCursors } from "@/lib/cursors";
import { ACCENTS } from "@/lib/theme";
import { TransitionEditor } from "./TransitionEditor";
import { cx } from "./ui";

export type Tool = "select" | "state" | "transition" | "delete";

interface View {
  x: number;
  y: number;
  k: number;
}

type Drag =
  | { kind: "move"; start: Pt; orig: Map<string, Pt>; moved: boolean }
  | { kind: "pan"; start: Pt; orig: View }
  | { kind: "marquee"; a: Pt; b: Pt; additive: boolean }
  | { kind: "link"; from: string; cursor: Pt };

type Menu =
  | { x: number; y: number; kind: "state"; id: string }
  | { x: number; y: number; kind: "edge"; id: string }
  | { x: number; y: number; kind: "canvas"; world: Pt };

type Editing = { kind: "transition"; id: string; isNew: boolean } | { kind: "state"; id: string; field: "name" | "label" };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Canvas({
  doc,
  tool,
  setTool,
  showNondet,
}: {
  doc: Doc;
  tool: Tool;
  setTool: (t: Tool) => void;
  showNondet: boolean;
}) {
  const a = doc.automaton;
  const { apply, mutate, snapshot, undo } = useStore.getState();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const spaceDown = useRef(false);
  const [panReady, setPanReady] = useState(false);

  const accent = useStore((s) => s.accent);
  const resolvedTheme = useStore((s) => s.resolvedTheme);
  const cur = useMemo(() => {
    const ac = ACCENTS.find((x) => x.id === accent) ?? ACCENTS[0];
    return resolvedTheme === "dark"
      ? buildCursors(ac.dark, ac.fgDark ?? "#0b0a12")
      : buildCursors(ac.light, ac.fgLight ?? "#ffffff");
  }, [accent, resolvedTheme]);

  const edges = useMemo(() => computeEdges(a), [a]);
  const nondet = useMemo(() => (showNondet ? analyze(a).nondetStates : new Set<string>()), [a, showNondet]);

  // Simulation highlights
  const sim = doc.sim;
  const hl = useMemo(() => {
    const active = new Set<string>();
    const accepted = new Set<string>();
    const dead = new Set<string>();
    const taken = new Set<string>();
    if (sim) {
      sim.active.forEach((c) => {
        active.add(c.state);
        if (c.via) taken.add(c.via.id);
      });
      sim.accepted.forEach((c) => accepted.add(c.state));
      if (sim.status === "rejected") sim.dead.forEach((c) => dead.add(c.state));
    }
    return { active, accepted, dead, taken };
  }, [sim]);

  const toWorld = useCallback((clientX: number, clientY: number): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k };
  }, []);

  const toScreen = (p: Pt): Pt => ({ x: p.x * view.k + view.x, y: p.y * view.k + view.y });

  // Fit to content
  const fit = useCallback(() => {
    const st = useStore.getState().docs.find((d) => d.id === doc.id)?.automaton.states ?? [];
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!st.length) {
      setView({ x: 0, y: 0, k: 1 });
      return;
    }
    const xs = st.map((s) => s.x);
    const ys = st.map((s) => s.y);
    const minX = Math.min(...xs) - R - 90;
    const maxX = Math.max(...xs) + R + 60;
    const minY = Math.min(...ys) - R - 110;
    const maxY = Math.max(...ys) + R + 60;
    const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.3, 1.25);
    setView({ k, x: W / 2 - ((minX + maxX) / 2) * k, y: H / 2 - ((minY + maxY) / 2) * k });
  }, [doc.id]);

  useEffect(() => {
    if (doc.fitNonce > 0) requestAnimationFrame(fit);
  }, [doc.fitNonce, fit]);

  // Reset local UI state when switching documents
  useEffect(() => {
    setSel(new Set());
    setSelEdge(null);
    setEditing(null);
    setMenu(null);
  }, [doc.id]);

  // Wheel: pan, or zoom with ctrl/cmd (and trackpad pinch)
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.01), 0.2, 3);
        setView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k });
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const deleteSelection = useCallback(() => {
    if (selEdge) {
      apply((x) => ({ ...x, transitions: x.transitions.filter((t) => t.id !== selEdge) }));
      setSelEdge(null);
      return;
    }
    if (!sel.size) return;
    apply((x) => ({
      ...x,
      states: x.states.filter((s) => !sel.has(s.id)),
      transitions: x.transitions.filter((t) => !sel.has(t.from) && !sel.has(t.to)),
    }));
    setSel(new Set());
  }, [sel, selEdge, apply]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Space") {
        spaceDown.current = e.type === "keydown";
        setPanReady(e.type === "keydown");
        if (e.type === "keydown") e.preventDefault();
        return;
      }
      if (e.type !== "keydown") return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "a") {
          e.preventDefault();
          setSel(new Set(a.states.map((s) => s.id)));
        }
        return;
      }
      switch (e.key) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelection();
          break;
        case "Escape":
          setSel(new Set());
          setSelEdge(null);
          setMenu(null);
          setDrag(null);
          break;
        case "v":
        case "1":
          setTool("select");
          break;
        case "s":
        case "2":
          setTool("state");
          break;
        case "t":
        case "3":
          setTool("transition");
          break;
        case "d":
        case "4":
          setTool("delete");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [a.states, deleteSelection, setTool]);

  const addState = (p: Pt) => {
    const id = uid("s");
    apply((x) => ({
      ...x,
      states: [
        ...x.states,
        {
          id,
          name: nextStateName(x.states),
          x: Math.round(p.x),
          y: Math.round(p.y),
          initial: x.states.length === 0,
          final: false,
        },
      ],
    }));
    return id;
  };

  const createTransition = (from: string, to: string) => {
    const id = uid("t");
    const t: Transition = { id, from, to, read: "" };
    if (a.type === "pda") Object.assign(t, { pop: "", push: "" });
    if (a.type === "tm") Object.assign(t, { read: "□", write: "□", move: "R" });
    apply((x) => ({ ...x, transitions: [...x.transitions, t] }));
    setEditing({ kind: "transition", id, isNew: true });
    setSelEdge(id);
  };

  const removeTransition = (id: string) =>
    apply((x) => ({ ...x, transitions: x.transitions.filter((t) => t.id !== id) }));

  const removeState = (id: string) =>
    apply((x) => ({
      ...x,
      states: x.states.filter((s) => s.id !== id),
      transitions: x.transitions.filter((t) => t.from !== id && t.to !== id),
    }));

  const toggleInitial = (id: string) =>
    apply((x) => ({
      ...x,
      states: x.states.map((s) => ({ ...s, initial: s.id === id ? !s.initial : false })),
    }));

  const toggleFinal = (id: string) =>
    apply((x) => ({ ...x, states: x.states.map((s) => (s.id === id ? { ...s, final: !s.final } : s)) }));

  // ── Pointer handling ───────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent) => {
    setMenu(null);
    if (editing) return;
    const w = toWorld(e.clientX, e.clientY);
    const target = e.target as Element;
    const stateEl = target.closest("[data-state]");
    const edgeEl = target.closest("[data-edge]");
    const stateId = stateEl?.getAttribute("data-state") ?? null;
    const edgeId = edgeEl?.getAttribute("data-edge") ?? null;

    if (e.button === 1 || (e.button === 0 && (spaceDown.current || e.altKey))) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setDrag({ kind: "pan", start: { x: e.clientX, y: e.clientY }, orig: view });
      return;
    }
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    if (tool === "delete") {
      if (stateId) removeState(stateId);
      else if (edgeId) removeTransition(edgeId);
      return;
    }

    if (stateId) {
      if (tool === "transition") {
        setDrag({ kind: "link", from: stateId, cursor: w });
        return;
      }
      let next = sel;
      if (e.shiftKey) {
        next = new Set(sel);
        if (next.has(stateId)) next.delete(stateId);
        else next.add(stateId);
      } else if (!sel.has(stateId)) next = new Set([stateId]);
      setSel(next);
      setSelEdge(null);
      const orig = new Map(a.states.filter((s) => next.has(s.id)).map((s) => [s.id, { x: s.x, y: s.y }]));
      setDrag({ kind: "move", start: w, orig, moved: false });
      return;
    }

    if (edgeId) {
      setSelEdge(edgeId);
      setSel(new Set());
      return;
    }

    // Empty canvas
    if (tool === "state") {
      const id = addState(w);
      setSel(new Set([id]));
      return;
    }
    if (tool === "select") {
      if (!e.shiftKey) {
        setSel(new Set());
        setSelEdge(null);
      }
      setDrag({ kind: "marquee", a: w, b: w, additive: e.shiftKey });
      return;
    }
    setDrag({ kind: "pan", start: { x: e.clientX, y: e.clientY }, orig: view });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = toWorld(e.clientX, e.clientY);
    if (d.kind === "pan") {
      setView({ ...d.orig, x: d.orig.x + e.clientX - d.start.x, y: d.orig.y + e.clientY - d.start.y });
    } else if (d.kind === "move") {
      const dx = w.x - d.start.x;
      const dy = w.y - d.start.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 2) return;
        snapshot();
        setDrag({ ...d, moved: true });
      }
      mutate((x) => ({
        ...x,
        states: x.states.map((s) => {
          const o = d.orig.get(s.id);
          return o ? { ...s, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : s;
        }),
      }));
    } else if (d.kind === "marquee") {
      setDrag({ ...d, b: w });
    } else if (d.kind === "link") {
      setDrag({ ...d, cursor: w });
      setHover(stateAt(a, w)?.id ?? null);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (d.kind === "link") {
      const target = stateAt(a, toWorld(e.clientX, e.clientY));
      setHover(null);
      if (target) createTransition(d.from, target.id);
    } else if (d.kind === "marquee") {
      const x1 = Math.min(d.a.x, d.b.x);
      const x2 = Math.max(d.a.x, d.b.x);
      const y1 = Math.min(d.a.y, d.b.y);
      const y2 = Math.max(d.a.y, d.b.y);
      if (x2 - x1 < 3 && y2 - y1 < 3) return;
      const hits = a.states.filter((s) => s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2).map((s) => s.id);
      setSel((prev) => new Set([...(d.additive ? prev : []), ...hits]));
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // Pointer capture retargets click events to the <svg>, so hit-test the real element
    const target = document.elementFromPoint(e.clientX, e.clientY) ?? (e.target as Element);
    const stateId = target.closest("[data-state]")?.getAttribute("data-state");
    const edgeId = target.closest("[data-edge]")?.getAttribute("data-edge");
    if (stateId) setEditing({ kind: "state", id: stateId, field: "name" });
    else if (edgeId) setEditing({ kind: "transition", id: edgeId, isNew: false });
    else if (tool === "select") addState(toWorld(e.clientX, e.clientY));
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const target = e.target as Element;
    const stateId = target.closest("[data-state]")?.getAttribute("data-state");
    const edgeId = target.closest("[data-edge]")?.getAttribute("data-edge");
    if (stateId) {
      setSel(new Set([stateId]));
      setMenu({ x, y, kind: "state", id: stateId });
    } else if (edgeId) {
      setSelEdge(edgeId);
      setMenu({ x, y, kind: "edge", id: edgeId });
    } else setMenu({ x, y, kind: "canvas", world: toWorld(e.clientX, e.clientY) });
  };

  // ── Render ─────────────────────────────────────────────────────

  const linkFrom = drag?.kind === "link" ? a.states.find((s) => s.id === drag.from) : undefined;
  const toolCursor = { select: cur.select, state: cur.state, transition: cur.transition, delete: cur.delete }[tool];
  // While dragging (or about to pan) one cursor wins over whatever is under the pointer
  const lockedCursor =
    drag?.kind === "pan"
      ? "grabbing"
      : panReady
        ? "grab"
        : drag?.kind === "link"
          ? cur.link
          : drag?.kind === "move" && drag.moved
            ? cur.move
            : null;
  const stateCursor = tool === "delete" ? cur.delete : tool === "transition" ? cur.link : cur.move;
  const edgeCursor = tool === "delete" ? cur.delete : cur.select;

  const editingTransition = editing?.kind === "transition" ? a.transitions.find((t) => t.id === editing.id) : undefined;
  const editingState = editing?.kind === "state" ? a.states.find((s) => s.id === editing.id) : undefined;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-canvas" onContextMenu={(e) => e.preventDefault()}>
      <svg
        ref={svgRef}
        data-canvas
        className={cx("block h-full w-full touch-none", lockedCursor && "cursor-lock")}
        style={{ cursor: lockedCursor ?? toolCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <defs>
          <pattern
            id="grid"
            width={24 * view.k}
            height={24 * view.k}
            x={view.x}
            y={view.y}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={1} style={{ fill: "var(--grid)" }} />
          </pattern>
          {(["edge", "accent", "ok"] as const).map((c) => (
            <marker
              key={c}
              id={`arrow-${c}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0,0.5 L10,5 L0,9.5 L2.5,5 z" style={{ fill: `var(--${c})` }} />
            </marker>
          ))}
        </defs>
        <rect data-grid width="100%" height="100%" fill="url(#grid)" />

        <g data-world transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Notes */}
          {a.notes.map((n) => (
            <text key={n.id} x={n.x} y={n.y} style={{ fill: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
              {n.text}
            </text>
          ))}

          {/* Edges */}
          {edges.map((e) => {
            const isSel = e.transitions.some((t) => t.id === selEdge);
            const isTaken = e.transitions.some((t) => hl.taken.has(t.id));
            const color = isTaken ? "accent" : isSel ? "accent" : "edge";
            return (
              <g key={e.key}>
                <path
                  d={e.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  data-edge={e.transitions[0].id}
                  style={{ cursor: edgeCursor }}
                />
                <path
                  d={e.path}
                  fill="none"
                  style={{ stroke: `var(--${color})` }}
                  strokeWidth={isTaken || isSel ? 2.4 : 1.6}
                  markerEnd={`url(#arrow-${color})`}
                  pointerEvents="none"
                />
                {e.transitions.map((t, i) => {
                  const p = e.labels[i];
                  const active = t.id === selEdge || hl.taken.has(t.id);
                  return (
                    <text
                      key={t.id}
                      data-edge={t.id}
                      x={p.x}
                      y={p.y}
                      textAnchor={p.anchor}
                      dominantBaseline="central"
                      className="edge-label"
                      style={{
                        cursor: edgeCursor,
                        fill: active ? "var(--accent)" : undefined,
                        fontWeight: active ? 700 : 500,
                        opacity: editing?.kind === "transition" && editing.id === t.id ? 0 : 1,
                      }}
                    >
                      {transitionLabel(t, a.type)}
                    </text>
                  );
                })}
              </g>
            );
          })}

          {/* Link preview */}
          {linkFrom && drag?.kind === "link" && (
            <line
              data-ui
              x1={linkFrom.x}
              y1={linkFrom.y}
              x2={hover ? a.states.find((s) => s.id === hover)!.x : drag.cursor.x}
              y2={hover ? a.states.find((s) => s.id === hover)!.y : drag.cursor.y}
              style={{ stroke: "var(--accent)" }}
              strokeWidth={2}
              strokeDasharray="6 4"
              markerEnd="url(#arrow-accent)"
              pointerEvents="none"
            />
          )}

          {/* States */}
          {a.states.map((s) => {
            const isSel = sel.has(s.id);
            const isActive = hl.active.has(s.id);
            const isAcc = hl.accepted.has(s.id);
            const isDead = hl.dead.has(s.id);
            const stroke = isAcc
              ? "var(--ok)"
              : isDead
                ? "var(--bad)"
                : isActive || isSel || hover === s.id
                  ? "var(--accent)"
                  : "var(--state-stroke)";
            const fill = isAcc
              ? "color-mix(in srgb, var(--ok) 22%, var(--state-fill))"
              : isDead
                ? "color-mix(in srgb, var(--bad) 18%, var(--state-fill))"
                : isActive
                  ? "var(--active-fill)"
                  : "var(--state-fill)";
            return (
              <g
                key={s.id}
                data-state={s.id}
                style={{ cursor: stateCursor }}
              >
                {isSel && <circle data-ui cx={s.x} cy={s.y} r={R + 6} style={{ fill: "var(--accent)" }} opacity={0.14} />}
                {isActive && !isAcc && (
                  <circle
                    data-ui
                    cx={s.x}
                    cy={s.y}
                    r={R + 4}
                    fill="none"
                    style={{ stroke: "var(--accent)" }}
                    className="pulse-ring"
                  />
                )}
                {nondet.has(s.id) && (
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={R + 7}
                    fill="none"
                    style={{ stroke: "var(--warn)" }}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                )}
                {s.initial && (
                  <path
                    d={`M ${s.x - R - 34} ${s.y} L ${s.x - R - 1} ${s.y}`}
                    style={{ stroke: "var(--edge)" }}
                    strokeWidth={1.8}
                    markerEnd="url(#arrow-edge)"
                  />
                )}
                <circle cx={s.x} cy={s.y} r={R} style={{ fill, stroke }} strokeWidth={isSel || isActive ? 2.4 : 1.8} />
                {s.final && (
                  <circle cx={s.x} cy={s.y} r={R - 5} fill="none" style={{ stroke }} strokeWidth={1.5} />
                )}
                <text
                  x={s.x}
                  y={s.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fill: "var(--text)",
                    fontSize: s.name.length > 4 ? 10 : 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    pointerEvents: "none",
                  }}
                >
                  {s.name}
                </text>
                {s.label && (
                  <text
                    x={s.x}
                    y={s.y + R + 14}
                    textAnchor="middle"
                    style={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)", pointerEvents: "none" }}
                  >
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}

          {drag?.kind === "marquee" && (
            <rect
              data-ui
              x={Math.min(drag.a.x, drag.b.x)}
              y={Math.min(drag.a.y, drag.b.y)}
              width={Math.abs(drag.b.x - drag.a.x)}
              height={Math.abs(drag.b.y - drag.a.y)}
              style={{ fill: "var(--accent)", stroke: "var(--accent)" }}
              fillOpacity={0.08}
              strokeDasharray="4 3"
              strokeWidth={1 / view.k}
            />
          )}
        </g>
      </svg>

      {/* Empty-state hint */}
      {a.states.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="animate-pop text-center">
            <div className="text-[15px] font-semibold text-text">Canvas vazio</div>
            <div className="mt-1.5 text-muted">
              Use a ferramenta <b className="text-text">Estado</b> (S) e clique para criar estados,
              <br />
              ou dê um duplo clique em qualquer lugar.
            </div>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-border bg-panel/90 p-1 text-xs text-muted shadow-pop backdrop-blur">
        <button className="h-6 w-6 rounded-md hover:bg-panel-2 hover:text-text" onClick={() => setView((v) => zoomAt(v, 1 / 1.2, wrapRef.current!))}>
          −
        </button>
        <button className="h-6 min-w-12 rounded-md px-1 font-mono hover:bg-panel-2 hover:text-text" onClick={fit} title="Ajustar à tela">
          {Math.round(view.k * 100)}%
        </button>
        <button className="h-6 w-6 rounded-md hover:bg-panel-2 hover:text-text" onClick={() => setView((v) => zoomAt(v, 1.2, wrapRef.current!))}>
          +
        </button>
      </div>

      {/* Inline editors */}
      {editingTransition && editing?.kind === "transition" && (
        <TransitionEditor
          type={a.type}
          transition={editingTransition}
          pos={toScreen(labelOf(edges, editingTransition.id) ?? { x: 0, y: 0 })}
          onCommit={(patch) => {
            const fn = (x: Automaton) => ({
              ...x,
              transitions: x.transitions.map((t) => (t.id === editingTransition.id ? { ...t, ...patch } : t)),
            });
            if (editing.isNew) mutate(fn);
            else apply(fn);
            setEditing(null);
          }}
          onCancel={() => {
            if (editing.isNew) undo();
            setEditing(null);
          }}
        />
      )}
      {editingState && editing?.kind === "state" && (
        <StateEditor
          value={(editing.field === "name" ? editingState.name : editingState.label) ?? ""}
          placeholder={editing.field === "name" ? "nome" : "rótulo (opcional)"}
          pos={toScreen({ x: editingState.x, y: editingState.y + R + 8 })}
          onCommit={(v) => {
            const field = editing.field;
            if (field === "name" && !v.trim()) return setEditing(null);
            apply((x) => ({
              ...x,
              states: x.states.map((s) => (s.id === editingState.id ? { ...s, [field]: v.trim() || undefined } : s)),
            }));
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Context menu */}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {menu.kind === "state" &&
            (() => {
              const s = a.states.find((x) => x.id === menu.id);
              if (!s) return null;
              return (
                <>
                  <MenuItem checked={s.initial} onClick={() => toggleInitial(s.id)}>
                    Estado inicial
                  </MenuItem>
                  <MenuItem checked={s.final} onClick={() => toggleFinal(s.id)}>
                    Estado final
                  </MenuItem>
                  <MenuSep />
                  <MenuItem onClick={() => setEditing({ kind: "state", id: s.id, field: "name" })}>Renomear…</MenuItem>
                  <MenuItem onClick={() => setEditing({ kind: "state", id: s.id, field: "label" })}>
                    {s.label ? "Editar rótulo…" : "Adicionar rótulo…"}
                  </MenuItem>
                  {s.label && (
                    <MenuItem
                      onClick={() =>
                        apply((x) => ({
                          ...x,
                          states: x.states.map((st) => (st.id === s.id ? { ...st, label: undefined } : st)),
                        }))
                      }
                    >
                      Remover rótulo
                    </MenuItem>
                  )}
                  <MenuSep />
                  <MenuItem danger onClick={() => removeState(s.id)}>
                    Excluir estado
                  </MenuItem>
                </>
              );
            })()}
          {menu.kind === "edge" && (
            <>
              <MenuItem onClick={() => setEditing({ kind: "transition", id: menu.id, isNew: false })}>
                Editar transição…
              </MenuItem>
              <MenuItem danger onClick={() => removeTransition(menu.id)}>
                Excluir transição
              </MenuItem>
            </>
          )}
          {menu.kind === "canvas" && (
            <>
              <MenuItem onClick={() => addState(menu.world)}>Adicionar estado aqui</MenuItem>
              <MenuItem onClick={fit}>Ajustar à tela</MenuItem>
              <MenuItem onClick={() => setSel(new Set(a.states.map((s) => s.id)))}>Selecionar tudo</MenuItem>
            </>
          )}
        </ContextMenu>
      )}
    </div>
  );
}

function zoomAt(v: View, factor: number, el: HTMLElement): View {
  const mx = el.clientWidth / 2;
  const my = el.clientHeight / 2;
  const k = clamp(v.k * factor, 0.2, 3);
  return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
}

function StateEditor({
  value,
  placeholder,
  pos,
  onCommit,
  onCancel,
}: {
  value: string;
  placeholder: string;
  pos: Pt;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="animate-pop absolute z-20 -translate-x-1/2" style={{ left: pos.x, top: pos.y }}>
      <input
        autoFocus
        className="field h-8 w-40 text-center shadow-pop"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => onCommit(v)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(v);
          if (e.key === "Escape") onCancel();
        }}
      />
    </div>
  );
}

function ContextMenu({ x, y, children, onClose }: { x: number; y: number; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener("blur", h);
    window.addEventListener("pointerdown", h);
    return () => {
      window.removeEventListener("blur", h);
      window.removeEventListener("pointerdown", h);
    };
  }, [onClose]);
  return (
    <div
      className="animate-pop absolute z-30 min-w-48 rounded-xl border border-border bg-elev p-1 shadow-pop"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  checked,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  checked?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-panel-2",
        danger ? "text-bad" : "text-text"
      )}
      onClick={onClick}
    >
      <span className="w-3.5 text-accent">{checked ? "✓" : ""}</span>
      {children}
    </button>
  );
}

function MenuSep() {
  return <div className="my-1 h-px bg-border" />;
}

