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
    section(article, 'como-consultar', 'Como consultar',
      el('div', { class: 'book-instruction-grid' },
        instruction('⌕', 'Pesquisa', 'Procura nome, descrição, categoria e referência, ignorando acentos.'),
        instruction('☷', 'Filtros', 'Combina opções com OR dentro de um grupo e AND entre grupos.'),
        instruction('⚡', 'Modo rápido', 'Prioriza regras, tabelas e números durante a sessão.'),
        instruction('↗', 'Vínculos', 'Leva do livro à ficha ou ao banco correspondente.')));
  },

  criacao(article, db) {
    section(article, 'atributos', 'Atributos',
      el('p', {}, 'Os quatro atributos básicos formam a base dos testes e de diversos valores derivados. A tabela abaixo é a mesma consultada pelo motor de personagem.'),
      editorialBox('rule', 'CUSTO DE ATRIBUTO', el('p', {}, 'O custo depende do valor final do atributo. Valores acima do limite publicado permanecem marcados como não definidos.')),
      keyValueTable('Valor', 'Custo em pontos', db.tables.custoAtributos?.tabela || {}),
      editorialBox('warning', 'LIMITE PUBLICADO', el('p', {}, db.tables.custoAtributos?.progressao || '—')));
    section(article, 'custos-pericias', 'Custos de perícias',
      el('p', {}, 'A dificuldade e a natureza física ou mental determinam quantos pontos são necessários para cada nível relativo ao atributo-base.'),
      skillCostTable('Perícias físicas', db.tables.custoPericias?.fisicas),
      skillCostTable('Perícias mentais', db.tables.custoPericias?.mentais));
    section(article, 'fluxo-criacao', 'Fluxo de criação',
      el('ol', { class: 'book-steps' },
        step('01', 'Conceito', 'Defina quem é o personagem antes de distribuir pontos.'),
        step('02', 'Atributos', 'Compre ST, DX, IQ e HT conforme a tabela publicada.'),
        step('03', 'Traços', 'Escolha vantagens, desvantagens e peculiaridades.'),
        step('04', 'Perícias', 'Invista pontos e confira defaults e pré-requisitos.'),
        step('05', 'Revisão', 'A ficha calcula custos e mostra o saldo disponível.')),
      actionLink('Abrir criação na ficha', '#/personagem', 'inline', '🧙'));
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
    section(article, 'vantagens', 'Vantagens',
      el('p', {}, 'Capacidades e posições favoráveis, apresentadas com o custo e a descrição do material.'),
      definitionTable(db.advantages, 'vantagem', item => item.custo || 'variável', item => addTrait(item, 'vantagens')));
    section(article, 'desvantagens', 'Desvantagens',
      el('p', {}, 'Limitações que ajudam a definir o personagem e afetam a contagem de pontos.'),
      definitionTable(db.disadvantages, 'desvantagem', item => item.custo || 'variável', item => addTrait(item, 'desvantagens')));
    section(article, 'peculiaridades', 'Peculiaridades',
      editorialBox('important', 'LIMITE', el('p', {}, `Máximo de ${db.quirks?.maximo ?? 5} peculiaridades, com −1 ponto cada, fora do limite de desvantagens.`)),
      el('div', { class: 'book-columns' }, (db.quirks?.exemplos || []).map(item => el('p', {}, `◆ ${item}`))));
  },

  combate(article, db) {
    const maneuvers = db.maneuvers || {};
    section(article, 'rodada', 'Início da rodada',
      editorialBox('rule', 'RODADA DE COMBATE', renderValue(maneuvers.inicioRodada)),
      actionLink('Abrir painel de combate', '#/combate', 'inline', '⚔'));
    section(article, 'manobras', 'Manobras',
      scrollTable(['Manobra', 'Sistema básico', 'Sistema avançado'], (maneuvers.manobras || []).map(item => [el('b', {}, item.nome), item.basico || '—', item.avancado || '—'])));
    section(article, 'defesas', 'Defesas', editorialBox('important', 'DEFESA ATIVA', renderValue(maneuvers.defesas)));
    section(article, 'ferimentos', 'Ferimentos', renderReferenceGrid(db.tables.ferimentos));
    section(article, 'tipos-dano', 'Tipos de dano', renderReferenceGrid(db.tables.tiposDano),
      el('h3', {}, 'Locais de impacto'), renderReferenceGrid(db.tables.locaisImpacto));
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
    section(article, 'mana', 'Níveis de mana',
      editorialBox('rule', 'MANA', el('p', {}, 'O nível de mana altera quem pode lançar magias e quais modificadores se aplicam.')),
      keyValueTable('Nível', 'Efeito', db.tables.mana?.niveis || {}));
    section(article, 'rituais', 'Rituais e custo',
      objectArrayTable(db.tables.rituaisMagia?.faixas || []),
      editorialBox('important', 'REDUÇÃO POR NH', el('p', {}, db.tables.reducaoCustoEnergia?.regra || '—')));
    const groups = groupBy(db.spells || [], spell => spell.escola || 'Outras');
    section(article, 'catalogo-magias', 'Catálogo de magias',
      ...Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([school, spells]) =>
        el('details', { class: 'book-catalog-group' },
          el('summary', {}, `${school} `, el('span', {}, spells.length)),
          el('div', { class: 'book-spell-list' }, spells.map(spell => spellEntry(spell, db))))));
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
