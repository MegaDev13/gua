/* GAU — Forja de Personagens (Criar Personagem)
   Wizard multi-etapas com validação automática
   FIX: inputs de texto não podem disparar rerender (perdia foco)
   FIX: draft preservado entre steps para não perder edição não salva
*/

import { el, toast } from './ui.js';
import { novoPersonagemBase, storage } from './storage.js';
import { computeCharacter } from './character-calculator.js';
import { testarMargem } from './dice.js';

const STEPS = [
  { id: 'identidade', nome: 'Identidade', icon: '🧙', desc: 'Nome, conceito e categoria' },
  { id: 'atributos', nome: 'Atributos', icon: '💪', desc: 'ST, DX, IQ, HT e margens' },
  { id: 'pericias', nome: 'Perícias', icon: '📜', desc: 'Conhecimentos e técnicas' },
  { id: 'manobras', nome: 'Manobras', icon: '⚔️', desc: 'Árvore tática de combate' },
  { id: 'equipamentos', nome: 'Equipamentos', icon: '🛡️', desc: 'Armas e carga' },
  { id: 'final', nome: 'Finalizar', icon: '✨', desc: 'História e revisão' }
];

// Draft em memória para preservar edição não salva entre navegações de steps
let _draft = null;
let _draftId = null;

export function renderCharacterBuilder(main, db, params, currentChar, onSave) {
  const charIdParam = params[0]; // 'novo' ou id real
  const stepParam = params[1] || 'identidade';
  let activeStep = STEPS.find(s => s.id === stepParam) ? stepParam : 'identidade';

  // Resolve personagem base
  let baseChar = null;
  if (charIdParam && charIdParam !== 'novo') {
    // Se temos draft com mesmo id, usa draft (preserva edição não salva)
    if (_draft && _draftId === charIdParam) {
      baseChar = _draft;
    } else {
      baseChar = storage.getPersonagem(charIdParam);
      // Se não achou no storage mas draft existe com id próximo (novo), tenta usar
      if (!baseChar && _draft && _draft.id === charIdParam) baseChar = _draft;
    }
  }
  // Se ainda não tem, tenta draft de 'novo' ou atual ou novo base
  if (!baseChar) {
    if (_draft && (charIdParam === 'novo' || !_draftId || _draftId === 'novo' || _draftId === _draft.id)) {
      // Se estamos criando novo e já existe draft, usa draft
      if (charIdParam === 'novo' || !_draft || _draft.id === _draftId) {
        // se draft foi criado como novo, reaproveita
        if (_draftId === 'novo' || _draftId === null || charIdParam === 'novo') {
          baseChar = _draft;
        }
      }
    }
  }
  if (!baseChar) {
    baseChar = storage.getAtual() || novoPersonagemBase();
    // Se param é novo, força novo base mas preserva draft se for novo
    if (charIdParam === 'novo' && _draft && _draftId === 'novo') {
      baseChar = _draft;
    } else if (charIdParam === 'novo') {
      baseChar = novoPersonagemBase();
    }
  }
  if (!baseChar) baseChar = novoPersonagemBase();

  // Clone para edição e guarda como draft
  let editing = JSON.parse(JSON.stringify(baseChar));
  if (!editing.id) editing.id = 'char_' + Date.now();
  _draft = editing;
  _draftId = charIdParam || editing.id;

  function saveDraft() {
    _draft = JSON.parse(JSON.stringify(editing));
    _draftId = editing.id;
  }

  function doRender() {
    const computed = computeCharacter(db, editing);
    main.innerHTML = '';
    const builder = el('div', { class: 'builder' });

    builder.append(
      el('h1', { class: 'page-title' }, '⚔️ Forja de Personagens', el('small', { id: 'builderTitleSmall' }, `${editing.nome ? editing.nome + ' • ' : ''}Margem 10 = humano comum`)),
      el('p', { class: 'page-subtitle' }, 'Construa seu personagem. O sistema recalcula margens, carga, deslocamento e valida tudo automaticamente.')
    );

    // Steps
    const stepsEl = el('div', { class: 'builder-steps' });
    for (const step of STEPS) {
      const done = STEPS.findIndex(s => s.id === activeStep) > STEPS.findIndex(s => s.id === step.id);
      const isActive = step.id === activeStep;
      stepsEl.append(el('button', {
        class: `builder-step ${isActive ? 'active' : ''} ${done ? 'done' : ''}`,
        onclick: () => {
          saveDraft();
          // Se já está no mesmo personagem, só troca step localmente sem perder draft
          if (editing.id) {
            activeStep = step.id;
            // Atualiza hash mas draft será usado no próximo route
            location.hash = `#/criar/${editing.id}/${step.id}`;
            // Também re-render local imediato para feedback rápido
            // (route vai re-render de novo, mas draft preserva)
            doRender();
          } else {
            location.hash = `#/criar/novo/${step.id}`;
          }
        }
      },
        el('span', { class: 'step-num' }, isActive ? '●' : done ? '✓' : STEPS.indexOf(step)+1),
        `${step.icon} ${step.nome}`
      ));
    }
    builder.append(stepsEl);

    // Conteúdo
    const content = el('div', { class: 'builder-content' });

    const onPatch = (patch) => {
      Object.assign(editing, patch);
      saveDraft();
      doRender();
    };

    if (activeStep === 'identidade') content.append(renderIdentidade(editing, db, onPatch, saveDraft));
    if (activeStep === 'atributos') content.append(renderAtributos(editing, db, computed, onPatch));
    if (activeStep === 'pericias') content.append(renderPericias(editing, db, computed, onPatch));
    if (activeStep === 'manobras') content.append(renderManobras(editing, db, computed, onPatch));
    if (activeStep === 'equipamentos') content.append(renderEquipamentos(editing, db, computed, onPatch));
    if (activeStep === 'final') content.append(renderFinal(editing, db, computed, saveDraft));

    content.append(renderValidacao(computed.validacao));

    const idx = STEPS.findIndex(s => s.id === activeStep);
    const prev = idx > 0 ? STEPS[idx-1] : null;
    const next = idx < STEPS.length-1 ? STEPS[idx+1] : null;
    const nav = el('div', { class: 'builder-nav' },
      prev ? el('button', { class: 'btn', onclick: () => { saveDraft(); location.hash = `#/criar/${editing.id}/${prev.id}`; } }, `← ${prev.nome}`) : el('span', {}),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost', onclick: () => { editing = novoPersonagemBase(); _draft = JSON.parse(JSON.stringify(editing)); _draftId = 'novo'; doRender(); toast('Ficha reiniciada','warn'); } }, 'Reiniciar'),
        el('button', { class: 'btn', onclick: () => { const saved = storage.salvarPersonagem(editing); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast(`Personagem ${saved.nome || 'sem nome'} salvo!`,'ok'); if (onSave) onSave(saved); location.hash = `#/personagens`; } }, '💾 Salvar'),
        el('button', { class: 'btn primary', onclick: () => { const saved = storage.salvarPersonagem(editing); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast('Salvo!','ok'); if (next) location.hash = `#/criar/${saved.id}/${next.id}`; else location.hash = `#/ficha/${saved.id}`; } }, next ? `${next.nome} →` : 'Ver Ficha →')
      )
    );
    content.append(nav);

    builder.append(content);
    main.append(builder);
  }

  doRender();
}

function renderIdentidade(char, db, onChange, saveDraft) {
  const wrap = el('div', {},
    el('h2', {}, '🧙 Identidade'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Quem é seu personagem no universo GAU? Nome, conceito e escala de existência.')
  );

  const grid = el('div', { class: 'field-grid' },
    el('label', { class: 'field' }, 'Nome do Personagem',
      el('input', {
        type: 'text',
        value: char.nome || '',
        placeholder: 'Ex: Kael, a Lâmina Errante',
        oninput: (e) => {
          char.nome = e.target.value;
          saveDraft();
          const t = document.getElementById('builderTitleSmall');
          if (t) t.textContent = `${e.target.value ? e.target.value + ' • ' : ''}Margem 10 = humano comum`;
        }
      })
    ),
    el('label', { class: 'field' }, 'Conceito / Arquétipo',
      el('input', {
        type: 'text',
        value: char.conceito || '',
        placeholder: 'Ex: Mercenário acrobático, Atirador futurista',
        oninput: (e) => { char.conceito = e.target.value; saveDraft(); }
      })
    ),
    el('label', { class: 'field' }, 'Jogador',
      el('input', {
        type: 'text',
        value: char.jogador || '',
        placeholder: 'Seu nome',
        oninput: (e) => { char.jogador = e.target.value; saveDraft(); }
      })
    ),
    el('label', { class: 'field' }, 'Categoria de Poder',
      (() => {
        const sel = el('select', {
          onchange: (e) => {
            char.categoria = e.target.value;
            saveDraft();
            onChange({ categoria: e.target.value });
          }
        });
        for (const cat of db.categories.categorias || []) {
          const opt = el('option', { value: cat.id, selected: cat.id === (char.categoria || 'mundano') }, `${cat.nome} — ${cat.dados} — ${cat.descricao.slice(0,60)}…`);
          sel.append(opt);
        }
        return sel;
      })()
    )
  );

  const catInfo = (db.categories.categorias || []).find(c => c.id === (char.categoria || 'mundano'));
  if (catInfo) {
    grid.append(el('div', { class: 'field-group', style: 'grid-column:1/-1' },
      el('div', { class: 'field-group-title' }, `🌌 ${catInfo.nome} — ${catInfo.dados}`),
      el('p', { style: 'font-size:.9rem;color:var(--ink-dim);margin:.3rem 0' }, catInfo.descricao),
      el('div', { class: 'pill gold', style: 'margin-top:.4rem' }, `Limite de atributo: ${catInfo.limiteAtributo}`),
      el('p', { style: 'font-size:.8rem;color:var(--ink-faint);margin-top:.6rem' }, `Exemplos: ${catInfo.exemplos}`)
    ));
  }

  wrap.append(grid);
  return wrap;
}

function renderAtributos(char, db, computed, onChange) {
  const wrap = el('div', {},
    el('h2', {}, '💪 Atributos'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Valor 10 = referência humana (margem 8–12, crítico 10). Quanto maior, maior a margem de sucesso. Teste = d20 dentro da margem.'),
    el('div', { class: 'rule-box' },
      el('div', { class: 'box-title' }, '📜 Regra Fundamental'),
      el('p', { style: 'margin:.3rem 0;font-size:.9rem' }, 'Atributo determina capacidade, categoria determina escala (quantidade de d20), margem determina resultado necessário.')
    )
  );

  const grid = el('div', { class: 'attr-grid' });
  for (const attr of db.attributes.atributos || []) {
    const val = char.atributos?.[attr.id] ?? 10;
    const margem = db.getMarginForValue(val);
    const card = el('div', { class: 'attr-card' },
      el('div', { class: 'attr-name' }, `${attr.nome} (${attr.id})`),
      el('div', { class: 'attr-value' }, String(val)),
      el('input', {
        type: 'range', min: '1', max: '20', value: String(val),
        oninput: (e) => {
          const v = parseInt(e.target.value,10);
          const newAttrs = { ...(char.atributos||{}), [attr.id]: v };
          onChange({ atributos: newAttrs });
        }
      }),
      el('div', { class: 'attr-margin' }, margem ? `Margem ${margem.margemTexto}` : 'Sem margem'),
      el('div', { class: 'attr-crit' }, margem?.critico ? `Crítico ${margem.critico} • ${margem.descricao}` : ''),
      el('div', { class: 'attr-bar' }, el('i', { style: `width:${Math.min(100, (val/20)*100)}%` }))
    );
    const controls = el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:.5rem' },
      el('button', { class: 'btn small', onclick: () => { const v = Math.max(1, val-1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } }); } }, '−'),
      el('button', { class: 'btn small', onclick: () => { const v = Math.min(20, val+1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } }); } }, '+'),
      el('button', { class: 'btn small ghost', onclick: () => {
        const res = testarMargem(val, db);
        toast(`${attr.id} ${val}: rolou ${res.rolagem} — ${res.sucesso ? '✅ Sucesso' : '❌ Falha'}${res.critico ? ' • CRÍTICO!' : ''} (margem ${res.margemTexto})`, res.sucesso ? 'ok' : 'bad');
      } }, '🎲 Testar')
    );
    card.append(controls);
    grid.append(card);
  }

  wrap.append(grid);

  const der = computed.derivados;
  wrap.append(
    el('div', { class: 'field-group', style: 'margin-top:1.2rem' },
      el('div', { class: 'field-group-title' }, '📊 Derivados Calculados Automaticamente'),
      el('div', { class: 'grid cols-3' },
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Deslocamento Base'), el('div', { class: 'value' }, String(der.deslocamento.base)), el('div', { class: 'hint' }, 'm/s')),
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Deslocamento Atual'), el('div', { class: 'value' }, String(der.deslocamento.atual)), el('div', { class: 'hint' }, `Carga ${der.deslocamento.carga.nome}`)),
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PF / PV'), el('div', { class: 'value' }, `${der.pf.atual}/${der.pf.max} • ${der.pv.atual}/${der.pv.max}`), el('div', { class: 'hint' }, 'Pontos')),
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Levantamento 1 mão'), el('div', { class: 'value' }, `${der.levantamento.umaMao}kg`), el('div', { class: 'hint' }, '3×ST')),
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Levantamento 2 mãos'), el('div', { class: 'value' }, `${der.levantamento.duasMaos}kg`), el('div', { class: 'hint' }, '13×ST')),
        el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Carregar Costas'), el('div', { class: 'value' }, `${der.levantamento.costas}kg`), el('div', { class: 'hint' }, '15×ST'))
      )
    )
  );

  return wrap;
}

function renderPericias(char, db, computed, onChange) {
  const wrap = el('div', {},
    el('h2', {}, '📜 Perícias'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Perícias representam conhecimentos e técnicas. NH = atributo base ± modificadores. Algumas podem ser tentadas sem treino com redutor (ex: Arrombamento IQ-5, Natação ST-5).')
  );

  const list = el('div', { class: 'skill-list' });
  for (const p of char.pericias || []) {
    const margem = db.getMarginForValue(p.valor);
    const row = el('div', { class: 'skill-item' },
      el('div', { class: 'grow' },
        el('div', { class: 'skill-name' }, p.nome),
        el('div', { class: 'meta', style: 'font-size:.75rem;color:var(--ink-faint)' }, `${p.descricao || ''} • Base ${p.atributoBase || '—'}`)
      ),
      el('span', { class: 'skill-attr' }, p.atributoBase || ''),
      el('input', {
        type: 'number', min: '1', max: '25', value: String(p.valor), style: 'width:70px',
        onchange: (e) => {
          const v = parseInt(e.target.value,10) || 10;
          const novas = (char.pericias||[]).map(x => x.nome === p.nome ? { ...x, valor: v } : x);
          onChange({ pericias: novas });
        },
        oninput: (e) => {
          // Atualiza sem perder foco, mas não re-renderiza a cada tecla
          const v = parseInt(e.target.value,10);
          if (!isNaN(v)) {
            const item = (char.pericias||[]).find(x => x.nome === p.nome);
            if (item) item.valor = v;
          }
        }
      }),
      el('span', { class: 'skill-margin' }, margem ? margem.margemTexto : '—'),
      el('button', { class: 'btn small ghost', onclick: () => {
        const res = testarMargem(p.valor, db);
        toast(`${p.nome} ${p.valor}: ${res.rolagem} → ${res.sucesso ? 'Sucesso' : 'Falha'}${res.critico ? ' CRÍTICO!' : ''}`, res.sucesso ? 'ok' : 'bad');
      }}, '🎲'),
      el('button', { class: 'btn small danger', onclick: () => {
        onChange({ pericias: (char.pericias||[]).filter(x => x.nome !== p.nome) });
      }}, '✕')
    );
    list.append(row);
  }

  wrap.append(list);

  const addRow = el('div', { class: 'field-group', style: 'margin-top:1rem' },
    el('div', { class: 'field-group-title' }, '➕ Adicionar Perícia'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome',
        el('input', { type: 'text', id: 'novaPericiaNome', placeholder: 'Ex: Furtividade, Medicina, Pilotagem' })
      ),
      el('label', { class: 'field' }, 'Atributo Base',
        (() => {
          const sel = el('select', { id: 'novaPericiaAttr' });
          ['ST','DX','IQ','HT'].forEach(a => sel.append(el('option', { value: a }, a)));
          return sel;
        })()
      ),
      el('label', { class: 'field' }, 'Valor',
        el('input', { type: 'number', id: 'novaPericiaValor', value: '10', min: '1', max: '25' })
      )
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => {
        const nome = document.getElementById('novaPericiaNome')?.value.trim();
        const attr = document.getElementById('novaPericiaAttr')?.value;
        const valor = parseInt(document.getElementById('novaPericiaValor')?.value,10) || 10;
        if (!nome) { toast('Informe nome da perícia','warn'); return; }
        const novas = [...(char.pericias||[]), { nome, atributoBase: attr, valor, descricao: `Base ${attr}` }];
        onChange({ pericias: novas });
      }}, 'Adicionar')
    )
  );
  wrap.append(addRow);

  return wrap;
}

function renderManobras(char, db, computed, onChange) {
  const wrap = el('div', {},
    el('h2', {}, '⚔️ Manobras de Combate'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Escolha as manobras que definem seu estilo. Cada turno = 1 segundo. Sequência por deslocamento base.'),
    el('div', { class: 'rule-box' },
      el('div', { class: 'box-title' }, 'Árvore Tática'),
      el('p', { style: 'font-size:.85rem;margin:.3rem 0' }, 'Movimento (Linear, Difuso, Acrobático, Atlético) → Atacar (Simples, Acrobático, Pesado, Distância) → Preparar → Apontar → Analisar → Fazer Nada')
    )
  );

  const allManeuvers = [];
  const collect = (obj, prefix='') => {
    if (!obj) return;
    if (obj.nome && obj.id) allManeuvers.push({ id: obj.id, nome: obj.nome, desc: obj.descricao?.slice(0,120) || '', grupo: prefix });
    for (const k of ['estilos','caminhos','formas','tipos','acoes']) {
      if (Array.isArray(obj[k])) obj[k].forEach(c => collect(c, obj.nome || prefix));
    }
  };
  Object.values(db.maneuvers).forEach(root => collect(root, ''));

  const selected = new Set(char.manobras || []);
  const grid = el('div', { class: 'grid cols-2' });
  const grupos = {};
  for (const m of allManeuvers) {
    const g = m.grupo || 'Geral';
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(m);
  }

  for (const [grupo, lista] of Object.entries(grupos)) {
    const panel = el('div', { class: 'panel' },
      el('h3', {}, grupo),
      el('div', { class: 'maneuver-chips' },
        ...lista.map(m => {
          const active = selected.has(m.id);
          return el('button', {
            class: `maneuver-chip ${active ? 'active' : ''}`,
            onclick: () => {
              const novas = new Set(selected);
              if (novas.has(m.id)) novas.delete(m.id); else novas.add(m.id);
              onChange({ manobras: [...novas] });
            },
            title: m.desc
          }, m.nome);
        })
      )
    );
    grid.append(panel);
  }

  wrap.append(grid);

  const empWrap = el('div', { class: 'field-group', style: 'margin-top:1.2rem' },
    el('div', { class: 'field-group-title' }, '🤲 Empunhadura Preferida'),
    el('div', { class: 'grid cols-3' },
      ...(db.empunhaduras.empunhaduras || []).map(emp => {
        const active = char.empunhadura === emp.id;
        return el('div', {
          class: `equip-card ${active ? 'active' : ''}`,
          style: active ? 'border-color:var(--gold);background:linear-gradient(180deg, rgba(201,165,92,.12), var(--bg))' : '',
          onclick: () => onChange({ empunhadura: emp.id })
        },
          el('div', { class: 'equip-name' }, emp.nome),
          el('div', { class: 'pill gold', style: 'margin:.3rem 0' }, emp.especialidade),
          el('div', { style: 'font-size:.8rem;color:var(--ink-dim)' }, emp.vantagem),
          el('div', { style: 'font-size:.78rem;color:var(--ink-faint);margin-top:.4rem' }, emp.descricao.slice(0,100)+'…'),
          el('div', { class: 'btn-row' }, el('span', { class: `pill ${active ? 'ok' : ''}` }, active ? '✓ Selecionada' : 'Selecionar'))
        );
      })
    )
  );
  wrap.append(empWrap);

  return wrap;
}

function renderEquipamentos(char, db, computed, onChange) {
  const wrap = el('div', {},
    el('h2', {}, '🛡️ Equipamentos & Carga'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Armas mundanas, modernas e futuristas. Carga afeta deslocamento, natação e fadiga.'),
    el('div', { class: 'grid cols-3' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso Total'), el('div', { class: 'value' }, `${computed.derivados.pesoEquip.toFixed(1)}kg`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Carga'), el('div', { class: 'value' }, computed.derivados.deslocamento.carga.nome), el('div', { class: 'hint' }, `Penalidade -${computed.derivados.deslocamento.carga.penalidade}`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Deslocamento Atual'), el('div', { class: 'value' }, `${computed.derivados.deslocamento.atual} m/s`), el('div', { class: 'hint' }, `Base ${computed.derivados.deslocamento.base}`))
    )
  );

  const list = el('div', { class: 'equip-grid', style: 'margin-top:1rem' });
  for (const eq of char.equipamentos || []) {
    list.append(el('div', { class: 'equip-card' },
      el('div', { class: 'equip-name' }, eq.nome),
      el('div', { class: 'equip-stats' },
        eq.dano ? el('span', { class: 'equip-stat' }, eq.dano) : '',
        eq.categoria ? el('span', { class: 'equip-stat' }, eq.categoria) : '',
        eq.peso ? el('span', { class: 'equip-stat' }, `${eq.peso}kg`) : '',
        eq.caracteristica ? el('span', { class: 'equip-stat' }, eq.caracteristica) : ''
      ),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn small danger', onclick: () => {
          onChange({ equipamentos: (char.equipamentos||[]).filter(e => e.nome !== eq.nome) });
        }}, 'Remover')
      )
    ));
  }
  wrap.append(list);

  const allWeapons = db.getAllWeapons();
  const addPanel = el('div', { class: 'field-group', style: 'margin-top:1.2rem' },
    el('div', { class: 'field-group-title' }, '➕ Adicionar Arma do Grimório'),
    el('div', { style: 'display:flex;gap:.5rem;margin-bottom:.8rem' },
      el('input', {
        type: 'search',
        id: 'buscaArma',
        placeholder: 'Buscar arma... ex: katana, rifle, plasma',
        style: 'flex:1',
        oninput: (e) => {
          const q = e.target.value.toLowerCase();
          const container = document.getElementById('listaArmas');
          if (!container) return;
          container.innerHTML = '';
          const filtradas = allWeapons.filter(w => w.nome.toLowerCase().includes(q) || w.caracteristica.toLowerCase().includes(q)).slice(0, 30);
          for (const w of filtradas) container.append(renderArmaOption(w, char, onChange));
        }
      }),
      el('button', { class: 'btn small', onclick: () => {
        const inp = document.getElementById('buscaArma');
        if (inp) inp.value = '';
        const container = document.getElementById('listaArmas');
        if (!container) return;
        container.innerHTML = '';
        for (const w of allWeapons.slice(0, 20)) container.append(renderArmaOption(w, char, onChange));
      }}, 'Listar 20')
    ),
    el('div', { id: 'listaArmas', class: 'equip-grid' })
  );

  setTimeout(() => {
    const container = document.getElementById('listaArmas');
    if (container) {
      for (const w of allWeapons.slice(0, 12)) container.append(renderArmaOption(w, char, onChange));
    }
  }, 0);

  wrap.append(addPanel);

  const custom = el('div', { class: 'field-group', style: 'margin-top:1rem' },
    el('div', { class: 'field-group-title' }, '🎒 Item Customizado'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'customNome', placeholder: 'Ex: Mochila, Corda, Poção' })),
      el('label', { class: 'field' }, 'Peso kg', el('input', { type: 'number', id: 'customPeso', value: '1', step: '0.1' })),
      el('label', { class: 'field' }, 'Descrição', el('input', { type: 'text', id: 'customDesc', placeholder: 'Característica' }))
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => {
        const nomeEl = document.getElementById('customNome');
        const pesoEl = document.getElementById('customPeso');
        const descEl = document.getElementById('customDesc');
        const nome = nomeEl?.value.trim();
        const peso = parseFloat(pesoEl?.value) || 0;
        const desc = descEl?.value.trim();
        if (!nome) { toast('Informe nome','warn'); return; }
        const novo = { nome, peso, caracteristica: desc, categoria: 'custom', qtd: 1 };
        onChange({ equipamentos: [...(char.equipamentos||[]), novo] });
        if (nomeEl) nomeEl.value = '';
      }}, 'Adicionar Item')
    )
  );
  wrap.append(custom);

  return wrap;
}

function renderArmaOption(w, char, onChange) {
  return el('div', { class: 'equip-card' },
    el('div', { class: 'equip-name' }, w.nome),
    el('div', { class: 'pill gold', style: 'margin:.2rem 0' }, w.categoria),
    el('div', { class: 'equip-stats' },
      el('span', { class: 'equip-stat' }, w.dano),
      el('span', { class: 'equip-stat' }, `Média ${w.media}`),
      el('span', { class: 'equip-stat' }, w.caracteristica),
      el('span', { class: 'equip-stat' }, w.tipo)
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn small primary', onclick: () => {
        const novo = { ...w, peso: estimatePeso(w), qtd: 1 };
        onChange({ equipamentos: [...(char.equipamentos||[]), novo] });
        toast(`${w.nome} adicionada!`,'ok');
      }}, 'Equipar')
    )
  );
}

function estimatePeso(arma) {
  if (arma.media <= 5) return 0.5;
  if (arma.media <= 10) return 1.5;
  if (arma.media <= 16) return 3;
  if (arma.media <= 25) return 5;
  if (arma.media <= 35) return 8;
  return 12;
}

function renderFinal(char, db, computed, saveDraft) {
  const wrap = el('div', {},
    el('h2', {}, '✨ Finalização'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Revise sua ficha, escreva história e finalize.'),
    el('label', { class: 'field', style: 'margin-top:1rem' }, 'História / Background / Anotações',
      el('textarea', {
        placeholder: 'Quem é seu personagem? De onde veio? Quais seus objetivos? Medos? Use para testes de Vontade e Pânico...',
        value: char.historia || '',
        rows: '6',
        oninput: (e) => { char.historia = e.target.value; saveDraft(); }
      })
    ),
    el('div', { class: 'grid cols-2', style: 'margin-top:1.2rem' },
      el('div', { class: 'panel' },
        el('h3', {}, '📊 Resumo Automático'),
        el('div', { class: 'breakdown' },
          el('div', { class: 'line' }, el('span', {}, 'Nome'), el('b', {}, computed.identidade.nome || '—')),
          el('div', { class: 'line' }, el('span', {}, 'Categoria'), el('b', {}, `${computed.identidade.categoria.nome} (${computed.identidade.categoria.dados})`)),
          el('div', { class: 'line' }, el('span', {}, 'Deslocamento'), el('b', {}, `${computed.derivados.deslocamento.atual} m/s`)),
          el('div', { class: 'line' }, el('span', {}, 'Carga'), el('b', {}, `${computed.derivados.deslocamento.carga.nome} (${computed.derivados.pesoEquip}kg)`)),
          el('div', { class: 'line' }, el('span', {}, 'PF/PV'), el('b', {}, `${computed.derivados.pf.atual}/${computed.derivados.pf.max} • ${computed.derivados.pv.atual}/${computed.derivados.pv.max}`)),
          el('div', { class: 'line' }, el('span', {}, 'Perícias'), el('b', {}, String(computed.pericias.length))),
          el('div', { class: 'line' }, el('span', {}, 'Manobras'), el('b', {}, String(computed.manobras.length))),
          el('div', { class: 'line' }, el('span', {}, 'Armas'), el('b', {}, String(computed.equipamentos.length)))
        )
      ),
      el('div', { class: 'panel' },
        el('h3', {}, '🎲 Teste Rápido'),
        el('p', { style: 'font-size:.85rem;color:var(--ink-dim)' }, 'Simule um teste de atributo ou perícia agora:'),
        el('div', { class: 'field-grid' },
          el('label', { class: 'field' }, 'Valor a testar (1-25)',
            el('input', { type: 'number', id: 'testeValor', value: '10', min: '1', max: '30' })
          ),
          el('label', { class: 'field' }, 'Rolagem d20 (vazio = aleatório)',
            el('input', { type: 'number', id: 'testeRoll', placeholder: 'Ex: 12', min: '1', max: '20' })
          )
        ),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn primary', onclick: () => {
            const val = parseInt(document.getElementById('testeValor')?.value,10) || 10;
            const rollInput = document.getElementById('testeRoll')?.value;
            const roll = rollInput ? parseInt(rollInput,10) : null;
            const res = testarMargem(val, db, roll);
            const resEl = document.getElementById('resultadoTeste');
            if (!resEl) return;
            resEl.innerHTML = '';
            resEl.append(
              el('div', { class: `pill ${res.sucesso ? 'ok' : 'bad'}`, style: 'font-size:1rem;padding:.4rem .8rem' }, `${res.sucesso ? '✅ Sucesso' : '❌ Falha'}${res.critico ? ' • CRÍTICO!' : ''}`),
              el('div', { style: 'margin-top:.6rem;font-size:.9rem' }, `Valor ${val} • Rolagem ${res.rolagem} • Margem ${res.margemTexto} • Distância ao crítico ${res.distanciaCritico}`),
              el('div', { class: 'dice-visual', style: 'margin-top:.6rem' }, el('span', { class: `die ${res.sucesso ? 'success' : 'fail'} ${res.critico ? 'crit' : ''}` }, String(res.rolagem)))
            );
          }}, '🎲 Testar Agora')
        ),
        el('div', { id: 'resultadoTeste', style: 'margin-top:1rem;padding:.8rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;min-height:60px' }, 'Resultado aparecerá aqui...')
      )
    )
  );
  return wrap;
}

function renderValidacao(validacao) {
  if (!validacao || (validacao.erros.length === 0 && validacao.avisos.length === 0 && validacao.infos.length === 0)) {
    return el('div', { class: 'validation-list' },
      el('div', { class: 'validation-item ok' }, el('span', { class: 'val-icon' }, '✅'), el('span', {}, 'Ficha válida. Pronta para forjar!'))
    );
  }
  const wrap = el('div', { class: 'validation-list' });
  for (const e of validacao.erros) wrap.append(el('div', { class: 'validation-item bad' }, el('span', { class: 'val-icon' }, '⛔'), el('span', {}, e.msg)));
  for (const a of validacao.avisos) wrap.append(el('div', { class: 'validation-item warn' }, el('span', { class: 'val-icon' }, '⚠️'), el('span', {}, a.msg)));
  for (const i of validacao.infos) wrap.append(el('div', { class: 'validation-item ok' }, el('span', { class: 'val-icon' }, 'ℹ️'), el('span', {}, i.msg)));
  return wrap;
}
