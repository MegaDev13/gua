/* GAU — Renderização do Livro Digital */

import { el } from './ui.js';
import { FilterSystem, FILTER_CATEGORIES, WEAPON_FILTERS } from './filters.js';

export function renderBookPage(main, db, params, storage, filterSystem) {
  const capitulos = db.book.capitulos || [];
  // Robust parse: suporta #/livro/testes, #/livro/testes/margem, #/livro/testes#margem e até #/livro/testes#margem velho
  let capIdRaw = params[0] || 'testes';
  let anchorFromParams = params[1] || null;
  // Se capId veio com # (formato antigo #/livro/testes#sec), separa
  if (capIdRaw && capIdRaw.includes('#')) {
    const [c, a] = capIdRaw.split('#');
    capIdRaw = c || 'testes';
    if (a) anchorFromParams = a;
  }
  // Se anchor ainda contém #, pega última parte
  if (anchorFromParams && anchorFromParams.includes('#')) {
    anchorFromParams = anchorFromParams.split('#').pop();
  }
  const capId = capIdRaw || 'testes';
  const cap = capitulos.find(c => c.id === capId) || capitulos.find(c => c.id !== 'capa') || capitulos[0];

  // Atualiza TOC lateral
  renderTOC(db, capId, storage, anchorFromParams);

  // Filtros laterais
  renderFilters(filterSystem);

  // Conteúdo principal
  const bookMode = storage.getBookMode();

  main.innerHTML = '';

  if (capId === 'capa' || cap.id === 'capa') {
    main.append(renderCapa(db));
    return;
  }

  const wrapper = el('div', { class: bookMode ? 'book-mode animate-fadeInUp' : 'animate-fadeInUp' });

  // Header
  wrapper.append(
    el('div', { class: 'book-header' },
      el('div', { class: 'book-chapter-num' }, `Capítulo ${cap.numero} • ${cap.descricao || ''}`),
      el('h1', { class: 'book-chapter-title' }, cap.titulo),
      cap.descricao ? el('div', { class: 'book-chapter-desc' }, cap.descricao) : ''
    )
  );

  // Ações topo
  const actions = el('div', { class: 'btn-row no-print', style: 'margin-bottom:1.2rem' },
    el('button', { class: 'btn small', onclick: () => { storage.setBookMode(!storage.getBookMode()); renderBookPage(main, db, params, storage, filterSystem); } },
      bookMode ? '📄 Modo Leitura Normal' : '📖 Modo Livro Físico'
    ),
    el('button', { class: 'btn small ghost', onclick: () => { document.getElementById('searchInput')?.focus(); document.getElementById('searchModal')?.removeAttribute('hidden'); } }, '🔍 Buscar neste capítulo')
  );
  wrapper.append(actions);

  // Seções
  if (cap.secoes) {
    for (const sec of cap.secoes) {
      if (!shouldShowSection(sec, filterSystem)) continue;
      wrapper.append(renderSecao(sec, db, filterSystem));
    }
  }

  // Paginação
  const idx = capitulos.findIndex(c => c.id === cap.id);
  const prev = idx > 0 ? capitulos[idx-1] : null;
  const next = idx < capitulos.length-1 ? capitulos[idx+1] : null;
  const pag = el('div', { class: 'book-pagination no-print' },
    prev ? el('a', { href: `#/livro/${prev.id}` }, `← ${prev.titulo}`) : el('span', {}),
    el('span', { class: 'book-page-number' }, `p. ${cap.numero} • GAU v2.0`),
    next ? el('a', { href: `#/livro/${next.id}` }, `${next.titulo} →`) : el('span', {})
  );
  wrapper.append(pag);

  main.append(wrapper);

  // Scroll para âncora se houver — FIX: agora suporta /secao e #secao e faz scroll confiável
  const anchorToScroll = anchorFromParams;
  if (anchorToScroll) {
    // tenta algumas vezes porque render pode ser assíncrono e imagens podem mudar layout
    const tryScroll = (attempt = 0) => {
      const target = document.getElementById(anchorToScroll);
      if (target) {
        // Se estiver dentro de .main que não tem scroll, usa window. Calcula offset do topbar sticky
        const topbarH = document.querySelector('.topbar')?.offsetHeight || 62;
        const rect = target.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY - topbarH - 12;
        window.scrollTo({ top: absoluteTop, behavior: attempt === 0 ? 'smooth' : 'auto' });
        // highlight temporário
        target.classList.add('anchor-highlight');
        setTimeout(() => target.classList.remove('anchor-highlight'), 2000);
      } else if (attempt < 5) {
        setTimeout(() => tryScroll(attempt + 1), 150);
      }
    };
    setTimeout(() => tryScroll(0), 120);
  }

  // Animação de reveal
  observeReveal();
}

function shouldShowSection(sec, filterSystem) {
  if (!filterSystem.hasFilters()) return true;
  // lógica simples: se filtro ativo inclui regra, mostra tudo que não é arma/tabela específica?
  // Para livro, filtros de tipo afetam seções com tabela específica
  const tipos = filterSystem.active;
  if (tipos.size === 0) return true;
  // Se seção tem tabela, verifica tipo
  if (sec.tabela) {
    if (sec.tabela === 'armas' && !tipos.has('arma') && !tipos.has('tabela')) return false;
    if (['luminosidade','localizacao','defesas','grau-dano','dano-arremesso','escalada','panico'].includes(sec.tabela) && !tipos.has('tabela') && !tipos.has('regra')) return false;
    if (sec.tabela === 'margins' && !tipos.has('tabela') && !tipos.has('regra')) return false;
  }
  if (sec.arvore && !tipos.has('manobra')) return false;
  return true;
}

function renderSecao(sec, db, filterSystem) {
  const secEl = el('section', { id: sec.id, class: 'book-section reveal' });

  // Título
  secEl.append(el('h2', { id: sec.id }, sec.titulo));

  // Tipo badge
  if (sec.tipo) {
    const tipoMap = { regra: '📜 Regra', exemplo: '💡 Exemplo', destaque: '✨ Destaque', aviso: '⚠️ Aviso' };
    secEl.append(el('div', { class: `pill ${sec.tipo === 'regra' ? 'gold' : sec.tipo === 'exemplo' ? 'ok' : 'warn'}`, style: 'margin-bottom:.8rem' }, tipoMap[sec.tipo] || sec.tipo));
  }

  // Conteúdo
  if (sec.conteudo) {
    const paras = sec.conteudo.split('\n\n');
    for (const p of paras) {
      if (!p.trim()) continue;
      // Detecta listas com -
      if (p.includes('\n- ') || p.trim().startsWith('- ')) {
        const items = p.split('\n').filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^- /, '').trim());
        if (items.length) {
          secEl.append(el('ul', {}, ...items.map(it => el('li', {}, it))));
          // resto do texto antes da lista?
          const before = p.split('\n- ')[0];
          if (before && !before.trim().startsWith('-')) {
            secEl.prepend(el('p', {}, before));
          }
          continue;
        }
      }
      secEl.append(el('p', {}, p));
    }
  }

  // Tabela associada
  if (sec.tabela) {
    const tabelaEl = renderTabelaPorId(sec.tabela, db, filterSystem);
    if (tabelaEl) secEl.append(tabelaEl);
  }

  // Árvore
  if (sec.arvore) {
    const arvoreEl = renderArvore(sec.arvore, db);
    if (arvoreEl) secEl.append(arvoreEl);
  }

  // Subseções
  if (sec.subsecoes) {
    for (const sub of sec.subsecoes) {
      const subEl = el('div', { class: 'book-subsection' });
      subEl.append(el('h3', {}, sub.titulo));
      if (sub.conteudo) {
        const paras = sub.conteudo.split('\n\n');
        for (const p of paras) {
          if (!p.trim()) continue;
          subEl.append(el('p', { class: 'no-dropcap' }, p));
        }
      }
      if (sub.tabela) {
        const t = renderTabelaPorId(sub.tabela, db, filterSystem);
        if (t) subEl.append(t);
      }
      if (sub.arvore) {
        const a = renderArvore(sub.arvore, db);
        if (a) subEl.append(a);
      }
      secEl.append(subEl);
    }
  }

  return secEl;
}

function renderTabelaPorId(id, db, filterSystem) {
  if (id === 'margins') {
    return renderTabelaMargens(db.margins);
  }
  if (id === 'armas') {
    return renderTabelaArmas(db.weapons, filterSystem);
  }
  if (db.tables[id]) {
    return renderTabelaGenerica(db.tables[id], id);
  }
  return null;
}

function renderTabelaMargens(margins) {
  if (!margins.tabela) return null;
  const wrap = el('div', { class: 'highlight-box' },
    el('div', { class: 'box-title', style: 'font-weight:700;color:var(--gold2);margin-bottom:.6rem;display:flex;align-items:center;gap:.4rem' }, '📊 Tabela Básica de Margens de Sucesso e Crítico'),
    el('div', { class: 'tbl-scroll' },
      el('table', { class: 'tbl' },
        el('tr', {}, el('th', {}, 'Valor'), el('th', {}, 'Margem'), el('th', {}, 'Crítico'), el('th', {}, 'Descrição')),
        ...margins.tabela.map(row => el('tr', {},
          el('td', { class: 'num' }, String(row.valor)),
          el('td', { class: 'num' }, row.margemTexto),
          el('td', { class: 'num' }, row.critico != null ? String(row.critico) : '—'),
          el('td', {}, row.descricao)
        ))
      )
    ),
    el('p', { class: 'table-caption' }, margins.extrapolacao || '')
  );
  return wrap;
}

function renderTabelaGenerica(tabelaObj, id) {
  const wrap = el('div', { class: tabelaObj.tabela ? 'rule-box' : 'highlight-box' },
    el('div', { class: 'box-title' }, tabelaObj.fonte || id),
    tabelaObj._aviso ? el('div', { class: 'pill warn', style: 'margin:.4rem 0' }, tabelaObj._aviso) : '',
    tabelaObj.regras ? el('p', { class: 'no-dropcap', style: 'font-size:.9rem;color:var(--ink-dim)' }, tabelaObj.regras) : '',
    tabelaObj.nota ? el('p', { class: 'no-dropcap', style: 'font-size:.85rem;color:var(--ink-dim);font-style:italic' }, tabelaObj.nota) : ''
  );

  if (Array.isArray(tabelaObj.tabela)) {
    const table = el('table', { class: 'tbl' });
    // header a partir das chaves do primeiro objeto
    const first = tabelaObj.tabela[0];
    if (first && typeof first === 'object') {
      const headers = Object.keys(first);
      table.append(el('tr', {}, ...headers.map(h => el('th', {}, h))));
      for (const row of tabelaObj.tabela) {
        table.append(el('tr', {}, ...headers.map(h => el('td', { class: typeof row[h] === 'number' ? 'num' : '' }, String(row[h] ?? '')))));
      }
    }
    wrap.append(el('div', { class: 'tbl-scroll' }, table));
  } else if (tabelaObj.tabela && typeof tabelaObj.tabela === 'object') {
    // objeto não array? ignorar
  }

  if (tabelaObj.regrasEspeciais) {
    wrap.append(el('ul', {}, ...tabelaObj.regrasEspeciais.map(r => el('li', { style: 'font-size:.85rem' }, r))));
  }

  return wrap;
}

function renderTabelaArmas(weapons, filterSystem) {
  if (!weapons.categorias) return null;
  const wrap = el('div', { class: 'highlight-box' },
    el('div', { class: 'box-title', style: 'font-weight:700;color:var(--gold2);margin-bottom:.6rem' }, '⚔️ Tabelas de Dano — Mundano, Moderno e Futurista')
  );

  // Filtros de armas inline
  const filterRow = el('div', { class: 'btn-row', style: 'margin-bottom:.8rem' });
  for (const f of WEAPON_FILTERS) {
    const active = filterSystem.isWeaponActive(f.id);
    filterRow.append(el('button', {
      class: `filter-pill ${active ? 'active' : ''}`,
      onclick: () => filterSystem.toggleWeapon(f.id)
    }, `${f.icon} ${f.label}`));
  }
  filterRow.append(el('button', { class: 'btn small ghost', onclick: () => filterSystem.clear() }, 'Limpar'));
  wrap.append(filterRow);

  for (const cat of weapons.categorias) {
    // filtra armas dentro da categoria
    let armasFiltradas = cat.armas;
    if (filterSystem.weaponActive.size > 0) {
      armasFiltradas = armasFiltradas.filter(a => {
        const catMatch = filterSystem.isWeaponActive(cat.id);
        const tipoMatch = filterSystem.isWeaponActive(a.tipo);
        const hasCat = [...filterSystem.weaponActive].some(id => ['mundano','moderno','futurista'].includes(id));
        const hasTipo = [...filterSystem.weaponActive].some(id => ['corpo-a-corpo','distancia','area'].includes(id));
        if (hasCat && hasTipo) return catMatch || tipoMatch;
        if (hasCat) return catMatch;
        if (hasTipo) return tipoMatch;
        return true;
      });
      if (armasFiltradas.length === 0) continue;
    }

    wrap.append(el('h3', { style: 'margin-top:1.2rem' }, `${cat.nome} (${armasFiltradas.length})`));
    wrap.append(el('p', { class: 'no-dropcap', style: 'font-size:.85rem;color:var(--ink-dim)' }, cat.descricao));
    const table = el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Arma'), el('th', {}, 'Dano'), el('th', {}, 'Média'), el('th', {}, 'Característica'), el('th', {}, 'Tipo')),
      ...armasFiltradas.map(a => el('tr', {},
        el('td', {}, el('b', {}, a.nome)),
        el('td', { class: 'num' }, a.dano),
        el('td', { class: 'num' }, String(a.media)),
        el('td', {}, a.caracteristica),
        el('td', {}, el('span', { class: 'pill small' }, a.tipo))
      ))
    );
    wrap.append(el('div', { class: 'tbl-scroll' }, table));
  }

  return wrap;
}

function renderArvore(id, db) {
  const maneuvers = db.maneuvers;
  let root = null;
  if (id === 'movimento') root = maneuvers.movimento;
  else if (id === 'ataque') root = maneuvers.ataque;
  else if (id === 'preparar') root = maneuvers.preparar;
  else if (id === 'apontar') root = maneuvers.apontar;
  else if (id === 'analisar') root = maneuvers.analisar;
  else return null;

  const wrap = el('div', { class: 'maneuver-tree' },
    el('div', { class: 'tree-node root' },
      el('div', { class: 'tree-label' }, root.nome),
      el('div', { class: 'tree-desc' }, root.descricao || '')
    )
  );

  const renderNode = (node, depth = 1) => {
    const nodeEl = el('div', { class: 'tree-node', style: `margin-left:${depth * 1.2}rem` },
      el('div', { class: 'tree-label' }, node.nome || node.id),
      node.descricao ? el('div', { class: 'tree-desc' }, node.descricao) : '',
      node.bonus ? el('div', { class: 'tree-bonus' }, node.bonus) : '',
      node.penalidade ? el('div', { class: 'tree-bonus', style: 'background:rgba(212,87,75,.12);border-color:rgba(212,87,75,.3);color:var(--bad)' }, `Penalidade ${node.penalidade}`) : ''
    );
    return nodeEl;
  };

  const walk = (obj, depth, container) => {
    if (!obj) return;
    const arrays = ['estilos','caminhos','formas','tipos','acoes','opcoes'];
    for (const key of arrays) {
      if (Array.isArray(obj[key])) {
        for (const child of obj[key]) {
          container.append(renderNode(child, depth));
          if (child.derivacao) {
            container.append(renderNode(child.derivacao, depth+1));
          }
          // recursivo
          walk(child, depth+1, container);
        }
      }
    }
    // caminhos especiais em apontar
    if (obj.precisao?.caminhos) {
      for (const c of obj.precisao.caminhos) {
        container.append(renderNode(c, depth));
      }
    }
  };

  walk(root, 1, wrap);

  // Se for apontar, renderiza tabela PREC
  if (id === 'apontar' && root.precisao?.tabela) {
    const table = el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Categoria'), el('th', {}, 'Exemplos'), el('th', {}, 'PREC')),
      ...root.precisao.tabela.map(r => el('tr', {}, el('td', {}, r.categoria), el('td', {}, r.exemplos), el('td', { class: 'num' }, `+${r.prec}`)))
    );
    wrap.append(el('div', { style: 'margin-top:1rem' }, el('h4', {}, 'Tabela de Precisão das Armas'), el('div', { class: 'tbl-scroll' }, table)));
  }

  return wrap;
}

function renderTOC(db, activeCapId, storage, activeSectionId) {
  const tocEl = document.getElementById('toc');
  if (!tocEl) return;
  tocEl.innerHTML = '';
  const capitulos = db.book.capitulos || [];
  for (const cap of capitulos) {
    if (cap.id === 'capa') continue;
    const isActive = cap.id === activeCapId;
    const a = el('a', { href: `#/livro/${cap.id}`, class: isActive ? 'active' : '', dataset: { cap: cap.id } },
      el('span', { class: 'toc-num' }, String(cap.numero).padStart(2,'0')),
      el('span', {}, cap.titulo)
    );
    if (isActive) {
      // sub seções — FIX: usa / em vez de # para que params[1] funcione e scroll seja confiável
      const subWrap = el('div', { style: 'margin:.3rem 0 .6rem 1.2rem;display:flex;flex-direction:column;gap:.15rem' });
      if (cap.secoes) {
        for (const sec of cap.secoes.slice(0, 30)) {
          const isSecActive = sec.id === activeSectionId;
          subWrap.append(el('a', {
            href: `#/livro/${cap.id}/${sec.id}`,
            class: `toc-section${isSecActive ? ' active' : ''}`,
            dataset: { sec: sec.id, cap: cap.id }
          }, sec.titulo));
        }
      }
      const wrapper = el('div', {}, a, subWrap);
      tocEl.append(wrapper);
    } else {
      tocEl.append(a);
    }
  }

  // Click handler delegado: se já estamos no capítulo ativo, faz scroll direto sem re-render pesado
  tocEl.onclick = (e) => {
    const link = e.target.closest('a.toc-section');
    if (!link) return;
    const cap = link.dataset.cap;
    const sec = link.dataset.sec;
    if (cap === activeCapId) {
      // já no mesmo capítulo — scroll direto, evita route() re-render
      e.preventDefault();
      const target = document.getElementById(sec);
      if (target) {
        const topbarH = document.querySelector('.topbar')?.offsetHeight || 62;
        const rect = target.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY - topbarH - 12;
        window.scrollTo({ top: absoluteTop, behavior: 'smooth' });
        // atualiza hash sem disparar route desnecessário? Mas queremos que hash reflita seção
        if (location.hash !== `#/livro/${cap}/${sec}`) {
          history.replaceState(null, '', `#/livro/${cap}/${sec}`);
        }
        // highlight
        document.querySelectorAll('.toc-section.active').forEach(el => el.classList.remove('active'));
        link.classList.add('active');
        target.classList.add('anchor-highlight');
        setTimeout(() => target.classList.remove('anchor-highlight'), 2000);
      } else {
        // fallback: navega normal
        location.hash = `#/livro/${cap}/${sec}`;
      }
      // fecha sidebar no mobile
      if (window.innerWidth <= 900) {
        setTimeout(() => {
          document.getElementById('sidebar')?.classList.remove('open');
          document.getElementById('sidebarBackdrop')?.setAttribute('hidden','');
        }, 250);
      }
    }
    // se capítulo diferente, deixa o hashchange fazer route normal — sidebar será fechado pelo handler global
  };
}

function renderFilters(filterSystem) {
  const container = document.getElementById('sidebarFilters');
  if (!container) return;
  container.innerHTML = '';
  const title = el('div', { style: 'font-size:.75rem;font-weight:600;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem' }, 'Filtros');
  container.append(title);
  const row = el('div', { style: 'display:flex;flex-wrap:wrap;gap:.3rem' });
  for (const cat of FILTER_CATEGORIES) {
    const active = filterSystem.isActive(cat.id);
    row.append(el('button', {
      class: `filter-pill ${active ? 'active' : ''}`,
      onclick: () => filterSystem.toggle(cat.id)
    }, `${cat.icon} ${cat.label}`));
  }
  if (filterSystem.hasFilters()) {
    row.append(el('button', { class: 'btn small ghost', style: 'padding:.2rem .5rem;font-size:.7rem', onclick: () => filterSystem.clear() }, '✕ Limpar'));
  }
  container.append(row);

  // Adiciona mini tabela de pontos no sidebar quando houver personagem
  try {
    const { storage } = window._gauStorage ? window._gauStorage : { storage: null };
    // tenta importar storage global se disponível, senão usa localStorage direto
    const raw = localStorage.getItem('gau_atual_v2');
    if (raw) {
      // não faz nada aqui, widget principal já mostra
    }
  } catch {}
}

function renderCapa(db) {
  const book = db.book;
  return el('div', { class: 'capa-hero animate-fadeInUp' },
    el('img', { src: book.capa || 'book/images/capa.svg', alt: 'Capa GAU', class: 'capa-logo' }),
    el('h1', { class: 'capa-title' }, book.titulo || 'GAU'),
    el('p', { class: 'capa-subtitle' }, book.subtitulo || 'Sistema Universal'),
    el('div', { class: 'capa-meta' },
      el('span', { class: 'meta-item' }, '📖 4 Capítulos'),
      el('span', { class: 'meta-item' }, '⚔️ Árvores Táticas'),
      el('span', { class: 'meta-item' }, '🎲 d20 Margens'),
      el('span', { class: 'meta-item' }, '🗡️ 64 Armas')
    ),
    el('div', { class: 'capa-actions' },
      el('a', { href: '#/livro/testes', class: 'btn primary large' }, '📖 Entrar no Grimório'),
      el('a', { href: '#/criar', class: 'btn large' }, '⚔️ Forjar Personagem')
    ),
    el('div', { class: 'capa-ornament' }, '❦'),
    el('div', { class: 'capa-quote' },
      '“Atributo determina a capacidade, categoria determina a escala e a margem determina o resultado necessário. Os dados determinam a capacidade de alcançar essa margem.”',
      el('div', { style: 'text-align:right;margin-top:.6rem;font-size:.8rem;color:var(--ink-faint)' }, '— Princípio Fundamental de GAU')
    ),
    el('div', { class: 'ornament-divider', style: 'margin-top:2.5rem;width:100%;max-width:500px' }, el('span', {}, '◈'))
  );
}

function observeReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}
