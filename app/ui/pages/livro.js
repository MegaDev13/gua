/* LIVRO DIGITAL — produto de leitura independente da ficha.
 * Conteúdo editorial em data/book.json; regras e catálogos vêm da mesma base da ficha.
 */
import { el, toast } from '../ui.js';
import { store } from '../store.js';
import { createFilterPanel } from '../filters.js';
import { buildBookIndex } from '../../engine/book-index.js';
import { novoItem } from '../../engine/economy.js';
import { abrirExportacaoLivro, exportarPaginaLivroPNG } from '../book-export.js';

const READING_KEY = 'gua.book.reading.v2';
let cleanupReader = null;

export function renderLivro(main, { db, params = [] }) {
  cleanupReader?.();
  cleanupReader = null;
  document.body?.classList?.add('book-experience');
  document.body?.classList?.remove('book-reading-mode');

  const chapters = db.book?.capitulos || [];
  const view = params[0] || 'capa';
  if (view === 'sumario') return renderSummary(main, db, chapters);
  if (view === 'pesquisar') return renderSearch(main, db, chapters, false);
  if (view === 'rapida') return renderSearch(main, db, chapters, true);
  if (view === 'continuar') {
    const saved = readProgress();
    const chapter = chapters.find(c => c.id === saved?.chapterId) || chapters[0];
    return renderReader(main, db, chapters, chapter, saved?.sectionId, true);
  }
  if (view === 'ler') {
    const chapter = chapters.find(c => c.id === params[1]) || chapters[0];
    return renderReader(main, db, chapters, chapter, params[2], false);
  }
  // Compatibilidade com URLs antigas: #/livro/combate
  const legacy = chapters.find(c => c.id === view);
  if (legacy) return renderReader(main, db, chapters, legacy, params[1], false);
  return renderCover(main, db, chapters);
}

function renderCover(main, db, chapters) {
  const book = db.book || {};
  const saved = readProgress();
  const lastChapter = chapters.find(chapter => chapter.id === saved?.chapterId);
  const first = chapters[0];
  main.append(el('div', { class: 'book-home' },
    el('section', { class: 'book-cover-stage', 'aria-labelledby': 'book-title' },
      el('div', { class: 'book-cover-art' },
        el('img', { src: book.capa || 'book/images/capa.svg', alt: 'Um antigo livro de regras sobre uma mesa de jogo' }),
        el('span', { class: 'book-cover-edition' }, book.edicao || 'Edição Digital')),
      el('div', { class: 'book-cover-copy' },
        el('p', { class: 'book-overline' }, 'Livro de regras · referência de mesa'),
        el('h1', { id: 'book-title' }, book.titulo || 'GUA'),
        el('h2', {}, book.subtitulo || 'Livro de Regras Digital'),
        el('div', { class: 'book-ornament', 'aria-hidden': 'true' }, '◆'),
        el('p', { class: 'book-cover-description' }, book.descricao || ''),
        el('p', { class: 'book-version' }, `${book.edicao || ''} · versão ${book.versao || db.rules?.versao || '1'}`),
        el('div', { class: 'book-cover-actions' },
          actionLink(saved ? 'Continuar lendo' : 'Começar a ler', saved ? '#/livro/continuar' : `#/livro/ler/${first?.id || 'apresentacao'}`, 'primary', '→'),
          actionLink('Sumário', '#/livro/sumario', '', '☰'),
          actionLink('Pesquisar', '#/livro/pesquisar', '', '⌕'),
          saved ? actionLink('Última leitura', '#/livro/continuar', 'continue', '↳') : el('span', { class: 'book-action disabled', title: 'Comece a leitura para salvar seu progresso' }, '↳ Última leitura'),
        ),
        saved && lastChapter ? el('p', { class: 'book-last-reading' },
          'Última leitura: ', el('b', {}, `Capítulo ${lastChapter.numero} — ${lastChapter.titulo}`),
          saved.percent != null ? ` · ${Math.round(saved.percent)}% do livro` : '') : '',
      )),
    el('section', { class: 'book-home-features', 'aria-label': 'Recursos do livro' },
      feature('ENSINAR', 'Hierarquia editorial, exemplos, caixas de regra e contexto para quem está começando.'),
      feature('CONSULTAR', 'Pesquisa acentuada, filtros combináveis e modo rápido para não interromper a sessão.'),
      feature('REFERENCIAR', 'Regras, perícias, magias e equipamentos ligados diretamente à ficha ativa.')),
    el('details', { class: 'book-changelog' },
      el('summary', {}, `Notas da versão ${book.versao || '1'}`),
      el('ul', {}, (book.alteracoes || []).map(change => el('li', {}, change)))),
    el('footer', { class: 'book-home-footer' },
      el('span', {}, `${chapters.length} capítulos · conteúdo salvo apenas neste dispositivo`),
      actionLink('Ir para a ficha', '#/personagem', 'quiet', '🧙')),
  ));
}

function renderSummary(main, db, chapters) {
  main.append(bookSubHeader('Sumário', 'Nove caminhos para aprender e consultar o sistema.'),
    el('div', { class: 'book-summary-layout' },
      el('aside', { class: 'book-summary-note' },
        el('span', { class: 'book-dropcap' }, 'G'),
        el('p', {}, 'Leia em sequência para aprender o sistema ou salte diretamente para a referência necessária durante a sessão.'),
        actionLink('⌕ Pesquisar no livro', '#/livro/pesquisar', 'primary'),
        actionLink('⚡ Consulta rápida', '#/livro/rapida')),
      el('ol', { class: 'book-summary-list' }, chapters.map(chapter => el('li', {},
        el('a', { href: `#/livro/ler/${chapter.id}` },
          el('span', { class: 'book-summary-number' }, chapter.numero),
          el('span', { class: 'book-summary-copy' },
            el('b', {}, chapter.titulo),
            el('small', {}, chapter.subtitulo),
            el('em', {}, chapter.resumo)),
          el('span', { class: 'book-summary-arrow', 'aria-hidden': 'true' }, '→')),
        el('div', { class: 'book-summary-sections' }, (chapter.secoes || []).map(section =>
          el('a', { href: `#/livro/ler/${chapter.id}/${section.id}` }, section.titulo))))))),
    chapterFooterLinks('#/livro', '#/livro/pesquisar', 'Capa', 'Pesquisar'));
}

function renderSearch(main, db, chapters, quick) {
  const index = buildBookIndex(db);
  const results = el('div', { class: quick ? 'book-quick-results' : 'book-search-results' });
  const title = quick ? 'Consulta rápida' : 'Pesquisa no livro';
  const subtitle = quick
    ? 'Regras, tabelas, custos e ações para encontrar uma resposta em poucos cliques.'
    : `Pesquise em ${index.length} capítulos, seções, regras e verbetes — sem precisar saber o nome exato.`;

  const schema = [
    { key: 'categories', label: 'Categorias', type: 'multi' },
    { key: 'chapter', label: 'Capítulos', type: 'multi', exclude: false },
    { key: 'kind', label: 'Tipo de conteúdo', type: 'multi' },
  ];
  const filters = createFilterPanel({
    id: quick ? 'book-quick' : 'book-search', items: index, schema,
    searchFields: ['title', 'text', 'chapter', 'categories', 'kind'],
    searchPlaceholder: quick ? 'Qual regra você precisa agora?' : 'Pesquisar no livro… ex.: fadiga, espada, defesa',
    quickFilters: [
      { label: 'Combate', apply: state => state.groups.categories.include = ['Combate'] },
      { label: 'Magia', apply: state => state.groups.categories.include = ['Magia'] },
      { label: 'Equipamentos', apply: state => state.groups.categories.include = ['Equipamentos'] },
      { label: 'Perícias', apply: state => state.groups.categories.include = ['Perícias'] },
      { label: 'Tabelas', apply: state => state.groups.kind.include = ['Tabela'] },
      { label: 'Regras', apply: state => state.groups.kind.include = ['Regra'] },
    ],
    onChange: docs => drawSearchResults(results, docs, quick),
  });

  main.append(bookSubHeader(title, subtitle, quick ? '⚡' : '⌕'),
    el('div', { class: `book-search-shell ${quick ? 'quick' : ''}` },
      filters.node,
      results),
    chapterFooterLinks('#/livro/sumario', quick ? '#/livro/pesquisar' : '#/livro/rapida', 'Sumário', quick ? 'Pesquisa completa' : 'Consulta rápida'));
}

function drawSearchResults(root, docs, quick) {
  root.innerHTML = '';
  if (!docs.length) {
    root.append(el('div', { class: 'book-empty' }, el('b', {}, 'Nenhum trecho encontrado.'), el('p', {}, 'Remova um filtro ou tente palavras relacionadas.')));
    return;
  }
  for (const doc of docs.slice(0, quick ? 80 : 140)) root.append(el('article', { class: 'book-search-result' },
    el('div', { class: 'book-result-meta' },
      el('span', { class: `book-kind kind-${doc.kind.toLowerCase()}` }, doc.kind),
      el('span', {}, doc.chapter), doc.page ? el('span', {}, `p. ${doc.page}`) : ''),
    el('h2', {}, el('a', { href: doc.route }, doc.title)),
    doc.excerpt ? el('p', {}, doc.excerpt + (doc.text.length > doc.excerpt.length ? '…' : '')) : '',
    el('div', { class: 'book-result-tags' }, doc.categories.slice(0, 5).map(tag => el('span', {}, tag))),
    el('a', { class: 'book-result-open', href: doc.route }, 'Abrir trecho →')));
  if (docs.length > (quick ? 80 : 140)) root.append(el('p', { class: 'book-result-limit' }, `Mostrando os primeiros ${quick ? 80 : 140} de ${docs.length} resultados. Refine a pesquisa.`));
}

function renderReader(main, db, chapters, chapter, targetSection, restorePosition) {
  if (!chapter) return renderCover(main, db, chapters);
  const currentIndex = chapters.findIndex(candidate => candidate.id === chapter.id);
  const previous = chapters[currentIndex - 1];
  const next = chapters[currentIndex + 1];
  const article = el('article', { class: 'book-page', 'data-chapter': chapter.id });
  renderChapter(article, chapter, db);

  const progressFill = el('i', { style: 'width:0%' });
  const progressLabel = el('span', {}, `Capítulo ${currentIndex + 1} de ${chapters.length}`);
  const progress = el('div', { class: 'book-progress no-print', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
    el('div', { class: 'book-progress-track' }, progressFill), progressLabel);

  const toc = el('aside', { class: 'book-reader-toc no-print', 'aria-label': 'Sumário do livro' },
    el('div', { class: 'book-toc-brand' }, el('a', { href: '#/livro' }, 'GUA'), el('small', {}, db.book.edicao || 'Livro Digital')),
    el('a', { class: 'book-toc-all', href: '#/livro/sumario' }, '☰ Sumário completo'),
    el('nav', {}, chapters.map(item => el('div', { class: 'book-toc-chapter' },
      el('a', { class: item.id === chapter.id ? 'active' : '', href: `#/livro/ler/${item.id}` },
        el('span', {}, item.numero), item.titulo),
      item.id === chapter.id ? el('div', { class: 'book-toc-sections' }, (item.secoes || []).map(section =>
        el('a', { href: `#/livro/ler/${item.id}/${section.id}`, dataset: { section: section.id } }, section.titulo))) : ''))));

  const modeButton = el('button', { class: 'book-tool', type: 'button' }, '▣ Modo de leitura');
  modeButton.onclick = () => {
    const on = document.body.classList.toggle('book-reading-mode');
    modeButton.textContent = on ? '✕ Sair da leitura' : '▣ Modo de leitura';
  };
  const toolbar = el('div', { class: 'book-reader-toolbar no-print', 'aria-label': 'Ferramentas do livro' },
    el('a', { class: 'book-tool', href: '#/livro/pesquisar' }, '⌕ Pesquisar'),
    el('a', { class: 'book-tool', href: '#/livro/rapida' }, '⚡ Consulta rápida'),
    modeButton,
    el('button', { class: 'book-tool', type: 'button', onclick: () => abrirExportacaoLivro({ db, chapters, currentChapter: chapter, renderChapter }) }, '⇩ Exportar PDF'),
    el('button', { class: 'book-tool', type: 'button', onclick: () => exportarPaginaLivroPNG(chapter, article, db.book) }, '▧ Página PNG'));

  article.append(el('nav', { class: 'book-chapter-nav no-print', 'aria-label': 'Navegação entre capítulos' },
    previous ? actionLink(`← ${previous.titulo}`, `#/livro/ler/${previous.id}`, 'previous') : el('span', {}),
    actionLink('Sumário', '#/livro/sumario', 'summary'),
    next ? actionLink(`${next.titulo} →`, `#/livro/ler/${next.id}`, 'next') : actionLink('Voltar à capa', '#/livro', 'next')));

  main.append(progress, toolbar, el('div', { class: 'book-reader-shell' }, toc, article));
  cleanupReader = setupReadingProgress(article, toc, progress, progressFill, progressLabel, chapter, chapters, targetSection, restorePosition);
}

/** Usado também pelo compositor de impressão por callback. */
function renderChapter(article, chapter, db, options = {}) {
  article.append(
    el('header', { class: 'book-running-header' },
      el('span', {}, db.book.titulo || 'GUA'),
      el('span', {}, chapter.titulo)),
    el('section', { class: `book-chapter-opening ${chapter.ilustracao ? 'illustrated' : ''}` },
      chapter.ilustracao ? el('img', { src: chapter.ilustracao, alt: '', class: 'book-chapter-image' }) : '',
      el('div', { class: 'book-opening-copy' },
        el('p', { class: 'book-chapter-label' }, `Capítulo ${chapter.numero}`),
        el('h1', {}, chapter.titulo),
        el('p', { class: 'book-chapter-subtitle' }, chapter.subtitulo),
        el('div', { class: 'book-ornament', 'aria-hidden': 'true' }, '◆'),
        el('p', { class: 'book-chapter-lede' }, chapter.resumo),
        el('p', { class: 'book-source' }, chapter.fonte))),
  );

  const renderer = CHAPTER_RENDERERS[chapter.id] || renderManifestSections;
  renderer(article, db, chapter, options);
  if (options.print) article.querySelectorAll('details').forEach(details => { details.open = true; });
  article.append(el('footer', { class: 'book-page-footer' },
    el('span', {}, `${db.book.edicao || 'Edição Digital'} · v${db.book.versao || '1'}`),
    el('span', {}, `Capítulo ${chapter.numero}`)));
}

const CHAPTER_RENDERERS = {
  apresentacao(article, db) {
    section(article, 'bem-vindo', 'Bem-vindo ao GUA',
      el('p', { class: 'book-drop-paragraph' }, 'Este livro foi organizado para acompanhar dois ritmos: a leitura tranquila de quem aprende e a consulta direta de quem já está em jogo. O conteúdo apresentado aqui vem do mesmo banco que alimenta a ficha de personagem.'),
      editorialBox('note', 'TRÊS FORMAS DE USAR',
        el('ul', {}, el('li', {}, el('b', {}, 'Aprender:'), ' siga os capítulos em ordem.'), el('li', {}, el('b', {}, 'Consultar:'), ' use pesquisa e filtros.'), el('li', {}, el('b', {}, 'Referenciar:'), ' abra um verbete e siga seus vínculos.'))));
    section(article, 'fonte-verdade', 'Uma única fonte de verdade',
      editorialBox('rule', 'REGRA EDITORIAL', el('p', {}, 'Livro, ficha e motores de cálculo leem os mesmos arquivos de dados. Uma alteração válida de regra precisa aparecer em todas essas experiências.')),
      el('p', {}, 'As prioridades registradas para o projeto são:'),
      el('ol', { class: 'book-numbered' }, (db.rules?.principios || []).map(item => el('li', {}, item))),
      editorialBox('warning', 'REGRA NÃO DEFINIDA',
        el('p', {}, 'Quando o material disponível não publica um valor, o sistema marca a lacuna e bloqueia cálculos dependentes em vez de inventar uma resposta.'),
        el('details', {}, el('summary', {}, 'Ver lacunas registradas'), el('ul', {}, (db.rules?.naoDefinidas || []).map(item => el('li', {}, item))))));
    section(article, 'o-que-mudou', 'O que mudou nesta edição',
      el('p', {}, 'O material G.A.U. (2026) passa a ser a fonte primária; o PDF de GURPS 3ª edição permanece como material subsidiário, usado apenas onde o sistema novo não publica um valor.'),
      el('ul', {}, (db.book?.alteracoes || []).map(item => el('li', {}, typeof item === 'string' ? item : item.texto || item.titulo || JSON.stringify(item)))),
      editorialBox('important', 'FONTES E PRIORIDADE',
        el('ul', {}, (db.rules?.material || []).map(m => el('li', {}, el('b', {}, `${m.nome || m.id}: `), `${m.papel || ''} ${m.descricao || ''}`)))),
      editorialBox('warning', 'CONFLITOS REGISTRADOS',
        el('p', {}, 'Quando as duas fontes divergem, o conflito fica registrado em vez de ser resolvido em silêncio.'),
        el('ul', {}, (db.rules?.conflitos || []).map(c => el('li', {}, el('b', {}, `${c.id}: `), c.resolucao || c.descricao || '')))));
    section(article, 'como-consultar', 'Como consultar',
      el('div', { class: 'book-instruction-grid' },
        instruction('⌕', 'Pesquisa', 'Procura nome, descrição, categoria e referência, ignorando acentos.'),
        instruction('☷', 'Filtros', 'Combina opções com OR dentro de um grupo e AND entre grupos.'),
        instruction('⚡', 'Modo rápido', 'Prioriza regras, tabelas e números durante a sessão.'),
        instruction('↗', 'Vínculos', 'Leva do livro à ficha ou ao banco correspondente.')));
  },

  criacao(article, db) {
    const ficha = db.ficha || {};
    const blocos = ficha.blocos || [];
    const secundarios = blocos.find(b => b.id === 'secundarios') || {};
    const params = blocos.find(b => b.id === 'parametros') || {};
    section(article, 'atributos', 'Atributos',
      el('p', {}, 'Os quatro atributos básicos determinam a capacidade do personagem e são a referência direta das jogadas: o próprio valor do atributo define a margem de sucesso.'),
      editorialBox('rule', 'CUSTO DE ATRIBUTO', el('p', {}, 'O custo depende do valor final do atributo. Valores acima do limite publicado permanecem marcados como não definidos.')),
      keyValueTable('Valor', 'Custo em pontos', db.tables.custoAtributos?.tabela || {}),
      editorialBox('warning', 'LIMITE PUBLICADO', el('p', {}, db.tables.custoAtributos?.progressao || '—')));
    section(article, 'secundarios', 'Atributos secundários',
      el('p', {}, secundarios.descricao || 'Valores derivados que aparecem na planilha oficial de personagem.'),
      scrollTable(['Secundário', 'Nome', 'Conta', 'Operandos'], (secundarios.contas || []).map(c => [c.id, c.nome, c.formula, (c.operandos || []).join(' · ')])),
      editorialBox('rule', 'PV = ST × HT', el('p', {}, 'Pontos de Vida são o produto de Força e Vigor; ferimentos reduzem PV. Pontos de Fadiga são iguais a HT.')),
      source(secundarios.fonte));
    section(article, 'parametros-ficha', 'Parâmetros da planilha',
      scrollTable(['Parâmetro', 'Nome', 'Base publicada', 'Fonte'], (params.definicoes || []).map(d => [d.id, d.nome, d.base, d.fonte])),
      params._aviso ? editorialBox('warning', 'REGRA NÃO DEFINIDA', el('p', {}, params._aviso)) : '');
    section(article, 'evolucao', 'Evolução do personagem',
      el('p', {}, ficha.evolucao?.regra || ''),
      el('ul', {}, (ficha.evolucao?.elementos || []).map(e => el('li', {}, el('b', {}, `${e.nome}: `), e.papel || ''))));
    section(article, 'custos-pericias', 'Custos de perícias',
      el('p', {}, 'A dificuldade e a natureza física ou mental determinam quantos pontos são necessários para cada nível relativo ao atributo-base.'),
      skillCostTable('Perícias físicas', db.tables.custoPericias?.fisicas),
      skillCostTable('Perícias mentais', db.tables.custoPericias?.mentais));
    section(article, 'fluxo-criacao', 'Fluxo de criação',
      el('ol', { class: 'book-steps' }, (db.poderes?.criacao?.passos || []).map((passo, i) =>
        step(String(i + 1).padStart(2, '0'), passo.titulo, passo.texto))),
      el('p', { class: 'book-source' }, db.poderes?.criacao?.titulo || ''),
      actionLink('Abrir criação na ficha', '#/personagem', 'inline', '🧙'),
      actionLink('Construir um poder', '#/poderes', 'inline', '🌀'));
    section(article, 'modelo-ficha', 'Modelo da planilha de personagem',
      el('p', {}, ficha.titulo || 'Planilha oficial G.A.U.'),
      scrollTable(['Bloco', 'Conteúdo'], blocos.map(b => [b.titulo || b.id, (b.colunas || b.campos || b.grupos || []).join(' · ') || b.descricao || '—'])),
      editorialBox('note', 'CABEÇALHO', el('p', {}, (ficha.cabecalho?.campos || []).join(' · '))),
      source(ficha._fonte));
  },

  pericias(article, db) {
    section(article, 'ler-pericia', 'Como ler uma perícia',
      editorialBox('rule', 'NÍVEL EFETIVO', el('p', {}, 'O motor combina atributo-base, pontos investidos, melhor default aplicável e modificadores ativos. Clique em um valor na ficha para ver esse cálculo.'), actionLink('Ver minhas perícias', '#/pericias', 'inline')),
      el('p', {}, `O catálogo contém ${db.skills.length} perícias. Os filtros da ficha permitem combinar atributo, categoria, dificuldade, treinamento e disponibilidade.`));
    const groups = Object.groupBy ? Object.groupBy(db.skills, skill => skill.categoria || 'Outras') : groupBy(db.skills, skill => skill.categoria || 'Outras');
    const catalogGroups = Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([category, skills]) => {
        const rows = skills.map(skill => [
          el('div', { id: `pericia-${skill.id}`, class: 'book-anchor' }, el('b', {}, skill.nome), el('small', {}, skill.descricao || ''), source(skill.fonte)),
          `${skill.tipo === 'Física' ? 'Fís.' : 'Men.'}/${skill.dificuldade}`,
          (skill.defaults || []).join(' · ') || '—',
          (skill.prereqs || []).join('; ') || '—',
          el('button', { class: 'book-add no-print', onclick: () => addSkill(skill) }, '+ Ficha'),
        ]);
        return el('details', { class: 'book-catalog-group' },
          el('summary', {}, `${category} `, el('span', {}, skills.length)),
          scrollTable(['Perícia', 'Tipo', 'Default', 'Pré-requisitos', ''], rows));
      });
    section(article, 'catalogo-pericias', 'Catálogo de perícias', ...catalogGroups);
  },

  vantagens(article, db) {
    const cap = db.vantagens || {};
    const definicao = cap.definicao || {};
    const porGrupo = grupo => db.advantages.filter(item => (item.grupo || 'classica') === grupo);
    const rotuloGrupo = { classica: 'Clássicas', social: 'Custo variável (definido em jogo)', nova: 'Novas Vantagens (16/08/2026)' };

    /* verbete de vantagem: efeitos estruturados, níveis, requisitos e incompatibilidades */
    const verbete = item => el('article', { class: 'book-definition', id: `vantagem-${item.id}` },
      el('div', { class: 'book-definition-head' },
        el('h3', {}, item.nome, item.unicidade ? el('small', { class: 'book-tag' }, ` · ${item.unicidade}`) : ''),
        el('b', {}, item.custo || 'variável')),
      el('p', {}, item.descricao || ''),
      (item.efeitos || []).length ? el('div', { class: 'book-subtable' }, el('h4', {}, 'Efeitos no motor'),
        el('ul', {}, item.efeitos.map(efeito => el('li', {},
          el('b', {}, rotuloEfeitoVantagem(efeito)),
          efeito.descricao ? ` — ${efeito.descricao}` : '',
          efeito.condicao ? el('small', {}, ` (${efeito.condicao})`) : '')))) : '',
      Array.isArray(item.niveis) && item.niveis.length ? el('div', { class: 'book-subtable' }, el('h4', {}, 'Níveis'),
        scrollTable(['Nível', 'Custo', 'Efeito'], item.niveis.map(nivel => [
          nivel.nome, nivel.custo != null ? `${nivel.custo} pts` : '—', nivel.efeito || '—']))) : '',
      (item.requisitos || []).length ? el('p', { class: 'book-source' }, el('b', {}, 'Requisitos: '), item.requisitos.join('; ')) : '',
      (item.incompativel || []).length ? el('p', { class: 'book-source' }, el('b', {}, 'Incompatível: '),
        item.incompativel.map(id => db.advantageCompat(id)?.nome || id).join('; ')) : '',
      item.fonteLegada ? el('p', { class: 'book-source' }, `No material-base constava como “${item.fonteLegada}”.`) : '',
      el('footer', {}, source(item.fonte), el('button', { class: 'book-add no-print', onclick: () => addTrait(item, 'vantagens') }, '+ Adicionar à ficha')));

    const catalogo = itens => el('div', { class: 'book-definitions' }, itens.map(verbete));
    const grupoColapsavel = (grupo, aberto) => {
      const itens = porGrupo(grupo);
      if (!itens.length) return '';
      return el('details', { class: 'book-catalog-group', open: !!aberto },
        el('summary', {}, `${rotuloGrupo[grupo] || grupo} `, el('span', {}, itens.length)), catalogo(itens));
    };

    section(article, 'definicao', definicao.titulo || 'O que são vantagens',
      el('p', {}, definicao.regra || ''),
      editorialBox('rule', 'CUSTOS', el('p', {}, definicao.custos || '')),
      editorialBox('note', 'MOMENTO DE COMPRA',
        el('p', {}, `Vantagens são adquiridas ${definicao.momentoDeCompra || 'só na criação (com poucas exceções)'}.`),
        actionLink('Abrir catálogo na ficha', '#/vantagens', 'inline', '⚖️')),
      source(definicao.fonte || cap._fonte));

    section(article, 'vantagens', 'Catálogo de vantagens',
      el('p', {}, `${db.advantages.length} vantagens transcritas da publicação oficial — ${porGrupo('classica').length} clássicas, `
        + `${porGrupo('social').length} de custo variável e ${porGrupo('nova').length} novas. Cada verbete traz o custo publicado, `
        + 'os efeitos que o motor aplica e os requisitos ou incompatibilidades declarados no material.'),
      grupoColapsavel('classica', true),
      grupoColapsavel('social', false));

    const novas = cap.novasVantagens || {};
    section(article, 'novas-vantagens', novas.titulo || 'Novas Vantagens',
      el('p', {}, novas.regra || ''),
      el('p', { class: 'book-source' }, novas.publicacao || ''),
      catalogo(porGrupo('nova')),
      source(novas.fonte || cap._fonteNovas));

    const aliado = cap.aliado || {};
    if (aliado.titulo) {
      const poder = aliado.poder || {};
      const frequencia = aliado.frequencia || {};
      section(article, 'aliado', aliado.titulo,
        el('p', {}, aliado.introducao || ''),
        el('p', {}, aliado.confiabilidade || ''),
        el('div', { class: 'book-subtable' }, el('h3', {}, poder.titulo || 'Poder do Aliado'),
          el('ul', {}, (poder.regras || []).map(regra => el('li', {}, regra))),
          scrollTable(['Pontos do Aliado', 'Custo', 'Resultado'], (poder.tabela || []).map(linha => [
            linha.pontosDoAliado, linha.custo != null ? `${linha.custo} pts` : '—', linha.resultado || '—'])),
          poder.habilidadesEspeciais ? el('p', { class: 'book-source' },
            `Habilidade especial: +${poder.habilidadesEspeciais.min} a ${poder.habilidadesEspeciais.max} pontos — ${poder.habilidadesEspeciais.nota || ''}`) : ''),
        el('div', { class: 'book-subtable' }, el('h3', {}, frequencia.titulo || 'Freqüência de participação'),
          el('p', {}, frequencia.regra || ''),
          scrollTable(['Situação', '3d ≤', 'Multiplicador do custo', 'Nota'], (frequencia.tabela || []).map(linha => [
            linha.rotulo, linha.dado, `×${linha.multiplicador}`, linha.nota || '—']))),
        aliado.criacao ? el('div', { class: 'book-subtable' }, el('h3', {}, aliado.criacao.titulo),
          el('ol', {}, (aliado.criacao.regras || []).map(regra => el('li', {}, regra)))) : '',
        aliado.representacao ? el('div', { class: 'book-subtable' }, el('h3', {}, aliado.representacao.titulo),
          el('ol', {}, (aliado.representacao.regras || []).map(regra => el('li', {}, regra)))) : '',
        source(aliado.fonte), aliado.fonteLegada ? el('p', { class: 'book-source' }, `Material-base: ${aliado.fonteLegada}.`) : '');
    }

    const patrono = cap.patrono || {};
    if (patrono.titulo) {
      const frequencia = patrono.frequencia || {};
      section(article, 'patrono', patrono.titulo,
        el('p', {}, patrono.introducao || ''),
        el('p', {}, patrono.limite || ''),
        editorialBox('rule', 'CUSTO', el('p', {}, patrono.custo || '')),
        el('div', { class: 'book-subtable' }, el('h3', {}, patrono.poder?.titulo || 'Poder do Patrono'),
          el('p', { class: 'book-source' }, patrono.poder?.nota || ''),
          scrollTable(['Custo', 'Escala', 'Exemplo'], (patrono.poder?.tabela || []).map(linha => [
            `${linha.custo} pts`, linha.descricao, linha.exemplo || '—']))),
        patrono.equipamento ? el('div', { class: 'book-subtable' }, el('h3', {}, patrono.equipamento.titulo),
          el('p', {}, patrono.equipamento.regra || ''),
          el('p', { class: 'book-source' }, `Acréscimo padrão: +${patrono.equipamento.acrescimoPadrao} pontos`
            + (patrono.equipamento.acrescimoMaior ? `; +${patrono.equipamento.acrescimoMaior.valor} ${patrono.equipamento.acrescimoMaior.condicao || ''}` : ''))) : '',
        patrono.qualidades ? el('div', { class: 'book-subtable' }, el('h3', {}, patrono.qualidades.titulo),
          el('p', {}, patrono.qualidades.regra || ''),
          el('p', { class: 'book-source' }, `Acréscimos: ${(patrono.qualidades.acrescimo || []).map(v => `+${v}`).join(' ou ')} pontos`),
          el('ul', {}, (patrono.qualidades.exemplos || []).map(exemplo => el('li', {}, exemplo)))) : '',
        el('div', { class: 'book-subtable' }, el('h3', {}, frequencia.titulo || 'Freqüência de participação do Patrono'),
          el('p', {}, frequencia.regra || ''),
          el('p', {}, `Mesma tabela de freqüência do Aliado (3d): ${(aliado.frequencia?.tabela || []).map(l => `${l.rotulo} → ×${l.multiplicador}`).join(' · ')}`),
          el('p', {}, frequencia.jogada || ''),
          el('p', {}, frequencia.limite || ''),
          el('ul', {}, (frequencia.relacionamentos || []).map(item => el('li', {}, item))),
          el('p', { class: 'book-source' }, frequencia.autoridadeFinal || ''),
          el('p', { class: 'book-source' }, frequencia.compartilhado || ''),
          el('p', { class: 'book-source' }, frequencia.semIntervencao || '')),
        patrono.inconvenientes ? el('div', { class: 'book-subtable' }, el('h3', {}, patrono.inconvenientes.titulo),
          el('ul', {}, (patrono.inconvenientes.regras || []).map(regra => el('li', {}, regra)))) : '',
        patrono.patroes ? el('div', { class: 'book-subtable' }, el('h3', {}, patrono.patroes.titulo),
          el('p', {}, patrono.patroes.regra || ''), el('p', {}, patrono.patroes.exemplo || '')) : '',
        source(patrono.fonte), patrono.fonteLegada ? el('p', { class: 'book-source' }, `Material-base: ${patrono.fonteLegada}.`) : '');
    }

    const riqueza = cap.riqueza || {};
    const riquezaDef = db.advantage('riqueza');
    if (riqueza.titulo) {
      section(article, 'riqueza', riqueza.titulo,
        el('p', {}, riqueza.regra || ''),
        Array.isArray(riquezaDef?.niveis) ? scrollTable(['Nível', 'Custo', 'Multiplicador de recursos', 'Dinheiro inicial'],
          riquezaDef.niveis.map(nivel => [nivel.nome, `${nivel.custo} pts`, nivel.multiplicadorRecursos ?? '—', nivel.dinheiro ?? '—'])) : '',
        el('p', { class: 'book-source' }, riqueza.nota || ''),
        source(riqueza.fonte), riqueza.fonteLegada ? el('p', { class: 'book-source' }, `Material-base: ${riqueza.fonteLegada}.`) : '');
    }

    const exemplo = cap.exemploSelecao || {};
    if (exemplo.titulo) {
      section(article, 'exemplo-selecao', exemplo.titulo,
        el('p', {}, `${exemplo.personagem || ''} — ${exemplo.pontosDisponiveis ?? '?'} pontos disponíveis.`),
        el('p', {}, exemplo.texto || ''),
        el('div', { class: 'book-columns' }, (exemplo.dialogo || []).map(fala => el('p', {}, `“${fala}”`))),
        scrollTable(['Vantagem', 'Nível', 'Pontos', 'Nota'], (exemplo.compra || []).map(item => [
          item.vantagem, item.nivel ?? '—', item.pontos != null ? `${item.pontos}` : '—', item.nota || '—'])),
        el('p', {}, el('b', {}, `Total gasto: ${exemplo.totalGasto ?? '?'} pontos`)),
        exemplo._aviso ? editorialBox('warning', 'DIVERGÊNCIA TRANSCRITA', el('p', {}, exemplo._aviso)) : '',
        source(exemplo.fonte));
    }

    if ((cap.conflitos || []).length) {
      section(article, 'conflitos-vantagens', 'Conflitos registrados',
        el('p', {}, 'Divergências entre publicações, mantidas visíveis em vez de resolvidas em silêncio.'),
        el('ul', {}, cap.conflitos.map(conflito => el('li', {},
          el('b', {}, `${conflito.assunto || conflito.id}: `), conflito.descricao || '',
          el('div', { class: 'book-source' }, `Resolução adotada: ${conflito.resolucaoAdotada || '—'} · ${conflito.fonte || ''}`)))));
    }

    if (cap.migracaoDeIds?.mapa) {
      section(article, 'migracao-ids', 'Migração de fichas salvas',
        el('p', {}, cap.migracaoDeIds.nota || ''),
        scrollTable(['Id anterior', 'Id atual'], Object.entries(cap.migracaoDeIds.mapa).map(([velho, novo]) => [velho, novo])),
        cap.migracaoDeIds.removidos ? el('div', { class: 'book-subtable' }, el('h3', {}, 'Entradas removidas'),
          scrollTable(['Id anterior', 'Motivo'], Object.entries(cap.migracaoDeIds.removidos).map(([velho, motivo]) => [velho, motivo]))) : '');
    }

    section(article, 'desvantagens', 'Desvantagens',
      el('p', {}, 'Limitações que ajudam a definir o personagem e afetam a contagem de pontos.'),
      definitionTable(db.disadvantages, 'desvantagem', item => item.custo || 'variável', item => addTrait(item, 'desvantagens')));
    section(article, 'peculiaridades', 'Peculiaridades',
      editorialBox('important', 'LIMITE', el('p', {}, `Máximo de ${db.quirks?.maximo ?? 5} peculiaridades, com −1 ponto cada, fora do limite de desvantagens.`)),
      el('div', { class: 'book-columns' }, (db.quirks?.exemplos || []).map(item => el('p', {}, `◆ ${item}`))));
  },

  combate(article, db) {
    const m = db.maneuvers || {};
    const manobraPor = id => (m.manobras || []).find(x => x.id === id);
    section(article, 'tipos', 'Tipos de combate',
      editorialBox('rule', m.sistema?.nome || 'Combate G.A.U.',
        el('p', {}, `Resolução: ${m.sistema?.resolucao || 'd20 dentro da margem de sucesso'}.`),
        el('p', {}, `Turno: ${m.sistema?.turno || '1 segundo'}.`),
        el('p', {}, m.sistema?.principio || '')),
      renderReferenceGrid(m.tiposCombate),
      actionLink('Abrir painel de combate', '#/combate', 'inline', '⚔'));
    section(article, 'sequencia', 'Sequência dentro de um combate',
      el('p', {}, m.sequencia?.regra || ''),
      el('p', {}, m.sequencia?.turno || ''),
      el('p', { class: 'book-source' }, m.sequencia?.manobras || ''),
      renderReferenceGrid(m.sequencia?.desempate ? { desempate: m.sequencia.desempate } : null));
    for (const [id, titulo] of [['movimento', 'Manobra básica: Movimento'], ['atacar', 'Manobra básica: Atacar'], ['preparar', 'Manobra básica: Preparar'], ['apontar', 'Manobra básica: Apontar'], ['analisar', 'Manobra básica: Analisar'], ['fazer-nada', 'Manobra básica: Fazer Nada']]) {
      const manobra = manobraPor(id);
      if (!manobra) continue;
      if (id === 'preparar') {
        secaoManobra(article, db, manobra, id, titulo);
        section(article, 'empunhaduras', 'Ajuste de empunhadura',
          el('p', {}, m.empunhaduras?.regra || ''),
          scrollTable(['Empunhadura', 'Especialidade', 'Estilo', 'Vantagens', 'Bônus'], (m.empunhaduras?.lista || []).map(e => [
            el('b', {}, e.nome), e.especialidade || '—', e.estilo || '—',
            (e.vantagens || []).join('; ') || '—',
            Object.entries(e.bonus || {}).map(([k, v]) => `${titleCase(k)}: ${typeof v === 'number' ? (v > 0 ? '+' + v : v) : v}`).join(' · ') || '—',
          ])),
          source(m.empunhaduras?.fonte));
        continue;
      }
      if (id === 'apontar') {
        secaoManobra(article, db, manobra, id, titulo);
        section(article, 'prec', 'Precisão Extraordinária (PREC)',
          el('p', {}, db.armas?.precisao?.regra || ''),
          scrollTable(['Categoria', 'Exemplos', 'PREC'], (db.armas?.precisao?.tabela || []).map(l => [l.categoria, l.exemplos || '—', l.prec])),
          editorialBox('tip', 'PONTARIA CERTEIRA E ARMA FIRMADA',
            el('p', {}, '+1 por segundo adicional apontando; +1 com besta ou arma de fogo apoiada em superfície estável.')),
          source(db.armas?.precisao?.fonte));
        continue;
      }
      secaoManobra(article, db, manobra, id, titulo);
    }
    section(article, 'defesas', 'Defesas ativas',
      el('p', {}, m.defesasAtivas?.regra || ''),
      scrollTable(['Defesa', 'Base', 'Uso', 'Equipamento'], (m.defesasAtivas?.tabela || []).map(d => [el('b', {}, d.defesa), d.base, d.uso, d.equipamento])),
      el('div', { class: 'book-reference-grid' }, Object.entries(m.defesasAtivas?.descricoes || {}).map(([k, v]) => el('article', {}, el('h3', {}, titleCase(k)), el('p', {}, v)))),
      source(m.defesasAtivas?.fonte));
    section(article, 'grau-dano', 'Grau de Dano (GD)',
      el('p', {}, m.grauDano?.conceito || ''),
      scrollTable(['Grau', 'Faixa de dano', 'Nome', 'Conceito'], (m.grauDano?.graus || []).map(g => [g.id, g.max == null ? `${g.min}+` : `${g.min}–${g.max}`, el('b', {}, g.nome), g.conceito])),
      el('div', { class: 'book-reference-grid' }, Object.entries(m.grauDano?.detalhes || {}).map(([k, d]) => el('article', {},
        el('h3', {}, k), el('p', {}, d.descricao || ''),
        (d.podeCausar || d.podeRepresentar || []).length ? el('ul', {}, (d.podeCausar || d.podeRepresentar).map(x => el('li', {}, x))) : '',
        d.nota ? el('p', { class: 'book-source' }, d.nota) : ''))),
      source(m.grauDano?.fonte));
    section(article, 'localizacao', 'Localização de acerto',
      el('p', {}, m.localizacao?.ataquePadrao || ''),
      el('ul', {}, (m.localizacao?.notas || []).map(n => el('li', {}, n))),
      m.localizacao?._aviso ? editorialBox('warning', 'REGRA NÃO DEFINIDA', el('p', {}, m.localizacao._aviso)) : '',
      source(m.localizacao?.fonte));
    section(article, 'luminosidade', 'Luminosidade e escuridão',
      el('p', {}, m.luminosidade?.regra || ''),
      scrollTable(['Nível', 'Penalidade', 'Exemplos'], (m.luminosidade?.tabela || []).map(l => [el('b', {}, l.nivel), `${l.penalidadeMin} a ${l.penalidadeMax}`, l.exemplos])),
      renderReferenceGrid(m.luminosidade?.combate),
      source(m.luminosidade?.fonte));
    section(article, 'montado', 'Combate montado',
      el('p', {}, m.montado?.aplicacao || ''),
      el('ol', { class: 'book-numbered' }, (m.montado?.passos || []).map(passo => el('li', {}, passo))),
      renderReferenceGrid(m.montado?.movimento),
      renderReferenceGrid(m.montado?.armas ? { armasDeCavalaria: m.montado.armas } : null),
      renderReferenceGrid(m.montado?.defesa ? { defesaDaMontaria: m.montado.defesa } : null),
      renderReferenceGrid(m.montado?.consequencias ? { consequencias: m.montado.consequencias } : null),
      source(m.montado?.fonte));
    section(article, 'veiculos', 'Combate em veículos',
      renderReferenceGrid(m.veiculos),
      source(m.veiculos?.fonte));
    section(article, 'arvores', 'Árvores de manobra (transcrição literal)',
      el('p', {}, 'As árvores abaixo são a transcrição literal do material publicado — a mesma estrutura usada pelo painel de combate.'),
      ...Object.entries(m.arvores || {}).filter(([k]) => k !== '_nota').map(([chave, texto]) =>
        el('details', { class: 'book-catalog-group', open: chave === 'ataques' },
          el('summary', {}, titleCase(chave)), preArvore(texto))));
  },

  equipamento(article, db) {
    section(article, 'carga', 'Níveis de carga',
      editorialBox('rule', 'CARGA E MOVIMENTO', el('p', {}, 'A ficha soma o peso carregado, compara o total à ST e aplica automaticamente o nível e a penalidade de movimento correspondentes.')),
      objectArrayTable(db.tables.carga?.niveis || []),
      editorialBox('important', 'MÁXIMO CARREGÁVEL', el('p', {}, db.tables.carga?.maximoCarregavel || '—')));
    section(article, 'armaduras', 'Armaduras', equipmentTable(db.equipment?.armaduras || [], 'armadura'));
    section(article, 'escudos', 'Escudos', equipmentTable(db.equipment?.escudos || [], 'escudo'));
    section(article, 'itens', 'Itens citados', equipmentTable(db.equipment?.itensAvulsos || [], 'item'));
    section(article, 'encantamento', 'Encantamento',
      editorialBox('rule', 'MÉTODO LENTO', el('p', {}, db.equipment?.encantamentoCustoLento?.regra || db.equipment?.encantamentoCustoLento?._regra || '—')),
      renderReferenceGrid(db.equipment?.encantamentoCustoLento));
  },

  fadiga(article, db) {
    section(article, 'custos-fadiga', 'Custos de fadiga',
      editorialBox('important', 'ESTADO DO PERSONAGEM', el('p', {}, 'A aba de combate usa estes valores para atualizar energia, ST efetiva e consequências do esforço.')),
      renderReferenceGrid(db.tables.fadiga));
    section(article, 'recuperacao', 'Recuperação',
      editorialBox('tip', 'DESCANSO', renderValue(db.tables.fadiga?.recuperacao)),
      actionLink('Ver fadiga atual no combate', '#/combate', 'inline', '⚔'));
  },

  magia(article, db) {
    const mg = db.magia || {};
    section(article, 'aptidao', 'Aptidão Mágica',
      el('p', {}, mg.aptidao?.regra || ''),
      el('p', {}, mg.aptidao?.cenarios || ''),
      editorialBox('important', 'LIMITE', el('p', {}, mg.aptidao?.limite || 'Ninguém pode ter uma Aptidão Mágica maior do que 3.')));
    section(article, 'aprendizado', 'Aprendendo mágicas',
      el('ul', {}, (mg.aprendizado?.regras || []).map(r => el('li', {}, r))),
      editorialBox('example', 'EXEMPLO', el('p', {}, mg.aprendizado?.exemplo || '')),
      el('p', { class: 'book-source' }, mg.aprendizado?.grimoire || ''));
    section(article, 'pre-requisitos', 'Pré-requisitos', renderReferenceGrid(mg.preRequisitos));
    section(article, 'fazendo-magica', 'Fazendo uma mágica',
      el('p', {}, mg.fazendoMagica?.requisitos || ''),
      el('p', {}, mg.fazendoMagica?.sequencia || ''),
      editorialBox('warning', 'CONFLITO DE RESOLUÇÃO',
        el('p', {}, mg.fazendoMagica?.resolucao?.comoPublicado || ''),
        el('p', {}, mg.fazendoMagica?.resolucao?._conflito || 'O capítulo de magia fala em 3 dados; TESTES DE HABILIDADE define o d20 como base de resolução. A ficha usa d20 por padrão (config.resolucaoMagia).')),
      renderReferenceGrid(mg.distracaoEFerimentos ? { distracaoEFerimentos: mg.distracaoEFerimentos } : null));
    section(article, 'tempo', 'Tempo e concentração', renderReferenceGrid(mg.tempo));
    section(article, 'energia', 'Custo em energia',
      el('ul', {}, (mg.custoEnergia?.regras || []).map(r => el('li', {}, r))),
      editorialBox('example', 'EXEMPLO', el('p', {}, mg.custoEnergia?.exemplo || '')),
      renderReferenceGrid(mg.custoEnergia?.energiaVital ? { energiaVital: mg.custoEnergia.energiaVital } : null),
      editorialBox('important', 'REDUÇÃO POR NH', el('p', {}, db.tables.reducaoCustoEnergia?.regra || '—')));
    section(article, 'duracao', 'Duração e manutenção',
      el('ul', {}, (mg.duracao?.regras || []).map(r => el('li', {}, r))),
      editorialBox('example', 'EXEMPLO', el('p', {}, mg.duracao?.exemplo || '')),
      el('p', { class: 'book-source' }, mg.duracao?.concentracao || ''),
      el('p', { class: 'book-source' }, mg.duracao?.custoReduzido || ''));
    section(article, 'toque-do-mago', 'Toque do Mago', renderReferenceGrid(mg.toqueDoMago));
    section(article, 'cajado', 'Cajado e vara de condão', renderReferenceGrid(mg.cajadoEVara));
    section(article, 'mana', 'Níveis de mana',
      editorialBox('rule', 'MANA', el('p', {}, mg.mana?.resumo || 'O nível de mana altera quem pode lançar mágicas e quais modificadores se aplicam.')),
      keyValueTable('Nível', 'Efeito', db.tables.mana?.niveis || {}),
      source(db.tables.mana?.fonte));
    section(article, 'rituais', 'Rituais por nível de habilidade',
      el('p', {}, mg.rituais?.nota || ''),
      objectArrayTable(db.tables.rituaisMagia?.faixas || []),
      source(db.tables.rituaisMagia?.fonte));
    section(article, 'classes', 'Classes de mágicas',
      el('p', {}, mg.classes?.regra || ''),
      el('div', { class: 'book-reference-grid' }, (mg.classes?.lista || []).map(c => el('article', {},
        el('h3', {}, c.nome), el('p', {}, c.descricao || ''),
        (c.regras || []).length ? el('ul', {}, c.regras.map(r => el('li', {}, r))) : '',
        (c.modosDeDirigir || []).length ? el('ul', {}, c.modosDeDirigir.map(md => el('li', {}, el('b', {}, md.modo), ' — ', md.nota))) : ''))),
      renderReferenceGrid(mg.modificadoresLongaDistancia ? { modificadoresDeLongaDistancia: mg.modificadoresLongaDistancia } : null));
    section(article, 'cerimonial', 'Magia cerimonial e de grupo',
      el('p', {}, mg.cerimonial?.introducao || ''),
      editorialBox('rule', 'TEMPO E CUSTO', el('p', {}, mg.cerimonial?.tempo || ''), el('p', {}, mg.cerimonial?.custo || '')),
      renderReferenceGrid(mg.cerimonial?.cooperacao));
    section(article, 'objetos', 'Objetos encantados',
      el('ul', {}, (mg.objetosEncantados?.regras || []).map(r => el('li', {}, r))),
      renderReferenceGrid(mg.objetosEncantados?.criacao),
      renderReferenceGrid(mg.objetosEncantados?.poder ? { poder: mg.objetosEncantados.poder } : null),
      renderReferenceGrid(mg.objetosEncantados?.rapidoESujo ? { rapidoESujo: mg.objetosEncantados.rapidoESujo } : null),
      renderReferenceGrid(mg.objetosEncantados?.lentoESeguro ? { lentoESeguro: mg.objetosEncantados.lentoESeguro } : null),
      renderReferenceGrid(mg.objetosEncantados?.uso ? { uso: mg.objetosEncantados.uso } : null),
      renderReferenceGrid(mg.objetosEncantados?.permanentementeAtivos ? { permanentementeAtivos: mg.objetosEncantados.permanentementeAtivos } : null),
      editorialBox('note', 'ECONOMIA DA MAGIA', el('p', {}, mg.objetosEncantados?.custoFabricacao?.nota || '')),
      renderReferenceGrid(db.equipment?.encantamentoCustoLento));
    section(article, 'entidades', 'Entidades mágicas',
      el('p', {}, mg.entidades?.introducao || ''),
      renderReferenceGrid(mg.entidades?.demonios ? { demonios: mg.entidades.demonios } : null),
      renderReferenceGrid(mg.entidades?.elementais ? { elementais: mg.entidades.elementais } : null));
    const groups = groupBy(db.spells || [], spell => spell.escola || 'Outras');
    section(article, 'catalogo-magias', 'Lista de mágicas',
      el('p', {}, mg.listaDeMagicas?.quantidade || ''),
      scrollTable(['Campo da descrição', 'Como ler'], (mg.listaDeMagicas?.formatoDaDescricao || []).map(f => [f.campo, f.nota])),
      ...Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([school, spells]) =>
        el('details', { class: 'book-catalog-group' },
          el('summary', {}, `${school} `, el('span', {}, spells.length)),
          el('div', { class: 'book-spell-list' }, spells.map(spell => spellEntry(spell, db))))));
  },

  testes(article, db) {
    const r = db.resolucao || {};
    section(article, 'como-funciona', 'Como funciona um teste',
      editorialBox('rule', `O DADO BASE: ${r.dadoBase || 'd20'}`,
        el('p', {}, 'Não existe necessariamente uma "Classe de Dificuldade" arbitrária criada pelo Mestre: o valor testado é a referência da jogada.')),
      el('ol', { class: 'book-numbered' }, (r.principios || []).map(p => el('li', {}, p))),
      actionLink('Rolar o d20', '#/dados', 'inline', '🎲'));
    section(article, 'referencia', 'A referência da jogada',
      el('p', {}, r.referencia?.regra || ''),
      editorialBox('example', 'EXEMPLO PUBLICADO', el('p', {}, r.referencia?.exemplo || '')),
      el('p', { class: 'book-source' }, r.referencia?.habilidades || ''),
      editorialBox('important', 'VALOR CRÍTICO', el('p', {}, r.critico?.regra || ''), el('p', {}, r.critico?.disputa || '')));
    section(article, 'margens', 'Tabela de margens de sucesso e crítico',
      el('p', {}, r.margens?.nota || ''),
      scrollTable(['Referência', 'Margem de sucesso', 'Valor crítico', 'Largura'],
        Object.entries(r.margens?.tabela || {}).map(([valor, m]) => [el('b', {}, valor), m.texto, m.critico ?? '—', m.largura ?? '—'])),
      source(r.margens?.fonte));
    section(article, 'categorias', 'Categorias de poder e escala',
      editorialBox('rule', 'ESCALA', el('p', {}, r.categorias?.regra || '')),
      scrollTable(['Categoria', 'Dados', 'Escala', 'Nota'], (r.categorias?.lista || []).map(c => [
        el('b', {}, c.nome), c.dados == null ? 'N/D' : `${c.dados} d20`, c.escala || '—', c.nota || '—'])),
      editorialBox('warning', r.categorias?.agregacaoDeDados?._aviso || 'REGRA NÃO DEFINIDA',
        el('p', {}, r.categorias?.agregacaoDeDados?.problema || ''),
        el('ul', {}, Object.entries(r.categorias?.agregacaoDeDados?.modosSuportados || {}).map(([modo, texto]) => el('li', {}, el('b', {}, `${modo}: `), texto))),
        el('p', { class: 'book-source' }, `Configurável em ${r.categorias?.agregacaoDeDados?.configuravel || 'config.modoEscala'}.`)));
    section(article, 'pre-definidos', 'Testes com níveis pré-definidos', renderReferenceGrid(r.testesPreDefinidos));
    section(article, 'por-categoria', 'Testes determinados por categoria', renderReferenceGrid(r.testesPorCategoria));
    section(article, 'disputas', 'Disputa de Habilidades',
      el('p', {}, r.disputas?.regraGeral || ''),
      el('p', {}, r.disputas?.consequencia || ''),
      el('p', { class: 'book-source' }, r.disputas?.modificadores || ''),
      renderReferenceGrid(r.disputas?.tipos),
      editorialBox('note', 'CRITÉRIO ALTERNATIVO',
        el('p', {}, 'O material também menciona vencer pela maior margem de sucesso. A ficha calcula os dois e o critério é configurável (config.criterioDisputa).')));
    section(article, 'testes-do-mestre', 'Quando o Mestre joga os dados',
      el('p', {}, r.testesDoMestre?.regra || ''),
      el('div', { class: 'book-reference-grid' }, (r.testesDoMestre?.tipos || []).map(t => el('article', {},
        el('h3', {}, t.titulo || t.id), el('p', {}, t.descricao || ''),
        t.procedimento ? el('p', { class: 'book-source' }, t.procedimento) : ''))));
    section(article, 'sucesso-automatico', 'Sucesso automático e o fim do 1 e 20',
      editorialBox('rule', 'BOM SENSO', el('p', {}, r.sucessoAutomatico?.regra || '')),
      el('ul', {}, Object.entries(r.sucessoAutomatico?.exemplos || {}).map(([k, v]) => el('li', {}, el('b', {}, `${titleCase(k)}: `), v))),
      renderReferenceGrid(r.umEVinte ? { umEVinte: r.umEVinte } : null));
  },

  proezas(article, db) {
    const pz = db.proezas || {};
    section(article, 'corrida', 'Corrida e deslocamento',
      el('ul', {}, (pz.corrida?.regras || []).map(r => el('li', {}, r))),
      editorialBox('rule', 'DSL', el('p', {}, 'Corrida = Deslocamento total; caminhada = metade do deslocamento, arredondada para cima.')));
    section(article, 'esforco-extra', 'Esforço Extra',
      el('p', {}, pz.esforcoExtra?.regra || ''),
      el('ul', {}, (pz.esforcoExtra?.usos || []).map(u => el('li', {}, u))),
      el('p', { class: 'book-source' }, pz.esforcoExtra?.autorizacaoDoMestre || ''),
      actionLink('Calcular esforço extra', '#/proezas', 'inline', '🏃'));
    section(article, 'saltos', 'Saltos',
      el('p', {}, pz.saltos?.regraGeral || ''),
      editorialBox('rule', 'LIMITE MUNDANO', el('p', {}, pz.saltos?.limiteMundano?.regra || ''), el('p', {}, `Salto máximo sem características sobrenaturais: ${pz.saltos?.limiteMundano?.metros ?? 1.5} m.`)),
      renderReferenceGrid(pz.saltos?.saltoSobrenatural ? { saltoSobrenatural: pz.saltos.saltoSobrenatural } : null),
      el('p', { class: 'book-source' }, pz.saltos?.periciaSalto || ''),
      el('p', { class: 'book-source' }, pz.saltos?.esforcoExtra || ''),
      renderReferenceGrid(pz.saltos?.saltandoComCarga ? { saltandoComCarga: pz.saltos.saltandoComCarga } : null));
    section(article, 'escalada', 'Escalada',
      el('ul', {}, (pz.escalada?.regras || []).map(r => el('li', {}, r))),
      el('p', { class: 'book-source' }, `Nível pré-definido: ${(pz.escalada?.default || []).join(' ou ')}.`),
      scrollTable(['Superfície', 'Modificador', 'Escalada curta', 'Escalada longa'], (pz.escalada?.tabela || []).map(l => [
        el('b', {}, l.tipo), l.modificador == null ? (l.semJogada ? 'sem jogada' : '—') : (l.modificador > 0 ? `+${l.modificador}` : l.modificador), l.escaladaCurta || '—', l.escaladaLonga || '—'])),
      (pz.escalada?.tabela || []).some(l => l._aviso) ? editorialBox('warning', 'REGRA A CONFERIR',
        el('ul', {}, pz.escalada.tabela.filter(l => l._aviso).map(l => el('li', {}, `${l.tipo}: ${l._aviso}`)))) : '');
    section(article, 'levantamento', 'Levantar e mover objetos',
      el('p', {}, pz.levantamento?.regraGeral || ''),
      scrollTable(['Limite', 'Fórmula', 'Observação'], (pz.levantamento?.limites || []).map(l => [el('b', {}, l.nome), l.formula, l.nota || '—'])),
      renderReferenceGrid(pz.levantamento?.erguer ? { erguer: pz.levantamento.erguer } : null),
      el('p', { class: 'book-source' }, pz.levantamento?.esforcoExtra || ''));
    section(article, 'empurrar', 'Empurrar e derrubar objetos', renderReferenceGrid(pz.empurrarDerrubar));
    section(article, 'arremesso', 'Arremesso de objetos',
      renderReferenceGrid({ limiteDePeso: pz.arremesso?.limitePeso, testeParaAtingir: pz.arremesso?.testeParaAtingir, distancia: pz.arremesso?.distancia, emCombate: pz.arremesso?.emCombate }),
      el('h3', {}, 'Dano provocado por objetos arremessados'),
      el('p', {}, db.armas?.arremesso?.regra || ''),
      scrollTable(['ST', ...(db.armas?.arremesso?.colunas || []).map(c => c.rotulo)], (db.armas?.arremesso?.tabela || []).map(l => [
        `${l.stMin}–${l.stMax}`, ...(db.armas?.arremesso?.colunas || []).map(c => l[c.id] ?? '—')])),
      source(db.armas?.arremesso?.fonte));
    section(article, 'cavar', 'Cavar',
      el('p', {}, pz.cavar?.regra || ''),
      scrollTable(['Situação', 'Fórmula'], (pz.cavar?.ritmos || []).map(r => [r.situacao, r.formula])),
      el('ul', {}, (pz.cavar?.notas || []).map(n => el('li', {}, n))),
      renderReferenceGrid(pz.cavar?.fadiga ? { fadiga: pz.cavar.fadiga } : null));
    section(article, 'natacao', 'Natação',
      el('p', { class: 'book-source' }, `Nível pré-definido: ${(pz.natacao?.default || []).join(' ou ')}.`),
      el('ul', {}, (pz.natacao?.regras || []).map(r => el('li', {}, r))),
      renderReferenceGrid(pz.natacao?.modificadores ? { modificadores: pz.natacao.modificadores } : null),
      renderReferenceGrid(pz.natacao?.velocidadeDeNado ? { velocidadeDeNado: pz.natacao.velocidadeDeNado } : null),
      renderReferenceGrid(pz.natacao?.combateNaAgua ? { combateNaAgua: pz.natacao.combateNaAgua } : null),
      renderReferenceGrid(pz.natacao?.salvandoVidas ? { salvandoVidas: pz.natacao.salvandoVidas } : null));
    section(article, 'sentidos', 'Testes dos sentidos',
      el('p', {}, pz.sentidos?.regra || ''),
      el('div', { class: 'book-reference-grid' }, ['visao', 'audicao', 'olfatoPaladar'].filter(k => pz.sentidos?.[k]).map(k =>
        el('article', {}, el('h3', {}, titleCase(k)), renderReferenceGrid(pz.sentidos[k])))));
    section(article, 'vontade', 'Testes de Vontade', renderReferenceGrid(pz.vontade));
    section(article, 'panico', 'Verificação de Pânico',
      el('p', {}, pz.panico?.regra || ''),
      el('p', { class: 'book-source' }, pz.panico?.dados || ''),
      renderReferenceGrid(pz.panico?.modificadores ? { modificadores: pz.panico.modificadores } : null),
      renderReferenceGrid(pz.panico?.frequencia ? { frequencia: pz.panico.frequencia } : null),
      renderReferenceGrid(pz.panico?.bonusERedutores ? { bonusERedutores: pz.panico.bonusERedutores } : null),
      el('h3', {}, 'Tabela de consequências (3d + margem da falha)'),
      el('p', {}, pz.panico?.rolagem?.regra || ''),
      scrollTable(['Resultado', 'Efeito'], (pz.panico?.rolagem?.tabela || []).map(l => [el('b', {}, l.resultado), l.efeito])),
      el('p', { class: 'book-source' }, pz.panico?.rolagem?.consequencias || ''));
    section(article, 'apanhar', 'Apanhar objetos em combate', renderReferenceGrid(pz.apanharObjetos));
    section(article, 'salto-combate', 'Salto durante o combate', renderReferenceGrid(pz.saltoDuranteCombate));
  },

  arsenal(article, db) {
    const eras = db.armas?.eras || [];
    const secaoEra = (era, id, titulo) => section(article, id, titulo,
      el('p', {}, era.introducao || ''),
      scrollTable(['Arma', 'Dano', 'Média', 'Característica', 'Tipo'], (era.armas || []).map(a => [
        el('div', { id: `arma-${a.id}`, class: 'book-anchor' }, el('b', {}, a.nome)),
        el('code', {}, a.dano || '—'), a.media ?? '—', a.caracteristica || '—', a.tipo || '—'])),
      source(era.fonte || db.armas?._fonte));
    eras.forEach((era, i) => {
      const ids = ['armas-medievais', 'armas-modernas', 'armas-futuristas'];
      secaoEra(era, ids[i] || `armas-${era.id}`, `Armas — ${era.nome}`);
    });
    section(article, 'precisao', 'Precisão Extraordinária (PREC)',
      el('p', {}, db.armas?.precisao?.regra || ''),
      scrollTable(['Categoria', 'Exemplos', 'PREC'], (db.armas?.precisao?.tabela || []).map(l => [l.categoria, l.exemplos || '—', l.prec])),
      source(db.armas?.precisao?.fonte));
    section(article, 'arremesso', 'Dano de objetos arremessados',
      el('p', {}, db.armas?.arremesso?.regra || ''),
      scrollTable(['ST', ...(db.armas?.arremesso?.colunas || []).map(c => c.rotulo)], (db.armas?.arremesso?.tabela || []).map(l => [
        `${l.stMin}–${l.stMax}`, ...(db.armas?.arremesso?.colunas || []).map(c => l[c.id] ?? '—')])),
      editorialBox('tip', 'DISTÂNCIA', el('p', {}, db.proezas?.arremesso?.distancia?.formula || 'ST + peso (arredondado para cima) = distância em metros.'),
        el('p', {}, db.proezas?.arremesso?.distancia?.comPericia || '')),
      source(db.armas?.arremesso?.fonte));
    const est = db.estruturas?.estruturas || {};
    section(article, 'estruturas', 'Dano em estruturas e objetos',
      el('p', {}, est.conceito || ''),
      scrollTable(['Material', 'Limiar de Dano', 'PE pequeno', 'PE médio', 'PE grande', 'Exemplos'], (est.materiais || []).map(m => [
        el('div', { id: `material-${m.id}`, class: 'book-anchor' }, el('b', {}, m.material)),
        el('code', {}, m.limiarDeDano), m.pePequeno ?? '—', m.peMedio ?? '—', m.peGrande ?? '—', (m.exemplos || []).join('; ') || '—'])),
      scrollTable(['Tamanho', 'Exemplo', 'Campo de PE'], (est.tamanhos || []).map(t => [t.nome, t.exemplo, t.campo])),
      renderReferenceGrid(est.estados ? { estadosDeDegradacao: est.estados } : null),
      renderReferenceGrid(est.interacoes ? { interacoes: est.interacoes } : null),
      source(db.estruturas?._fonte));
    section(article, 'nt', 'Nível de tecnologia (NT)',
      el('p', {}, db.estruturas?.nivelTecnologico?.regra || ''),
      scrollTable(['NT', 'Era', 'Início', 'Assinatura'], (db.estruturas?.nivelTecnologico?.tabela || []).map(l => [
        el('b', {}, String(l.nt)), l.era, l.inicio || '—', l.assinatura || '—'])));
  },

  poderes(article, db) {
    const pw = db.poderes || {};
    const mod = pw.modulos || {};
    section(article, 'como-construir', 'Criando seus poderes',
      el('p', {}, pw.conceito?.regra || ''),
      el('p', {}, pw.conceito?.modular || ''),
      editorialBox('rule', 'MÓDULOS OBRIGATÓRIOS',
        el('p', {}, pw.conceito?.obrigatorios?.regra || ''),
        el('p', {}, `Para um poder com efeito: ${(pw.conceito?.obrigatorios?.modulos || []).map(m => titleCase(m)).join(' + ')}.`)),
      actionLink('Abrir o construtor de poderes', '#/poderes', 'inline', '🌀'));
    section(article, 'orcamento', 'Pontos de poder',
      el('p', {}, pw.orcamento?.regra || ''),
      el('p', { class: 'book-source' }, pw.orcamento?.limite || ''),
      editorialBox('example', 'ORÇAMENTO PADRÃO', el('p', {}, `${pw.orcamento?.exemploPadrao ?? 150} pontos · nível inicial: ${pw.orcamento?.nivelInicial ?? 'mundano'}`)));
    section(article, 'efeitos', 'Efeitos',
      el('p', {}, mod.efeitos?.descricao || ''),
      ...((mod.efeitos?.grupos || []).map(g => el('details', { class: 'book-catalog-group' },
        el('summary', {}, `${g.nome} `, el('span', {}, (g.itens || []).length)),
        scrollTable(['Efeito', 'Pontos'], (g.itens || []).map(i => [
          el('div', { id: `efeito-${i.id}`, class: 'book-anchor' }, el('b', {}, i.nome)),
          `${i.pontos}${i.escalonavel ? '+' : ''}`]))))));
    const subTabelas = (fonte, prefixo) => (fonte?.submodulos || []).map(sub => el('div', { class: 'book-subtable' },
      el('h3', {}, `${titleCase(sub)} — ${fonte[sub]?.descricao || ''}`),
      scrollTable(['Opção', 'Pontos', 'Detalhe'], (fonte[sub]?.itens || []).map(i => [
        el('div', { id: `${prefixo}-${sub}-${i.id}`, class: 'book-anchor' }, el('b', {}, i.nome)),
        `${i.pontos}${i.escalonavel ? '+' : ''}`,
        i.exemplo || (i.grau ? `Grau de Dano ${i.grau}` : i.quantidade != null ? `${i.quantidade} alvos` : i.turnos != null ? `${i.turnos} turno(s)` : '—')]))));
    section(article, 'extensao', 'Extensão', el('p', {}, mod.extensao?.descricao || ''), ...subTabelas(mod.extensao, 'extensao'));
    section(article, 'potencia', 'Potência', el('p', {}, mod.potencia?.descricao || ''), ...subTabelas(mod.potencia, 'potencia'));
    section(article, 'condicoes', 'Condições',
      el('p', {}, mod.condicoes?.descricao || ''),
      editorialBox('important', 'LIMITE', el('p', {}, mod.condicoes?.limite || `Até ${mod.condicoes?.maximo ?? 3} Condições por poder.`)),
      scrollTable(['Condição', 'Pontos'], (mod.condicoes?.itens || []).map(i => [el('b', {}, i.nome), i.pontos])));
    section(article, 'bonus', 'Bônus, penalidades, PV e RD',
      el('div', { class: 'book-subtable' }, el('h3', {}, mod.bonus?.titulo || 'Bônus'), el('p', {}, mod.bonus?.descricao || ''),
        scrollTable(['Bônus', 'Pontos'], (mod.bonus?.itens || []).map(i => [`+${i.bonus}`, i.pontos]))),
      el('div', { class: 'book-subtable' }, el('h3', {}, mod.penalidades?.titulo || 'Penalidades'), el('p', {}, mod.penalidades?.descricao || ''),
        scrollTable(['Penalidade', 'Pontos'], (mod.penalidades?.itens || []).map(i => [i.penalidade, i.pontos]))),
      el('div', { class: 'book-subtable' }, el('h3', {}, mod.pv?.titulo || 'Pontos de Vida'),
        scrollTable(['Opção', 'PV', 'Pontos'], (mod.pv?.itens || []).map(i => [i.nome, `+${i.pv}`, i.pontos]))),
      el('div', { class: 'book-subtable' }, el('h3', {}, mod.rd?.titulo || 'Redução de Dano'),
        scrollTable(['Opção', 'RD', 'Pontos'], (mod.rd?.itens || []).map(i => [i.nome, `+${i.rd}`, i.pontos]))),
      el('div', { class: 'book-subtable' }, el('h3', {}, mod.outros?.titulo || 'Outros bônus'), el('p', {}, mod.outros?.descricao || ''),
        scrollTable(['Opção', 'Pontos'], (mod.outros?.itens || []).map(i => [i.nome, `${i.pontos}${i.escalonavel ? '+' : ''}`]))));
    section(article, 'dimensionalidade', 'Dimensionalidade',
      el('p', {}, pw.dimensionalidade?.definicao || ''),
      el('ol', { class: 'book-numbered' }, (pw.dimensionalidade?.operacao || []).map(o => el('li', {}, o))),
      editorialBox('example', 'EXEMPLO', el('p', {}, pw.dimensionalidade?.exemplo || '')),
      el('p', {}, pw.dimensionalidade?.implicacoes || ''),
      el('p', { class: 'book-source' }, pw.dimensionalidade?.exemploDeImunidade || ''),
      editorialBox('warning', 'RESSALVA', el('p', {}, pw.dimensionalidade?.ressalva || '')),
      el('p', { class: 'book-source' }, pw.dimensionalidade?.dimensoesInferiores || ''));
    section(article, 'hax', 'Hax',
      el('p', {}, pw.hax?.definicao || ''),
      editorialBox('note', 'RELATIVIDADE', el('p', {}, pw.hax?.relatividade || '')),
      el('p', { class: 'book-source' }, pw.hax?.limite || ''));
    section(article, 'criacao-poderes', 'Como fazer o meu personagem',
      el('p', {}, pw.criacao?.titulo || ''),
      el('ol', { class: 'book-steps' }, (pw.criacao?.passos || []).map((passo, i) => step(String(i + 1).padStart(2, '0'), passo.titulo, passo.texto))));
  },

  referencia(article, db) {
    const refs = [
      ['quedas', 'Quedas', db.tables.queda],
      ['primeiros-socorros', 'Primeiros socorros', db.tables.primeirosSocorros],
      ['modificadores', 'Modificadores de velocidade e distância', db.tables.modificadoresVelocidadeDistancia],
      ['modificadores-tamanho', 'Modificadores de tamanho', db.tables.modificadoresTamanho],
      ['altura-peso', 'Altura e peso', db.tables.alturaPeso],
      ['aparencia', 'Aparência aleatória', db.tables.aparenciaAleatoria],
      ['probabilidades', 'Probabilidades em 3d', db.tables.probabilidades3d],
    ];
    for (const [id, title, data] of refs) section(article, id, title,
      data?._aviso ? editorialBox('warning', data._aviso, el('p', {}, 'Confira a fonte antes de usar fora desta edição.')) : '',
      renderReferenceGrid(data));
  },
};

function renderManifestSections(article, db, chapter) {
  for (const item of chapter.secoes || []) section(article, item.id, item.titulo, renderValue(item.ref ? readDataRef(db, item.ref) : item));
}

/* ------------------------------- componentes editoriais -------------------- */
function section(article, id, title, ...content) {
  article.append(el('section', { class: 'book-section', id },
    el('div', { class: 'book-section-number', 'aria-hidden': 'true' }, '§'),
    el('h2', {}, title), ...content));
}

function editorialBox(kind, title, ...content) {
  const icons = { rule: '⚔', important: '!', example: '◇', note: '✦', warning: '△', tip: '☞' };
  return el('aside', { class: `book-box book-box-${kind}` },
    el('div', { class: 'book-box-title' }, el('span', {}, icons[kind] || '◆'), title),
    el('div', { class: 'book-box-body' }, ...content));
}

function instruction(icon, title, text) { return el('div', {}, el('span', {}, icon), el('h3', {}, title), el('p', {}, text)); }
function step(number, title, text) { return el('li', {}, el('span', {}, number), el('div', {}, el('b', {}, title), el('p', {}, text))); }
function source(text) { return text ? el('small', { class: 'book-source' }, text) : ''; }

function scrollTable(headers, rows) {
  return el('div', { class: 'book-table-scroll', tabindex: '0' }, el('table', { class: 'book-table' },
    el('thead', {}, el('tr', {}, headers.map(header => el('th', {}, header)))),
    el('tbody', {}, rows.map(row => el('tr', {}, row.map(cell => el('td', {}, cell ?? '—')))))));
}

function keyValueTable(keyLabel, valueLabel, object) {
  return scrollTable([keyLabel, valueLabel], Object.entries(object || {}).map(([key, value]) => [key, String(value)]));
}

function objectArrayTable(items) {
  if (!items?.length) return el('p', {}, '—');
  const keys = [...new Set(items.flatMap(item => Object.keys(item)))];
  return scrollTable(keys.map(titleCase), items.map(item => keys.map(key => renderCell(item[key]))));
}

function skillCostTable(title, data) {
  if (!data) return '';
  const columns = data.colunas || [];
  return el('div', { class: 'book-subtable' }, el('h3', {}, title),
    scrollTable(['Nível relativo', ...columns], Object.entries(data.linhas || {}).map(([level, costs]) => [level, ...costs.map(value => value ?? '—')])));
}

function definitionTable(items, prefix, cost, add) {
  return el('div', { class: 'book-definitions' }, items.map(item => el('article', { class: 'book-definition', id: `${prefix}-${item.id}` },
    el('div', { class: 'book-definition-head' }, el('h3', {}, item.nome), el('b', {}, cost(item))),
    el('p', {}, item.descricao || ''),
    el('footer', {}, source(item.fonte), el('button', { class: 'book-add no-print', onclick: () => add(item) }, '+ Adicionar à ficha')))));
}

function equipmentTable(items, category) {
  return scrollTable(['Item', 'Proteção', 'Custo', 'Peso', 'Notas', ''], items.map(item => {
    const id = item.id || slug(item.nome);
    return [
      el('div', { id: `equipamento-${id}`, class: 'book-anchor' }, el('b', {}, item.nome), source(item.fonte)),
      [item.dp != null ? `DP ${item.dp}` : '', item.rd != null ? `RD ${item.rd}` : ''].filter(Boolean).join(' · ') || '—',
      item.custo != null ? `$${item.custo}` : 'N/D',
      typeof item.peso === 'number' ? `${item.peso} kg` : item.peso || 'N/D',
      item.notas || '—',
      el('div', { class: 'book-table-actions no-print' },
        el('a', { href: '#/equipamentos', title: 'Ver no banco de equipamentos' }, '↗ Banco'),
        el('button', { onclick: () => addEquipment({ ...item, id, categoria: category }) }, '+ Ficha')),
    ];
  }));
}

function spellEntry(spell, db) {
  const prereqs = spell['Pré-requisitos'] || '';
  return el('article', { class: 'book-spell', id: `magia-${spell.id}` },
    el('header', {}, el('div', {}, el('h3', {}, spell.nome), el('p', {}, `${spell.classes || 'Classe não indicada'} · ${spell.fonte || ''}`)),
      el('button', { class: 'book-add no-print', onclick: () => addSpell(spell) }, '+ Adicionar à ficha')),
    el('p', {}, spell.descricao || ''),
    el('dl', {},
      spell.Custo ? [el('dt', {}, 'Custo'), el('dd', {}, spell.Custo)] : '',
      spell.Duração ? [el('dt', {}, 'Duração'), el('dd', {}, spell.Duração)] : '',
      prereqs ? [el('dt', {}, 'Pré-requisitos'), el('dd', {}, crossLinkSpells(prereqs, db))] : '',
      spell.Objetos ? [el('dt', {}, 'Objetos'), el('dd', {}, spell.Objetos)] : ''));
}

function crossLinkSpells(text, db) {
  const container = el('span', {});
  const names = (db.spells || []).filter(spell => spell.nome !== text && normalize(text).includes(normalize(spell.nome))).slice(0, 6);
  if (!names.length) return text;
  let rest = text;
  for (const spell of names) {
    const index = normalize(rest).indexOf(normalize(spell.nome));
    if (index < 0) continue;
    container.append(rest.slice(0, index), el('a', { class: 'book-cross-ref', href: `#/livro/ler/magia/magia-${spell.id}` }, spell.nome));
    rest = rest.slice(index + spell.nome.length);
  }
  container.append(rest);
  return container;
}

/* ------------------------------- árvore de manobras (G.A.U.) ---------------- */
function preArvore(texto) { return el('pre', { class: 'book-tree', tabindex: '0' }, texto); }

/** Rótulo legível de um efeito estruturado de vantagem (data/advantages.json → efeitos). */
function rotuloEfeitoVantagem(efeito) {
  const nome = efeito.nome || efeito.alvo || efeito.id || '';
  const sinal = Number(efeito.valor) >= 0 ? '+' : '';
  switch (efeito.tipo) {
    case 'sentido': return `${nome} ${sinal}${efeito.valor}`;
    case 'defesaAtiva': return `${nome} ${sinal}${efeito.valor}${efeito.rd ? ` · RD ${efeito.rd}` : ''}`;
    case 'atributoEfetivo':
    case 'atributo': return `${nome} ${sinal}${efeito.valor}${efeito.contexto ? ` (IQ efetivo: ${efeito.contexto})` : ''}`;
    case 'testeGeral': return `${nome} ${sinal}${efeito.valor}${efeito.alcance ? ` em ${efeito.alcance}` : ''}`;
    case 'dano': return `+${efeito.valor} de dano${nome ? ` (${nome})` : ''}`;
    case 'panico': return `Pânico ${nome} ${sinal}${efeito.valor}`;
    case 'pericia': return `${nome}: ${sinal}${efeito.valor}${efeito.pericia ? ` em ${efeito.pericia}` : ''}`;
    case 'imunidade': return `Imunidade: ${nome}`;
    case 'dispensaPericia': return `Dispensa teste de ${nome}`;
    case 'acoesExtras': return `${nome}: ${efeito.valor}`;
    case 'statusDerivado': return `Status derivado: ${nome}`;
    default: return nome || efeito.tipo;
  }
}

function rotuloEfeitos(no) {
  const e = no.efeitos || {};
  const partes = [];
  if (e.modsAtaque) partes.push(`ataque ${e.modsAtaque > 0 ? '+' : ''}${e.modsAtaque}`);
  if (e.modsDefesaAlvo) partes.push(`defesa do alvo ${e.modsDefesaAlvo}`);
  if (e.ataques) partes.push(`${e.ataques} ataques`);
  if (Array.isArray(e.penalidadesPorAtaque) && e.penalidadesPorAtaque.length) partes.push(`por ataque: ${e.penalidadesPorAtaque.join(', ')}`);
  if (e.danoExtra) partes.push(`dano ${e.danoExtra}`);
  if (e.danoCenario) partes.push(`dano de cenário ${e.danoCenario}`);
  if (e.danoFixoExtra) partes.push(`+${e.danoFixoExtra} de dano`);
  if (e.danoExtraEstruturas) partes.push(`+${e.danoExtraEstruturas} contra estruturas`);
  if (e.ignoraRD) partes.push(`ignora ${e.ignoraRD} de RD`);
  if (e.localizacao) partes.push('escolha de localização');
  if (e.condicao) partes.push(`condição: ${e.condicao}`);
  if (e.area) partes.push('controle de área');
  if (e.grauMaximo) partes.push(`limitado a GD ${e.grauMaximo}`);
  if (e.arremesso) partes.push(`arremesso ${e.arremesso}`);
  if (e.recuoAte) partes.push(`recuo de até ${e.recuoAte} m`);
  if (e.atravessaAlvo) partes.push('atravessa o alvo');
  return partes;
}

function arvoreManobra(no, nivel = 0) {
  const filhos = [...(no.estilos || []), ...(no.formas || []), ...(no.caminhos || []), ...(no.derivacoes || []), ...(no.opcoes || [])];
  const efeitos = rotuloEfeitos(no);
  return el('li', { class: 'book-tree-node' },
    el('div', { class: 'book-tree-head' },
      el('b', {}, no.rotulo ? `${no.nome} ` : no.nome, no.rotulo ? el('small', {}, `(${no.rotulo})`) : ''),
      efeitos.length ? el('span', { class: 'book-tree-tags' }, efeitos.map(t => el('code', {}, t))) : ''),
    no.descricao ? el('p', {}, no.descricao) : '',
    no.textoEfeito ? el('p', { class: 'book-source' }, no.textoEfeito) : '',
    (no.requisitos || []).length ? el('p', { class: 'book-source' }, `Requisitos: ${no.requisitos.join('; ')}`) : '',
    no._aviso ? editorialBox('warning', 'REGRA NÃO DEFINIDA', el('p', {}, no._aviso)) : '',
    filhos.length ? el('ul', { class: 'book-tree-list' }, filhos.map(f => arvoreManobra(f, nivel + 1))) : '');
}

function secaoManobra(article, db, manobra, id, titulo) {
  const raizes = [...(manobra.estilos || []), ...(manobra.formas || []), ...(manobra.caminhos || [])];
  section(article, id, titulo,
    el('p', {}, manobra.descricao || ''),
    ...(manobra.notas || []).map(n => el('p', { class: 'book-source' }, typeof n === 'string' ? n : n.texto || '')),
    manobra._avisoDistancia ? editorialBox('warning', 'REGRA NÃO DEFINIDA', el('p', {}, manobra._avisoDistancia)) : '',
    manobra.diferenca ? editorialBox('note', 'DIVISÃO', el('p', {}, manobra.divisao || ''), el('p', {}, manobra.diferenca)) : '',
    raizes.length ? el('ul', { class: 'book-tree-list' }, raizes.map(r => arvoreManobra(r))) : '',
    manobra.usos ? el('ul', {}, (Array.isArray(manobra.usos) ? manobra.usos : [manobra.usos]).map(u => el('li', {}, typeof u === 'string' ? u : u.texto || ''))) : '',
    manobra.regra ? el('p', { class: 'book-source' }, manobra.regra) : '');
}

function renderReferenceGrid(value) {
  if (!value) return el('p', {}, '—');
  if (Array.isArray(value)) return value.length && typeof value[0] === 'object' ? objectArrayTable(value) : el('ul', {}, value.map(item => el('li', {}, String(item))));
  if (typeof value !== 'object') return el('p', {}, String(value));
  const entries = Object.entries(value).filter(([key]) => !key.startsWith('_') && key !== 'fonte');
  return el('div', { class: 'book-reference-grid' }, entries.map(([key, item]) => el('article', {},
    el('h3', {}, titleCase(key)), renderValue(item))));
}

function renderValue(value) {
  if (value == null) return el('p', {}, '—');
  if (typeof value === 'string' || typeof value === 'number') return el('p', {}, String(value));
  if (Array.isArray(value)) return value.length && typeof value[0] === 'object' ? objectArrayTable(value) : el('ul', {}, value.map(item => el('li', {}, String(item))));
  return renderReferenceGrid(value);
}

function renderCell(value) {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join(' · ');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${titleCase(key)}: ${item}`).join(' · ');
  return String(value);
}

function actionLink(label, href, variant = '', icon = '') { return el('a', { class: `book-action ${variant}`, href }, icon ? el('span', { 'aria-hidden': 'true' }, icon) : '', label); }
function feature(title, text) { return el('article', {}, el('span', {}, title.slice(0, 1)), el('div', {}, el('h2', {}, title), el('p', {}, text))); }
function chapterFooterLinks(left, right, leftLabel, rightLabel) { return el('nav', { class: 'book-page-actions' }, actionLink(`← ${leftLabel}`, left), actionLink(`${rightLabel} →`, right)); }
function bookSubHeader(title, subtitle, icon = '☰') { return el('header', { class: 'book-subheader' }, actionLink('GUA', '#/livro', 'quiet'), el('div', {}, el('p', {}, icon), el('h1', {}, title), el('p', {}, subtitle))); }

/* -------------------------------- integrações com a ficha ------------------ */
function addSkill(skill) {
  if ((store.atual?.pericias || []).some(item => item.id === skill.id)) return toast(`${skill.nome} já está na ficha.`, 'bad');
  updateFromBook(pc => pc.pericias.push({ id: skill.id, pontos: 0.5, especialidade: null }));
  toast(`${skill.nome} adicionada com ½ ponto.`, 'ok');
}
function addSpell(spell) {
  if ((store.atual?.magias || []).some(item => item.id === spell.id)) return toast(`${spell.nome} já está na ficha.`, 'bad');
  updateFromBook(pc => pc.magias.push({ id: spell.id, pontos: 1 }));
  toast(`${spell.nome} adicionada à ficha.`, 'ok');
}
function addTrait(item, list) {
  if ((store.atual?.[list] || []).some(entry => entry.id === item.id)) return toast(`${item.nome} já está na ficha.`, 'bad');
  updateFromBook(pc => pc[list].push({ id: item.id, nome: item.nome }));
  toast(`${item.nome} adicionada à ficha.`, 'ok');
}
function addEquipment(item) {
  updateFromBook(pc => {
    const existing = (pc.inventario || []).find(entry => entry.id === item.id);
    if (existing) existing.qtd = (existing.qtd || 1) + 1;
    else pc.inventario.push(novoItem(item, 1));
  });
  toast(`${item.nome} adicionado ao inventário.`, 'ok');
}
function updateFromBook(mutator) {
  const y = typeof window !== 'undefined' ? window.scrollY : 0;
  store.update(mutator);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => window.scrollTo({ top: y }));
}

/* -------------------------------- progresso de leitura --------------------- */
function setupReadingProgress(article, toc, progress, fill, label, chapter, chapters, targetSection, restorePosition) {
  if (typeof window === 'undefined') return () => {};
  let frame = null;
  let lastPersist = 0;
  const headings = [...article.querySelectorAll('.book-section[id], .book-anchor[id], .book-spell[id]')];
  const chapterIndex = chapters.findIndex(item => item.id === chapter.id);
  const update = () => {
    frame = null;
    const rect = article.getBoundingClientRect();
    const readable = Math.max(1, rect.height - window.innerHeight * .7);
    const fraction = Math.max(0, Math.min(1, (96 - rect.top) / readable));
    const percent = ((chapterIndex + fraction) / chapters.length) * 100;
    const active = [...headings].reverse().find(node => node.getBoundingClientRect().top <= 180) || headings[0];
    const sectionId = active?.id || chapter.secoes?.[0]?.id || '';
    progress.setAttribute('aria-valuenow', String(Math.round(percent)));
    fill.style.width = `${percent}%`;
    label.textContent = `Capítulo ${chapterIndex + 1} de ${chapters.length} · ${Math.round(percent)}%`;
    toc.querySelectorAll('[data-section]').forEach(link => link.classList.toggle('active', link.dataset.section === sectionId));
    const now = Date.now();
    if (now - lastPersist > 250) {
      lastPersist = now;
      writeProgress({ chapterId: chapter.id, sectionId, scrollY: window.scrollY, percent, updatedAt: new Date().toISOString() });
    }
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(() => {
    const target = targetSection ? document.getElementById(targetSection) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.classList.add('book-highlight');
      setTimeout(() => target.classList.remove('book-highlight'), 1800);
    } else if (restorePosition) {
      const saved = readProgress();
      if (saved?.chapterId === chapter.id) window.scrollTo({ top: saved.scrollY || 0 });
    } else window.scrollTo({ top: 0 });
    update();
  });
  return () => {
    window.removeEventListener('scroll', onScroll);
    if (frame) cancelAnimationFrame(frame);
    document.body?.classList?.remove('book-reading-mode');
  };
}

function readProgress() { try { return JSON.parse(localStorage.getItem(READING_KEY) || 'null'); } catch { return null; } }
function writeProgress(value) { try { localStorage.setItem(READING_KEY, JSON.stringify(value)); } catch { /* armazenamento indisponível */ } }

/* -------------------------------- utilidades -------------------------------- */
function groupBy(items, fn) { return (items || []).reduce((groups, item) => { (groups[fn(item)] ||= []).push(item); return groups; }, {}); }
function readDataRef(db, ref) { return String(ref).split('.').reduce((value, key) => value?.[key], db); }
function titleCase(value) { const text = String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1); }
function slug(value) { return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function normalize(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
