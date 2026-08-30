/* GAU — App principal, roteamento e orquestração
   SPA com hash routing, sem frameworks, 100% GitHub Pages compatível
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
import { testarMargem, rollD20, rollDice, getGrauDano } from './dice.js';

const PAGES = [
  { id: 'capa', nome: 'Capa', icon: '🏰', showInNav: false },
  { id: 'livro', nome: 'O Livro', icon: '📖', showInNav: true },
  { id: 'criar', nome: 'Criar Personagem', icon: '⚔️', showInNav: true },
  { id: 'personagens', nome: 'Meus Personagens', icon: '👥', showInNav: true },
  { id: 'ficha', nome: 'Ficha', icon: '📜', showInNav: false },
  { id: 'buscar', nome: 'Buscar', icon: '🔍', showInNav: false },
  { id: 'glossario', nome: 'Glossário', icon: '📚', showInNav: true },
  { id: 'config', nome: 'Configurações', icon: '⚙️', showInNav: true },
];

let filterSystem = new FilterSystem();
let searchEngine = null;

async function init() {
  await DB.load();
  searchEngine = new SearchEngine(DB);

  // Tema
  const temaSalvo = storage.getTema();
  document.documentElement.setAttribute('data-theme', temaSalvo);
  updateThemeIcon(temaSalvo);

  montarNav();
  montarSeletorPersonagens();
  setupEventosGlobais();
  setupFiltros();

  window.addEventListener('hashchange', route);
  route();
}

function montarNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const p of PAGES.filter(p => p.showInNav)) {
    const btn = el('button', {
      class: 'tab',
      dataset: { page: p.id },
      onclick: () => { location.hash = `#/${p.id}`; }
    }, `${p.icon} ${p.nome}`);
    // efeito de luz no mouse
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
      btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
    nav.append(btn);
  }
}

function montarSeletorPersonagens() {
  const sel = document.getElementById('charSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const lista = storage.getPersonagens();
  if (lista.length === 0) {
    sel.append(el('option', { value: '' }, 'Nenhum personagem'));
    return;
  }
  for (const p of lista) {
    sel.append(el('option', { value: p.id, selected: p.id === storage.getAtualId() }, p.nome || 'Sem nome'));
  }
  sel.onchange = () => {
    storage.setAtualId(sel.value);
    route();
  };
}

function setupEventosGlobais() {
  // Busca
  const btnSearch = document.getElementById('btnSearch');
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const btnCloseSearch = document.getElementById('btnCloseSearch');

  const openSearch = () => {
    searchModal.removeAttribute('hidden');
    setTimeout(() => searchInput.focus(), 50);
  };
  const closeSearch = () => {
    searchModal.setAttribute('hidden','');
    searchInput.value = '';
    searchResults.innerHTML = '';
  };

  btnSearch?.addEventListener('click', openSearch);
  btnCloseSearch?.addEventListener('click', closeSearch);
  searchModal?.addEventListener('click', (e) => { if (e.target === searchModal) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape' && !searchModal.hasAttribute('hidden')) closeSearch();
  });

  searchInput?.addEventListener('input', () => {
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

  // Tema
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-theme') || 'dark';
    const novo = atual === 'dark' ? 'light' : 'dark';
    storage.setTema(novo);
    updateThemeIcon(novo);
    toast(`Tema ${novo === 'dark' ? 'escuro' : 'claro'} ativado`, 'ok');
  });

  // Menu mobile
  const btnMenu = document.getElementById('btnMenu');
  const sidebar = document.getElementById('sidebar');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
  btnMenu?.addEventListener('click', () => sidebar.classList.add('open'));
  btnCloseSidebar?.addEventListener('click', () => sidebar.classList.remove('open'));
  // fechar sidebar ao navegar no mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== btnMenu) sidebar.classList.remove('open');
    }
  });

  // Brand click -> capa
  document.getElementById('brand')?.addEventListener('click', () => location.hash = '#/capa');
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function setupFiltros() {
  filterSystem.onChange(() => {
    storage.setFiltros([...filterSystem.active, ...filterSystem.weaponActive]);
    // re-render se estiver no livro
    const hash = location.hash.replace(/^#\/?/, '');
    if (hash.startsWith('livro')) route();
  });
  // restaura filtros salvos
  const salvos = storage.getFiltros();
  for (const f of salvos) {
    if (['regra','manobra','arma','tabela','empunhadura'].includes(f)) filterSystem.active.add(f);
    else filterSystem.weaponActive.add(f);
  }
}

function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'capa';
  const [pageId, ...params] = raw.split('/');
  const page = PAGES.find(p => p.id === pageId) || PAGES[0];

  // Atualiza tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.toggleAttribute('aria-current', t.dataset.page === page.id);
  });

  const main = document.getElementById('main');
  main.innerHTML = '';
  main.scrollTop = 0;
  window.scrollTo(0,0);

  try {
    if (page.id === 'capa') {
      renderCapaPage(main);
    } else if (page.id === 'livro') {
      renderBookPage(main, DB, params, storage, filterSystem);
    } else if (page.id === 'criar') {
      const atual = storage.getAtual();
      renderCharacterBuilder(main, DB, params, atual, (saved) => {
        montarSeletorPersonagens();
      });
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
      // abre modal de busca
      document.getElementById('searchModal')?.removeAttribute('hidden');
      renderBookPage(main, DB, ['testes'], storage, filterSystem);
    } else {
      renderCapaPage(main);
    }
  } catch (e) {
    console.error(e);
    main.append(el('div', { class: 'panel' },
      el('h2', {}, 'Erro ao renderizar página'),
      el('p', {}, e.message),
      el('pre', { style: 'font-size:.8rem;overflow:auto' }, e.stack || '')
    ));
  }

  // Mostra/esconde sidebar dependendo da página
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    if (page.id === 'livro') sidebar.style.display = '';
    else sidebar.style.display = 'none';
  }
}

/* -------------------- Páginas -------------------- */

function renderCapaPage(main) {
  const book = DB.book;
  const allWeapons = DB.getAllWeapons();
  main.append(
    el('div', { class: 'capa-hero animate-fadeInUp' },
      el('img', { src: book.capa || 'book/images/capa.svg', alt: 'Capa GAU', class: 'capa-logo' }),
      el('h1', { class: 'capa-title' }, book.titulo || 'GAU'),
      el('p', { class: 'capa-subtitle' }, book.subtitulo || 'Sistema Universal — Testes, Combate e Sobrevivência'),
      el('div', { class: 'capa-meta' },
        el('span', { class: 'meta-item' }, `📖 ${(book.capitulos||[]).length -1} Capítulos`),
        el('span', { class: 'meta-item' }, `⚔️ ${Object.keys(DB.maneuvers).length} Árvores Táticas`),
        el('span', { class: 'meta-item' }, `🎲 Margem 10 = Humano`),
        el('span', { class: 'meta-item' }, `🗡️ ${allWeapons.length} Armas`)
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
        )
      ),
      el('div', { class: 'ornament-divider', style: 'margin-top:2.5rem;width:100%;max-width:500px' }, el('span', {}, '◈')),
      el('div', { style: 'margin-top:1rem;font-size:.8rem;color:var(--ink-faint)' }, 'GAU v2.0 • Edição Digital • GitHub Pages • 100% client-side • localStorage • PDF/PNG/JSON')
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
    const computed = computeCharacter(DB, p);
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
          ...Object.entries(computed.atributos.margens).map(([k,v]) => v ? el('div', { class: 'stat small' }, el('div', { class: 'label' }, k), el('div', { class: 'value' }, String(v.valor)), el('div', { class: 'hint' }, v.margemTexto)) : '')
        ),
        el('div', { class: 'btn-row' },
          el('a', { href: `#/ficha/${p.id}`, class: 'btn small primary' }, '📜 Ver Ficha'),
          el('a', { href: `#/criar/${p.id}/identidade`, class: 'btn small' }, '✏️ Editar'),
          el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); const dup = storage.duplicar(p.id); montarSeletorPersonagens(); renderMeusPersonagens(main); toast(`Duplicado: ${dup.nome}`,'ok'); } }, '⎘ Duplicar'),
          el('button', { class: 'btn small danger', onclick: (e) => { e.stopPropagation(); if (confirm(`Excluir ${p.nome}?`)) { storage.excluir(p.id); montarSeletorPersonagens(); renderMeusPersonagens(main); toast('Excluído','warn'); } } }, '🗑️ Excluir')
        ),
        el('div', { style: 'font-size:.7rem;color:var(--ink-faint);margin-top:.4rem' }, `Atualizado: ${new Date(p.atualizadoEm).toLocaleString('pt-BR')} • ${p.equipamentos?.length || 0} equipamentos • ${p.pericias?.length || 0} perícias`)
      )
    );
    card.addEventListener('click', () => location.hash = `#/ficha/${p.id}`);
    grid.append(card);
  }

  main.append(grid);

  // Ações backup
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
      el('button', { class: 'btn', onclick: () => { downloadJSON(char, `GAU_${char.nome.replace(/\s+/g,'_')}.json`); toast('JSON exportado','ok'); } }, '📦 Exportar JSON'),
      el('button', { class: 'btn', onclick: async () => { await exportarPDFFicha(computed, DB); toast('PDF gerado','ok'); } }, '📄 Exportar PDF'),
      el('button', { class: 'btn', onclick: async () => {
        const fichaEl = document.getElementById('fichaVisual');
        if (fichaEl) await exportarPNGFicha(fichaEl, `GAU_${char.nome.replace(/\s+/g,'_')}.png`);
        toast('PNG exportado','ok');
      }}, '🖼️ Exportar PNG')
    )
  );

  // Ficha visual
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
      // Atributos
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
      // Derivados
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
      // Perícias
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
      // Manobras
      computed.manobras.length ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '⚔️'), `Manobras (${computed.manobras.length})`),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'maneuver-chips' },
            ...computed.manobras.map(m => el('span', { class: 'maneuver-chip active' }, m))
          )
        )
      ) : '',
      // Empunhadura
      computed.empunhadura ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '🤲'), 'Empunhadura'),
        el('div', { class: 'sheet-section-body' },
          el('div', { class: 'equip-card', style: 'border-color:var(--gold)' },
            el('div', { class: 'equip-name' }, computed.empunhadura.nome),
            el('div', { class: 'pill gold', style: 'margin:.3rem 0' }, `${computed.empunhadura.especialidade} • ${computed.empunhadura.vantagem}`),
            el('div', { style: 'font-size:.85rem;color:var(--ink-dim)' }, computed.empunhadura.descricao),
            el('div', { style: 'font-size:.8rem;color:var(--ink-faint);margin-top:.4rem' }, `Estilo: ${computed.empunhadura.estilo}`)
          )
        )
      ) : '',
      // Equipamentos
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
                eq.caracteristica ? el('div', { style: 'font-size:.8rem;color:var(--ink-dim);margin-top:.3rem' }, eq.caracteristica) : '',
                eq.tipo ? el('div', { style: 'margin-top:.3rem' }, el('span', { class: 'pill' }, eq.tipo)) : ''
              );
            })
          )
        )
      ) : '',
      // História
      computed.identidade.historia ? el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '📖'), 'História & Anotações'),
        el('div', { class: 'sheet-section-body' },
          el('p', { style: 'white-space:pre-wrap;line-height:1.6' }, computed.identidade.historia)
        )
      ) : '',
      // Validação
      el('div', { class: 'sheet-section' },
        el('div', { class: 'sheet-section-header' }, el('span', { class: 'section-icon' }, '✅'), 'Validação'),
        el('div', { class: 'sheet-section-body' },
          ...computed.validacao.erros.map(e => el('div', { class: 'validation-item bad' }, `⛔ ${e.msg}`)),
          ...computed.validacao.avisos.map(a => el('div', { class: 'validation-item warn' }, `⚠️ ${a.msg}`)),
          ...computed.validacao.infos.map(i => el('div', { class: 'validation-item ok' }, `ℹ️ ${i.msg}`)),
          computed.validacao.total === 0 ? el('div', { class: 'validation-item ok' }, '✅ Ficha válida, pronta para jogo!') : ''
        )
      )
    )
  );

  main.append(ficha);

  // Ações export (duplicado no final para mobile)
  main.append(
    el('div', { class: 'sheet-actions no-print' },
      el('div', { class: 'action-group' },
        el('span', { class: 'action-label' }, 'Exportar'),
        el('button', { class: 'btn small', onclick: () => downloadJSON(char, `GAU_${char.nome.replace(/\s+/g,'_')}.json`) }, '📦 JSON'),
        el('button', { class: 'btn small', onclick: async () => { await exportarPDFFicha(computed, DB); } }, '📄 PDF'),
        el('button', { class: 'btn small', onclick: async () => { await exportarPNGFicha(document.getElementById('fichaVisual'), `GAU_${char.nome.replace(/\s+/g,'_')}.png`); } }, '🖼️ PNG')
      ),
      el('div', { class: 'action-group' },
        el('span', { class: 'action-label' }, 'Testar'),
        el('button', { class: 'btn small', onclick: () => {
          const val = computed.atributos.ST;
          const res = testarMargem(val, DB);
          toast(`ST ${val}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}`, res.sucesso ? 'ok' : 'bad');
        }}, '💪 ST'),
        el('button', { class: 'btn small', onclick: () => {
          const val = computed.atributos.DX;
          const res = testarMargem(val, DB);
          toast(`DX ${val}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}`, res.sucesso ? 'ok' : 'bad');
        }}, '🤸 DX'),
        el('button', { class: 'btn small', onclick: () => {
          const val = computed.atributos.IQ;
          const res = testarMargem(val, DB);
          toast(`IQ ${val}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}`, res.sucesso ? 'ok' : 'bad');
        }}, '🧠 IQ')
      )
    )
  );
}

function renderGlossario(main) {
  const termos = [
    { termo: 'Margem de Sucesso', def: 'Intervalo de resultados no d20 que representa sucesso. Determinada pelo valor do atributo/habilidade. Ex: valor 10 = margem 8–12.' },
    { termo: 'Crítico', def: 'Resultado exatamente igual ao valor do atributo/habilidade. Efeito especial. Valor 10 crítico 10.' },
    { termo: 'Categoria de Poder', def: 'Escala de existência. Mundano = 1d20, Sobre-Humano = 2d20, Lendário = 3d20, Cósmico = 4d20+. Quantidade de dados representa escala, não bônus.' },
    { termo: 'Disputa de Habilidades', def: 'Quando ação ofensiva encontra defensiva, ambos testam. Vence quem estiver mais próximo do próprio crítico dentro da própria margem.' },
    { termo: 'Disputa Rápida', def: 'Decide em 1 turno. Ex: lutar por arma. Se ambos sucesso/falha, vence maior margem de sucesso ou menor margem de falha.' },
    { termo: 'Disputa Normal', def: 'Pode durar vários turnos. Ex: braço de ferro. Se ambos sucesso/falha, posição não muda.' },
    { termo: 'Combate de Impacto', def: 'Dano sem intenção de matar, roteirizado pelos jogadores. Maioria dos NPCs usa.' },
    { termo: 'Combate Mortal', def: 'Tentativa deliberada de matar. Inclui atacar caído, veneno, poderes letais, quedas, vácuo, etc.' },
    { termo: 'Manobra', def: 'Ação declarada no turno (1 segundo). Árvore determina o que é capaz de fazer.' },
    { termo: 'Movimento Linear', def: 'Deslocamento em linha reta. Ex: Investida (ataca durante percurso) e Mover-se e Atacar (ataca ao final).' },
    { termo: 'Movimento Difuso', def: 'Deslocamento imprevisível, zigue-zague. Finta (-2 ataque, alvo -2 defesa) e Ataque em Círculos (+2).' },
    { termo: 'Movimento Acrobático', def: 'Usa corpo para movimentos complexos: cambalhota, mortal. Pode atacar durante ou ao final.' },
    { termo: 'Movimento Atlético', def: 'Força física + ambiente: escalar, correr por paredes. Combo com Cenário (+1, Ataque Pesado) e Grande Salto.' },
    { termo: 'Ataque Simples', def: 'Ataque básico corpo-a-corpo. Deriva em Ataque Duplo (-2 no segundo) e Triplo (-4 no terceiro) e Golpe de Recuo.' },
    { termo: 'Ataque Acrobático', def: 'Usa DX em vez de ST. Pode ser Preciso (ignora penalidade localização), Penetrante (ignora 1 RD), Sequência (-1 em ambos), Potência (+10 dano).' },
    { termo: 'Ataque Pesado', def: 'Usa ST, +1d dano. Pode ser Duplo, Potente (arremessa ST/2 +1d cenário), Atordoante, Demolidor (área 5m, +10 vs estruturas).' },
    { termo: 'Saraivada', def: '3 ataques à distância na mesma ação. Evolui para Semiautomático (5 ataques -2) e Automático (10 ataques).' },
    { termo: 'Tiro Preciso', def: 'Concentra em único disparo, ignora penalidade localização.' },
    { termo: 'Tiro de Supressão', def: 'Controla área em vez de mirar indivíduo.' },
    { termo: 'Tiro Ricochete', def: 'Usa superfície para alterar trajetória. Pode exigir Analisar.' },
    { termo: 'Preparar', def: 'Sacar, apanhar, guardar objeto. Saque Rápido e Saque em Movimento, Ajustar Equipamento e Empunhaduras.' },
    { termo: 'Empunhadura', def: 'Estilo de segurar arma: Uma Mão (versátil), Bastarda (adaptação), Duas Mãos (+1 Força), Tsuka (+1 Movimento), Zatoichi (+2 após saque), Anatômica (+1 Acrobático).' },
    { termo: 'Apontar', def: 'Concentra mira para +PREC da arma. Pontaria Certeira: +1 por segundo adicional. Arma Firmada: +1 com apoio.' },
    { termo: 'PREC', def: 'Bônus de precisão da arma por categoria. Ex: Sniper +4, Rifle precisão +3, Arco simples +1.' },
    { termo: 'Analisar', def: 'Estuda situação antes de agir. Analisar Indivíduo (Movimento, Poderes, Ação), Cenário, Ambiente.' },
    { termo: 'Fazer Nada', def: 'Não realiza ação relevante. Usada quando surpreso, atordoado, esperando momento.' },
    { termo: 'Grau de Dano (GD)', def: 'Intensidade do impacto: GD1 Raspão 1–20, GD2 Em cheio 21–64, GD3 Letal 65+. Localização determina onde.' },
    { termo: 'Esquiva', def: 'Defesa ativa baseada em DX. Pode ser usada contra qualquer ataque.' },
    { termo: 'Aparar', def: 'Defesa com arma ou desarmado. Contra corpo-a-corpo e alguns à distância.' },
    { termo: 'Bloqueio', def: 'Defesa com escudo baseada em ST. Bônus do escudo.' },
    { termo: 'Luminosidade', def: 'Penalidade em Visão e Combate por luz: Luz Total 0 até Escuridão Total -10.' },
    { termo: 'Esforço Extra', def: 'Ir além dos limites por 1 PF. Vale para saltos, levantamento, defesas, etc.' },
    { termo: 'Verificação de Pânico', def: 'Teste de Vontade quando algo aterroriza. Falha = rola 3d + margem de falha na tabela de pânico (4 a 40+).' },
  ];

  main.append(
    el('h1', { class: 'page-title' }, '📚 Glossário', el('small', {}, `${termos.length} termos`)),
    el('p', { class: 'page-subtitle' }, 'Termos e conceitos do sistema GAU, extraídos diretamente do livro. Clique para buscar no grimório.')
  );

  const grid = el('div', { class: 'grid cols-2' });
  for (const t of termos) {
    const card = el('div', { class: 'panel', style: 'cursor:pointer' },
      el('h3', {}, t.termo),
      el('p', { style: 'font-size:.9rem;color:var(--ink-dim);margin:.4rem 0 0' }, t.def),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn small ghost', onclick: () => {
          document.getElementById('searchInput').value = t.termo;
          document.getElementById('searchModal').removeAttribute('hidden');
          const ev = new Event('input'); document.getElementById('searchInput').dispatchEvent(ev);
        }}, '🔍 Buscar')
      )
    );
    grid.append(card);
  }
  main.append(grid);
}

function renderConfig(main) {
  const temaAtual = storage.getTema();
  const bookMode = storage.getBookMode();

  main.append(
    el('h1', { class: 'page-title' }, '⚙️ Configurações'),
    el('p', { class: 'page-subtitle' }, 'Personalize sua experiência de leitura e forja.')
  );

  main.append(
    el('div', { class: 'grid cols-2' },
      el('div', { class: 'panel' },
        el('h3', {}, '🎨 Aparência'),
        el('div', { class: 'field-grid' },
          el('label', { class: 'field' }, 'Tema',
            el('select', { onchange: (e) => { storage.setTema(e.target.value); document.documentElement.setAttribute('data-theme', e.target.value); updateThemeIcon(e.target.value); toast(`Tema ${e.target.value}`,'ok'); }, value: temaAtual },
              el('option', { value: 'dark', selected: temaAtual==='dark' }, '🌙 Escuro — Grimório Noturno'),
              el('option', { value: 'light', selected: temaAtual==='light' }, '☀️ Claro — Pergaminho')
            )
          ),
          el('label', { class: 'field' }, 'Modo Livro Físico',
            el('select', { onchange: (e) => { storage.setBookMode(e.target.value==='true'); toast('Modo livro '+(e.target.value==='true'?'ativado':'desativado'),'ok'); }, value: String(bookMode) },
              el('option', { value: 'false', selected: !bookMode }, '📄 Normal'),
              el('option', { value: 'true', selected: bookMode }, '📖 Livro Físico (moldura decorativa)')
            )
          )
        )
      ),
      el('div', { class: 'panel' },
        el('h3', {}, '💾 Dados'),
        el('p', { style: 'font-size:.85rem;color:var(--ink-dim)' }, `${storage.getPersonagens().length} personagens salvos localmente.`),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: () => {
            const backup = storage.exportarBackup();
            downloadJSON(backup, `gau_backup_${new Date().toISOString().slice(0,10)}.json`);
          }}, '📦 Exportar Backup'),
          el('button', { class: 'btn danger', onclick: () => {
            if (confirm('Apagar TODOS os personagens? Esta ação não pode ser desfeita.')) {
              localStorage.clear();
              toast('Dados apagados','bad');
              location.reload();
            }
          }}, '🗑️ Apagar Tudo')
        )
      ),
      el('div', { class: 'panel' },
        el('h3', {}, '📖 Sobre GAU'),
        el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, 'GAU — Sistema Universal v2.0. Sistema d20 com margens de sucesso, categorias de poder por quantidade de dados, árvores de manobras táticas e graus de dano.'),
        el('ul', { style: 'font-size:.85rem;color:var(--ink-dim);padding-left:1.2rem' },
          el('li', {}, 'Valor 10 = referência humana, margem 8–12, crítico 10'),
          el('li', {}, '1 e 20 não são automáticos — apenas margem importa'),
          el('li', {}, 'Disputa: vence quem está mais próximo do próprio crítico'),
          el('li', {}, 'Combate: 1 turno = 1 segundo, sequência por deslocamento'),
          el('li', {}, 'GD1 1–20 Raspão, GD2 21–64 Em cheio, GD3 65+ Letal')
        )
      ),
      el('div', { class: 'panel' },
        el('h3', {}, '⌨️ Atalhos'),
        el('div', { class: 'tbl-scroll' },
          el('table', { class: 'tbl' },
            el('tr', {}, el('th', {}, 'Tecla'), el('th', {}, 'Ação')),
            el('tr', {}, el('td', {}, '/'), el('td', {}, 'Abrir busca global')),
            el('tr', {}, el('td', {}, 'ESC'), el('td', {}, 'Fechar modal/busca')),
            el('tr', {}, el('td', {}, 'Ctrl+S'), el('td', {}, 'Salvar personagem (na forja)'))
          )
        )
      )
    )
  );
}
