# GUA — Ecossistema Digital de RPG

Livro de regras digital **+** ficha de personagem automatizada, construídos sobre **uma única base de regras** (`data/*.json`). Nenhuma regra foi inventada: tudo vem do material-fonte, com a origem citada em cada valor, e o que o material não define está marcado como **REGRA NÃO DEFINIDA**.

> ⚔️ Prioridade do projeto: **fidelidade às regras &gt; correção dos cálculos &gt; integridade dos dados &gt; funcionalidade &gt; integração &gt; usabilidade &gt; design &gt; efeitos visuais.**

**Duas camadas de regras convivem no mesmo motor:**

| | Sistema **G.A.U.** (principal) | Material **legado 3d6** (subsistema) |
|---|---|---|
| Resolução | **1d20 dentro da margem de sucesso** da referência | 3d6 ≤ NH |
| Dano | **Grau de Dano** (GD1 raspão · GD2 em cheio · GD3 letal) | dano por dado, RD, DP |
| Combate | **árvore de 55 manobras** (6 básicas) + empunhaduras + PREC | manobras básicas/avançadas do material 3d6 |
| Poderes | **construtor modular** (efeitos, extensão, potência, condições) | vantagens clássicas |
| Ligado em | `config.modoCombate = 'gau'` (padrão) | `config.modoCombate = 'legado'` |

---

## O que tem aqui

| | |
|---|---|
| 📖 **Livro digital** | Produto de leitura próprio em `#/livro`: capa, **13 capítulos**, sumário, pesquisa full-text (**1124 documentos indexados**), progresso de leitura, consulta rápida e exportação |
| 🧑 **Ficha de personagem** | Navegação própria com personagem, atributos, perícias, vantagens/desvantagens, **poderes**, magias, **proezas**, equipamentos, dados, histórico e configurações |
| ⚔️ **Combate** | Espaço global próprio, com os **dois modos** (G.A.U. d20 / legado 3d6) e a árvore de manobras navegável |
| ⚙️ **Rule Engine** | **25 módulos** ES puros (`app/engine/`) — **100% dos cálculos** vivem aqui; a interface não contém fórmulas |
| ☷ **FilterEngine** | Filtros reutilizáveis com `(A OU B) E C`, NOT, intervalos, relações com o personagem, favoritos e combinações salvas |
| 🗄️ **Banco único** | **21 arquivos** `data/*.json` servem ao livro **e** à ficha (fonte única da verdade) |
| ✅ **Testes** | **369** testes do engine + **17** do FilterEngine + smoke test de **13 páginas**, **13 capítulos × 4 rotas**, **2 modos de combate**, interações da aba Dados, painel G.A.U. de perícias (**descrição inteira, compra em lote e filtro persistente**), **compras clicadas de ponta a ponta** (vantagem adquirida/trocada de nível/removida, desvantagem que devolve pontos, peculiaridade do catálogo e livre, atributo comprado e bloqueado por orçamento, magia, perícia e poder editado), **as 13 páginas com a ficha cheia nos 2 modelos**, capítulos *Perícias* e *Criação*, **widget/painel de pontos**, **bootstrap completo (`app/main.js`)** e integridade de todas as rotas do índice |
| 💾 **Dados do jogador** | localStorage do navegador — nada sai do dispositivo; import/export JSON, backup completo, PDF e PNG |

### Conteúdo do banco (extraído do material)

**Material G.A.U. (d20):**

| Arquivo | Conteúdo |
|---|---|
| `data/resolucao.json` | Núcleo de resolução: dado base, princípios, referência, **tabela de margens (1–20)**, categorias de poder/escala, sucesso automático, "1 e 20 não importam", crítico, testes pré-definidos, testes por categoria, disputas, testes secretos do mestre |
| `data/ficha.json` | Modelo oficial da planilha: **9 blocos** (atributos, secundários, parâmetros, perícias, vantagens, desvantagens, biografia, línguas, poderes) com as fórmulas PV/VON/PER/PF e as bases de ATQ/ESQ/DSL/APAR/BLOQ |
| `data/proezas.json` | Proezas físicas (corrida, esforço extra, saltos, escalada, levantamento, empurrar/derrubar, apanhar, arremesso, cavar, natação), sentidos, vontade e **tabela de pânico (4–40+)** |
| `data/maneuvers.json` | **Árvore de manobras (55 nós)**, defesas ativas, Grau de Dano, localização de acerto, luminosidade, empunhaduras, combate montado/veículos |
| `data/armas.json` | **64 armas** em 3 eras (medieval, moderna, futurista) + tabela **PREC** + dano de arremesso |
| `data/estruturas.json` | Dano em estruturas/objetos: 7 materiais (Limiar de Dano e PE por tamanho), estados de degradação e **13 níveis de tecnologia (NT 0–12+)** |
| `data/poderes.json` | Construtor modular: **78 efeitos** (9 grupos), **40 extensões**, **21 potências**, **30 condições**, bônus/penalidades/PV/RD, dimensionalidade e hax |
| `data/magia.json` | Sistema mágico completo: aptidão, aprendizado, pré-requisitos, mana, rituais por NH, tempo, custo de energia, duração, classes, toque do mago, cajado/vara, cerimonial, objetos encantados e entidades |
| `data/advantages.json` | **65 vantagens** da publicação oficial (38 clássicas + 6 de custo variável + **21 novas** de 16/08/2026), com custos, **efeitos estruturados** consumidos pelo motor, níveis (Rijeza, Memória Eidética, Sorte, Aptidão Mágica, Abascanto, Riqueza, Status, Aparência…), requisitos, incompatibilidades e unicidade |
| `data/vantagens.json` | Regras do capítulo: definição e momento de compra, custos, **NOVAS VANTAGENS**, **Aliado** (poder × freqüência 3d), **Patrono** (escalas 10/15/25/30, equipamento, qualidades), **Riqueza**, exemplo de seleção de Dai Blackthorn, conflitos e **migração de ids** de fichas salvas |

**Material legado (3d6):**

| Arquivo | Conteúdo |
|---|---|
| `data/skills.json` | **176 perícias da publicação oficial G.A.U.** em **16 grupos**: custo em pontos, `preDefinido[]` estruturado (256 fontes tipificadas), modificadores publicados (12 com vínculo a vantagem), especializações, pré-requisitos, NT mínimo, familiaridade — e os campos legados `defaults`/`dificuldade` preservados |
| `data/pericias.json` | Regras do capítulo: definição, desenvolvimento e aperfeiçoamento, escolha inicial (**limite 2 × idade**), **comprando perícias** (nível 1 + 1 ponto por nível), **familiaridade** (−2 e 8 h), os 16 grupos, **línguas** (dificuldades, testes de comunicação, alfabetização), 7 divergências, 4 lacunas e `migracaoDeModelo` |
| `data/disadvantages.json` | **106 desvantagens** (82 do material-base + 24 integradas: aparência, saúde, vícios, fobias, deveres, inimigo, segredo, reputação…), com custo legível pelo motor (`-N pontos` / `-N pontos/nível`) |
| `data/peculiaridades.json` | **Catálogo escolhível de 52 peculiaridades** (32 do material-base p. 88–89 + 20 de campanha), todas −1 ponto, com a regra do máximo |
| `data/pontos.json` | **Pontos de personagem**: 9 presets (25 *Fraco* → 1.000 *Divino*), 8 faixas de campanha, o que é grátis (manobras, empunhadura), limites (mínimo 25, passos 10/50, sem teto), travamento de gasto e os dois modos de orçamento |
| `data/quirks.json` | Peculiaridades: máx. 5, −1 pt cada, 32 exemplos do material |
| `data/spells.json` | 85 magias em 11 escolas, com custo, duração, pré-reqs (também usadas como **Lista de Mágicas** do G.A.U.) |
| `data/equipment.json` | 17 armaduras, 6 escudos, 3 ataques naturais, qualidade, encantamento completo |
| `data/tables.json` | 19 tabelas (custos, dano, carga, ferimentos, fadiga, mana, modificadores…) |
| `data/rules.json` | Manifesto: princípios, **7 conflitos registrados**, registry de REGRA NÃO DEFINIDA, configuráveis (incl. `orcamentoPontos` e `permitirEstourarPontos`) |
| `data/book.json` | Metadados do livro digital: 13 capítulos com manifestos de seção apontando para os dados |

## O sistema G.A.U. em 60 segundos

1. **A referência é o valor** do atributo ou do nível de habilidade — não existe dificuldade arbitrária.
2. Rola-se **1d20** e o resultado precisa cair **dentro da margem de sucesso** daquela referência (ex.: referência 10 → 8–12).
3. O **crítico** é o valor exato da referência. **1 e 20 não são mais falha/sucesso automáticos.**
4. **Categoria de poder é escala, não bônus**: seres acima de Mundano rolam mais d20 (2 ou 3) e podem tentar testes que um mundano **não pode** (bloqueio com o motivo).
5. No combate, a **margem do ataque** define o **Grau de Dano**: GD1 raspão (1–20), GD2 em cheio (21–64), GD3 letal (65+).
6. **PV = ST × HT**, VON = IQ, PER = IQ, **PF = HT**; ESQ vem de DX, BLOQ de ST + escudo, DSL do parâmetro Velocidade.
7. Poderes são montados como **módulos** (Efeito + Extensão + Potência, no máximo **3 Condições**) e, por padrão, **saem do mesmo total de pontos do personagem**.
8. **Pontos são um orçamento único**: o total do personagem (25 a 1.000+) paga atributos, perícias, vantagens, poderes e mágicas — gastou num, sobra menos no outro. Desvantagens e peculiaridades **devolvem** pontos; manobras e empunhadura **não custam** nada.

## Pontos de personagem — orçamento único

| | |
|---|---|
| 🎚️ **Total configurável** | 9 presets publicados (25 *Fraco*, 50 *Comum*, 75 *Competente*, 100 *Profissional*, 150 *Herói Padrão*, 250 *Cinematográfico*, 400 *Lendário*, 600 *Super-humano*, 1.000 *Divino*), **campo livre** (mínimo 25, sem teto) e ajustes rápidos de **±10 / ±50** |
| 🧮 **Um orçamento só** | Atributos, aparência, status, vantagens, perícias, **poderes** e mágicas saem do **mesmo total**: gastou em atributo, sobra menos em poder. Desvantagens e peculiaridades **devolvem** pontos; manobras e empunhadura são **grátis** |
| 🪜 **Faixas de campanha** | O total situa o personagem numa das 8 faixas ("Abaixo de 25 · Fraco/Crianças/Zumbis" … "500 a 1.000+ · Super-humano/Divino") |
| 🔒 **Travamento de gasto** | Compra que estoura o orçamento é **bloqueada com o motivo** (quanto falta e onde aumentar) e não grava nada; `config.permitirEstourarPontos` troca o bloqueio por aviso |
| 🎭 **Peculiaridades** | Catálogo de **52** (32 do material-base p. 88–89 + 20 de campanha), máx. 5, −1 ponto cada |
| 📍 **Onde aparece** | **Widget no topo da ficha** (total · gastos · livres + barra + faixa + presets + ±10/±50), painel **Pontos** em *Configurações* (breakdown por categoria, extras ganhos, modo do orçamento), teto correto na aba **Poderes** e duas seções no capítulo *Criação* do livro |

> O modo **separado** (orçamento próprio de pontos de poder por nível de saga, como publicado em `data/poderes.json`) continua disponível em *Configurações → Orçamento* — o conflito está registrado em `data/rules.json → conflitos` (`pontos-orcamento-poderes`).

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
app/engine/*.js      ← TODO cálculo (resolução d20, derivados, dano/GD, manobras,
      │                poderes, categorias, proezas, magia, fadiga, vantagens,
      │                perícias G.A.U. (custo em pontos, pré-definidos, familiaridade),
      │                pontos (orçamento único, presets, faixas, travamento de gasto),
      │                personagem, além do legado: atributos, perícias 3d, carga,
      │                combate 3d, economia, requisitos) — cada valor sai com "breakdown"
      │
app/engine/engine.js ← computeAll(db, personagem) — fachada única da UI
      │
app/engine/book-index.js ← índice de pesquisa derivado dos MESMOS dados
      │
app/ui/              ← desenha e chama o engine. Zero fórmulas.
app/main.js          ← SPA hash-routing (Livro · Ficha · Combate), sem frameworks
```

- Mudou um atributo → secundários, parâmetros, perícias, dano, carga, deslocamento, defesas, fadiga, poderes e magia **recalculam sozinhos**.
- **Inicialização à prova de falha**: `DB.load()` busca `data/*.json` com nova tentativa, é repetível (só recarrega o que falhou) e registra cada arquivo com problema em `DB.erros`; se algo não carregar, a página mostra **qual arquivo falhou** e um botão *↻ Tentar novamente* — as fórmulas devolvem `null`/`—` em vez de quebrar, e a migração das fichas só roda **depois** do banco carregado (`store.inicializar()`), nunca contra dados ausentes.
- **Perícias em lote**: marque várias linhas (ou "☑ Marcar filtradas" depois de um filtro/pesquisa), escolha quantos níveis e compre tudo **numa gravação só** — a barra inferior mostra o custo total e o que resta do orçamento, e o plano lista o motivo de cada perícia que ficou de fora (pré-requisito, NT mínimo, limite de criação 2 × idade, pontos). A descrição publicada aparece **inteira** na linha (2 linhas recolhidas, clique expande; há também o interruptor *texto completo*) e a pesquisa/filtros **sobrevivem** à re-renderização — comprar não apaga mais o que você tinha filtrado.
- Ação impossível é **bloqueada com o motivo exato** ("Mana Nula: nenhuma mágica funciona", "personagem Mundano não realiza testes de categoria superior", "Dinheiro insuficiente: tem $500, preço $550 (**faltam $50**)").
- Valores intermediários **nunca arredondados**, exceto onde o material manda.
- Todo número calculado tem tooltip **"como este valor foi calculado"**.
- Onde o material se contradiz, os **dois lados são calculados** e a escolha fica em `config` (ex.: critério de disputa, resolução de magia).

### Ferramentas

- `tools/extract_data.py` — extrai o bruto do PDF-fonte para `analysis/outdata/`
- `tools/build_data.py` — gera `data/*.json` do material legado (reproduzível: rode de novo e o diff é vazio). **Não** gera `advantages.json`, `vantagens.json`, `skills.json` nem `pericias.json`: esses vêm das publicações oficiais G.A.U. de vantagens (canal #『📕』vantagens) e de perícias (canal #『📕』perícias) e são preservados (e conferidos) pelo script.

### Testes

```bash
node tests/run.mjs        # 369 testes do engine vs. exemplos do próprio material
node tests/filters.mjs    # 17 testes de AND/OR/NOT, texto, intervalos e presets
node tests/smoke_ui.mjs   # 13 páginas, 13 capítulos × 4 rotas, 2 modos de combate, interações da aba Dados,
                          # painel G.A.U. de perícias, pontos na UI (widget, painel, catálogo de
                          # peculiaridades), CLIQUES REAIS de compra em todas as abas que gastam pontos
                          # (vantagens/desvantagens/peculiaridades/atributos/magias/perícias/poderes),
                          # as 13 páginas renderizadas com a ficha completa nos modelos G.A.U. e legado,
                          # capítulos Perícias/Criação, bootstrap (app/main.js) e as 1124 rotas do índice
node tests/smoke_dados_faltando.mjs   # boot com data/*.json fora do ar: aviso nomeando os arquivos,
                          # páginas em "—", ficha antiga preservada e DB.recarregar() rebuscando só o que falhou
```

Exemplos validados: personagem-modelo Dai (ST8/DX15/IQ12/HT12 = 85 pts), margens de sucesso 1–20, crítico = referência, bloqueio por categoria, disputas pelos dois critérios, GD1/GD2/GD3, PV = ST × HT, 55 nós da árvore de manobras, empunhaduras, PREC, dano das 64 armas, Limiar de Dano/PE dos 7 materiais, NT, custos e validação de poderes (máx. 3 condições), mana/rituais/toque do mago, proezas físicas (salto, escalada, levantamento, arremesso, cavar, natação), sentidos, pânico 4–40+, **65 vantagens oficiais** (custos por nível, efeitos em sentidos/defesas/RD/vontade/pânico/resistências/atributos efetivos/IQ mágico, requisitos, incompatibilidades, unicidade), **176 perícias oficiais** (custo publicado + 1 ponto por nível, limite de criação 2 × idade, pré-definidos sem encadeamento nos três modos de leitura, modificadores de vantagem/carga/especialista/familiaridade, compra bloqueada por pré-requisito e NT), migração de personagens antigos (ids normalizados, pontos de perícia convertidos em nível, `VERSAO_FICHA` 4) e **38 casos do sistema de pontos** (presets 25→1.000, faixas de campanha, mínimo/passos/sem teto, orçamento único com poder de 90 pts saindo do total de 150, modo separado, travamento de gasto sem efeito colateral, desvantagens que devolvem pontos, estouro permitido por config e resumo do widget) + 5 checagens dos dados novos + **contrato que a aba ⚖️ Vantagens & Desvantagens lê do engine** (`validarVantagens` → `{ ok, erros, avisos }` e as 21 chaves de `resumoDasVantagens`), para um campo renomeado no engine nunca mais derrubar a compra na UI.

## O que o material não define (e o que fizemos)

Política: **nada é inventado**. Itens ausentes ficam marcados e a arquitetura aceita a regra quando publicada — o registry completo (15 itens) está em `data/rules.json → naoDefinidas` e aparece em *Configurações → Regras não definidas*:

- Nomes oficiais das Categorias de Poder acima de Mundano
- Como combinar os d20 adicionais de uma categoria superior (soma, melhor dado ou por dado — `config.modoEscala`)
- Margens de sucesso para referências acima de 20
- Tabela de Localização de Acerto (publicada como **imagem** — só as notas textuais foram capturadas)
- Custo dos níveis adicionais dos itens escalonáveis do construtor de poderes
- Valores numéricos dos parâmetros ATQ/ESQ/DSL/APAR/BLOQ além da referência publicada
- Orçamento de pontos de poder por nível de saga (o material dá 150 como exemplo)
- PREC para armas corpo a corpo
- Custo de atributos acima de 20
- Encontrões (citados como regra separada, ainda não publicada)
- Do material legado: tabela de armas corpo-a-corpo, Golpes Fulminantes / Erros Críticos, preços da Lista de Equipamentos, fator de revenda, evolução pós-criação

Tabelas reconstruídas a partir de regra **textual** (não inventadas) carregam `_aviso: "TABELA RECONSTRUÍDA"`. Conflitos entre publicações ficam em `data/rules.json → conflitos`, com a resolução adotada e a fonte de cada lado.

## Análise do material

O mapa completo das regras — **Parte I** (material 3d6, 17 seções com páginas citadas) e **Parte II** (material G.A.U., §18–§29 com canal/data de origem e o mapa arquivo → motor → interface) — está em [`docs/analise/01-mapa-de-regras.md`](docs/analise/01-mapa-de-regras.md).

---

*Material-base: publicações do sistema **G.A.U. RPG** (2026) e GURPS® Basic Set, 3ª edição (PT-BR, 370 pp.), usados como fonte privada de mesa. GURPS® é marca registrada de seus detentores; este projeto não tem afiliação nem distribui o material original.*
