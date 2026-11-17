"use client";

import { useState } from "react";
import { ArrowRight, Copy, GitBranch, Minimize2, PackagePlus, Repeat, Sigma, Wand2 } from "lucide-react";
import { Automaton } from "@/lib/types";
import { Doc, useStore } from "@/lib/store";
import { completeDfa, complementDfa, faToRegex, minimizeDfa, nfaToDfa } from "@/lib/convert";
import { RegexError, glushkov, parse } from "@/lib/regex";
import { analyze } from "@/lib/analyze";
import { Badge, Button, Section } from "./ui";

export function ConvertPanel({ doc }: { doc: Doc }) {
  const a = doc.automaton;
  const { openDoc, showToast } = useStore.getState();
  const info = analyze(a);
  const [regex, setRegex] = useState<string | null>(null);

  const run = (fn: (a: Automaton) => Automaton, suffix: string) => {
    try {
      openDoc(fn(a), `${doc.title} · ${suffix}`);
      showToast(`Criado em nova aba: ${suffix}`, "ok");
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const items = [
    {
      icon: <GitBranch size={15} />,
      title: "AFN → AFD",
      desc: "Construção de subconjuntos",
      onClick: () => run(nfaToDfa, "AFD"),
      disabled: false,
    },
    {
      icon: <Minimize2 size={15} />,
      title: "Minimizar AFD",
      desc: "Refinamento de partições",
      onClick: () => run(minimizeDfa, "mínimo"),
      disabled: !info.deterministic,
    },
    {
      icon: <PackagePlus size={15} />,
      title: "Completar AFD",
      desc: "Adiciona estado armadilha",
      onClick: () => run((x) => completeDfa(x), "completo"),
      disabled: !info.deterministic || info.complete,
    },
    {
      icon: <Repeat size={15} />,
      title: "Complemento",
      desc: "Inverte estados finais",
      onClick: () => run(complementDfa, "complemento"),
      disabled: !info.deterministic,
    },
  ];

  return (
    <div>
      <Section
        title="Transformações"
        right={info.deterministic ? <Badge tone="ok">AFD</Badge> : <Badge tone="warn">AFN</Badge>}
      >
        <div className="space-y-1.5">
          {items.map((it) => (
            <button
              key={it.title}
              disabled={it.disabled}
              onClick={it.onClick}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-panel-2 px-3 py-2.5 text-left transition-all hover:border-accent/50 hover:bg-elev disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">{it.icon}</span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-text">{it.title}</span>
                <span className="block text-[11px] text-muted">{it.desc}</span>
              </span>
              <ArrowRight size={14} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
          ))}
        </div>
        {!info.deterministic && (
          <p className="mt-2 text-[11px] text-faint">Minimizar, completar e complementar exigem um AFD.</p>
        )}
      </Section>

      <Section title="AF → Expressão regular">
        <Button
          icon={<Sigma size={14} />}
          onClick={() => {
            try {
              setRegex(faToRegex(a));
            } catch (e) {
              showToast((e as Error).message, "error");
            }
          }}
        >
          Eliminar estados
        </Button>
        {regex !== null && (
          <div className="animate-pop mt-3 rounded-xl border border-border bg-panel-2 p-3">
            <div className="break-all font-mono text-[13px] text-text">{regex}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={12} />}
                onClick={() => {
                  navigator.clipboard.writeText(regex);
                  showToast("Copiado", "ok");
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Expressão regular → AF">
        <RegexToFa />
      </Section>
    </div>
  );
}

export function RegexToFa({ autoFocus = false }: { autoFocus?: boolean }) {
  const { openDoc, showToast } = useStore.getState();
  const [src, setSrc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const build = () => {
    try {
      const re = parse(src);
      openDoc(glushkov(re), `ER: ${src || "ε"}`);
      showToast("AFN criado a partir da expressão", "ok");
      setErr(null);
    } catch (e) {
      setErr(e instanceof RegexError ? `${e.message} (posição ${e.pos + 1})` : (e as Error).message);
    }
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          className="field"
          placeholder="(a+b)*abb"
          value={src}
          spellCheck={false}
          onChange={(e) => {
            setSrc(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && build()}
        />
        <Button variant="primary" icon={<Wand2 size={14} />} onClick={build}>
          Gerar
        </Button>
      </div>
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        União <code className="text-muted">+</code> ou <code className="text-muted">|</code> · estrela <code className="text-muted">*</code> ·
        opcional <code className="text-muted">?</code> · vazio <code className="text-muted">ε</code>/<code className="text-muted">λ</code>/
        <code className="text-muted">!</code> · construção de Glushkov (AFN sem ε)
      </p>
    </div>
  );
}
