# Automata Studio

Editor e simulador de autômatos para desktop (Electron + Next.js), inspirado no JFLAP.

## Recursos

- **Autômatos finitos** (AFD, AFN, AFN-ε): simulação, AFN → AFD (subconjuntos), minimização,
  completar com estado armadilha, complemento, AF → ER (eliminação de estados), ER → AFN (Glushkov)
- **Autômatos de pilha** não determinísticos, aceitação por estado final ou pilha vazia
- **Máquinas de Turing** de uma fita (L/R/S), com saída da fita
- Simulação passo a passo (todas as configurações, pilha e fita visíveis), execução rápida com
  caminho de aceitação, e execução em lote
- Definição formal e tabela δ, detecção de não determinismo e estados inalcançáveis
- Abrir/exportar arquivos `.jff` do JFLAP, salvar `.automata`, exportar SVG
- Abas, desfazer/refazer
- Aparência: Sistema (segue o SO ao vivo), Claro ou Escuro, e 7 temas de cor; também no menu Visualizar → Aparência
- Tela inicial com a hierarquia de Chomsky em diagrama de Venn: cada card mostra a classe de linguagens que a máquina reconhece

## Uso

```bash
npm install
npm run dev       # Next dev server + Electron com hot reload
npm start         # build estático + Electron
npm run dist      # gera instalador com electron-builder
npm run dev:web   # apenas no navegador (http://localhost:3123)
```

## Atalhos do editor

| Tecla | Ação |
|---|---|
| V / S / T / D | Selecionar · Estado · Transição · Apagar |
| Duplo clique | Criar estado (vazio) · renomear estado · editar transição |
| Clique direito | Inicial, final, rótulo, excluir |
| Espaço + arrastar / rolar | Mover a vista |
| ⌘ + rolar / pinça | Zoom |
| ⌘Z / ⇧⌘Z | Desfazer / refazer |

Em transições, campo vazio significa ε (ou □ na Máquina de Turing). `λ`, `ε` e `!` também são aceitos.
