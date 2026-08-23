# GUA — Ecossistema Digital de RPG

Livro de regras digital **+** ficha de personagem automatizada, construídos sobre **uma única base de regras** (`data/*.json`). Nenhuma regra foi inventada: tudo vem do material-fonte, com páginas citadas, e o que o material não define está marcado como **REGRA NÃO DEFINIDA**.

> ⚔️ Prioridade do projeto: **fidelidade às regras &gt; correção dos cálculos &gt; integridade dos dados &gt; funcionalidade &gt; integração &gt; usabilidade &gt; design &gt; efeitos visuais.**

---

## O que tem aqui

| | |
|---|---|
| 📖 **Livro digital** | Produto de leitura próprio em `#/livro`: capa, 9 capítulos, sumário, pesquisa, progresso, consulta rápida e exportação |
| 🧑 **Ficha de personagem** | Navegação independente com personagem, atributos, perícias, vantagens/desvantagens, equipamentos, magias, dados, histórico e configurações |
| ⚔️ **Combate** | Espaço global próprio, acessível diretamente do livro ou da ficha |
| ⚙️ **Rule Engine** | Módulos ES puros (`app/engine/`) — **100% dos cálculos** vivem aqui; a interface não contém fórmulas |
| ☷ **FilterEngine** | Filtros reutilizáveis com `(A OU B) E C`, NOT, intervalos, relações com o personagem, favoritos e combinações salvas |
| 🗄️ **Banco único** | `data/*.json` serve ao livro **e** à ficha (fonte única da verdade) |
| ✅ **Testes** | 75 testes do engine + 17 do FilterEngine + smoke test das 11 experiências |
| 💾 **Dados do jogador** | localStorage do navegador — nada sai do dispositivo; import/export JSON, backup completo, PDF e PNG |

### Conteúdo do banco (extraído do material)

| Arquivo | Conteúdo |
|---|---|
| `data/skills.json` | 175 perícias (tipo/dificuldade, defaults, pré-reqs, fonte por página) |
| `data/advantages.json` | 62 vantagens, com níveis (Riqueza, Status, Aparência…) |
| `data/disadvantages.json` | 82 desvantagens |
| `data/quirks.json` | Peculiaridades: máx. 5, −1 pt cada, 32 exemplos do material |
| `data/spells.json` | 85 magias em 11 escolas (p. 331–370), com custo, duração, pré-reqs |
| `data/equipment.json` | 17 armaduras, 6 escudos, 3 ataques naturais, qualidade, encantamento completo (p. 322–323) |
| `data/tables.json` | 19 tabelas (custos, dano, carga, ferimentos, fadiga, mana, modificadores…) |
| `data/maneuvers.json` | Manobras de combate básico/avançado e defesas |
| `data/rules.json` | Manifesto: princípios, registry de REGRA NÃO DEFINIDA, configuráveis |
| `data/book.json` | Metadados do livro digital |

## Como rodar

**Local** (qualquer pasta estática; ES modules exigem servidor, não `file://`):

```bash
cd gua
python3 -m http.server 8080
# abre http://localhost:8080
```

**Publicar no GitHub Pages** (funciona em subdiretório — todos os caminhos são relativos):

1. Settings → Pages → **Deploy from a branch**
2. Branch: `main` · Pasta: `/ (root)` → Save

Pronto: a raiz do repositório já é o site (`index.html`).

> Dados de personagem **não** vão para o repositório: ficam no `localStorage` do navegador de quem joga. Use *Configurações → Backup* para exportar/importar.

## Arquitetura em 30 segundos

```
data/*.json          ← FONTE ÚNICA DA VERDADE (livro e ficha leem daqui)
      │
app/engine/*.js      ← TODO cálculo (atributos, perícias, carga, combate,
      │                fadiga, magia, economia, requisitos, contagem de pontos)
      │                cada valor sai com "breakdown" (origem de cada número)
      │
app/engine/engine.js ← computeAll(db, personagem) — fachada única da UI
      │
app/ui/              ← desenha e chama o engine. Zero fórmulas.
app/main.js          ← SPA hash-routing (Livro · Ficha · Combate), sem frameworks
```

- Mudou um atributo → perícias, dano, carga, deslocamento, esquiva, defesa passiva, fadiga e magia **recalcular sozinhos**.
- Compra/venda/conjuração impossíveis são **bloqueadas com o motivo exato** ("Dinheiro insuficiente: tem $500, preço $550 (**faltam $50**)").
- Valores intermediários **nunca arredondados**, exceto onde o material manda.
- Todo número calculado tem tooltip **"como este valor foi calculado"**.

### Ferramentas

- `tools/extract_data.py` — extrai o bruto do PDF-fonte para `analysis/outdata/`
- `tools/build_data.py` — gera `data/*.json` (reproduzível: rode de novo e o diff é vazio)

### Testes

```bash
node tests/run.mjs        # 75 testes do engine vs. exemplos do material
node tests/filters.mjs    # 17 testes de AND/OR/NOT, texto, intervalos e presets
node tests/smoke_ui.mjs   # renderiza as 11 experiências em DOM falso
```

Exemplos validados: personagem-modelo Dai (ST8/DX15/IQ12/HT12 = 85 pts), montante ST10 = 1D+1, corte 8 vs RD 3 → 7, níveis de carga p. 195–197, fadiga p. 298–300, custos de magia p. 300–314, encantamento p. 322–323.

## O que o material não define (e o que fizemos)

Política: **nada é inventado**. Itens ausentes ficam marcados e a arquitetura aceita a regra quando publicada — o registry completo está em `data/rules.json → naoDefinidas`:

- Tabela de armas corpo-a-corpo → cadastro manual na aba Equipamentos (o motor calcula NH/dano/aparar)
- Golpes Fulminantes / Erros Críticos (tabelas 3d)
- Lista de preços de equipamentos (só itens citados no texto)
- Preço de revenda (fator configurável em Configurações)
- Evolução pós-criação (XP registrável no Histórico)
- Poderes não-mágicos (módulo pronto e vazio)

Tabelas reconstruídas a partir de regra **textual** (não inventadas) carregam `_aviso: "TABELA RECONSTRUÍDA"` em `tables.json`.

## Análise do material

O mapa completo das 17 seções de regras, com páginas citadas, está em [`docs/analise/01-mapa-de-regras.md`](docs/analise/01-mapa-de-regras.md).

---

*Material-base: GURPS® Basic Set, 3ª edição (PT-BR, 370 pp.), usado como fonte privada de mesa. GURPS® é marca registrada de seus detentores; este projeto não tem afiliação nem distribui o material original.*
