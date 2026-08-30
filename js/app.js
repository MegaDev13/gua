/* GAU — App principal, roteamento e orquestração
   SPA com hash routing, sem frameworks, 100% GitHub Pages compatível
   Correção para primeira página bugada: fallback estático + loading robusto
*/

import DB from './db.js';
import { el, toast, downloadJSON } from './ui.js';
import { storage, novoPersonagemBase } from './storage.js';
import { SearchEngine } from './search.js';
import { FilterSystem } from './filters.js';
import { renderBookPage } from './book.js';
import { renderCharacterBuilder } from './character-builder.js';
import { computeCharacter } from './character-calculator.js';
import { exportarPDFFicha } from './export-pdf.js';
import { exportarPNGFicha } from './export-png.js';
import { testarMargem, getGrauDano } from './dice.js';
import { calcularCustoTotal, PONTOS_PRESETS } from './points-system.js';

const PAGES = [
  { id: 'capa', nome: 'Capa', icon: '🏰', showInNav: false },
  { id: 'livro', nome: 'O Livro', icon: '📖', showInNav: true },
  { id: 'criar', nome: 'Criar Personagem', icon: '⚔️', showInNav: true },
  { id: 'personagens', nome: 'Meus Personagens', icon: '👥', showInNav: true },
  { id: 'ficha', nome: 'Ficha', icon: '📜', showInNav: false },
  { id: 'glossario', nome: 'Glossário', icon: '📚', showInNav: true },
  { id: 'config', nome: 'Configurações', icon: '⚙️', showInNav: true },
];

let filterSystem = new FilterSystem();
let searchEngine = null;
let dbLoaded = false;

async function init() {
  const loadingEl = document.getElementById('loadingIndicator');
  const loadingError = document.getElementById('loadingError');
  const capaFallback = document.getElementById('capaFallback');

  // Mostra loading
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    console.log('GAU init: carregando DB...');
    await DB.load();
    dbLoaded = true;
    console.log('GAU DB ok, entradas:', DB.searchIndex.length);
    searchEngine = new SearchEngine(DB);

    // Tema
    const temaSalvo = storage.getTema();
    document.documentElement.setAttribute('data-theme', temaSalvo);
    updateThemeIcon(temaSalvo);

    montarNav();
    montarSeletorPersonagens();
    setupEventosGlobais();
    setupFiltros();

    // Esconde fallback estático e loading, pois JS carregou
    if (capaFallback) {
      // Mantém fallback para rota capa, mas remove duplicação
      // Se estivermos na capa, vamos re-renderizar via route() que substitui main
      // Então apenas esconde loading
    }
    if (loadingEl) loadingEl.style.display = 'none';

    window.addEventListener('hashchange', route);
    route();

    toast('Grimório conjurado! 📖', 'ok');

  } catch (e) {
    console.error('GAU init falhou:', e);
    if (loadingError) {
      loadingError.style.display = 'block';
      loadingError.innerHTML = `
        <strong>Falha ao carregar grimório:</strong> ${e.message}<br>
        <small style="display:block;margin-top:.5rem;color:var(--ink-faint)">
        Verifique:<br>
        • Está rodando via servidor? (python -m http.server) — file:// não funciona por causa de fetch<br>
        • GitHub Pages configurado para branch <code>arena/01a0543b-gua</code> ou <code>main</code>?<br>
        • Caminho <code>data/</code> existe? Tentativas: ${DB._baseTried?.slice(0,3).join(', ') || 'nenhuma'}<br>
        </small>
        <div style="margin-top:.8rem">
          <a href="#/livro/testes" class="btn small">📖 Tentar livro mesmo assim</a>
          <button class="btn small" onclick="location.reload()">🔄 Recarregar</button>
        </div>
      `;
    }
    if (loadingEl) loadingEl.style.display = 'block';
    // Mesmo com falha, tenta montar nav mínima
    try {
      montarNavFallback();
      montarSeletorPersonagens();
      setupEventosGlobais();
      window.addEventListener('hashchange', route);
      route();
    } catch (e2) {
      console.error('Fallback também falhou', e2);
    }
  }
}

function montarNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = '';
  for (const p of PAGES.filter(p => p.showInNav)) {
    const btn = el('button', {
      class: 'tab',
      dataset: { page: p.id },
      onclick: () => { location.hash = `#/${p.id}`; }
    }, `${p.icon} ${p.nome}`);
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
      btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
    nav.append(btn);
  }
}

function montarNavFallback() {
  // Se DB falhou, mantém links <a> estáticos já no HTML, mas garante que funcionem
  const nav = document.getElementById('nav');
  if (!nav || nav.children.length > 0) return;
  nav.innerHTML = `
    <a href="#/livro/testes" class="tab">📖 O Livro</a>
    <a href="#/criar/novo/identidade" class="tab">⚔️ Criar</a>
    <a href="#/personagens" class="tab">👥 Personagens</a>
    <a href="#/glossario" class="tab">📚 Glossário</a>
    <a href="#/config" class="tab">⚙️ Config</a>
  `;
}

function montarSeletorPersonagens() {
  const sel = document.getElementById('charSelect');
  if (!sel) return;
  sel.innerHTML = '';
  try {
    const lista = storage.getPersonagens();
    if (lista.length === 0) {
      sel.append(el('option', { value: '' }, 'Nenhum personagem'));
    } else {
      for (const p of lista) {
        sel.append(el('option', { value: p.id, selected: p.id === storage.getAtualId() }, p.nome || 'Sem nome'));
      }
    }
    sel.onchange = () => {
      storage.setAtualId(sel.value);
      route();
      atualizarPontosWidget();
    };
  } catch {
    sel.append(el('option', { value: '' }, 'Erro storage'));
  }
  atualizarPontosWidget();
}

function atualizarPontosWidget() {
  const widget = document.getElementById('pontosWidget');
  if (!widget) return;
  try {
    const char = storage.getAtual();
    if (!char) {
      widget.innerHTML = `<span style="color:var(--ink-faint);font-size:.75rem">Sem personagem</span>`;
      return;
    }
    const computed = computeCharacter(DB, char);
    const pts = computed.pontos || calcularCustoTotal(char, DB);
    const livreClass = pts.disponivel < 0 ? 'bad' : pts.disponivel <= 10 ? 'warn' : 'ok';
    const pct = Math.min(100, Math.max(0, (pts.totalGasto / (pts.pontosTotais || 150)) * 100));

    widget.innerHTML = '';
    const totalEl = el('span', { class: 'pw-total', title: 'Pontos totais' }, `${pts.pontosTotais} pts`);
    const gastoEl = el('span', { class: 'pw-gasto', title: `Gasto: ${pts.totalGasto}` }, `• ${pts.totalGasto} usados`);
    const livreEl = el('span', { class: `pw-livre ${livreClass}`, title: `Livres: ${pts.disponivel}` }, `${pts.disponivel >= 0 ? '' : ''}${pts.disponivel} livres`);

    const bar = el('span', { class: `pw-bar ${livreClass}` }, el('i', { style: `width:${pct}%` }));

    const btnMinus = el('button', { class: 'pw-btn', title: '-10 pontos totais', onclick: (e) => { e.stopPropagation(); ajustarPontosTotais(-10); } }, '−');
    const btnPlus = el('button', { class: 'pw-btn', title: '+10 pontos totais', onclick: (e) => { e.stopPropagation(); ajustarPontosTotais(10); } }, '+');

    // Presets dropdown
    const sel = el('select', {
      title: 'Mudar escala de pontos',
      onchange: (e) => {
        const v = parseInt(e.target.value,10);
        if (!isNaN(v)) definirPontosTotais(v);
      }
    });
    sel.append(el('option', { value: '' }, 'Escala...'));
    for (const pre of PONTOS_PRESETS) {
      sel.append(el('option', { value: String(pre.pontos) }, `${pre.nome} ${pre.pontos}`));
    }

    widget.append(btnMinus, totalEl, gastoEl, livreEl, bar, btnPlus, el('span', { class: 'pw-presets' }, sel));

    widget.onclick = () => {
      // Ao clicar, vai para página de pontos / finalizar
      const atualId = storage.getAtualId();
      if (atualId) location.hash = `#/criar/${atualId}/final`;
      else location.hash = `#/criar/novo/final`;
    };
    widget.style.cursor = 'pointer';
  } catch (e) {
    console.warn('pontos widget erro', e);
    widget.innerHTML = `<span style="color:var(--bad);font-size:.7rem">Erro pts</span>`;
  }
}

function ajustarPontosTotais(delta) {
  const char = storage.getAtual();
  if (!char) { toast('Crie um personagem primeiro','warn'); return; }
  const novo = Math.max(0, (char.pontosTotais ?? 150) + delta);
  char.pontosTotais = novo;
  storage.salvarPersonagem(char);
  atualizarPontosWidget();
  // Se estiver na builder, re-render
  const hash = location.hash;
  if (hash.includes('/criar/')) route();
  toast(`Pontos totais: ${novo}`,'ok');
}

function definirPontosTotais(total) {
  const char = storage.getAtual();
  if (!char) { toast('Crie um personagem primeiro','warn'); return; }
  char.pontosTotais = total;
  storage.salvarPersonagem(char);
  atualizarPontosWidget();
  if (location.hash.includes('/criar/')) route();
  toast(`Escala ${total} pts aplicada`,'ok');
}

// Expõe para builder chamar
window.atualizarPontosWidget = atualizarPontosWidget;
window.ajustarPontosTotais = ajustarPontosTotais;
window.definirPontosTotais = definirPontosTotais;

function setupEventosGlobais() {
  const btnSearch = document.getElementById('btnSearch');
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const btnCloseSearch = document.getElementById('btnCloseSearch');

  const openSearch = () => {
    if (!searchModal) return;
    searchModal.removeAttribute('hidden');
    setTimeout(() => searchInput?.focus(), 50);
  };
  const closeSearch = () => {
    if (!searchModal) return;
    searchModal.setAttribute('hidden','');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
  };

  btnSearch?.addEventListener('click', openSearch);
  btnCloseSearch?.addEventListener('click', closeSearch);
  searchModal?.addEventListener('click', (e) => { if (e.target === searchModal) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape' && searchModal && !searchModal.hasAttribute('hidden')) closeSearch();
  });

  searchInput?.addEventListener('input', () => {
    if (!searchEngine || !searchResults) return;
    const q = searchInput.value;
    const tipos = [...filterSystem.active];
    const results = searchEngine.search(q, { tipos });
    searchResults.innerHTML = '';
    const rendered = searchEngine.renderResults(results, q, (item) => {
      closeSearch();
      location.hash = item.ref;
    });
    searchResults.append(rendered);
  });

  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-theme') || 'dark';
    const novo = atual === 'dark' ? 'light' : 'dark';
    storage.setTema(novo);
    updateThemeIcon(novo);
    toast(`Tema ${novo === 'dark' ? 'escuro' : 'claro'} ativado`, 'ok');
  });

  const btnMenu = document.getElementById('btnMenu');
  const sidebar = document.getElementById('sidebar');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    sidebar?.classList.add('open');
    if (backdrop && window.innerWidth <= 900) backdrop.removeAttribute('hidden');
  }
  function closeSidebar() {
    sidebar?.classList.remove('open');
    if (backdrop) backdrop.setAttribute('hidden','');
  }

  btnMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sidebar?.classList.contains('open')) closeSidebar();
    else openSidebar();
  });
  btnCloseSidebar?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebar();
  });
  backdrop?.addEventListener('click', () => closeSidebar());

  // Fecha ao clicar fora — FIX robusto para bug do sumário que fechava ao abrir
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && sidebar?.classList.contains('open')) {
      const target = e.target;
      if (sidebar.contains(target)) return;
      if (btnMenu && (target === btnMenu || btnMenu.contains(target))) return;
      if (btnCloseSidebar && (target === btnCloseSidebar || btnCloseSidebar.contains(target))) return;
      // Não fecha se clicou no backdrop (já tratado) ou dentro de modal
      if (target.closest && target.closest('.modal-back')) return;
      closeSidebar();
    }
  });
  // Fecha ao navegar em link da TOC no mobile — FIX: toc-section já tem handler próprio com scroll suave
  document.getElementById('toc')?.addEventListener('click', (e) => {
    if (window.innerWidth <= 900) {
      const link = e.target.closest('a');
      if (link && !link.classList.contains('toc-section')) {
        // só fecha para links de capítulo; seção é tratada dentro de renderTOC
        setTimeout(() => closeSidebar(), 200);
      }
    }
  });
  // Fecha sidebar com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) closeSidebar();
  });

  const brand = document.getElementById('brand');
  brand?.addEventListener('click', () => location.hash = '#/capa');
  brand?.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = '#/capa'; });
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function setupFiltros() {
  filterSystem.onChange(() => {
    storage.setFiltros([...filterSystem.active, ...filterSystem.weaponActive]);
    const hash = location.hash.replace(/^#\/?/, '');
    if (hash.startsWith('livro')) route();
  });
  try {
    const salvos = storage.getFiltros();
    for (const f of salvos) {
      if (['regra','manobra','arma','tabela','empunhadura','poder','escala'].includes(f)) filterSystem.active.add(f);
      else filterSystem.weaponActive.add(f);
    }
  } catch {}
}

function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'capa';
  const [pageId, ...params] = raw.split('/');
  // Detecta se é navegação para âncora (ex: #/livro/testes/margem ou #/livro/testes#margem)
  const isAnchorNav = pageId === 'livro' && (params.length > 1 || (params[0] && params[0].includes('#')));
  const page = PAGES.find(p => p.id === pageId) || PAGES[0];

  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset?.page) t.toggleAttribute('aria-current', t.dataset.page === page.id);
  });

  const main = document.getElementById('main');
  if (!main) return;
  // Se for capa e temos fallback estático, mas DB carregou, limpa para re-render
  if (dbLoaded || page.id !== 'capa') {
    main.innerHTML = '';
  } else {
    // Se DB não carregou e é capa, mantém fallback estático
    if (document.getElementById('capaFallback')) return;
  }

  // Só reseta scroll se NÃO for navegação para âncora (evita flicker que impedia scroll até seção)
  if (!isAnchorNav) {
    main.scrollTop = 0;
    window.scrollTo(0,0);
  }

  try {
    if (page.id === 'capa') {
      renderCapaPage(main);
    } else if (page.id === 'livro') {
      if (!dbLoaded) {
        main.append(el('div', { class: 'panel' }, 'Carregando grimório... Se demorar, recarregue.'));
        return;
      }
      renderBookPage(main, DB, params, storage, filterSystem);
    } else if (page.id === 'criar') {
      if (!dbLoaded) {
        main.append(el('div', { class: 'panel' }, 'Carregando...'));
        return;
      }
      const atual = storage.getAtual();
      renderCharacterBuilder(main, DB, params, atual, () => montarSeletorPersonagens());
    } else if (page.id === 'personagens') {
      renderMeusPersonagens(main);
    } else if (page.id === 'ficha') {
      const id = params[0] || storage.getAtualId();
      renderFichaPage(main, id);
    } else if (page.id === 'glossario') {
      renderGlossario(main);
    } else if (page.id === 'config') {
      renderConfig(main);
    } else if (page.id === 'buscar') {
      document.getElementById('searchModal')?.removeAttribute('hidden');
      if (dbLoaded) renderBookPage(main, DB, ['testes'], storage, filterSystem);
      else renderCapaPage(main);
    } else {
      renderCapaPage(main);
    }
  } catch (e) {
    console.error('Erro route', e);
    main.append(el('div', { class: 'panel' },
      el('h2', {}, 'Erro ao renderizar página'),
      el('p', {}, e.message),
      el('pre', { style: 'font-size:.8rem;overflow:auto;max-height:200px' }, e.stack || ''),
      el('div', { class: 'btn-row' },
        el('a', { href: '#/capa', class: 'btn' }, '🏰 Voltar à capa'),
        el('button', { class: 'btn', onclick: () => location.reload() }, '🔄 Recarregar')
      )
    ));
  }

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) {
    if (page.id === 'livro') {
      sidebar.style.display = '';
    } else {
      sidebar.style.display = 'none';
      sidebar.classList.remove('open');
      if (backdrop) backdrop.setAttribute('hidden','');
    }
  }

  // Atualiza widget de pontos em todas páginas
  try { atualizarPontosWidget(); } catch {}
}

/* -------------------- Páginas -------------------- */

function renderCapaPage(main) {
  // Se já existe fallback estático e não carregou DB, não duplica
  if (!dbLoaded && document.getElementById('capaFallback')) return;

  const book = DB.book || { titulo: 'GAU', subtitulo: 'Sistema Universal', capa: './book/images/capa.svg', capitulos: [] };
  const allWeapons = DB.getAllWeapons ? DB.getAllWeapons() : [];
  const numCaps = (book.capitulos || []).filter(c => c.id !== 'capa').length || 4;
  const numManeuvers = DB.maneuvers ? Object.keys(DB.maneuvers).length : 5;

  main.innerHTML = '';
  main.append(
    el('div', { class: 'capa-hero animate-fadeInUp' },
      el('img', { src: book.capa || './book/images/capa.svg', alt: 'Capa GAU', class: 'capa-logo', width: '180', height: '180' }),
      el('h1', { class: 'capa-title' }, book.titulo || 'GAU'),
      el('p', { class: 'capa-subtitle' }, book.subtitulo || 'Sistema Universal — Testes, Combate e Sobrevivência'),
      el('div', { class: 'capa-meta' },
        el('span', { class: 'meta-item' }, `📖 ${numCaps} Capítulos`),
        el('span', { class: 'meta-item' }, `⚔️ ${numManeuvers} Árvores Táticas`),
        el('span', { class: 'meta-item' }, `🎲 Margem 10 = Humano`),
        el('span', { class: 'meta-item' }, `🗡️ ${allWeapons.length || 64} Armas`)
      ),
      el('div', { class: 'capa-actions' },
        el('a', { href: '#/livro/testes', class: 'btn primary large' }, '📖 Entrar no Grimório'),
        el('a', { href: '#/criar/novo/identidade', class: 'btn large' }, '⚔️ Forjar Personagem'),
        el('a', { href: '#/personagens', class: 'btn large ghost' }, '👥 Meus Personagens')
      ),
      el('div', { class: 'capa-ornament' }, '❦'),
      el('div', { class: 'capa-quote' },
        '“Atributo determina a capacidade, categoria determina a escala e a margem determina o resultado necessário. Os dados determinam a capacidade de alcançar essa margem.”',
        el('div', { style: 'text-align:right;margin-top:.6rem;font-size:.8rem;color:var(--ink-faint)' }, '— Princípio Fundamental de GAU')
      ),
      el('div', { class: 'grid cols-3', style: 'margin-top:2.5rem;max-width:800px;width:100%;text-align:left' },
        el('div', { class: 'panel' },
          el('h3', {}, '📜 Testes com Margens'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'Sistema d20 onde margem expande com atributo. Valor 10 = referência humana 8–12 crítico 10. 1 e 20 não são automáticos. Disputa vence quem está mais próximo do crítico.')
        ),
        el('div', { class: 'panel' },
          el('h3', {}, '⚔️ Combate Tático'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'Árvores de manobras: Movimento Linear/Difuso/Acrobático/Atlético, Ataque Simples/Acrobático/Pesado/Distância, Preparar, Apontar com PREC, Analisar e Fazer Nada.')
        ),
        el('div', { class: 'panel' },
          el('h3', {}, '🎲 Graus de Dano'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'GD1 Raspão 1–20, GD2 Em Cheio 21–64, GD3 Letal 65+. Tabelas mundanas, modernas e futuristas com 64 armas de adaga a canhão de fusão.')
        ),
        el('div', { class: 'panel' },
          el('h3', {}, '🧠 Psiquismo & Poderes'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'Potência = força bruta (alcance/dano), Habilidade = controle Mental/Difícil. Telepatia, Psicocinese, PES, Teleporte, Cura, Anti-Psi. Escala de feitos de 10-C Humano baixo até 0 Absoluto, dimensionalidade 0D a Transcendente, HAX.')
        ),
        el('div', { class: 'panel' },
          el('h3', {}, '📈 Escala de Feitos'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'Classificação de feitos: Parede, Construção, Quarteirão, Vilarejo, Cidade, Montanha, Ilha, País, Continente, Lua, Planeta, Estrela, Sistema Solar, Galáxia, Universo, Multiverso, Complexo, Hiperdimensional, Transcendência, Absoluto.')
        ),
        el('div', { class: 'panel' },
          el('h3', {}, '🌀 Dimensionalidade'),
          el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, '0D Ponto a 12D Dodeca, Finito >12D, Infinito e Transcendente. 4D > 3D: leis inferiores não afetam superior. Essencial para feitos sobrenaturais.')
        )
      ),
      el('div', { class: 'ornament-divider', style: 'margin-top:2.5rem;width:100%;max-width:500px' }, el('span', {}, '◈')),
      el('div', { style: 'margin-top:1rem;font-size:.8rem;color:var(--ink-faint);text-align:center' },
        'GAU v2.0 • Edição Digital • GitHub Pages • 100% client-side • localStorage • PDF/PNG/JSON',
        el('div', { style: 'margin-top:.5rem' }, `Base: ${window.location.pathname} • Hash: ${window.location.hash || '#/capa'}`)
      )
    )
  );
}

function renderMeusPersonagens(main) {
  const lista = storage.getPersonagens();
  main.append(
    el('h1', { class: 'page-title' }, '👥 Meus Personagens', el('small', {}, `${lista.length} forjados`)),
    el('p', { class: 'page-subtitle' }, 'Personagens salvos localmente no navegador. Exporte JSON para transportar entre dispositivos.')
  );

  if (lista.length === 0) {
    main.append(
      el('div', { class: 'empty-sheet panel' },
        el('div', { class: 'empty-icon' }, '⚔️'),
        el('h3', {}, 'Nenhum personagem forjado'),
        el('p', {}, 'Seu grimório está vazio. Forje seu primeiro personagem e ele aparecerá aqui, salvo automaticamente neste dispositivo.'),
        el('div', { class: 'btn-row', style: 'justify-content:center' },
          el('a', { href: '#/criar/novo/identidade', class: 'btn primary large' }, '⚔️ Forjar Primeiro Personagem')
        )
      )
    );
    return;
  }

  const grid = el('div', { class: 'grid cols-3' });
  for (const p of lista) {
    let computed;
    try { computed = computeCharacter(DB, p); } catch { computed = { identidade: { categoria: { nome: p.categoria || 'mundano' } }, atributos: { margens: {} }, validacao: { nivel: 'ok' }, derivados: { pesoEquip: 0 } }; }
    const card = el('div', { class: 'char-sheet', style: 'padding:0;cursor:pointer' },
      el('div', { class: 'sheet-header', style: 'padding:1rem' },
        el('div', { class: 'sheet-title-row' },
          el('div', {},
            el('h3', { class: 'sheet-char-name', style: 'font-size:1.3rem' }, p.nome || 'Sem nome'),
            el('div', { class: 'sheet-char-concept', style: 'font-size:.85rem' }, p.conceito || 'Sem conceito')
          ),
          el('div', { class: 'sheet-meta' },
            el('span', { class: 'meta-badge gold' }, computed.identidade.categoria.nome),
            el('span', { class: `pill ${computed.validacao.nivel === 'ok' ? 'ok' : computed.validacao.nivel === 'alerta' ? 'warn' : 'bad'}` }, computed.validacao.nivel)
          )
        )
      ),
      el('div', { class: 'sheet-body', style: 'padding:1rem;gap:.8rem' },
        el('div', { class: 'grid cols-4' },
          ...Object.entries(computed.atributos.margens || {}).map(([k,v]) => v ? el('div', { class: 'stat small' }, el('div', { class: 'label' }, k), el('div', { class: 'value' }, String(v.valor)), el('div', { class: 'hint' }, v.margemTexto)) : '')
        ),
        el('div', { class: 'btn-row' },
          el('a', { href: `#/ficha/${p.id}`, class: 'btn small primary' }, '📜 Ver Ficha'),
          el('a', { href: `#/criar/${p.id}/identidade`, class: 'btn small' }, '✏️ Editar'),
          el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); const dup = storage.duplicar(p.id); montarSeletorPersonagens(); renderMeusPersonagens(main); toast(`Duplicado: ${dup.nome}`,'ok'); } }, '⎘ Duplicar'),
          el('button', { class: 'btn small danger', onclick: (e) => { e.stopPropagation(); if (confirm(`Excluir ${p.nome}?`)) { storage.excluir(p.id); montarSeletorPersonagens(); renderMeusPersonagens(main); toast('Excluído','warn'); } } }, '🗑️ Excluir')
        ),
        el('div', { style: 'font-size:.7rem;color:var(--ink-faint);margin-top:.4rem' }, `Atualizado: ${new Date(p.atualizadoEm).toLocaleString('pt-BR')} • ${p.equipamentos?.length || 0} equip • ${p.pericias?.length || 0} perícias • ${(() => { try { const c = computeCharacter(DB, p); return `${c.pontos.totalGasto}/${c.pontos.pontosTotais} pts`; } catch { return `${p.pontosTotais||150} pts`; } })()}`)
      )
    );
    card.addEventListener('click', () => location.hash = `#/ficha/${p.id}`);
    grid.append(card);
  }

  main.append(grid);

  main.append(
    el('div', { class: 'panel', style: 'margin-top:1.5rem' },
      el('h3', {}, '💾 Backup & Transporte'),
      el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'Seus personagens ficam no localStorage deste navegador. Exporte para levar para outro dispositivo.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => {
          const backup = storage.exportarBackup();
          downloadJSON(backup, `gau_backup_${new Date().toISOString().slice(0,10)}.json`);
          toast('Backup exportado!','ok');
        }}, '📦 Exportar Backup JSON'),
        el('label', { class: 'btn' },
          '📥 Importar Backup',
          el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const text = await file.text();
              const obj = JSON.parse(text);
              storage.importarBackup(obj);
              montarSeletorPersonagens();
              renderMeusPersonagens(main);
              toast('Backup importado!','ok');
            } catch (err) { toast('Erro ao importar: '+err.message,'bad'); }
          }})
        )
      )
    )
  );
}

function renderFichaPage(main, id) {
  const char = id ? storage.getPersonagem(id) : storage.getAtual();
  if (!char) {
    main.append(
      el('div', { class: 'empty-sheet panel' },
        el('div', { class: 'empty-icon' }, '📜'),
        el('h3', {}, 'Nenhum personagem selecionado'),
        el('p', {}, 'Selecione um personagem no topo ou crie um novo.'),
        el('a', { href: '#/criar/novo/identidade', class: 'btn primary' }, 'Criar Personagem')
      )
    );
    return;
  }

  const computed = computeCharacter(DB, char);

  main.append(
    el('h1', { class: 'page-title' }, '📜 Ficha de Personagem', el('small', {}, `${char.nome} • ${computed.identidade.categoria.nome}`)),
    el('div', { class: 'btn-row no-print', style: 'margin-bottom:1rem' },
      el('a', { href: `#/criar/${char.id}/identidade`, class: 'btn' }, '✏️ Editar'),
      el('button', { class: 'btn', onclick: () => { const dup = storage.duplicar(char.id); montarSeletorPersonagens(); location.hash = `#/ficha/${dup.id}`; toast('Duplicado!','ok'); } }, '⎘ Duplicar'),
      el('button', { class: 'btn', onclick: () => { downloadJSON(char, `GAU_${char.nome.replace(/\s+/g,'_')}.json`); toast('JSON exportado','ok'); } }, '📦 JSON'),
      el('button', { class: 'btn', onclick: async () => { await exportarPDFFicha(computed, DB); toast('PDF gerado','ok'); } }, '📄 PDF'),
      el('button', { class: 'btn', onclick: async () => {
        const fichaEl = document.getElementById('fichaVisual');
        if (fichaEl) await exportarPNGFicha(fichaEl, `GAU_${char.nome.replace(/\s+/g,'_')}.png`);
        toast('PNG exportado','ok');
      }}, '🖼️ PNG')
    )
  );

  const ficha = el('div', { id: 'fichaVisual', class: 'char-sheet animate-fadeInUp' },
    el('div', { class: 'sheet-header' },
      el('div', { class: 'sheet-title-row' },
        el('div', {},
          el('h1', { class: 'sheet-char-name' }, computed.identidade.nome),
          el('div', { class: 'sheet-char-concept' }, computed.identidade.conceito || 'Sem conceito'),
          el('div', { style: 'font-size:.8rem;color:var(--ink-dim);margin-top:.3rem' }, `Jogador: ${computed.identidade.jogador || '—'} • Criado: ${new Date(char.criadoEm).toLocaleDateString('pt-BR')}`)
        ),
        el('div', { class: 'sheet-meta' },
          el('span', { class: 'meta-badge gold' }, `${computed.identidade.categoria.nome} • ${computed.identidade.categoria.dados}`),
          el('span', { class: 'meta-badge' }, `ST ${computed.atributos.ST} • DX ${computed.atributos.DX} • IQ ${computed.atributos.IQ} • HT ${computed.atributos.HT}`)
        )
      )
    ),
    el('div', { class: 'sheet-body' },
      el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '💪'), 'Atributos & Margens'),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'attr-grid' },
            ...Object.entries(computed.atributos.margens).map(([k,v]) => v ? el('div', { class: 'attr-card' },
              el('div', { class: 'attr-name' }, k),
              el('div', { class: 'attr-value' }, String(v.valor)),
              el('div', { class: 'attr-margin' }, `Margem ${v.margemTexto}`),
              el('div', { class: 'attr-crit' }, `Crítico ${v.critico} • ${v.descricao}`),
              el('div', { class: 'attr-bar' }, el('i', { style: `width:${Math.min(100, (v.valor/20)*100)}%` }))
            ) : '')
          ),
          el('div', { class: 'grid cols-3', style: 'margin-top:1rem' },
            el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Vontade'), el('div', { class: 'value' }, String(computed.atributos.vontade.valor)), el('div', { class: 'hint' }, `Margem ${computed.atributos.vontade.margem?.margemTexto || '—'}`)),
            el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Percepção'), el('div', { class: 'value' }, String(computed.atributos.percepcao.valor)), el('div', { class: 'hint' }, `Margem ${computed.atributos.percepcao.margem?.margemTexto || '—'}`)),
            el('div', { class: 'stat gold' }, el('div', { class: 'label' }, 'Deslocamento'), el('div', { class: 'value' }, `${computed.derivados.deslocamento.atual} m/s`), el('div', { class: 'hint' }, `Base ${computed.derivados.deslocamento.base} • Carga ${computed.derivados.deslocamento.carga.nome}`))
          )
        )
      ),
      el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '📊'), 'Derivados & Carga'),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'grid cols-3' },
            el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PF (Fadiga)'), el('div', { class: 'value' }, `${computed.derivados.pf.atual}/${computed.derivados.pf.max}`), el('div', { class: 'bar fat', style: 'margin-top:.4rem' }, el('i', { style: `width:${(computed.derivados.pf.atual/computed.derivados.pf.max)*100}%` }))),
            el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PV (Vida)'), el('div', { class: 'value' }, `${computed.derivados.pv.atual}/${computed.derivados.pv.max}`), el('div', { class: 'bar hp', style: 'margin-top:.4rem' }, el('i', { style: `width:${(computed.derivados.pv.atual/computed.derivados.pv.max)*100}%` }))),
            el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso Equipado'), el('div', { class: 'value' }, `${computed.derivados.pesoEquip.toFixed(1)}kg`), el('div', { class: 'hint' }, `Máx ${computed.derivados.deslocamento.carga.limites.max}kg`))
          ),
          el('div', { class: 'grid cols-3', style: 'margin-top:.8rem' },
            el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Levantar 1 mão'), el('div', { class: 'value' }, `${computed.derivados.levantamento.umaMao}kg`)),
            el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Levantar 2 mãos'), el('div', { class: 'value' }, `${computed.derivados.levantamento.duasMaos}kg`)),
            el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Costas'), el('div', { class: 'value' }, `${computed.derivados.levantamento.costas}kg`))
          )
        )
      ),
      computed.pericias.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '📜'), `Perícias (${computed.pericias.length})`),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'skill-list' },
            ...computed.pericias.map(p => el('div', { class: 'skill-item' },
              el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, p.nome), el('div', { class: 'meta', style: 'font-size:.75rem;color:var(--ink-faint)' }, p.descricao || '')),
              el('span', { class: 'skill-attr' }, p.atributoBase || ''),
              el('span', { class: 'skill-value' }, String(p.valor)),
              el('span', { class: 'skill-margin' }, p.margemTexto),
              el('button', { class: 'btn small ghost', onclick: () => {
                const res = testarMargem(p.valor, DB);
                toast(`${p.nome}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}${res.critico ? ' CRÍTICO!' : ''}`, res.sucesso ? 'ok' : 'bad');
              }}, '🎲')
            ))
          )
        )
      ) : '',
      computed.manobras.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '⚔️'), `Manobras (${computed.manobras.length})`),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'maneuver-chips' }, ...computed.manobras.map(m => el('span', { class: 'maneuver-chip active' }, m)))
        )
      ) : '',
      computed.poderes && computed.poderes.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '🧠'), `Poderes Psíquicos (${computed.poderes.length}) — ${computed.custoPoderes} pts`),
        el('div', { class: 'sheet-section-body' },
          ...computed.poderes.map(p => el('div', { class: 'panel', style: `margin-bottom:.8rem;border-color:${p.custom?'var(--accent)':'var(--gold)'}` },
            el('h3', {}, `${p.custom?'🧩 ':''}${p.nome} (${p.sigla}) — Pot ${p.potencia} — ${p.custoPot} pts — Alcance ${p.alcance} ${p.custom?'• custom':''}`),
            p.descricao ? el('p', { style: 'font-size:.8rem;color:var(--ink-dim);margin:.3rem 0' }, p.descricao.slice(0,200)) : '',
            el('div', { class: 'skill-list' },
              ...p.pericias.map(per => el('div', { class: 'skill-item' },
                el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${per.nome} ${per.custom?'🧩':''}`), el('div', { class: 'meta', style: 'font-size:.75rem;color:var(--ink-faint)' }, (per.descricao||'').slice(0,120))),
                el('span', { class: 'skill-value' }, String(per.nivel)),
                el('span', { class: 'skill-margin' }, per.margemTexto),
                el('button', { class: 'btn small ghost', onclick: () => {
                  const res = testarMargem(per.nivel, DB);
                  toast(`${per.nome}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}${res.critico ? ' CRÍTICO!' : ''}`, res.sucesso ? 'ok' : 'bad');
                }}, '🎲')
              ))
            )
          ))
        )
      ) : '',
      computed.magias && computed.magias.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '🔮'), `Magias (${computed.magias.length}) — ${computed.custoMagias} pts`),
        el('div', { class: 'sheet-section-body' },
          ...computed.magias.map(e => el('div', { class: 'panel', style: `margin-bottom:.8rem;border-color:${e.custom?'var(--accent)':'var(--gold)'}` },
            el('h3', {}, `${e.custom?'🧩 ':''}${e.nome} (${e.sigla}) — Nv ${e.nivel} — ${e.custoNivel} pts ${e.custom?'• custom':''}`),
            e.descricao ? el('p', { style: 'font-size:.8rem;color:var(--ink-dim);margin:.3rem 0' }, e.descricao.slice(0,200)) : '',
            el('div', { class: 'skill-list' },
              ...e.magias.map(mm => el('div', { class: 'skill-item' },
                el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${mm.nome} ${mm.custom?'🧩':''}`), el('div', { class: 'meta', style: 'font-size:.75rem;color:var(--ink-faint)' }, (mm.descricao||'').slice(0,120))),
                el('span', { class: 'skill-value' }, String(mm.nivel)),
                el('span', { class: 'skill-margin' }, mm.margemTexto),
                el('button', { class: 'btn small ghost', onclick: () => {
                  const res = testarMargem(mm.nivel, DB);
                  toast(`${mm.nome}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}`, res.sucesso ? 'ok' : 'bad');
                }}, '🎲')
              ))
            )
          ))
        )
      ) : '',
      computed.empunhadura ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '🤲'), 'Empunhadura'),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'equip-card', style: 'border-color:var(--gold)' },
            el('div', { class: 'equip-name' }, computed.empunhadura.nome),
            el('div', { class: 'pill gold', style: 'margin:.3rem 0' }, `${computed.empunhadura.especialidade} • ${computed.empunhadura.vantagem}`),
            el('div', { style: 'font-size:.85rem;color:var(--ink-dim)' }, computed.empunhadura.descricao)
          )
        )
      ) : '',
      computed.equipamentos.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '🛡️'), `Equipamentos (${computed.equipamentos.length})`),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'equip-grid' },
            ...computed.equipamentos.map(eq => {
              const grau = eq.media ? getGrauDano(eq.media) : null;
              return el('div', { class: 'equip-card' },
                el('div', { class: 'equip-name' }, eq.nome),
                el('div', { class: 'equip-stats' },
                  eq.dano ? el('span', { class: 'equip-stat' }, eq.dano) : '',
                  eq.media ? el('span', { class: 'equip-stat' }, `Média ${eq.media}`) : '',
                  grau ? el('span', { class: `pill ${grau.grau===3 ? 'bad' : grau.grau===2 ? 'warn' : 'ok'}` }, grau.nome) : '',
                  eq.categoria ? el('span', { class: 'equip-stat' }, eq.categoria) : '',
                  eq.peso ? el('span', { class: 'equip-stat' }, `${eq.peso}kg`) : ''
                ),
                eq.caracteristica ? el('div', { style: 'font-size:.8rem;color:var(--ink-dim);margin-top:.3rem' }, eq.caracteristica) : ''
              );
            })
          )
        )
      ) : '',
      computed.identidade.historia ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '📖'), 'História'),
        el('div', { class: 'sheet-section-body' }, el('p', { style: 'white-space:pre-wrap' }, computed.identidade.historia))
      ) : '',
      el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '💰'), `Pontos — ${computed.pontos.pontosTotais} totais | ${computed.pontos.totalGasto} gastos | ${computed.pontos.disponivel} livres`),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'bar gold', style: 'height:14px;margin-bottom:.8rem' }, el('i', { style: `width:${Math.min(100, (computed.pontos.totalGasto/computed.pontos.pontosTotais)*100)}%` })),
          el('table', { class: 'pontos-table' },
            el('tr', {}, el('th', {}, 'Categoria'), el('th', {}, 'Custo')),
            el('tr', {}, el('td', {}, 'Atributos (ST,DX,IQ,HT) 10pts/nível'), el('td', { class: 'num' }, `${computed.pontos.breakdown.atributos.total} pts`)),
            el('tr', {}, el('td', {}, 'Perícias 2pts/nível'), el('td', { class: 'num' }, `${computed.pontos.breakdown.pericias.total} pts`)),
            el('tr', {}, el('td', {}, `Manobras GRÁTIS ${computed.pontos.breakdown.manobras.quantidade}`), el('td', { class: 'num' }, `0 pts`)),
            el('tr', {}, el('td', {}, `Empunhadura GRÁTIS ${char.empunhadura||''}`), el('td', { class: 'num' }, `0 pts`)),
            el('tr', {}, el('td', {}, 'Poderes (Pot 5/3 + per 2)'), el('td', { class: 'num' }, `${computed.pontos.breakdown.poderes.total} pts`)),
            el('tr', {}, el('td', {}, 'Magias (Escola 3 + magia 2)'), el('td', { class: 'num' }, `${computed.pontos.breakdown.magias.total} pts`)),
            el('tr', { style: 'font-weight:700;background:var(--panel2)' }, el('td', {}, 'TOTAL'), el('td', { class: 'num' }, `${computed.pontos.totalGasto}/${computed.pontos.pontosTotais}`))
          ),
          el('div', { class: 'btn-row', style: 'margin-top:.6rem' },
            el('button', { class: 'btn small', onclick: () => { char.pontosTotais = Math.max(0, (char.pontosTotais||150)-10); storage.salvarPersonagem(char); location.reload(); } }, '−10 Totais'),
            el('button', { class: 'btn small', onclick: () => { char.pontosTotais = (char.pontosTotais||150)+10; storage.salvarPersonagem(char); location.reload(); } }, '+10 Totais'),
            el('button', { class: 'btn small', onclick: () => { char.pontosTotais = (char.pontosTotais||150)+50; storage.salvarPersonagem(char); location.reload(); } }, '+50'),
            el('select', {
              onchange: (e) => { const v = parseInt(e.target.value,10); if (!isNaN(v)) { char.pontosTotais = v; storage.salvarPersonagem(char); location.reload(); } },
              style: 'max-width:150px'
            },
              el('option', { value: '' }, 'Preset...'),
              ...PONTOS_PRESETS.map(pre => el('option', { value: String(pre.pontos) }, `${pre.nome} ${pre.pontos}`))
            )
          )
        )
      ),
      el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '✅'), 'Validação'),
        el('div', { class: 'sheet-section-body' },
          ...computed.validacao.erros.map(e => el('div', { class: 'validation-item bad' }, `⛔ ${e.msg}`)),
          ...computed.validacao.avisos.map(a => el('div', { class: 'validation-item warn' }, `⚠️ ${a.msg}`)),
          ...computed.validacao.infos.map(i => el('div', { class: 'validation-item ok' }, `ℹ️ ${i.msg}`)),
          computed.validacao.total === 0 ? el('div', { class: 'validation-item ok' }, '✅ Ficha válida!') : ''
        )
      )
    )
  );

  main.append(ficha);
}

function renderGlossario(main) {
  const termos = [
    { termo: 'Margem de Sucesso', def: 'Intervalo no d20 que é sucesso. Ex: 10 = 8–12.' },
    { termo: 'Crítico', def: 'Roll exatamente igual ao valor. Ex: 10 crítico 10.' },
    { termo: 'Categoria de Poder', def: 'Escala: Mundano 1d20, Sobre-Humano 2d20, Lendário 3d20, Cósmico 4d20+.' },
    { termo: 'Disputa', def: 'Vence quem está mais próximo do próprio crítico.' },
    { termo: 'Combate Impacto vs Mortal', def: 'Impacto = sem intenção de matar. Mortal = tentativa de matar.' },
    { termo: 'GD', def: 'Grau Dano: GD1 1–20 Raspão, GD2 21–64 Em cheio, GD3 65+ Letal.' },
    { termo: 'Empunhadura GRÁTIS', def: 'Uma Mão, Bastarda, Duas Mãos +1 Força, Tsuka +1 Mov, Zatoichi +2 pós-saque, Anatômica +1 Acrobático. Não custa pontos.' },
    { termo: 'Manobras GRÁTIS', def: 'Árvore tática não custa pontos. Movimento, Atacar, Preparar, Apontar, Analisar, Fazer Nada.' },
    { termo: 'PSIQUISMO', def: 'Habilidades da mente que exigem poder inato. Potência = força bruta (alcance/dano), Habilidade = controle (Mental/Difícil). TP/PK/Teleporte 5 pts/nível, PES/Cura/Anti-Psi 3 pts/nível. Travado: não deixa aumentar sem pontos.' },
    { termo: 'Potência', def: 'Força bruta do psiquismo. Igual para todas perícias de um poder. Controla alcance, dano, peso.' },
    { termo: 'Habilidade Psi', def: 'Controle da perícia psi, tipo Mental/Difícil, baseada em IQ. 2 pts/nível.' },
    { termo: 'Poder Custom', def: 'Crie seu próprio poder: nome, sigla, custo 5/3 pts, potência, fonte (psíquica/mágica/chi/divino/cósmico), foco, descrição. Entra no cálculo e ficha.' },
    { termo: 'Magia & Escolas', def: 'Escola = afinidade (Fogo, Água, Ar, Terra, Luz, Trevas, Mente, Tempo). Custo 3 pts/nível (Tempo 5). Magia individual 2 pts/nível. Pode criar escola/magia custom.' },
    { termo: 'Escolas Elementais', def: 'Fogo (dano), Água (cura/controle), Ar (movimento/ilusão), Terra (defesa). Custo 3 pts/nível.' },
    { termo: 'Escolas Luz/Trevas/Mente/Tempo', def: 'Luz (proteção), Trevas (debuff/necromancia), Mente (controle), Tempo 5 pts/nível (mais cara, manipula tempo).' },
    { termo: 'Magia Custom', def: 'Crie sua escola: nome, sigla, custo, nível, fonte, foco, descrição. E magias individuais dentro da escola. Tudo entra no custo.' },
    { termo: 'Pontos Travados', def: 'Sistema impede aumentar atributo/perícia/poder/magia se pontos livres insuficientes. Mostra toast e desabilita botão. Manobras e equipamentos grátis.' },
    { termo: 'Telepatia', def: 'Comunicação e controle mental. Alcance dobra por nível após 11. Não afetada por barreiras físicas.' },
    { termo: 'Escudo Mental', def: 'Defesa telepática. Força = Potência TP. Níveis 8- a 20+ determinam filtragem amistoso/hostil e disfarce.' },
    { termo: 'Psicocinese (PK)', def: 'Mover objetos à distância. Peso por Potência: 1=7g até 22=1 ton, +125kg/nível após.' },
    { termo: 'PES', def: 'Percepção Extra-Sensorial: Clarividência (ver através, alcance Pot²×2,5 cm), Clariaudiência, Psicometria (anos = Pot²), Precognição (tempo dias = Pot², -10, 2 PF, 10min).' },
    { termo: 'Psicoteleporte', def: 'Mover sem percorrer espaço. Auto = si +2,5kg, Exo = 10% peso TK. Falha = lugar parecido +2 PF, crítica = 1D horas atordoado.' },
    { termo: 'Cura Psíquica', def: 'Restaura HT até Potência, contato físico, custo 3×PV curado em PF, falha 1D PF, crítica 1D dano no alvo.' },
    { termo: 'Estática Psíquica (Cigarra)', def: 'Antipsi que interfere com todo psiquismo na área Potência. Disputa Estática vs perícia, custa 1 PF ao outro. Pré-definido IQ-4.' },
    { termo: 'Escala de Feitos', def: 'De 10-C Humano baixo a 0 Absoluto. Classifica destruição: 9-B Parede, 8-C Construção média, 8-B Quarteirão, 7-B Cidade, 7-A Montanha, 6-C Ilha, 6-B País, 6-A Continente, 5-B Planeta, 4-C Estrela, 4-B Sistema Solar, 3-C Galáxia, 3-A Universo, 2-C Multiverso pequeno, 2-A Multiverso infinito, 1-C Complexo, 1-B Hiperdimensional, 1-A Transcendência, 0 Absoluto.' },
    { termo: 'Dimensionalidade', def: '0D Ponto (11-C) a 12D Dodeca (1-B), Finito >12D, Infinito (High 1-B), Transcendente além de dimensionalidade (Low 1-A ~0). 4D > 3D: leis inferiores não afetam superior.' },
    { termo: 'HAX', def: 'Habilidade que permite vencer oponente com potência/escala maior por virtude de efeitos (ex: Paralisação Temporal, Manipulação Realidade). Relativo ao nível.' },
  ];
  main.append(el('h1', { class: 'page-title' }, '📚 Glossário'));
  const grid = el('div', { class: 'grid cols-2' });
  for (const t of termos) grid.append(el('div', { class: 'panel' }, el('h3', {}, t.termo), el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, t.def)));
  main.append(grid);
}

function renderConfig(main) {
  const temaAtual = storage.getTema();
  main.append(el('h1', { class: 'page-title' }, '⚙️ Configurações'));
  main.append(el('div', { class: 'panel' },
    el('h3', {}, 'Tema'),
    el('select', { onchange: (e) => { storage.setTema(e.target.value); document.documentElement.setAttribute('data-theme', e.target.value); updateThemeIcon(e.target.value); } },
      el('option', { value: 'dark', selected: temaAtual==='dark' }, 'Escuro'),
      el('option', { value: 'light', selected: temaAtual==='light' }, 'Claro')
    ),
    el('div', { style: 'margin-top:1rem;font-size:.85rem;color:var(--ink-dim)' }, `GitHub Pages base: ${window.location.pathname} • Se a primeira página estava bugada, agora tem fallback estático e loader robusto que tenta ./data/, /gua/data/, etc.`)
  ));
}

// Inicia
init();
