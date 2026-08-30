/* GAU — Forja de Personagens v3
   - Pontos atualizam em tempo real a cada mudança
   - Vantagens / Desvantagens / Peculiaridades como compra (vantagens custam, desvantagens dão pontos)
   - Perícias catálogo com filtros acumulativos (tipo, atributo, categoria, dificuldade, busca)
   - Magias como compra (escolas + magias)
   - Supabase sync
*/

import { el, toast } from './ui.js';
import { novoPersonagemBase, storage } from './storage.js';
import { computeCharacter } from './character-calculator.js';
import { testarMargem } from './dice.js';
import { PONTOS_PRESETS, CUSTOS } from './points-system.js';
import { supabaseService } from './supabase.js';

const STEPS = [
  { id: 'identidade', nome: 'Identidade', icon: '🧙', desc: 'Nome, conceito, pontos' },
  { id: 'atributos', nome: 'Atributos', icon: '💪', desc: '10 pts/nível' },
  { id: 'vantagens', nome: 'Vantagens', icon: '✨', desc: 'Comprar com pontos' },
  { id: 'desvantagens', nome: 'Desvantagens', icon: '💀', desc: 'Ganha pontos' },
  { id: 'peculiaridades', nome: 'Peculiaridades', icon: '🌀', desc: '-1 ponto cada' },
  { id: 'pericias', nome: 'Perícias', icon: '📜', desc: 'Catálogo filtrável 2 pts/nível' },
  { id: 'manobras', nome: 'Manobras', icon: '⚔️', desc: 'Grátis' },
  { id: 'poderes', nome: 'Poderes', icon: '🧠', desc: 'Psi 5/3 +2' },
  { id: 'magias', nome: 'Magias', icon: '🔮', desc: 'Escolas 3 + magias 2' },
  { id: 'equipamentos', nome: 'Equipamentos', icon: '🛡️', desc: 'Grátis' },
  { id: 'final', nome: 'Finalizar', icon: '🏁', desc: 'Revisão' }
];

let _draft = null;
let _draftId = null;

export function renderCharacterBuilder(main, db, params, currentChar, onSave) {
  const charIdParam = params[0];
  const stepParam = params[1] || 'identidade';
  let activeStep = STEPS.find(s => s.id === stepParam) ? stepParam : 'identidade';

  let baseChar = null;
  if (charIdParam && charIdParam !== 'novo') {
    if (_draft && _draftId === charIdParam) baseChar = _draft;
    else baseChar = storage.getPersonagem(charIdParam) || (_draft && _draft.id === charIdParam ? _draft : null);
  }
  if (!baseChar) {
    if (_draft && (charIdParam === 'novo' || !_draftId || _draftId === 'novo')) baseChar = _draft;
  }
  if (!baseChar) {
    baseChar = storage.getAtual() || novoPersonagemBase();
    if (charIdParam === 'novo' && _draft && _draftId === 'novo') baseChar = _draft;
    else if (charIdParam === 'novo') baseChar = novoPersonagemBase();
  }
  if (!baseChar) baseChar = novoPersonagemBase();

  let editing = JSON.parse(JSON.stringify(baseChar));
  if (!editing.id) editing.id = 'char_' + Date.now();
  if (editing.pontosTotais == null) editing.pontosTotais = 150;
  if (!editing.poderes) editing.poderes = {};
  if (!editing.magias) editing.magias = {};
  if (!editing.vantagens) editing.vantagens = [];
  if (!editing.desvantagens) editing.desvantagens = [];
  if (!editing.peculiaridades) editing.peculiaridades = [];
  if (!editing.pericias) editing.pericias = [];
  _draft = editing;
  _draftId = charIdParam || editing.id;

  function saveDraft() {
    _draft = JSON.parse(JSON.stringify(editing));
    _draftId = editing.id;
    if (window.atualizarPontosWidget) window.atualizarPontosWidget();
    // Supabase sync async
    supabaseService.salvar(editing).then(r => {
      if (r.ok) console.log('Supabase sync ok');
    });
  }

  function doRender() {
    const computed = computeCharacter(db, editing);
    const onPatch = (patch) => {
      const testChar = { ...editing, ...patch };
      const testComputed = computeCharacter(db, testChar);
      // Travamento: se aumenta gasto e não tem pontos, bloqueia (exceto quando aumenta pontosTotais)
      if (patch.pontosTotais == null || patch.pontosTotais <= editing.pontosTotais) {
        if (testComputed.pontos.disponivel < 0 && testComputed.pontos.totalGasto > computed.pontos.totalGasto) {
          // Se desvantagem/peculiaridade, ela REDUZ gasto, então pode ser negativa -> permite
          const isReducao = testComputed.pontos.totalGasto < computed.pontos.totalGasto;
          if (!isReducao) {
            toast(`Sem pontos! Faltam ${-testComputed.pontos.disponivel} pts.`, 'bad');
            return;
          }
        }
      }
      Object.assign(editing, patch);
      saveDraft();
      doRender();
    };

    main.innerHTML = '';
    const builder = el('div', { class: 'builder' });
    builder.append(
      el('h1', { class: 'page-title' }, '⚔️ Forja de Personagens', el('small', { id: 'builderTitleSmall' }, `${editing.nome ? editing.nome + ' • ' : ''}${editing.pontosTotais||150} pts • ${computed.pontos.disponivel} livres`)),
      el('p', { class: 'page-subtitle' }, 'Pontos atualizam em tempo real a cada mudança. Vantagens custam, desvantagens dão pontos, peculiaridades -1, manobras e equipamentos grátis.'),
      renderPontosBarra(computed, editing, onPatch, saveDraft)
    );

    const stepsEl = el('div', { class: 'builder-steps' });
    for (const step of STEPS) {
      const done = STEPS.findIndex(s => s.id === activeStep) > STEPS.findIndex(s => s.id === step.id);
      const isActive = step.id === activeStep;
      stepsEl.append(el('button', {
        class: `builder-step ${isActive ? 'active' : ''} ${done ? 'done' : ''}`,
        onclick: () => {
          saveDraft();
          if (editing.id) {
            activeStep = step.id;
            location.hash = `#/criar/${editing.id}/${step.id}`;
            doRender();
          } else location.hash = `#/criar/novo/${step.id}`;
        }
      }, el('span', { class: 'step-num' }, isActive ? '●' : done ? '✓' : STEPS.indexOf(step)+1), `${step.icon} ${step.nome}`));
    }
    builder.append(stepsEl);

    const content = el('div', { class: 'builder-content' });
    if (activeStep === 'identidade') content.append(renderIdentidade(editing, db, onPatch, saveDraft));
    if (activeStep === 'atributos') content.append(renderAtributos(editing, db, computed, onPatch));
    if (activeStep === 'vantagens') content.append(renderVantagens(editing, db, computed, onPatch));
    if (activeStep === 'desvantagens') content.append(renderDesvantagens(editing, db, computed, onPatch));
    if (activeStep === 'peculiaridades') content.append(renderPeculiaridades(editing, db, computed, onPatch));
    if (activeStep === 'pericias') content.append(renderPericiasCatalog(editing, db, computed, onPatch, saveDraft));
    if (activeStep === 'manobras') content.append(renderManobras(editing, db, computed, onPatch));
    if (activeStep === 'poderes') content.append(renderPoderes(editing, db, computed, onPatch, saveDraft));
    if (activeStep === 'magias') content.append(renderMagias(editing, db, computed, onPatch, saveDraft));
    if (activeStep === 'equipamentos') content.append(renderEquipamentos(editing, db, computed, onPatch));
    if (activeStep === 'final') content.append(renderFinal(editing, db, computed, saveDraft));

    content.append(renderValidacao(computed.validacao));
    const idx = STEPS.findIndex(s => s.id === activeStep);
    const prev = idx>0 ? STEPS[idx-1] : null;
    const next = idx < STEPS.length-1 ? STEPS[idx+1] : null;
    const nav = el('div', { class: 'builder-nav' },
      prev ? el('button', { class: 'btn', onclick: () => { saveDraft(); location.hash = `#/criar/${editing.id}/${prev.id}`; } }, `← ${prev.nome}`) : el('span', {}),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost', onclick: () => { editing = novoPersonagemBase(); _draft = JSON.parse(JSON.stringify(editing)); _draftId = 'novo'; doRender(); toast('Ficha reiniciada','warn'); } }, 'Reiniciar'),
        el('button', { class: 'btn', onclick: async () => { const saved = storage.salvarPersonagem(editing); await supabaseService.salvar(saved); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast(`Salvo ${saved.nome||''}`,'ok'); if(onSave) onSave(saved); location.hash='#/personagens'; } }, '💾 Salvar'),
        el('button', { class: 'btn primary', onclick: async () => { const saved = storage.salvarPersonagem(editing); await supabaseService.salvar(saved); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast('Salvo!','ok'); if(next) location.hash=`#/criar/${saved.id}/${next.id}`; else location.hash=`#/ficha/${saved.id}`; } }, next ? `${next.nome} →` : 'Ver Ficha →')
      )
    );
    content.append(nav);
    builder.append(content);
    main.append(builder);
  }
  doRender();
}

function renderPontosBarra(computed, editing, onPatch, saveDraft) {
  const pts = computed.pontos;
  if (!pts) return el('div', {});
  const livreClass = pts.disponivel < 0 ? 'bad' : pts.disponivel <= 10 ? 'warn' : 'ok';
  const pct = Math.min(100, Math.max(0, (pts.totalGasto / (pts.pontosTotais || 150)) * 100));
  const supaStatus = supabaseService.getStatus();
  const barra = el('div', { class: 'panel', style: 'padding:.8rem 1rem;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;justify-content:space-between;border-color:var(--gold)' },
    el('div', { style: 'display:flex;gap:.6rem;align-items:center;flex-wrap:wrap' },
      el('span', { style: 'font-weight:700;color:var(--gold2);font-family:var(--font-display)' }, `💰 ${pts.pontosTotais} pts`),
      el('span', { class: `pill ${livreClass}` }, `${pts.totalGasto} gastos • ${pts.disponivel} livres`),
      el('div', { class: `bar gold ${livreClass==='bad' ? 'bad' : ''}`, style: 'width:140px;height:12px' }, el('i', { style: `width:${pct}%` })),
      el('span', { class: `pill ${supaStatus==='ok'?'ok':supaStatus==='offline'?'bad':'warn'} small`, title: `Supabase ${supaStatus}` }, `☁️ Supabase ${supaStatus}`)
    ),
    el('div', { style: 'display:flex;gap:.4rem;align-items:center;flex-wrap:wrap' },
      el('button', { class: 'btn small', onclick: () => { const v = Math.max(0, (editing.pontosTotais||150)-10); onPatch({ pontosTotais: v }); } }, '−10'),
      el('button', { class: 'btn small', onclick: () => { const v = (editing.pontosTotais||150)+10; onPatch({ pontosTotais: v }); } }, '+10'),
      el('button', { class: 'btn small', onclick: () => { const v = (editing.pontosTotais||150)+50; onPatch({ pontosTotais: v }); } }, '+50'),
      (() => {
        const sel = el('select', { style: 'max-width:140px', onchange: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) onPatch({ pontosTotais: v }); } });
        sel.append(el('option', { value: '' }, 'Preset...'));
        for (const pre of PONTOS_PRESETS) sel.append(el('option', { value: String(pre.pontos), selected: pre.pontos===pts.pontosTotais }, `${pre.nome} ${pre.pontos}`));
        return sel;
      })(),
      el('input', { type: 'number', min: '0', max: '5000', step: '10', value: String(pts.pontosTotais), style: 'width:80px',
        onchange: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) onPatch({ pontosTotais: v }); },
        oninput: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) { editing.pontosTotais=v; saveDraft(); const t=document.getElementById('builderTitleSmall'); if(t) t.textContent=`${editing.nome?editing.nome+' • ':''}${v} pts • ${computed.pontos.disponivel} livres`; } }
      })
    )
  );
  const breakdown = el('div', { class: 'grid cols-4', style: 'margin-top:.6rem;width:100%' },
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Atributos'), el('div', { class: 'value' }, `${pts.breakdown.atributos.total} pts`)),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Vantagens'), el('div', { class: 'value' }, `${pts.breakdown.vantagens.total} pts`), el('div', { class: 'hint' }, `${pts.breakdown.vantagens.detalhe.length} itens`)),
    el('div', { class: 'stat small ok' }, el('div', { class: 'label' }, 'Desvantagens'), el('div', { class: 'value' }, `${pts.breakdown.desvantagens.total} pts`), el('div', { class: 'hint' }, 'ganha pontos')),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Peculiaridades'), el('div', { class: 'value' }, `${pts.breakdown.peculiaridades.total} pts`), el('div', { class: 'hint' }, '-1 cada')),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Perícias'), el('div', { class: 'value' }, `${pts.breakdown.pericias.total} pts`), el('div', { class: 'hint' }, '2 pts/nível')),
    el('div', { class: 'stat small gold' }, el('div', { class: 'label' }, 'Poderes'), el('div', { class: 'value' }, `${pts.breakdown.poderes.total} pts`)),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Magias'), el('div', { class: 'value' }, `${pts.breakdown.magias.total} pts`)),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Manobras'), el('div', { class: 'value' }, `0 pts`), el('div', { class: 'hint' }, 'grátis'))
  );
  return el('div', { style: 'width:100%' }, barra, breakdown);
}

function renderIdentidade(char, db, onChange, saveDraft) {
  const wrap = el('div', {}, el('h2', {}, '🧙 Identidade'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Defina identidade. Pontos atualizam em tempo real. Supabase sincroniza automaticamente.'));
  const grid = el('div', { class: 'field-grid' },
    el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', value: char.nome||'', placeholder: 'Kael', oninput: (e) => { char.nome=e.target.value; saveDraft(); const t=document.getElementById('builderTitleSmall'); if(t) t.textContent=`${e.target.value?e.target.value+' • ':''}${char.pontosTotais||150} pts`; } })),
    el('label', { class: 'field' }, 'Conceito', el('input', { type: 'text', value: char.conceito||'', placeholder: 'Mercenário', oninput: (e) => { char.conceito=e.target.value; saveDraft(); } })),
    el('label', { class: 'field' }, 'Jogador', el('input', { type: 'text', value: char.jogador||'', placeholder: 'Seu nome', oninput: (e) => { char.jogador=e.target.value; saveDraft(); } })),
    el('label', { class: 'field' }, 'Pontos Totais (ao vivo)',
      el('div', { style: 'display:flex;gap:.4rem;align-items:center;flex-wrap:wrap' },
        el('button', { class: 'btn small', onclick: () => { char.pontosTotais=Math.max(0,(char.pontosTotais||150)-10); saveDraft(); onChange({ pontosTotais: char.pontosTotais }); } }, '−10'),
        el('input', { type: 'number', min: '0', max: '5000', value: String(char.pontosTotais||150), style: 'width:90px',
          onchange: (e) => { const v=parseInt(e.target.value,10)||150; onChange({ pontosTotais: v }); },
          oninput: (e) => { const v=parseInt(e.target.value,10); if(!isNaN(v)) { char.pontosTotais=v; saveDraft(); } }
        }),
        el('button', { class: 'btn small', onclick: () => { char.pontosTotais=(char.pontosTotais||150)+10; saveDraft(); onChange({ pontosTotais: char.pontosTotais }); } }, '+10'),
        el('button', { class: 'btn small', onclick: () => { char.pontosTotais=(char.pontosTotais||150)+50; saveDraft(); onChange({ pontosTotais: char.pontosTotais }); } }, '+50'),
        el('select', { onchange: (e) => { const v=parseInt(e.target.value,10); if(!isNaN(v)) onChange({ pontosTotais: v }); }, style: 'max-width:150px' },
          el('option', { value: '' }, 'Preset...'),
          ...PONTOS_PRESETS.map(pre => el('option', { value: String(pre.pontos), selected: pre.pontos===(char.pontosTotais||150) }, `${pre.nome} ${pre.pontos}`))
        )
      )
    ),
    el('label', { class: 'field' }, 'Categoria', (() => { const sel=el('select', { onchange: (e) => { char.categoria=e.target.value; saveDraft(); onChange({ categoria: e.target.value }); } }); for (const cat of db.categories.categorias||[]) sel.append(el('option', { value: cat.id, selected: cat.id===(char.categoria||'mundano') }, `${cat.nome} — ${cat.dados}`)); return sel; })())
  );
  wrap.append(grid);
  wrap.append(el('div', { class: 'rule-box', style: 'margin-top:1rem' }, el('div', { class: 'box-title' }, '💰 Custos ao vivo'), el('p', { style: 'font-size:.85rem' }, 'Atributos 10 pts, Vantagens custo próprio, Desvantagens dão pontos (negativo), Peculiaridades -1, Perícias 2 pts/nível, Poderes Pot 5/3 +2, Magias 3+2, Manobras 0. Widget atualiza a cada mudança. Supabase status no topo.')));
  return wrap;
}

function renderAtributos(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '💪 Atributos — 10 pts/nível (ao vivo)'));
  const grid = el('div', { class: 'attr-grid' });
  for (const attr of db.attributes.atributos||[]) {
    const val = char.atributos?.[attr.id] ?? 10;
    const margem = db.getMarginForValue(val);
    const custo = (val-10)*CUSTOS.atributo.porNivel;
    const podeAumentarReal = computed.pontos.disponivel >= 10;
    const card = el('div', { class: 'attr-card' },
      el('div', { class: 'attr-name' }, `${attr.nome} (${attr.id})`),
      el('div', { class: 'attr-value' }, String(val)),
      el('div', { class: `pill ${custo>0?'warn':custo<0?'ok':''}`, style: 'margin:.2rem auto' }, `${custo>=0?'+':''}${custo} pts`),
      el('input', { type: 'range', min: '1', max: '20', value: String(val), oninput: (e) => {
        const v = parseInt(e.target.value,10);
        const diff = v - val;
        const custoExtra = diff * CUSTOS.atributo.porNivel;
        if (custoExtra>0 && computed.pontos.disponivel < custoExtra) { toast(`Sem pontos para ${attr.id} ${v}`,'bad'); return; }
        onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } });
      } }),
      el('div', { class: 'attr-margin' }, margem ? `Margem ${margem.margemTexto}` : '—'),
      el('div', { class: 'attr-bar' }, el('i', { style: `width:${Math.min(100,(val/20)*100)}%` }))
    );
    const controls = el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:.4rem' },
      el('button', { class: 'btn small', onclick: () => { const v=Math.max(1,val-1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } }); } }, '−'),
      el('button', { class: `btn small ${!podeAumentarReal?'ghost':''}`, disabled: !podeAumentarReal, onclick: () => {
        if (!podeAumentarReal) { toast('Sem pontos!','bad'); return; }
        const v=Math.min(20,val+1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } });
      } }, '+'),
      el('button', { class: 'btn small ghost', onclick: () => { const res=testarMargem(val,db); toast(`${attr.id} ${val}: ${res.rolagem} → ${res.sucesso?'Sucesso':'Falha'}`,'ok'); } }, '🎲')
    );
    card.append(controls);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

// Catálogo genérico com filtros acumulativos
function createFilterState() {
  return {
    busca: '',
    tipo: new Set(),
    categoria: new Set(),
    atributo: new Set(),
    dificuldade: new Set(),
    custoMin: null,
    custoMax: null
  };
}

function renderCatalogFilters(db, filterState, onFilterChange, options) {
  // options: { tipos, categorias, atributos, dificuldades, showCusto }
  const wrap = el('div', { class: 'panel', style: 'padding:.8rem;margin-bottom:1rem' },
    el('div', { class: 'field-group-title' }, '🔍 Filtros (acumulativos — clique para ativar/desativar)'),
    el('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem' },
      el('input', { type: 'search', placeholder: 'Buscar nome ou descrição...', value: filterState.busca, style: 'flex:1;min-width:200px',
        oninput: (e) => { filterState.busca = e.target.value.toLowerCase(); onFilterChange(); }
      }),
      el('button', { class: 'btn small ghost', onclick: () => { filterState.busca=''; filterState.tipo.clear(); filterState.categoria.clear(); filterState.atributo.clear(); filterState.dificuldade.clear(); filterState.custoMin=null; filterState.custoMax=null; onFilterChange(); } }, 'Limpar filtros')
    )
  );

  const makeChips = (label, values, set) => {
    if (!values || values.length===0) return '';
    return el('div', { style: 'margin-bottom:.5rem' },
      el('div', { style: 'font-size:.75rem;font-weight:600;color:var(--ink-dim);margin-bottom:.2rem' }, label),
      el('div', { class: 'maneuver-chips' },
        ...values.map(v => {
          const active = set.has(v);
          return el('button', { class: `maneuver-chip ${active?'active':''}`, onclick: () => { if(active) set.delete(v); else set.add(v); onFilterChange(); } }, `${v}${active?' ✓':''}`);
        })
      )
    );
  };

  if (options.tipos) wrap.append(makeChips('Tipo', options.tipos, filterState.tipo));
  if (options.categorias) wrap.append(makeChips('Categoria', options.categorias, filterState.categoria));
  if (options.atributos) wrap.append(makeChips('Atributo', options.atributos, filterState.atributo));
  if (options.dificuldades) wrap.append(makeChips('Dificuldade', options.dificuldades, filterState.dificuldade));

  if (options.showCusto) {
    wrap.append(el('div', { style: 'display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-top:.4rem' },
      el('label', { style: 'font-size:.75rem' }, 'Custo min:', el('input', { type: 'number', value: filterState.custoMin ?? '', style: 'width:70px;margin-left:.2rem', oninput: (e) => { const v=parseInt(e.target.value,10); filterState.custoMin=isNaN(v)?null:v; onFilterChange(); } })),
      el('label', { style: 'font-size:.75rem' }, 'max:', el('input', { type: 'number', value: filterState.custoMax ?? '', style: 'width:70px;margin-left:.2rem', oninput: (e) => { const v=parseInt(e.target.value,10); filterState.custoMax=isNaN(v)?null:v; onFilterChange(); } }))
    ));
  }

  const activeFilters = [];
  if (filterState.busca) activeFilters.push(`busca:${filterState.busca}`);
  for (const t of filterState.tipo) activeFilters.push(`tipo:${t}`);
  for (const c of filterState.categoria) activeFilters.push(`cat:${c}`);
  for (const a of filterState.atributo) activeFilters.push(`atr:${a}`);
  for (const d of filterState.dificuldade) activeFilters.push(`dif:${d}`);
  if (activeFilters.length) wrap.append(el('div', { style: 'font-size:.7rem;color:var(--ink-faint);margin-top:.4rem' }, `Filtros ativos: ${activeFilters.join(' • ')}`));

  return wrap;
}

function filterItem(item, filterState) {
  if (filterState.busca) {
    const hay = `${item.nome} ${item.descricao||''} ${item.categoria||''}`.toLowerCase();
    if (!hay.includes(filterState.busca)) return false;
  }
  if (filterState.tipo.size && item.tipo && !filterState.tipo.has(item.tipo)) return false;
  if (filterState.categoria.size && item.categoria && !filterState.categoria.has(item.categoria)) return false;
  if (filterState.atributo.size) {
    const atr = item.atributo || item.atributoBase || '';
    if (!filterState.atributo.has(atr)) return false;
  }
  if (filterState.dificuldade.size && item.dificuldade && !filterState.dificuldade.has(item.dificuldade)) return false;
  if (filterState.custoMin != null && (item.custo||0) < filterState.custoMin) return false;
  if (filterState.custoMax != null && (item.custo||0) > filterState.custoMax) return false;
  return true;
}

function renderVantagens(char, db, computed, onChange) {
  const catalog = db.vantagens?.vantagens || [];
  const filterState = createFilterState();
  const wrap = el('div', {}, el('h2', {}, `✨ Vantagens — Catálogo Compra (${catalog.length} itens)`), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Vantagens custam pontos. Filtros acumulativos por tipo, categoria, custo. Clique para comprar. Pontos atualizam ao vivo.'));

  const tipos = [...new Set(catalog.map(c=>c.tipo).filter(Boolean))];
  const categorias = [...new Set(catalog.map(c=>c.categoria).filter(Boolean))].sort();

  const selected = new Set((char.vantagens||[]).map(v=>v.id));
  let filtered = catalog;

  const listContainer = el('div', { class: 'grid cols-2', style: 'margin-top:.8rem' });
  const selectedContainer = el('div', { class: 'skill-list', style: 'margin-bottom:1rem' });

  function renderSelected() {
    selectedContainer.innerHTML = '';
    if ((char.vantagens||[]).length===0) {
      selectedContainer.append(el('div', { style: 'color:var(--ink-faint);font-size:.85rem' }, 'Nenhuma vantagem comprada.'));
    } else {
      for (const v of char.vantagens||[]) {
        selectedContainer.append(el('div', { class: 'skill-item' },
          el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${v.nome} • ${v.custo} pts`), el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, v.descricao||'')),
          el('span', { class: 'pill gold small' }, `${v.custo} pts`),
          el('button', { class: 'btn small danger', onclick: () => { onChange({ vantagens: (char.vantagens||[]).filter(x=>x.id!==v.id) }); } }, '✕')
        ));
      }
    }
  }

  function renderList() {
    listContainer.innerHTML = '';
    filtered = catalog.filter(item => filterItem(item, filterState));
    for (const item of filtered.slice(0,100)) {
      const owned = selected.has(item.id);
      const podeComprar = computed.pontos.disponivel >= item.custo || owned;
      const card = el('div', { class: `panel ${owned?'':' '}`, style: owned?'border-color:var(--gold);background:linear-gradient(180deg, rgba(201,165,92,.12), var(--panel))':'' },
        el('h3', { style: 'font-size:.95rem' }, `${item.nome} ${owned?'✓':''}`),
        el('div', { class: 'pill gold small', style: 'margin:.2rem 0' }, `${item.custo} pts ${item.custo_por_nivel?' /nível':''} • ${item.tipo||''} • ${item.categoria||''}`),
        el('p', { style: 'font-size:.8rem;color:var(--ink-dim);margin:.3rem 0' }, item.descricao),
        el('div', { class: 'btn-row' },
          owned ? el('button', { class: 'btn small danger', onclick: () => { onChange({ vantagens: (char.vantagens||[]).filter(x=>x.id!==item.id) }); } }, 'Remover') :
          el('button', { class: `btn small ${!podeComprar?'ghost':''} primary`, disabled: !podeComprar, title: !podeComprar?`Precisa ${item.custo} pts`:'Comprar', onclick: () => {
            if (!podeComprar) { toast('Sem pontos!','bad'); return; }
            const novo = { id: item.id, nome: item.nome, custo: item.custo, nivel: 1, categoria: item.categoria, tipo: item.tipo, descricao: item.descricao };
            onChange({ vantagens: [...(char.vantagens||[]), novo] });
          } }, `Comprar ${item.custo} pts`)
        )
      );
      listContainer.append(card);
    }
    if (filtered.length>100) listContainer.append(el('div', { style: 'grid-column:1/-1;text-align:center;color:var(--ink-faint);font-size:.8rem' }, `Mostrando 100 de ${filtered.length} — refine filtros`));
  }

  const filtersEl = renderCatalogFilters(db, filterState, () => { renderList(); }, { tipos, categorias, showCusto: true });

  renderSelected();
  renderList();

  wrap.append(el('div', { class: 'field-group' }, el('div', { class: 'field-group-title' }, 'Compradas'), selectedContainer));
  wrap.append(filtersEl);
  wrap.append(listContainer);

  // Custom vantagem
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1rem;border-color:var(--gold)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Vantagem Custom'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'vantNome', placeholder: 'Ex: Memória Fotográfica Melhorada' })),
      el('label', { class: 'field' }, 'Custo pts', el('input', { type: 'number', id: 'vantCusto', value: '10' })),
      el('label', { class: 'field' }, 'Tipo', el('select', { id: 'vantTipo' }, ...['Física','Mental','Social','Sobrenatural','Mundana'].map(t=>el('option',{value:t},t)))),
      el('label', { class: 'field' }, 'Categoria', el('input', { type: 'text', id: 'vantCat', placeholder: 'Mental' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Descrição', el('textarea', { id: 'vantDesc', rows: '2', placeholder: 'O que faz...' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('vantNome')?.value.trim();
      const custo=parseInt(document.getElementById('vantCusto')?.value,10)||10;
      const tipo=document.getElementById('vantTipo')?.value||'Mundana';
      const cat=document.getElementById('vantCat')?.value.trim()||'Custom';
      const desc=document.getElementById('vantDesc')?.value.trim()||'Vantagem custom';
      if(!nome){ toast('Nome','warn'); return; }
      if(computed.pontos.disponivel < custo){ toast(`Sem pontos! Precisa ${custo}`,'bad'); return; }
      const novo={ id:`custom_${Date.now()}`, nome, custo, tipo, categoria: cat, descricao: desc, custom:true };
      onChange({ vantagens: [...(char.vantagens||[]), novo] });
    } }, '✨ Criar e Comprar'))
  ));

  return wrap;
}

function renderDesvantagens(char, db, computed, onChange) {
  const catalog = db.desvantagens?.desvantagens || [];
  const filterState = createFilterState();
  const wrap = el('div', {}, el('h2', {}, `💀 Desvantagens — Ganha Pontos (${catalog.length} itens)`), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Desvantagens dão pontos de volta (custo negativo). Filtros acumulativos.'));

  const tipos = [...new Set(catalog.map(c=>c.tipo).filter(Boolean))];
  const categorias = [...new Set(catalog.map(c=>c.categoria).filter(Boolean))].sort();

  const listContainer = el('div', { class: 'grid cols-2', style: 'margin-top:.8rem' });
  const selectedContainer = el('div', { class: 'skill-list', style: 'margin-bottom:1rem' });

  function renderSelected() {
    selectedContainer.innerHTML = '';
    if ((char.desvantagens||[]).length===0) selectedContainer.append(el('div', { style: 'color:var(--ink-faint);font-size:.85rem' }, 'Nenhuma desvantagem.'));
    else for (const v of char.desvantagens||[]) selectedContainer.append(el('div', { class: 'skill-item' },
      el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${v.nome} • ${v.custo} pts`), el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, v.descricao||'')),
      el('span', { class: 'pill bad small' }, `${v.custo} pts`),
      el('button', { class: 'btn small danger', onclick: () => { onChange({ desvantagens: (char.desvantagens||[]).filter(x=>x.id!==v.id) }); } }, '✕')
    ));
  }
  function renderList() {
    listContainer.innerHTML = '';
    const filtered = catalog.filter(item => filterItem(item, filterState));
    for (const item of filtered.slice(0,100)) {
      const owned = (char.desvantagens||[]).some(x=>x.id===item.id);
      const card = el('div', { class: 'panel', style: owned?'border-color:var(--accent);background:rgba(156,43,35,.08)':'' },
        el('h3', { style: 'font-size:.95rem' }, `${item.nome} ${owned?'✓':''}`),
        el('div', { class: 'pill bad small', style: 'margin:.2rem 0' }, `${item.custo} pts (ganha ${-item.custo}) • ${item.tipo} • ${item.categoria}`),
        el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, item.descricao),
        el('div', { class: 'btn-row' },
          owned ? el('button', { class: 'btn small danger', onclick: () => { onChange({ desvantagens: (char.desvantagens||[]).filter(x=>x.id!==item.id) }); } }, 'Remover') :
          el('button', { class: 'btn small ok', onclick: () => {
            const novo={ id:item.id, nome:item.nome, custo:item.custo, categoria:item.categoria, tipo:item.tipo, descricao:item.descricao };
            onChange({ desvantagens: [...(char.desvantagens||[]), novo] });
          } }, `Adicionar (ganha ${-item.custo} pts)`)
        )
      );
      listContainer.append(card);
    }
  }
  const filtersEl = renderCatalogFilters(db, filterState, () => { renderList(); }, { tipos, categorias, showCusto: true });
  renderSelected(); renderList();
  wrap.append(el('div', { class: 'field-group' }, el('div', { class: 'field-group-title' }, 'Selecionadas (ganham pontos)'), selectedContainer));
  wrap.append(filtersEl);
  wrap.append(listContainer);

  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1rem;border-color:var(--accent)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Desvantagem Custom'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'desNome', placeholder: 'Ex: Medo de Altura Grave' })),
      el('label', { class: 'field' }, 'Pontos ganhos (negativo)', el('input', { type: 'number', id: 'desCusto', value: '-10' })),
      el('label', { class: 'field' }, 'Tipo', el('select', { id: 'desTipo' }, ...['Física','Mental','Social','Sobrenatural'].map(t=>el('option',{value:t},t)))),
      el('label', { class: 'field' }, 'Categoria', el('input', { type: 'text', id: 'desCat', placeholder: 'Mental' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Descrição', el('textarea', { id: 'desDesc', rows: '2' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('desNome')?.value.trim();
      let custo=parseInt(document.getElementById('desCusto')?.value,10)||-10;
      if(custo>0) custo=-custo;
      const tipo=document.getElementById('desTipo')?.value||'Mental';
      const cat=document.getElementById('desCat')?.value.trim()||'Custom';
      const desc=document.getElementById('desDesc')?.value.trim()||'Desvantagem custom';
      if(!nome){ toast('Nome','warn'); return; }
      const novo={ id:`custom_${Date.now()}`, nome, custo, tipo, categoria: cat, descricao: desc, custom:true };
      onChange({ desvantagens: [...(char.desvantagens||[]), novo] });
    } }, '✨ Criar'))
  ));
  return wrap;
}

function renderPeculiaridades(char, db, computed, onChange) {
  const catalog = db.peculiaridades?.peculiaridades || [];
  const wrap = el('div', {}, el('h2', {}, `🌀 Peculiaridades — -1 ponto cada (máx 5)`), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Peculiaridades são manias, cada uma dá -1 ponto (ganha 1). Máximo 5.'));
  const list = el('div', { class: 'grid cols-2', style: 'margin-top:.8rem' });
  const selected = el('div', { class: 'skill-list', style: 'margin-bottom:1rem' });

  function renderSel() {
    selected.innerHTML = '';
    for (const p of char.peculiaridades||[]) selected.append(el('div', { class: 'skill-item' },
      el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${p.nome} • ${p.custo} pts`), el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, p.descricao||'')),
      el('button', { class: 'btn small danger', onclick: () => { onChange({ peculiaridades: (char.peculiaridades||[]).filter(x=>x.id!==p.id) }); } }, '✕')
    ));
    if ((char.peculiaridades||[]).length===0) selected.append(el('div', { style: 'color:var(--ink-faint)' }, 'Nenhuma peculiaridade.'));
  }
  function renderList() {
    list.innerHTML = '';
    for (const item of catalog) {
      const owned=(char.peculiaridades||[]).some(x=>x.id===item.id);
      const canAdd=(char.peculiaridades||[]).length<5 || owned;
      list.append(el('div', { class: 'panel', style: owned?'border-color:var(--gold)':'' },
        el('h3', { style: 'font-size:.9rem' }, `${item.nome} ${owned?'✓':''}`),
        el('div', { class: 'pill bad small' }, `${item.custo} pts`),
        el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, item.descricao),
        el('div', { class: 'btn-row' },
          owned ? el('button', { class: 'btn small danger', onclick: () => { onChange({ peculiaridades: (char.peculiaridades||[]).filter(x=>x.id!==item.id) }); } }, 'Remover') :
          el('button', { class: `btn small ${!canAdd?'ghost':''} ok`, disabled: !canAdd, onclick: () => {
            if(!canAdd){ toast('Máx 5 peculiaridades!','warn'); return; }
            const novo={ id:item.id, nome:item.nome, custo:item.custo, descricao:item.descricao };
            onChange({ peculiaridades: [...(char.peculiaridades||[]), novo] });
          } }, 'Adicionar (ganha 1)')
        )
      ));
    }
  }
  renderSel(); renderList();
  wrap.append(el('div', { class: 'field-group' }, el('div', { class: 'field-group-title' }, 'Selecionadas'), selected));
  wrap.append(list);
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1rem' },
    el('div', { class: 'field-group-title' }, '🧩 Peculiaridade Custom -1 ponto'),
    el('div', { style: 'display:flex;gap:.4rem' },
      el('input', { type: 'text', id: 'pecNome', placeholder: 'Ex: Sempre limpa arma', style: 'flex:1' }),
      el('button', { class: 'btn small', onclick: () => {
        const nome=document.getElementById('pecNome')?.value.trim();
        if(!nome){ toast('Nome','warn'); return; }
        if((char.peculiaridades||[]).length>=5){ toast('Máx 5!','warn'); return; }
        const novo={ id:`custom_${Date.now()}`, nome, custo:-1, descricao:'Custom', custom:true };
        onChange({ peculiaridades: [...(char.peculiaridades||[]), novo] });
      } }, 'Adicionar')
    )
  ));
  return wrap;
}

function renderPericiasCatalog(char, db, computed, onChange, saveDraft) {
  const catalog = db.periciasCatalog?.pericias || [];
  const filterState = createFilterState();
  const wrap = el('div', {}, el('h2', {}, `📜 Perícias — Catálogo (${catalog.length} itens) — Filtros acumulativos`), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Compre perícias do catálogo. Filtros por tipo, atributo, categoria, dificuldade, busca — acumulam. Pontos atualizam ao vivo.'));

  const tipos = [...new Set(catalog.map(c=>c.tipo).filter(Boolean))];
  const categorias = [...new Set(catalog.map(c=>c.categoria).filter(Boolean))].sort();
  const atributos = [...new Set(catalog.map(c=>c.atributo).filter(Boolean))].sort();
  const dificuldades = [...new Set(catalog.map(c=>c.dificuldade).filter(Boolean))];

  const ownedContainer = el('div', { class: 'skill-list', style: 'margin-bottom:1rem' });
  const listContainer = el('div', { class: 'grid cols-2', style: 'margin-top:.8rem' });

  function renderOwned() {
    ownedContainer.innerHTML = '';
    if ((char.pericias||[]).length===0) ownedContainer.append(el('div', { style: 'color:var(--ink-faint)' }, 'Nenhuma perícia comprada.'));
    else {
      for (const p of char.pericias||[]) {
        const margem=db.getMarginForValue(p.valor);
        const baseVal=char.atributos?.[p.atributoBase]??10;
        const custo = p.redutor ? Math.max(0,(p.valor-(baseVal-p.redutor))*CUSTOS.pericia.porNivel) : Math.max(CUSTOS.pericia.minimo,(p.valor-baseVal)*CUSTOS.pericia.porNivel);
        const podeAum = computed.pontos.disponivel >= CUSTOS.pericia.porNivel;
        ownedContainer.append(el('div', { class: 'skill-item' },
          el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${p.nome} • ${custo} pts`), el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `${p.atributoBase||''} • ${p.descricao||''} • Valor ${p.valor} [${margem?margem.margemTexto:'—'}]`)),
          el('button', { class: 'btn small', onclick: () => { const v=Math.max(1,p.valor-1); onChange({ pericias: (char.pericias||[]).map(x=>x.nome===p.nome?{...x,valor:v}:x) }); } }, '−'),
          el('span', { style: 'min-width:24px;text-align:center' }, String(p.valor)),
          el('button', { class: `btn small ${!podeAum?'ghost':''}`, disabled: !podeAum, onclick: () => { if(!podeAum){ toast('Sem pontos!','bad'); return; } onChange({ pericias: (char.pericias||[]).map(x=>x.nome===p.nome?{...x,valor:x.valor+1}:x) }); } }, '+'),
          el('button', { class: 'btn small danger', onclick: () => { onChange({ pericias: (char.pericias||[]).filter(x=>x.nome!==p.nome) }); } }, '✕')
        ));
      }
    }
  }

  function renderList() {
    listContainer.innerHTML = '';
    const filtered = catalog.filter(item => filterItem(item, filterState));
    for (const item of filtered.slice(0,120)) {
      const owned = (char.pericias||[]).some(x=>x.nome===item.nome);
      const base = char.atributos?.[item.atributo]??10;
      const custoExtra = Math.max(CUSTOS.pericia.minimo,(10-base)*CUSTOS.pericia.porNivel); // comprar com valor 10
      const podeComprar = computed.pontos.disponivel >= custoExtra || owned;
      listContainer.append(el('div', { class: 'panel', style: owned?'border-color:var(--gold);background:rgba(201,165,92,.08)':'' },
        el('h3', { style: 'font-size:.9rem' }, `${item.nome} ${owned?'✓ comprada':''}`),
        el('div', { style: 'display:flex;gap:.3rem;flex-wrap:wrap;margin:.2rem 0' },
          el('span', { class: 'pill small' }, item.atributo),
          el('span', { class: 'pill small' }, item.tipo),
          el('span', { class: 'pill small' }, item.dificuldade),
          el('span', { class: 'pill gold small' }, item.categoria),
          el('span', { class: 'pill small' }, `${item.custo} pts/nível`)
        ),
        el('p', { style: 'font-size:.78rem;color:var(--ink-dim)' }, item.descricao),
        el('div', { class: 'btn-row' },
          owned ? el('span', { class: 'pill ok small' }, 'Já possui') :
          el('button', { class: `btn small ${!podeComprar?'ghost':''} primary`, disabled: !podeComprar, title: !podeComprar?`Precisa ${custoExtra} pts`:`Comprar`, onclick: () => {
            if(!podeComprar){ toast('Sem pontos!','bad'); return; }
            const nova={ nome:item.nome, atributoBase:item.atributo, valor: Math.max(10, base), descricao:item.descricao, categoria:item.categoria, tipo:item.tipo, dificuldade:item.dificuldade };
            onChange({ pericias: [...(char.pericias||[]), nova] });
          } }, `Comprar (Nv 10 — ${custoExtra} pts)`)
        )
      ));
    }
    if (filtered.length>120) listContainer.append(el('div', { style: 'grid-column:1/-1;text-align:center;color:var(--ink-faint);font-size:.8rem' }, `Mostrando 120 de ${filtered.length} — use filtros`));
  }

  const filtersEl = renderCatalogFilters(db, filterState, () => { renderList(); }, { tipos, categorias, atributos, dificuldades, showCusto: false });

  renderOwned(); renderList();
  wrap.append(el('div', { class: 'field-group' }, el('div', { class: 'field-group-title' }, 'Perícias Compradas (ao vivo)'), ownedContainer));
  wrap.append(filtersEl);
  wrap.append(listContainer);

  // Custom perícia
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1rem' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Perícia Custom — 2 pts/nível'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'perNome', placeholder: 'Ex: Pilotagem Drone' })),
      el('label', { class: 'field' }, 'Atributo', el('select', { id: 'perAtr' }, ...['ST','DX','IQ','HT'].map(a=>el('option',{value:a},a)))),
      el('label', { class: 'field' }, 'Tipo', el('select', { id: 'perTipo' }, ...['Física','Mental'].map(t=>el('option',{value:t},t)))),
      el('label', { class: 'field' }, 'Dificuldade', el('select', { id: 'perDif' }, ...['Fácil','Médio','Difícil','Muito Difícil'].map(d=>el('option',{value:d},d)))),
      el('label', { class: 'field' }, 'Categoria', el('input', { type: 'text', id: 'perCat', placeholder: 'Técnica' })),
      el('label', { class: 'field' }, 'Valor inicial', el('input', { type: 'number', id: 'perVal', value: '10', min: '1', max: '25' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('perNome')?.value.trim();
      const atr=document.getElementById('perAtr')?.value;
      const tipo=document.getElementById('perTipo')?.value;
      const dif=document.getElementById('perDif')?.value;
      const cat=document.getElementById('perCat')?.value.trim()||'Custom';
      const val=parseInt(document.getElementById('perVal')?.value,10)||10;
      if(!nome){ toast('Nome','warn'); return; }
      const base=char.atributos?.[atr]??10;
      const custo=Math.max(CUSTOS.pericia.minimo,(val-base)*CUSTOS.pericia.porNivel);
      if(computed.pontos.disponivel < custo){ toast(`Sem pontos! Precisa ${custo}`,'bad'); return; }
      const nova={ nome, atributoBase: atr, valor: val, descricao:`${tipo} ${dif} ${cat} custom`, categoria: cat, tipo, dificuldade: dif, custom:true };
      onChange({ pericias: [...(char.pericias||[]), nova] });
    } }, '✨ Criar e Comprar'))
  ));

  return wrap;
}

function renderManobras(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '⚔️ Manobras — GRÁTIS'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Não custam pontos.'));
  const allManeuvers=[]; const collect=(obj,prefix='')=>{ if(!obj) return; if(obj.nome&&obj.id) allManeuvers.push({id:obj.id,nome:obj.nome,desc:obj.descricao?.slice(0,120)||'',grupo:prefix}); for(const k of ['estilos','caminhos','formas','tipos','acoes']) if(Array.isArray(obj[k])) obj[k].forEach(c=>collect(c,obj.nome||prefix)); };
  Object.values(db.maneuvers).forEach(root=>collect(root,''));
  const selected=new Set(char.manobras||[]); const grid=el('div',{class:'grid cols-2'}); const grupos={};
  for(const m of allManeuvers){ const g=m.grupo||'Geral'; if(!grupos[g]) grupos[g]=[]; grupos[g].push(m); }
  for(const [grupo,lista] of Object.entries(grupos)){
    const panel=el('div',{class:'panel'}, el('h3',{},`${grupo} — GRÁTIS`), el('div',{class:'maneuver-chips'}, ...lista.map(m=>{ const active=selected.has(m.id); return el('button',{class:`maneuver-chip ${active?'active':''}`, onclick:()=>{ const novas=new Set(selected); if(novas.has(m.id)) novas.delete(m.id); else novas.add(m.id); onChange({manobras:[...novas]}); }}, `${m.nome}${active?' ✓':''}`); })));
    grid.append(panel);
  }
  wrap.append(grid);
  const empWrap=el('div',{class:'field-group',style:'margin-top:1.2rem'}, el('div',{class:'field-group-title'},'🤲 Empunhadura — GRÁTIS'), el('div',{class:'grid cols-3'}, ...(db.empunhaduras.empunhaduras||[]).map(emp=>{
    const active=char.empunhadura===emp.id;
    return el('div',{class:`equip-card ${active?'active':''}`, style: active?'border-color:var(--gold);background:linear-gradient(180deg, rgba(201,165,92,.12), var(--bg))':'', onclick:()=>onChange({empunhadura:emp.id})},
      el('div',{class:'equip-name'},emp.nome), el('div',{class:'pill gold',style:'margin:.3rem 0'},`${emp.especialidade} — GRÁTIS`), el('div',{style:'font-size:.8rem;color:var(--ink-dim)'},emp.vantagem));
  })));
  wrap.append(empWrap);
  return wrap;
}

function renderPoderes(char, db, computed, onChange, saveDraft) {
  const powersData = db.powers || { poderes: [] };
  const wrap = el('div', {}, el('h2', {}, '🧠 Poderes & Psiquismo — Pot 5/3 +2 pts (ao vivo)'));
  const poderesAtuais = char.poderes || {};
  const poderesGrid = el('div', { class: 'grid cols-2', style: 'margin-top:1rem' });
  for (const poder of powersData.poderes||[]) {
    const atual = poderesAtuais[poder.id] || { potencia:0, pericias:[] };
    const potencia = atual.potencia||0;
    const custoPot = poder.custo;
    const podeAumentarPot = computed.pontos.disponivel >= custoPot;
    const card = el('div', { class: 'panel', style: potencia>0?'border-color:var(--gold)':'' },
      el('h3', {}, `${poder.nome} (${poder.sigla}) ${potencia>0?`— Pot ${potencia}`:''}`),
      el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, (poder.descricao||'').slice(0,160)+'…'),
      el('div', { class: 'pill gold', style: 'margin:.3rem 0' }, `${custoPot} pts/nível`),
      el('div', { style: 'display:flex;gap:.3rem;align-items:center;margin-top:.4rem' },
        el('button', { class: 'btn small', onclick: () => { const nova=Math.max(0,potencia-1); const novos={...poderesAtuais,[poder.id]:{...atual,potencia:nova}}; if(nova===0) delete novos[poder.id]; onChange({poderes:novos}); } }, '−'),
        el('span', { style: 'min-width:28px;text-align:center;font-weight:700' }, String(potencia)),
        el('button', { class: `btn small ${!podeAumentarPot?'ghost':''}`, disabled: !podeAumentarPot, onclick: () => {
          if(!podeAumentarPot){ toast('Sem pontos!','bad'); return; }
          const nova=Math.min(25,potencia+1); const novos={...poderesAtuais,[poder.id]:{...atual,potencia:nova,pericias:atual.pericias||[]}}; onChange({poderes:novos});
        } }, '+'),
        el('span', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `= ${potencia*custoPot} pts`)
      ),
      potencia>0 ? el('div', { style: 'margin-top:.6rem' },
        el('div', { style: 'font-size:.8rem;font-weight:600;color:var(--gold2)' }, 'Perícias psi — 2 pts/nível:'),
        el('div', { class: 'maneuver-chips' },
          ...(poder.pericias||[]).map(per => {
            const tem=(atual.pericias||[]).find(pp=>pp.id===per.id);
            const nivel=tem?.nivel||0;
            const podeAum = computed.pontos.disponivel >= CUSTOS.periciaPsi.porNivel;
            return el('div', { style: `display:flex;flex-direction:column;gap:.2rem;border:1px solid var(--border);border-radius:8px;padding:.3rem .4rem;background:${nivel>0?'rgba(201,165,92,.12)':'var(--panel2)'}` },
              el('div', { style: 'font-size:.78rem;font-weight:600' }, `${per.nome} ${nivel>0?`— ${nivel} (${nivel*CUSTOS.periciaPsi.porNivel}pts)`:''}`),
              el('div', { style: 'display:flex;gap:.2rem;align-items:center' },
                el('button', { class: 'btn small', onclick: () => {
                  let novas=[...(atual.pericias||[])]; const idx=novas.findIndex(pp=>pp.id===per.id);
                  if(idx>=0){ const nn=Math.max(0,(novas[idx].nivel||0)-1); if(nn===0) novas=novas.filter(pp=>pp.id!==per.id); else novas[idx].nivel=nn; }
                  const novos={...poderesAtuais,[poder.id]:{potencia,pericias:novas}}; onChange({poderes:novos});
                } }, '−'),
                el('input', { type: 'number', min: '0', max: '25', value: String(nivel), style: 'width:50px',
                  onchange: (e) => {
                    const v=parseInt(e.target.value,10)||0;
                    const diff = v - nivel;
                    if(diff>0 && computed.pontos.disponivel < diff*CUSTOS.periciaPsi.porNivel){ toast('Sem pontos!','bad'); return; }
                    let novas=[...(atual.pericias||[])]; if(v===0) novas=novas.filter(pp=>pp.id!==per.id); else { const idx=novas.findIndex(pp=>pp.id===per.id); if(idx>=0) novas[idx].nivel=v; else novas.push({id:per.id,nome:per.nome,nivel:v}); }
                    onChange({ poderes: { ...poderesAtuais, [poder.id]: { potencia, pericias: novas } } });
                  }
                }),
                el('button', { class: `btn small ${!podeAum?'ghost':''}`, disabled: !podeAum && nivel===0, onclick: () => {
                  if(computed.pontos.disponivel < CUSTOS.periciaPsi.porNivel){ toast('Sem pontos!','bad'); return; }
                  let novas=[...(atual.pericias||[])]; const idx=novas.findIndex(pp=>pp.id===per.id); if(idx>=0) novas[idx].nivel=(novas[idx].nivel||0)+1; else novas.push({id:per.id,nome:per.nome,nivel:1});
                  onChange({ poderes: { ...poderesAtuais, [poder.id]: { potencia, pericias: novas } } });
                } }, '+')
              )
            );
          })
        )
      ) : ''
    );
    poderesGrid.append(card);
  }
  for (const [id, dados] of Object.entries(poderesAtuais)) {
    if ((powersData.poderes||[]).find(p=>p.id===id)) continue;
    const potencia = dados.potencia||0;
    poderesGrid.append(el('div', { class: 'panel', style: 'border-color:var(--accent);background:linear-gradient(180deg, rgba(156,43,35,.08), var(--panel))' },
      el('h3', {}, `🧩 ${dados.nome||id} — Pot ${potencia} — custom`),
      el('div', { class: 'pill bad' }, `${dados.custo||5} pts/nível`),
      el('div', { style: 'display:flex;gap:.3rem;margin-top:.4rem' },
        el('button', { class: 'btn small', onclick: () => { const novos={...poderesAtuais,[id]:{...dados,potencia:Math.max(0,potencia-1)}}; if(novos[id].potencia===0) delete novos[id]; onChange({poderes:novos}); } }, '−'),
        el('button', { class: 'btn small', onclick: () => { if(computed.pontos.disponivel < (dados.custo||5)){ toast('Sem pontos','bad'); return; } const novos={...poderesAtuais,[id]:{...dados,potencia:potencia+1}}; onChange({poderes:novos}); } }, '+'),
        el('button', { class: 'btn small danger', onclick: () => { const novos={...poderesAtuais}; delete novos[id]; onChange({poderes:novos}); } }, '🗑️')
      )
    ));
  }
  wrap.append(poderesGrid);
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1.5rem;border-color:var(--gold)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Poder Custom'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'cpNome', placeholder: 'Cronocinese' })),
      el('label', { class: 'field' }, 'Sigla', el('input', { type: 'text', id: 'cpSigla', placeholder: 'CRON' })),
      el('label', { class: 'field' }, 'Custo', el('select', { id: 'cpCusto' }, el('option', { value: '5' }, '5 pts'), el('option', { value: '3' }, '3 pts'))),
      el('label', { class: 'field' }, 'Pot', el('input', { type: 'number', id: 'cpPot', value: '5', min: '1', max: '25' })),
      el('label', { class: 'field' }, 'Fonte', el('input', { type: 'text', id: 'cpFonte', placeholder: 'psíquica' })),
      el('label', { class: 'field' }, 'Foco', el('input', { type: 'text', id: 'cpFoco', placeholder: 'tempo' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Desc', el('textarea', { id: 'cpDesc', rows: '2' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('cpNome')?.value.trim();
      const sigla=document.getElementById('cpSigla')?.value.trim()||'CUS';
      const custo=parseInt(document.getElementById('cpCusto')?.value,10)||5;
      const pot=parseInt(document.getElementById('cpPot')?.value,10)||1;
      const fonte=document.getElementById('cpFonte')?.value.trim()||'psíquica';
      const foco=document.getElementById('cpFoco')?.value.trim()||'custom';
      const desc=document.getElementById('cpDesc')?.value.trim()||'Poder custom';
      if(!nome){ toast('Nome','warn'); return; }
      if(computed.pontos.disponivel < pot*custo){ toast(`Sem pontos! Precisa ${pot*custo}`,'bad'); return; }
      const id=`custom_${Date.now()}`;
      const novos={...poderesAtuais,[id]:{ nome, sigla, custo, potencia: pot, fonte, foco, descricao: desc, pericias: [], custom: true }};
      onChange({ poderes: novos });
    } }, '✨ Criar'))
  ));
  return wrap;
}

function renderMagias(char, db, computed, onChange, saveDraft) {
  const magicsData = db.magics || { escolas: [] };
  const wrap = el('div', {}, el('h2', {}, '🔮 Magias & Escolas — Catálogo Compra (ao vivo)'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Escolas custam 3 pts/nível (Tempo 5), magias 2 pts/nível. Filtros acumulativos por fonte, foco, busca.'));

  const filterState = createFilterState();
  const tipos = [...new Set(magicsData.escolas.map(e=>e.fonte).filter(Boolean))];
  const categorias = [...new Set(magicsData.escolas.map(e=>e.foco).filter(Boolean))];

  const magiasAtuais = char.magias || {};
  const grid = el('div', { class: 'grid cols-2', style: 'margin-top:1rem' });
  const ownedBox = el('div', { class: 'skill-list', style: 'margin-bottom:1rem' });

  function renderOwned() {
    ownedBox.innerHTML = '';
    if (Object.keys(magiasAtuais).length===0) ownedBox.append(el('div', { style: 'color:var(--ink-faint)' }, 'Nenhuma escola comprada.'));
    else {
      for (const [id, esc] of Object.entries(magiasAtuais)) {
        ownedBox.append(el('div', { class: 'skill-item' },
          el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${esc.nome||id} Nv ${esc.nivel||0} • ${esc.custo||3} pts/nível`), el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `${(esc.magias||[]).length} magias`)),
          el('span', { class: 'pill gold small' }, `${(esc.nivel||0)*(esc.custo||3)} pts`),
          el('button', { class: 'btn small danger', onclick: () => { const novos={...magiasAtuais}; delete novos[id]; onChange({ magias: novos }); } }, '✕')
        ));
      }
    }
  }

  function renderGrid() {
    grid.innerHTML = '';
    let filtered = magicsData.escolas.filter(item => filterItem({ nome:item.nome, descricao:item.descricao, tipo:item.fonte, categoria:item.foco, custo:item.custo }, filterState));
    for (const esc of filtered) {
      const atual = magiasAtuais[esc.id] || { nivel:0, magias:[] };
      const nivel = atual.nivel||0;
      const custoEsc = esc.custo||3;
      const podeAum = computed.pontos.disponivel >= custoEsc;
      const card = el('div', { class: 'panel', style: nivel>0?'border-color:var(--gold)':'' },
        el('h3', {}, `${esc.nome} (${esc.sigla}) ${nivel>0?`— Nv ${nivel}`:''}`),
        el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, (esc.descricao||'').slice(0,150)),
        el('div', { class: 'pill gold' }, `${custoEsc} pts/nível • ${esc.fonte} • ${esc.foco}`),
        el('div', { style: 'display:flex;gap:.3rem;align-items:center;margin-top:.5rem' },
          el('button', { class: 'btn small', onclick: () => { const nn=Math.max(0,nivel-1); const novos={...magiasAtuais,[esc.id]:{...atual,nivel:nn}}; if(nn===0) delete novos[esc.id]; onChange({magias:novos}); } }, '−'),
          el('span', { style: 'min-width:24px;text-align:center;font-weight:700' }, String(nivel)),
          el('button', { class: `btn small ${!podeAum?'ghost':''}`, disabled: !podeAum, onclick: () => {
            if(!podeAum){ toast('Sem pontos!','bad'); return; }
            const nn=Math.min(20,nivel+1); const novos={...magiasAtuais,[esc.id]:{...atual,nivel:nn,magias:atual.magias||[]}}; onChange({magias:novos});
          } }, '+'),
          el('span', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `= ${nivel*custoEsc} pts`)
        ),
        nivel>0 ? el('div', { style: 'margin-top:.6rem' },
          el('div', { style: 'font-size:.8rem;font-weight:600;color:var(--gold2)' }, 'Magias 2 pts/nível:'),
          el('div', { class: 'maneuver-chips' },
            ...(esc.magias||[]).map(m => {
              const tem=(atual.magias||[]).find(mm=>mm.id===m.id);
              const mnivel=tem?.nivel||0;
              const podeAumM = computed.pontos.disponivel >= CUSTOS.magia.pericia;
              return el('div', { style: `display:flex;flex-direction:column;gap:.2rem;border:1px solid var(--border);border-radius:8px;padding:.3rem .4rem;background:${mnivel>0?'rgba(201,165,92,.12)':'var(--panel2)'}` },
                el('div', { style: 'font-size:.78rem;font-weight:600' }, `${m.nome} ${mnivel>0?`— ${mnivel} (${mnivel*CUSTOS.magia.pericia}pts)`:''}`),
                el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `${m.descricao.slice(0,80)}`),
                el('div', { style: 'display:flex;gap:.2rem' },
                  el('button', { class: 'btn small', onclick: () => {
                    let novas=[...(atual.magias||[])]; const idx=novas.findIndex(mm=>mm.id===m.id);
                    if(idx>=0){ const nn=Math.max(0,(novas[idx].nivel||0)-1); if(nn===0) novas=novas.filter(mm=>mm.id!==m.id); else novas[idx].nivel=nn; }
                    onChange({ magias: { ...magiasAtuais, [esc.id]: { nivel, magias: novas } } });
                  } }, '−'),
                  el('button', { class: `btn small ${!podeAumM?'ghost':''}`, disabled: !podeAumM && mnivel===0, onclick: () => {
                    if(computed.pontos.disponivel < CUSTOS.magia.pericia){ toast('Sem pontos!','bad'); return; }
                    let novas=[...(atual.magias||[])]; const idx=novas.findIndex(mm=>mm.id===m.id); if(idx>=0) novas[idx].nivel=(novas[idx].nivel||0)+1; else novas.push({id:m.id,nome:m.nome,nivel:1});
                    onChange({ magias: { ...magiasAtuais, [esc.id]: { nivel, magias: novas } } });
                  } }, '+')
                )
              );
            })
          )
        ) : ''
      );
      grid.append(card);
    }
  }

  const filtersEl = renderCatalogFilters(db, filterState, () => { renderGrid(); }, { tipos, categorias, showCusto: true });
  renderOwned(); renderGrid();
  wrap.append(el('div', { class: 'field-group' }, el('div', { class: 'field-group-title' }, 'Escolas Compradas (ao vivo)'), ownedBox));
  wrap.append(filtersEl);
  wrap.append(grid);

  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1.5rem;border-color:var(--gold)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Escola Custom'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'cmNome', placeholder: 'Sangue' })),
      el('label', { class: 'field' }, 'Sigla', el('input', { type: 'text', id: 'cmSigla', placeholder: 'SAN' })),
      el('label', { class: 'field' }, 'Custo', el('select', { id: 'cmCusto' }, el('option', { value: '3' }, '3 pts'), el('option', { value: '5' }, '5 pts Tempo'))),
      el('label', { class: 'field' }, 'Nível', el('input', { type: 'number', id: 'cmNivel', value: '3', min: '1', max: '20' })),
      el('label', { class: 'field' }, 'Fonte', el('input', { type: 'text', id: 'cmFonte', placeholder: 'mágica' })),
      el('label', { class: 'field' }, 'Foco', el('input', { type: 'text', id: 'cmFoco', placeholder: 'sangue' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Desc', el('textarea', { id: 'cmDesc', rows: '2' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('cmNome')?.value.trim();
      const sigla=document.getElementById('cmSigla')?.value.trim()||'CUS';
      const custo=parseInt(document.getElementById('cmCusto')?.value,10)||3;
      const nivel=parseInt(document.getElementById('cmNivel')?.value,10)||1;
      const fonte=document.getElementById('cmFonte')?.value.trim()||'mágica';
      const foco=document.getElementById('cmFoco')?.value.trim()||'custom';
      const desc=document.getElementById('cmDesc')?.value.trim()||'Escola custom';
      if(!nome){ toast('Nome','warn'); return; }
      if(computed.pontos.disponivel < nivel*custo){ toast(`Sem pontos! Precisa ${nivel*custo}`,'bad'); return; }
      const id=`custom_${Date.now()}`;
      const novos={...magiasAtuais,[id]:{ nome, sigla, custo, nivel, fonte, foco, descricao: desc, magias: [], custom: true }};
      onChange({ magias: novos });
    } }, '✨ Criar Escola'))
  ));

  return wrap;
}

function renderEquipamentos(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '🛡️ Equipamentos — GRÁTIS'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Não custam pontos.'));
  const list = el('div', { class: 'equip-grid', style: 'margin-top:1rem' });
  for (const eq of char.equipamentos||[]) list.append(el('div', { class: 'equip-card' }, el('div', { class: 'equip-name' }, eq.nome), el('div', { class: 'equip-stats' }, eq.dano?el('span',{class:'equip-stat'},eq.dano):'', eq.peso?el('span',{class:'equip-stat'},`${eq.peso}kg`):''), el('div', { class: 'btn-row' }, el('button', { class: 'btn small danger', onclick: () => { onChange({ equipamentos: (char.equipamentos||[]).filter(e=>e.nome!==eq.nome) }); } }, 'Remover'))));
  wrap.append(list);
  const allWeapons=db.getAllWeapons();
  const addPanel=el('div',{class:'field-group',style:'margin-top:1.2rem'}, el('div',{class:'field-group-title'},'➕ Arma — GRÁTIS'), el('div',{style:'display:flex;gap:.5rem;margin-bottom:.8rem'}, el('input',{type:'search',id:'buscaArma',placeholder:'Buscar...',style:'flex:1',oninput:(e)=>{ const q=e.target.value.toLowerCase(); const container=document.getElementById('listaArmas'); if(!container) return; container.innerHTML=''; const filtradas=allWeapons.filter(w=>w.nome.toLowerCase().includes(q)).slice(0,30); for(const w of filtradas) container.append(renderArmaOption(w,char,onChange)); } }), el('button',{class:'btn small',onclick:()=>{ const container=document.getElementById('listaArmas'); if(!container) return; container.innerHTML=''; for(const w of allWeapons.slice(0,20)) container.append(renderArmaOption(w,char,onChange)); }},'Listar 20')), el('div',{id:'listaArmas',class:'equip-grid'}));
  setTimeout(()=>{ const container=document.getElementById('listaArmas'); if(container) for(const w of allWeapons.slice(0,12)) container.append(renderArmaOption(w,char,onChange)); },0);
  wrap.append(addPanel);
  return wrap;
}
function renderArmaOption(w, char, onChange) {
  return el('div', { class: 'equip-card' }, el('div', { class: 'equip-name' }, w.nome), el('div', { class: 'pill gold', style: 'margin:.2rem 0' }, `${w.categoria} — GRÁTIS`), el('div', { class: 'equip-stats' }, el('span',{class:'equip-stat'},w.dano), el('span',{class:'equip-stat'},`Média ${w.media}`)), el('div', { class: 'btn-row' }, el('button', { class: 'btn small primary', onclick: () => { const novo={...w,peso:estimatePeso(w),qtd:1}; onChange({ equipamentos: [...(char.equipamentos||[]), novo] }); toast(`${w.nome} equipada! GRÁTIS`,'ok'); } }, 'Equipar')));
}
function estimatePeso(arma){ if(arma.media<=5) return 0.5; if(arma.media<=10) return 1.5; if(arma.media<=16) return 3; if(arma.media<=25) return 5; if(arma.media<=35) return 8; return 12; }

function renderFinal(char, db, computed, saveDraft) {
  const pts=computed.pontos;
  const wrap=el('div',{}, el('h2',{},'✨ Finalização — Pontos ao vivo'), el('p',{style:'color:var(--ink-dim);font-size:.9rem'},'Tudo atualiza em tempo real. Supabase sincroniza.'),
    el('div',{class:'panel',style:'border-color:var(--gold);margin-bottom:1rem'},
      el('h3',{},`💰 ${pts.pontosTotais} totais | ${pts.totalGasto} gastos | ${pts.disponivel} livres`),
      el('div',{class:'bar gold',style:'height:14px;margin:.6rem 0'}, el('i',{style:`width:${Math.min(100,(pts.totalGasto/pts.pontosTotais)*100)}%`})),
      el('table',{class:'pontos-table'},
        el('tr',{},el('th',{},'Categoria'),el('th',{},'Detalhe'),el('th',{class:'num'},'Custo')),
        el('tr',{},el('td',{},'Atributos'),el('td',{},`${Object.entries(pts.breakdown.atributos.detalhe).map(([k,v])=>`${k}${v.valor}(${v.custo>=0?'+':''}${v.custo})`).join(', ')}`),el('td',{class:'num'},`${pts.breakdown.atributos.total} pts`)),
        el('tr',{},el('td',{},'Vantagens'),el('td',{},`${pts.breakdown.vantagens.detalhe.map(d=>`${d.nome}(${d.custo})`).join(', ')||'nenhuma'}`),el('td',{class:'num'},`${pts.breakdown.vantagens.total} pts`)),
        el('tr',{},el('td',{},'Desvantagens (ganha)'),el('td',{},`${pts.breakdown.desvantagens.detalhe.map(d=>`${d.nome}(${d.custo})`).join(', ')||'nenhuma'}`),el('td',{class:'num'},`${pts.breakdown.desvantagens.total} pts`)),
        el('tr',{},el('td',{},'Peculiaridades'),el('td',{},`${pts.breakdown.peculiaridades.detalhe.length} × -1`),el('td',{class:'num'},`${pts.breakdown.peculiaridades.total} pts`)),
        el('tr',{},el('td',{},'Perícias'),el('td',{},`${pts.breakdown.pericias.detalhe.slice(0,4).map(p=>`${p.nome}${p.valor}(${p.custo})`).join(', ')}${pts.breakdown.pericias.detalhe.length>4?' +...':''}`),el('td',{class:'num'},`${pts.breakdown.pericias.total} pts`)),
        el('tr',{},el('td',{},'Manobras GRÁTIS'),el('td',{},`${pts.breakdown.manobras.quantidade}`),el('td',{class:'num'},`0 pts`)),
        el('tr',{},el('td',{},'Poderes'),el('td',{},`${pts.breakdown.poderes.detalhe.map(d=>`${d.nome}Pot${d.potencia}(${d.subtotal})`).join(', ')||'nenhum'}`),el('td',{class:'num'},`${pts.breakdown.poderes.total} pts`)),
        el('tr',{},el('td',{},'Magias'),el('td',{},`${pts.breakdown.magias.detalhe.map(d=>`${d.nome}Nv${d.nivel}(${d.subtotal})`).join(', ')||'nenhum'}`),el('td',{class:'num'},`${pts.breakdown.magias.total} pts`)),
        el('tr',{style:'font-weight:700;background:var(--panel2)'},el('td',{},'TOTAL'),el('td',{},`${pts.disponivel>=0?'Dentro':'EXCEDIDO'}`),el('td',{class:'num'},`${pts.totalGasto}/${pts.pontosTotais}`))
      )
    ),
    el('label',{class:'field',style:'margin-top:1rem'},'História', el('textarea',{value:char.historia||'',rows:'6',oninput:(e)=>{ char.historia=e.target.value; saveDraft(); }})),
    el('div',{class:'grid cols-2',style:'margin-top:1rem'},
      el('div',{class:'panel'}, el('h3',{},'📊 Resumo'), el('div',{class:'breakdown'},
        el('div',{class:'line'},el('span',{},'Nome'),el('b',{},computed.identidade.nome||'—')),
        el('div',{class:'line'},el('span',{},'Vantagens'),el('b',{},String(computed.vantagens.length))),
        el('div',{class:'line'},el('span',{},'Desvant'),el('b',{},String(computed.desvantagens.length))),
        el('div',{class:'line'},el('span',{},'Perícias'),el('b',{},String(computed.pericias.length))),
        el('div',{class:'line'},el('span',{},'Poderes'),el('b',{},String(computed.poderes.length))),
        el('div',{class:'line'},el('span',{},'Magias'),el('b',{},String(computed.magias.length)))
      )),
      el('div',{class:'panel'}, el('h3',{},'🎲 Teste'), el('div',{class:'field-grid'}, el('label',{class:'field'},'Valor',el('input',{type:'number',id:'testeValor',value:'10'})), el('label',{class:'field'},'Roll',el('input',{type:'number',id:'testeRoll',placeholder:'aleatório'}))), el('div',{class:'btn-row'}, el('button',{class:'btn primary',onclick:()=>{ const val=parseInt(document.getElementById('testeValor')?.value,10)||10; const roll=document.getElementById('testeRoll')?.value?parseInt(document.getElementById('testeRoll').value,10):null; const res=testarMargem(val,db,roll); const resEl=document.getElementById('resultadoTeste'); if(!resEl) return; resEl.innerHTML=''; resEl.append(el('div',{class:`pill ${res.sucesso?'ok':'bad'}`},`${res.sucesso?'✅':'❌'} ${res.rolagem}`), el('div',{style:'margin-top:.4rem'},`Margem ${res.margemTexto}`)); }},'🎲 Testar')), el('div',{id:'resultadoTeste',style:'margin-top:.8rem;padding:.6rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;min-height:40px'},'Resultado...'))
    )
  );
  return wrap;
}

function renderValidacao(validacao) {
  if(!validacao || (validacao.erros.length===0 && validacao.avisos.length===0 && validacao.infos.length===0)) return el('div',{class:'validation-list'}, el('div',{class:'validation-item ok'}, el('span',{class:'val-icon'},'✅'), el('span',{},'Ficha válida!')));
  const wrap=el('div',{class:'validation-list'});
  for(const e of validacao.erros) wrap.append(el('div',{class:'validation-item bad'}, el('span',{class:'val-icon'},'⛔'), el('span',{},e.msg)));
  for(const a of validacao.avisos) wrap.append(el('div',{class:'validation-item warn'}, el('span',{class:'val-icon'},'⚠️'), el('span',{},a.msg)));
  for(const i of validacao.infos) wrap.append(el('div',{class:'validation-item ok'}, el('span',{class:'val-icon'},'ℹ️'), el('span',{},i.msg)));
  return wrap;
}
