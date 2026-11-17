import { Automaton, BLANK, MachineType, Move, State, Transition, uid } from "./types";

type S = [name: string, x: number, y: number, flags?: "i" | "f" | "if"];

function build(
  type: MachineType,
  states: S[],
  trans: [from: string, to: string, ...rest: string[]][],
  extra: Partial<Automaton> = {}
): Automaton {
  const byName = new Map<string, State>();
  const st: State[] = states.map(([name, x, y, f = ""]) => {
    const s = { id: uid("s"), name, x, y, initial: f.includes("i"), final: f.includes("f") };
    byName.set(name, s);
    return s;
  });
  const tr: Transition[] = trans.map(([from, to, ...rest]) => {
    const t: Transition = { id: uid("t"), from: byName.get(from)!.id, to: byName.get(to)!.id, read: rest[0] ?? "" };
    if (type === "pda") {
      t.pop = rest[1] ?? "";
      t.push = rest[2] ?? "";
    }
    if (type === "tm") {
      t.read = rest[0] || BLANK;
      t.write = rest[1] || BLANK;
      t.move = (rest[2] as Move) ?? "R";
    }
    return t;
  });
  return { type, states: st, transitions: tr, notes: [], ...extra };
}

export interface Example {
  title: string;
  description: string;
  tests: string[];
  make: () => Automaton;
}

export const EXAMPLES: Example[] = [
  {
    title: "AFD — termina em “ab”",
    description: "Cadeias sobre {a, b} que terminam com ab.",
    tests: ["ab", "aab", "abab", "ba", "abb", "ε"],
    make: () =>
      build(
        "fa",
        [
          ["q0", 140, 240, "i"],
          ["q1", 340, 240],
          ["q2", 540, 240, "f"],
        ],
        [
          ["q0", "q0", "b"],
          ["q0", "q1", "a"],
          ["q1", "q1", "a"],
          ["q1", "q2", "b"],
          ["q2", "q1", "a"],
          ["q2", "q0", "b"],
        ]
      ),
  },
  {
    title: "AFN-ε — contém “aba”",
    description: "Não determinístico, com transição ε.",
    tests: ["aba", "babab", "abba", "aaba", "ab"],
    make: () =>
      build(
        "fa",
        [
          ["q0", 120, 240, "i"],
          ["q1", 290, 240],
          ["q2", 460, 240],
          ["q3", 630, 240],
          ["q4", 800, 240, "f"],
        ],
        [
          ["q0", "q0", "a"],
          ["q0", "q0", "b"],
          ["q0", "q1", "a"],
          ["q1", "q2", "b"],
          ["q2", "q3", "a"],
          ["q3", "q4", ""],
          ["q4", "q4", "a"],
          ["q4", "q4", "b"],
        ]
      ),
  },
  {
    title: "AP — aⁿbⁿ",
    description: "Autômato de pilha que reconhece aⁿbⁿ, n ≥ 0.",
    tests: ["", "ab", "aabb", "aaabbb", "aab", "abab"],
    make: () =>
      build(
        "pda",
        [
          ["q0", 160, 240, "i"],
          ["q1", 400, 240],
          ["q2", 640, 240, "f"],
        ],
        [
          ["q0", "q0", "a", "Z", "AZ"],
          ["q0", "q0", "a", "A", "AA"],
          ["q0", "q1", "", "", ""],
          ["q1", "q1", "b", "A", ""],
          ["q1", "q2", "", "Z", "Z"],
        ]
      ),
  },
  {
    title: "AP — palíndromos wwᴿ",
    description: "Não determinístico: adivinha o meio da cadeia.",
    tests: ["abba", "aa", "abaaba", "ab", "aba"],
    make: () =>
      build(
        "pda",
        [
          ["q0", 160, 240, "i"],
          ["q1", 400, 240],
          ["q2", 640, 240, "f"],
        ],
        [
          ["q0", "q0", "a", "", "a"],
          ["q0", "q0", "b", "", "b"],
          ["q0", "q1", "", "", ""],
          ["q1", "q1", "a", "a", ""],
          ["q1", "q1", "b", "b", ""],
          ["q1", "q2", "", "Z", "Z"],
        ]
      ),
  },
  {
    title: "MT — aⁿbⁿ",
    description: "Máquina de Turing que marca pares a/b com X e Y.",
    tests: ["", "ab", "aabb", "aaabbb", "aab", "ba"],
    make: () =>
      build(
        "tm",
        [
          ["q0", 140, 260, "i"],
          ["q1", 360, 140],
          ["q2", 580, 260],
          ["q3", 380, 430],
          ["q4", 140, 500, "f"],
        ],
        [
          ["q0", "q1", "a", "X", "R"],
          ["q0", "q3", "Y", "Y", "R"],
          ["q0", "q4", BLANK, BLANK, "S"],
          ["q1", "q1", "a", "a", "R"],
          ["q1", "q1", "Y", "Y", "R"],
          ["q1", "q2", "b", "Y", "L"],
          ["q2", "q2", "a", "a", "L"],
          ["q2", "q2", "Y", "Y", "L"],
          ["q2", "q0", "X", "X", "R"],
          ["q3", "q3", "Y", "Y", "R"],
          ["q3", "q4", BLANK, BLANK, "S"],
        ]
      ),
  },
  {
    title: "MT — aⁿbⁿcⁿ",
    description: "Linguagem sensível ao contexto: nenhum AP a reconhece.",
    tests: ["abc", "aabbcc", "aaabbbccc", "aabbc", "abcc", "acb", ""],
    make: () =>
      build(
        "tm",
        [
          ["q0", 140, 290, "i"],
          ["q1", 370, 150],
          ["q2", 610, 150],
          ["q3", 490, 330],
          ["q4", 370, 470],
          ["q5", 610, 470],
          ["q6", 830, 470, "f"],
        ],
        [
          ["q0", "q1", "a", "X", "R"],
          ["q1", "q1", "a", "a", "R"],
          ["q1", "q1", "Y", "Y", "R"],
          ["q1", "q2", "b", "Y", "R"],
          ["q2", "q2", "b", "b", "R"],
          ["q2", "q2", "Z", "Z", "R"],
          ["q2", "q3", "c", "Z", "L"],
          ["q3", "q3", "a", "a", "L"],
          ["q3", "q3", "b", "b", "L"],
          ["q3", "q3", "Y", "Y", "L"],
          ["q3", "q3", "Z", "Z", "L"],
          ["q3", "q0", "X", "X", "R"],
          ["q0", "q4", "Y", "Y", "R"],
          ["q4", "q4", "Y", "Y", "R"],
          ["q4", "q5", "Z", "Z", "R"],
          ["q5", "q5", "Z", "Z", "R"],
          ["q5", "q6", BLANK, BLANK, "S"],
        ]
      ),
  },
  {
    title: "MT — incremento binário",
    description: "Soma 1 a um número binário; veja a saída na fita.",
    tests: ["0", "1", "1011", "111", "1000"],
    make: () =>
      build(
        "tm",
        [
          ["q0", 160, 240, "i"],
          ["q1", 400, 240],
          ["q2", 640, 240, "f"],
        ],
        [
          ["q0", "q0", "0", "0", "R"],
          ["q0", "q0", "1", "1", "R"],
          ["q0", "q1", BLANK, BLANK, "L"],
          ["q1", "q1", "1", "0", "L"],
          ["q1", "q2", "0", "1", "S"],
          ["q1", "q2", BLANK, "1", "S"],
        ]
      ),
  },
];
