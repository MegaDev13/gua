# GAU — Grimório Digital & Forja de Personagens

> **Sistema Universal v3.0 — Edição Digital + Supabase**
> Livro RPG interativo + criador personagem com catálogo completo comprável, pontos ao vivo, Supabase backend.

![GAU Capa](book/images/capa.svg)

**GAU** é sistema d20 com margens. Atributo determina capacidade, categoria escala (qtd d20), margem resultado necessário.

- **Valor 10** = humano, margem **8–12**, crítico **10**
- **1 e 20** não são auto — só margem importa
- **Disputa**: vence mais próximo do crítico
- **Combate**: 1 turno=1s, sequência por deslocamento, árvores táticas
- **Graus Dano**: GD1 1–20 Raspão, GD2 21–64 Em cheio, GD3 65+ Letal

---

## ✨ v3.0 — O que tem aqui

| Seção | Descrição |
|-------|-----------|
| 📖 **Livro Digital** | 11 capítulos: Testes, Combate Montado, Proezas, Sistema Combate, Poderes & Psiquismo, Magias & Escolas, Vantagens, Desvantagens, Peculiaridades, Perícias Catálogo |
| ⚔️ **Forja Personagens** | Wizard 11 etapas: Identidade → Atributos → Vantagens → Desvantagens → Peculiaridades → Perícias (catálogo filtrável) → Manobras → Poderes → Magias → Equip → Final |
| 🛒 **Catálogo Compra** | Vantagens (custa), Desvantagens (ganha pontos), Peculiaridades (-1), Perícias (2 pts/nível), Magias (escola 3 + magia 2), Poderes (Pot 5/3 +2) — tudo com custo visível |
| 🔍 **Filtros Acumulativos** | Perícias: tipo (Física/Mental), atributo (ST/DX/IQ/HT), categoria (Combate, Furtividade...), dificuldade (Fácil/Médio/Difícil/Muito Difícil), busca texto — acumulam! Magias: fonte/foco/custo. Vantagens/Desvantagens: tipo/categoria/custo |
| 💰 **Pontos Ao Vivo** | Widget no topo atualiza a cada mudança (atributo, vantagem, perícia, magia...). Travado: não deixa comprar se faltar pontos. Desvantagens e peculiaridades aumentam livres |
| ☁️ **Supabase Backend** | Opcional: `js/supabase.js` com URL `https://ebjjxncnlddzfgkqegpa.supabase.co` e anon key. Sync automático local↔nuvem por `owner_id`. Tabelas `personagens` e `catalogos_custom`. SQL em `supabase_schema.sql` |
| 🎲 **Motor Regras** | `character-calculator.js` + `dice.js` — 100% cálculos, UI sem fórmulas |
| 🗄️ **Banco Único** | `data/*.json` serve livro e ficha |
| 💾 **Armazenamento** | localStorage + Supabase, export JSON/PDF/PNG, backup |
| 🔍 **Busca & Filtros Livro** | Busca 300+ entradas: regras, manobras, armas, poderes, magias, vantagens, desvantagens, perícias, peculiaridades |
| 🎨 **Temas** | Escuro e claro |

### Conteúdo do banco

| Arquivo | Conteúdo |
|---------|----------|
| `data/book.json` | Livro completo estruturado em capítulos/seções/subseções |
| `data/margins.json` | Tabela de margens 1–20 + extrapolação |
| `data/weapons.json` | 64 armas: 23 medievais, 21 modernas, 20 futuristas com dano, média, característica |
| `data/maneuvers.json` | Árvores completas: Movimento (Linear/Difuso/Acrobático/Atlético), Ataque (Simples/Acrobático/Pesado/Distância), Preparar, Apontar (PREC), Analisar, Fazer Nada |
| `data/empunhaduras.json` | 6 empunhaduras: Uma Mão, Bastarda, Duas Mãos, Tsuka, Zatoichi, Anatômica |
| `data/tables.json` | Luminosidade, Localização, Defesas Ativas, Grau de Dano, Dano Arremesso, Escalada, Pânico |
| `data/attributes.json` | ST, DX, IQ, HT + secundários Vontade, Percepção, Deslocamento, PF |
| `data/categories.json` | Categorias de Poder: Mundano 1d20, Sobre-Humano 2d20, Lendário 3d20, Cósmico 4d20+ |
| `data/rules.json` | Manifesto de regras, fórmulas, configuráveis |

---

## 🚀 Como rodar local

ES modules exigem servidor (não funciona em `file://`):

```bash
cd gua
python3 -m http.server 8000
# abre http://localhost:8000
```

Ou com Node:

```bash
npx serve .
```

---

## 📦 Publicar no GitHub Pages

O projeto já é 100% estático e funciona em subdiretório (caminhos relativos).

1. Vá em **Settings → Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` (ou `arena/01a0543b-gua`) • **Folder**: `/ (root)` → Save
4. Aguarde deploy — a raiz já é o site (`index.html` + `data/` + `js/` + `styles/`)

> Dados de personagem **não** vão para o repositório: ficam no `localStorage` do navegador. Use **Meus Personagens → Exportar Backup** para transportar.

---

## 🏗️ Arquitetura

```
data/*.json          ← FONTE ÚNICA DA VERDADE (livro e ficha leem daqui)
      │
js/db.js             ← Carregador + índice de busca (189 entradas)
      │
js/dice.js           ← d20, margens, grau de dano, carga, levantamento
js/character-calculator.js ← computeCharacter(db, char) — fachada única
      │
js/                  ← UI sem fórmulas
  app.js             ← SPA hash-routing, 8 páginas
  book.js            ← Render livro, modo físico, TOC, árvores
  search.js          ← Busca global com scoring
  filters.js         ← Filtros por tipo e arma
  character-builder.js ← Wizard 6 etapas
  storage.js         ← localStorage, backup, tema
  export-pdf.js      ← jsPDF
  export-png.js      ← html2canvas
  ui.js              ← Helpers DOM

styles/
  main.css           ← Tema escuro/claro, layout, componentes
  book.css           ← Tipografia editorial, modo livro físico
  character-sheet.css← Ficha visual oficial
  animations.css     ← Fade, slide, microinterações, reduced-motion
```

### Fluxo de regras

```
Character (nome, atributos, perícias, manobras, equipamentos)
   ↓
Rules Engine (margens por valor, carga ST×, levantamento, deslocamento)
   ↓
Modifiers (bônus empunhadura, penalidade carga, categoria)
   ↓
Derived Stats (margemTexto, crítico, PF/PV, peso, GD)
   ↓
Validation (erros, avisos, infos com campo e motivo)
   ↓
Character Sheet (ficha visual oficial)
```

- Mudou ST → recalcula carga, deslocamento, levantamento, PF, margens, validação
- Equipou arma → recalcula peso, carga, deslocamento
- Teste = `testarMargem(valor, db, roll?)` → sucesso se roll dentro da margem, crítico se roll == valor
- Disputa = compara distância ao crítico

---

## 📖 Como usar o livro

- **Índice lateral**: clique para navegar, seções destacadas
- **Modo Livro Físico**: botão no topo do capítulo — moldura decorativa, ornamentos, paginação
- **Busca**: ícone 🔍 no topo ou tecla `/` — busca regras, manobras, armas, tabelas
- **Filtros**: na sidebar — filtre por Regras, Manobras, Armas, Tabelas, Empunhaduras e por categoria de arma (Medieval/Moderno/Futurista, Corpo-a-corpo/Distância/Área)

---

## ⚔️ Como criar personagem

1. **Identidade**: nome, conceito, jogador, categoria de poder (Mundano 1d20 até Cósmico 4d20+)
2. **Atributos**: ST, DX, IQ, HT (1–20, 10 = humano). Slider + botões +/- + teste d20 ao vivo. Derivados calculados automaticamente.
3. **Perícias**: lista inicial (Arrombamento IQ-5, Cavalgar DX, Natação ST-5, Escalada DX-5). Adicione custom, teste com 🎲
4. **Manobras**: escolha na árvore tática (Investida, Finta, Cambalhota, Combo com Cenário, Ataque Duplo, Preciso, Pesado, Saraivada, etc) + empunhadura (Uma Mão, Tsuka, etc)
5. **Equipamentos**: busque 64 armas do grimório ou crie item custom com peso. Carga e deslocamento recalculam.
6. **Finalizar**: história, resumo automático, teste rápido de qualquer valor, validação com erros/avisos.

**Validação automática**:

- Atributo 1 = sem margem (incapaz)
- >20 em Mundano = requer categoria superior
- Carga >15×ST = não pode se mover
- Empunhadura sem arma = info
- Nome curto = aviso

---

## 💾 Salvamento e exportação

- **Auto-save**: ao clicar Salvar, vai para `localStorage`
- **Meus Personagens**: lista com ST/DX/IQ/HT, categoria, validação, ações Ver/Editar/Duplicar/Excluir
- **Exportar**:
  - 📦 **JSON**: personagem completo para importar depois
  - 📄 **PDF**: via jsPDF (ou fallback print) com layout oficial
  - 🖼️ **PNG**: via html2canvas, escala 2× para impressão
  - 📦 **Backup**: todos personagens + tema + filtros em um JSON

---

## 🎨 Design

Identidade visual baseada no universo GAU:

- **Paleta**: couro #1e1b14, pergaminho #efe6d2, ouro #c9a55c, sangue #9c2b23
- **Tipografia**: Títulos Cinzel Decorative, Corpo Lora (serif leitura longa), UI Inter
- **Elementos**: molduras duplas, ornamentos ❧ ◈, bordas douradas, sombras suaves, textura sutil
- **Modo Livro**: página centralizada, moldura decorativa, número da página, cabeçalho, rodapé, ornamentos, transição de página
- **Ficha**: mesma identidade do livro, parece página oficial — molduras, símbolos, tipografia, divisores

**Animações** (respeitam `prefers-reduced-motion`):

- Fade, slide, scale, hover lift, glow, shimmer em barras, float na capa, dice roll, page turn

---

## 🔧 Onde modificar

| O que | Onde |
|-------|------|
| Texto do livro | `data/book.json` → capitulos[].secoes[] |
| Margens | `data/margins.json` |
| Armas | `data/weapons.json` → categorias[].armas[] |
| Manobras | `data/maneuvers.json` |
| Empunhaduras | `data/empunhaduras.json` |
| Tabelas | `data/tables.json` |
| Atributos | `data/attributes.json` |
| Categorias | `data/categories.json` |
| Regras/fórmulas | `js/character-calculator.js` + `js/dice.js` |
| Design cores | `styles/main.css` → :root |
| Tipografia livro | `styles/book.css` |
| Ficha visual | `styles/character-sheet.css` |
| Animações | `styles/animations.css` |

---

## ✅ Testes

Teste manual do motor:

```bash
node --input-type=module -e "
import DB from './js/db.js';
global.fetch = async (p) => { const fs = await import('fs'); const text = fs.readFileSync(p.replace('data/','./data/'),'utf-8'); return { ok:true, json: async()=>JSON.parse(text)}; };
await DB.load();
console.log('Margem 10', DB.getMarginForValue(10));
"
```

Checklist:

- [x] Capa com Entrar no Livro e Criar Personagem
- [x] Índice clicável + navegação suave
- [x] Modo Livro Físico com moldura
- [x] Busca global (189 entradas) com trecho + botão
- [x] Filtros por tipo e arma (múltipla seleção)
- [x] Criação de personagem 6 etapas
- [x] Cálculo automático de margens, carga, deslocamento, PF/PV, levantamento
- [x] Validação com motivo (🔒 Requisito não atendido)
- [x] Ficha visual oficial com molduras e ornamentos
- [x] Salvar/duplicar/excluir em localStorage
- [x] Exportar JSON, PDF, PNG
- [x] Backup completo
- [x] Temas escuro/claro
- [x] Responsivo (PC, tablet, celular)
- [x] Acessível (skip-link, ARIA, foco visível, contraste, reduced-motion)
- [x] Performance (sem frameworks, CDN apenas para export, CSS eficiente)

---

## 📜 Licença e créditos

Sistema GAU — conteúdo textual fornecido pelo autor. Este grimório digital é uma implementação independente, sem backend, sem banco proprietário, 100% client-side.

- Tipografia: Google Fonts (Cinzel, Lora, Inter)
- Export: jsPDF, html2canvas via CDN
- Ícones: Unicode emoji (sem dependências)

> Sempre que houver escolha entre beleza e usabilidade, buscamos os dois. Entre animação e performance, priorizamos performance. Entre inventar e seguir o livro, seguimos o livro.

---

**Forje seu personagem. Entre no grimório. Que seus críticos sejam 10.**
