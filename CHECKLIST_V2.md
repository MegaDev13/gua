# GAU — Checklist do que falta / Auditoria v2.2-magias-custom

Data: 2026-08-30

## ✅ Implementado (conforme pedido)

- [x] **Manobras de combate NÃO custam pontos** — `CUSTOS.manobra=0`, `CUSTOS.empunhadura=0`, UI mostra "GRÁTIS" em builder, ficha, PDF, pontos widget. Cálculo em `points-system.js` retorna 0.
- [x] **Travamento de gasto de pontos** — builder verifica `computed.pontos.disponivel` antes de aumentar atributo/perícia/potência/escola/magia. Botões desabilitados com `disabled` e `ghost` quando sem pontos, toast "Sem pontos!". `onPatch` bloqueia se `totalGasto` excede e é aumento.
- [x] **Poderes custom** — Formulário "Criar Seu Próprio Poder" com nome, sigla, custo 5/3, potência inicial, fonte, foco, descrição. Salvo em `char.poderes[id].custom=true` com `custo` próprio. Custo calculado via `dados.custo ?? def.custo`. Lista separada na ficha com ícone 🧩 e borda vermelha. Pode adicionar perícia psi custom por poder.
- [x] **Aba Magias** — Novo `data/magics.json` com 8 escolas: fogo, água, ar, terra, luz, trevas, mente, tempo (5 pts). Cada com 2-3 magias exemplo. Regras: custo, concentração, grimório. Capítulo 6 no `book.json` gerado automaticamente. `db.js` FILES inclui magics, search index inclui escolas/magias. Builder step `magias` (STEPS[5]) com UI igual poderes: nível escola (3 pts), magias individuais (2 pts), criar magia custom por escola, criar escola custom. `character-calculator` inclui `magiasCalc` e `custoMagias`. Ficha, PDF, PNG, JSON incluem magias.
- [x] **Pontos visuais** — Widget no topbar mostra totais/gastos/livres + barra + presets + +/-10/50. Barra em todas etapas. Final com tabela detalhada (atributos, perícias, manobras GRÁTIS, empunhadura GRÁTIS, poderes, magias).
- [x] **Export PDF/PNG/JSON** — PDF inclui magias e poderes custom (borda accent, ícone 🧩). PNG via html2canvas, JSON via download.
- [x] **Busca, filtros, glossário, modo livro** — Search index inclui magias, filtros preservados, glossário atualizado com termos novos (Manobras GRÁTIS, Pontos Travados, Poder Custom, Magia Custom etc).
- [x] **GitHub Pages 100% client-side** — sem backend, localStorage, fetch relativo, 404.html, cache-buster v2.2-magias-custom.

## 🔍 O que falta / Melhorias sugeridas (não bloqueantes, mas para 100% completo)

### Prioridade ALTA — Regras do PDF anexado
- [ ] **Ler PDF Nota_08_22_2026_21_08_42.pdf** — arquivo não foi persistido em `/home/user/uploads` (arena bug). Usuário precisa re-anexar para auditarmos se há regras novas de combate montado/proezas que ainda não estão em `book.json`. No momento usamos dados de `maneuvers.json` genéricos.
- [ ] **Combate Montado e Proezas** — capítulos 2 e 3 existem em `book.json`? Verificar se vieram do PDF final. Se não, gerar de dados novos.
- [ ] **Tabelas completas** — `tables.json` contém carga e deslocamento, mas faltam tabelas de dano detalhadas por arma (já temos em weapons.json) e de pânico/vontade mencionadas no livro.

### Prioridade MÉDIA — UX Builder
- [ ] **Validação de perícias custom vs atributos** — hoje aceita qualquer valor, mas poderia sugerir base IQ/DX/ST conforme nome.
- [ ] **Importar/Exportar personagem individual** — JSON já funciona, mas falta botão "Importar JSON" na página Meus Personagens (só backup total hoje).
- [ ] **Desfazer (undo) no builder** — draft salvo, mas sem histórico.
- [ ] **Modo impressão ficha** — CSS print já existe mas precisa testar margens para magias longas.

### Prioridade BAIXA — Conteúdo
- [ ] **Imagens do livro** — só capa.svg. Poderia adicionar ilustrações por capítulo em `book/images/`.
- [ ] **Tutorial interativo** — tour guiado na primeira visita explicando pontos travados e magias.
- [ ] **Testes automatizados** — criar `tests/points.test.js` para garantir que manobra=0 nunca regresse.
- [ ] **PWA / offline** — adicionar service worker para funcionar offline total no Pages.

### Checklist Técnico GitHub Pages
- [x] `index.html` usa caminhos relativos `./data/` e `./js/` — OK
- [x] `404.html` redireciona para `index.html` — existe
- [x] `db.js` tenta múltiplas bases (`./`, `/gua/`, origin) — OK
- [x] `js/app.js?v=v2.2` cache-buster — atualizado
- [ ] Verificar se branch `arena/01a0543b-gua` está configurada como source no Pages (usuário precisa checar em Settings > Pages)
- [ ] Testar em modo anônimo após push — aguardar 2-3 min deploy

## 📦 Próximos passos sugeridos
1. Re-anexar PDF Nota_08_22_2026 para extrair combate montado e proezas 100% verbatim.
2. Rodar `npm run build`? Não há build, mas validar `data/book.json` tem 7 capítulos (0 capa,1 testes,2 combate montado,3 proezas,4 sistema combate,5 poderes,6 magias).
3. Adicionar botão "Importar Personagem JSON" em `renderMeusPersonagens`.
4. Criar página `/testes` simples para CI.

---
Gerado automaticamente após v2.2-magias-custom.
