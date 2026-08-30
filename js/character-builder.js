/* GAU — Forja de Personagens
   Wizard multi-etapas com sistema de pontos visual travado
   - Manobras NÃO custam pontos
   - Travamento para não exceder pontos
   - Poderes customizáveis
   - Aba Magias
*/

import { el, toast } from './ui.js';
import { novoPersonagemBase, storage } from './storage.js';
import { computeCharacter } from './character-calculator.js';
import { testarMargem } from './dice.js';
import { PONTOS_PRESETS, CUSTOS } from './points-system.js';

const STEPS = [
  { id: 'identidade', nome: 'Identidade', icon: '🧙', desc: 'Nome, conceito, pontos' },
  { id: 'atributos', nome: 'Atributos', icon: '💪', desc: 'ST, DX, IQ, HT — 10 pts/nível' },
  { id: 'pericias', nome: 'Perícias', icon: '📜', desc: '2 pts/nível acima base' },
  { id: 'manobras', nome: 'Manobras', icon: '⚔️', desc: 'Grátis — estilo de combate' },
  { id: 'poderes', nome: 'Poderes', icon: '🧠', desc: 'Psi — Pot 5/3 + per 2 pts' },
  { id: 'magias', nome: 'Magias', icon: '🔮', desc: 'Escolas 3 pts + magias 2 pts' },
  { id: 'equipamentos', nome: 'Equipamentos', icon: '🛡️', desc: 'Armas e carga — grátis' },
  { id: 'final', nome: 'Finalizar', icon: '✨', desc: 'Pontos, história e revisão' }
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
  _draft = editing;
  _draftId = charIdParam || editing.id;

  function saveDraft() {
    _draft = JSON.parse(JSON.stringify(editing));
    _draftId = editing.id;
    if (window.atualizarPontosWidget) window.atualizarPontosWidget();
  }

  function doRender() {
    const computed = computeCharacter(db, editing);
    const onPatch = (patch) => {
      // Travamento: se patch aumenta custo e não tem pontos, bloqueia
      const testChar = { ...editing, ...patch };
      // Para atributos/pericias/poderes/magias, precisamos checar custo extra
      const testComputed = computeCharacter(db, testChar);
      if (testComputed.pontos.disponivel < 0) {
        // Se excede, avisa mas permite se for redução de pontosTotais? Não, só bloqueia aumento de gasto
        // Se patch é pontosTotais aumentando, permite
        if (patch.pontosTotais != null && patch.pontosTotais > editing.pontosTotais) {
          // aumentar total é permitido
        } else if (testComputed.pontos.totalGasto > computed.pontos.totalGasto) {
          toast(`Sem pontos! Faltam ${-testComputed.pontos.disponivel} pts. Aumente total ou reduza algo.`, 'bad');
          // Ainda aplica mas vai mostrar erro na validação; para travar de verdade, não aplica se for aumento simples
          // Para atributos/pericias, vamos travar: retorna sem aplicar se for aumento
          const isAumento = testComputed.pontos.totalGasto > computed.pontos.totalGasto;
          if (isAumento && computed.pontos.disponivel >=0) {
            // Se já estava dentro do orçamento e novo excede, bloqueia
            // Exceto se for magias/poderes custom que o usuário realmente quer exceder para ver erro
            // Vamos bloquear apenas para atributos e pericias com botão +, mas permitir para poderes/magias para mostrar erro?
            // Para cumprir requisito \"travar para não passar\", bloqueamos tudo que aumenta gasto
            if (patch.atributos || patch.pericias || patch.poderes || patch.magias) {
              // Não bloqueia se o usuário está diminuindo? Mas testComputed já excede, então é aumento
              // Vamos impedir
              return;
            }
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
      el('h1', { class: 'page-title' }, '⚔️ Forja de Personagens', el('small', { id: 'builderTitleSmall' }, `${editing.nome ? editing.nome + ' • ' : ''}${editing.pontosTotais||150} pts`)),
      el('p', { class: 'page-subtitle' }, 'Sistema de pontos travado: manobras e equipamentos são grátis. Atributos 10 pts/nível, perícias 2 pts, poderes Pot 5/3 + 2 pts/perícia, magias 3 pts + 2 pts.'),
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
    if (activeStep === 'pericias') content.append(renderPericias(editing, db, computed, onPatch));
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
        el('button', { class: 'btn', onclick: () => { const saved = storage.salvarPersonagem(editing); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast(`Salvo ${saved.nome||''}`,'ok'); if(onSave) onSave(saved); location.hash='#/personagens'; } }, '💾 Salvar'),
        el('button', { class: 'btn primary', onclick: () => { const saved = storage.salvarPersonagem(editing); _draft = JSON.parse(JSON.stringify(saved)); _draftId = saved.id; toast('Salvo!','ok'); if(next) location.hash=`#/criar/${saved.id}/${next.id}`; else location.hash=`#/ficha/${saved.id}`; } }, next ? `${next.nome} →` : 'Ver Ficha →')
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
  const barra = el('div', { class: 'panel', style: 'padding:.8rem 1rem;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;justify-content:space-between;border-color:var(--gold)' },
    el('div', { style: 'display:flex;gap:.6rem;align-items:center;flex-wrap:wrap' },
      el('span', { style: 'font-weight:700;color:var(--gold2);font-family:var(--font-display)' }, `💰 ${pts.pontosTotais} pts Totais`),
      el('span', { class: `pill ${livreClass}` }, `${pts.totalGasto} gastos • ${pts.disponivel} livres`),
      el('div', { class: `bar gold ${livreClass==='bad' ? 'bad' : ''}`, style: 'width:140px;height:12px' }, el('i', { style: `width:${pct}%` }))
    ),
    el('div', { style: 'display:flex;gap:.4rem;align-items:center;flex-wrap:wrap' },
      el('button', { class: 'btn small', onclick: () => { const v = Math.max(0, (editing.pontosTotais||150)-10); onPatch({ pontosTotais: v }); } }, '−10'),
      el('button', { class: 'btn small', onclick: () => { const v = (editing.pontosTotais||150)+10; onPatch({ pontosTotais: v }); } }, '+10'),
      el('button', { class: 'btn small', onclick: () => { const v = (editing.pontosTotais||150)+50; onPatch({ pontosTotais: v }); } }, '+50'),
      (() => {
        const sel = el('select', { style: 'max-width:160px', onchange: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) onPatch({ pontosTotais: v }); } });
        sel.append(el('option', { value: '' }, 'Preset...'));
        for (const pre of PONTOS_PRESETS) sel.append(el('option', { value: String(pre.pontos), selected: pre.pontos===pts.pontosTotais }, `${pre.nome} ${pre.pontos}`));
        return sel;
      })(),
      el('input', { type: 'number', min: '0', max: '5000', step: '10', value: String(pts.pontosTotais), style: 'width:90px',
        onchange: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) onPatch({ pontosTotais: v }); },
        oninput: (e) => { const v = parseInt(e.target.value,10); if(!isNaN(v)) { editing.pontosTotais=v; saveDraft(); } }
      })
    )
  );
  const breakdown = el('div', { class: 'grid cols-4', style: 'margin-top:.6rem;width:100%' },
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Atributos'), el('div', { class: 'value' }, `${pts.breakdown.atributos.total} pts`), el('div', { class: 'hint' }, '10 pts/nível acima 10')),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Perícias'), el('div', { class: 'value' }, `${pts.breakdown.pericias.total} pts`), el('div', { class: 'hint' }, '2 pts/nível')),
    el('div', { class: 'stat small gold' }, el('div', { class: 'label' }, 'Poderes'), el('div', { class: 'value' }, `${pts.breakdown.poderes.total} pts`), el('div', { class: 'hint' }, 'Pot 5/3 + per 2')),
    el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Magias'), el('div', { class: 'value' }, `${pts.breakdown.magias.total} pts`), el('div', { class: 'hint' }, '3 pts + 2 pts/magia'))
  );
  return el('div', { style: 'width:100%' }, barra, breakdown);
}

function renderIdentidade(char, db, onChange, saveDraft) {
  const wrap = el('div', {}, el('h2', {}, '🧙 Identidade'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Defina identidade e escala de pontos. Manobras e equipamentos são grátis.'));
  const grid = el('div', { class: 'field-grid' },
    el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', value: char.nome||'', placeholder: 'Kael, a Lâmina Errante', oninput: (e) => { char.nome=e.target.value; saveDraft(); const t=document.getElementById('builderTitleSmall'); if(t) t.textContent=`${e.target.value?e.target.value+' • ':''}${char.pontosTotais||150} pts`; } })),
    el('label', { class: 'field' }, 'Conceito', el('input', { type: 'text', value: char.conceito||'', placeholder: 'Mercenário acrobático', oninput: (e) => { char.conceito=e.target.value; saveDraft(); } })),
    el('label', { class: 'field' }, 'Jogador', el('input', { type: 'text', value: char.jogador||'', placeholder: 'Seu nome', oninput: (e) => { char.jogador=e.target.value; saveDraft(); } })),
    el('label', { class: 'field' }, 'Pontos Totais (editável em todas páginas)',
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
          ...PONTOS_PRESETS.map(pre => el('option', { value: String(pre.pontos), selected: pre.pontos===(char.pontosTotais||150) }, `${pre.nome} ${pre.pontos} — ${pre.desc}`))
        )
      )
    ),
    el('label', { class: 'field' }, 'Categoria de Poder',
      (() => {
        const sel = el('select', { onchange: (e) => { char.categoria=e.target.value; saveDraft(); onChange({ categoria: e.target.value }); } });
        for (const cat of db.categories.categorias||[]) sel.append(el('option', { value: cat.id, selected: cat.id===(char.categoria||'mundano') }, `${cat.nome} — ${cat.dados}`));
        return sel;
      })()
    )
  );
  const catInfo = (db.categories.categorias||[]).find(c => c.id===(char.categoria||'mundano'));
  if (catInfo) grid.append(el('div', { class: 'field-group', style: 'grid-column:1/-1' }, el('div', { class: 'field-group-title' }, `🌌 ${catInfo.nome} — ${catInfo.dados}`), el('p', { style: 'font-size:.9rem;color:var(--ink-dim)' }, catInfo.descricao), el('div', { class: 'pill gold' }, `Limite: ${catInfo.limiteAtributo}`)));
  wrap.append(grid);
  wrap.append(el('div', { class: 'rule-box', style: 'margin-top:1rem' }, el('div', { class: 'box-title' }, '💰 Custos'), el('p', { style: 'font-size:.85rem' }, 'Atributos (valor-10)*10 pts, Perícias 2 pts/nível, Poderes Potência 5 ou 3 pts + perícia psi 2 pts, Magias Escola 3 pts + magia 2 pts, Manobras e Equipamentos 0 pts (grátis). Travado: não deixa aumentar se faltar pontos.')));
  return wrap;
}

function renderAtributos(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '💪 Atributos — 10 pts/nível acima 10 (travado)'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Aumentar custa pontos. Sistema trava se não houver pontos livres. Diminuir devolve pontos.'));
  const grid = el('div', { class: 'attr-grid' });
  for (const attr of db.attributes.atributos||[]) {
    const val = char.atributos?.[attr.id] ?? 10;
    const margem = db.getMarginForValue(val);
    const custo = (val-10)*CUSTOS.atributo.porNivel;
    const custoProx = 10; // aumentar 1 custa 10
    const podeAumentar = computed.pontos.disponivel >= custoProx || val < (char.atributos?.[attr.id] ?? 10); // se já tem valor, aumentar custa; se disponivel negativo, bloqueia
    const podeAumentarReal = computed.pontos.disponivel >= custoProx;
    const card = el('div', { class: 'attr-card' },
      el('div', { class: 'attr-name' }, `${attr.nome} (${attr.id})`),
      el('div', { class: 'attr-value' }, String(val)),
      el('div', { class: `pill ${custo>0?'warn':custo<0?'ok':''}`, style: 'margin:.2rem auto' }, `${custo>=0?'+':''}${custo} pts`),
      el('input', { type: 'range', min: '1', max: '20', value: String(val), oninput: (e) => {
        const v = parseInt(e.target.value,10);
        const diff = v - val;
        const custoExtra = diff * CUSTOS.atributo.porNivel;
        if (custoExtra>0 && computed.pontos.disponivel < custoExtra) { toast(`Sem pontos para ${attr.id} ${v} (precisa ${custoExtra})`,'bad'); return; }
        onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } });
      } }),
      el('div', { class: 'attr-margin' }, margem ? `Margem ${margem.margemTexto}` : '—'),
      el('div', { class: 'attr-bar' }, el('i', { style: `width:${Math.min(100,(val/20)*100)}%` }))
    );
    const controls = el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:.4rem' },
      el('button', { class: 'btn small', onclick: () => { const v=Math.max(1,val-1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } }); } }, '−'),
      el('button', { class: `btn small ${!podeAumentarReal?'ghost':''}`, disabled: !podeAumentarReal, title: !podeAumentarReal ? `Precisa ${custoProx} pts livres` : `+${custoProx} pts`, onclick: () => {
        if (!podeAumentarReal) { toast('Sem pontos livres!','bad'); return; }
        const v=Math.min(20,val+1); onChange({ atributos: { ...(char.atributos||{}), [attr.id]: v } });
      } }, '+'),
      el('button', { class: 'btn small ghost', onclick: () => { const res=testarMargem(val,db); toast(`${attr.id} ${val}: ${res.rolagem} → ${res.sucesso?'Sucesso':'Falha'}${res.critico?' CRÍTICO!':''}`,'ok'); } }, '🎲')
    );
    card.append(controls);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

function renderPericias(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '📜 Perícias — 2 pts/nível (travado)'));
  const list = el('div', { class: 'skill-list' });
  for (const p of char.pericias||[]) {
    const margem = db.getMarginForValue(p.valor);
    const baseVal = char.atributos?.[p.atributoBase] ?? 10;
    const custo = p.redutor ? Math.max(0,(p.valor-(baseVal-p.redutor))*CUSTOS.pericia.porNivel) : Math.max(CUSTOS.pericia.minimo,(p.valor-baseVal)*CUSTOS.pericia.porNivel);
    const podeAumentar = computed.pontos.disponivel >= CUSTOS.pericia.porNivel;
    const row = el('div', { class: 'skill-item' },
      el('div', { class: 'grow' }, el('div', { class: 'skill-name' }, `${p.nome} • ${custo}pts`), el('div', { class: 'meta', style: 'font-size:.7rem;color:var(--ink-faint)' }, `Base ${p.atributoBase} ${baseVal} • Custo ${custo} pts`)),
      el('input', { type: 'number', min: '1', max: '25', value: String(p.valor), style: 'width:60px',
        onchange: (e) => {
          const v=parseInt(e.target.value,10)||10;
          const diff = v - p.valor;
          const extra = diff>0 ? diff*CUSTOS.pericia.porNivel : 0;
          if (extra>0 && computed.pontos.disponivel < extra) { toast(`Sem pontos para ${p.nome} ${v}`,'bad'); return; }
          onChange({ pericias: (char.pericias||[]).map(x => x.nome===p.nome?{...x,valor:v}:x) });
        }
      }),
      el('span', { class: 'skill-margin' }, margem?margem.margemTexto:'—'),
      el('span', { class: 'pill gold small' }, `${custo} pts`),
      el('button', { class: `btn small ${!podeAumentar?'ghost':''}`, disabled: !podeAumentar, onclick: () => {
        if(!podeAumentar){ toast('Sem pontos!','bad'); return; }
        onChange({ pericias: (char.pericias||[]).map(x => x.nome===p.nome?{...x,valor:x.valor+1}:x) });
      } }, '+'),
      el('button', { class: 'btn small danger', onclick: () => { onChange({ pericias: (char.pericias||[]).filter(x => x.nome!==p.nome) }); } }, '✕')
    );
    list.append(row);
  }
  wrap.append(list);
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1rem' }, el('div', { class: 'field-group-title' }, '➕ Nova Perícia — 2 pts/nível'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome', el('input', { type: 'text', id: 'novaPericiaNome', placeholder: 'Furtividade' })),
      el('label', { class: 'field' }, 'Base', (() => { const sel=el('select',{id:'novaPericiaAttr'}); ['ST','DX','IQ','HT'].forEach(a=>sel.append(el('option',{value:a},a))); return sel; })()),
      el('label', { class: 'field' }, 'Valor', el('input', { type: 'number', id: 'novaPericiaValor', value: '10', min: '1', max: '25' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => {
      const nome=document.getElementById('novaPericiaNome')?.value.trim();
      const attr=document.getElementById('novaPericiaAttr')?.value;
      const valor=parseInt(document.getElementById('novaPericiaValor')?.value,10)||10;
      if(!nome){ toast('Nome','warn'); return; }
      const base=char.atributos?.[attr]??10;
      const custoExtra=Math.max(CUSTOS.pericia.minimo,(valor-base)*CUSTOS.pericia.porNivel);
      if(computed.pontos.disponivel < custoExtra){ toast(`Sem pontos! Precisa ${custoExtra}`,'bad'); return; }
      onChange({ pericias: [...(char.pericias||[]), { nome, atributoBase: attr, valor, descricao: `Base ${attr}` }] });
    } }, 'Adicionar (custo calculado)'))
  ));
  return wrap;
}

function renderManobras(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '⚔️ Manobras — GRÁTIS (não custam pontos)'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Escolha livre, não consome pontos.'));
  const allManeuvers=[];
  const collect=(obj,prefix='')=>{ if(!obj) return; if(obj.nome&&obj.id) allManeuvers.push({id:obj.id,nome:obj.nome,desc:obj.descricao?.slice(0,120)||'',grupo:prefix}); for(const k of ['estilos','caminhos','formas','tipos','acoes']) if(Array.isArray(obj[k])) obj[k].forEach(c=>collect(c,obj.nome||prefix)); };
  Object.values(db.maneuvers).forEach(root=>collect(root,''));
  const selected=new Set(char.manobras||[]);
  const grid=el('div',{class:'grid cols-2'});
  const grupos={};
  for(const m of allManeuvers){ const g=m.grupo||'Geral'; if(!grupos[g]) grupos[g]=[]; grupos[g].push(m); }
  for(const [grupo,lista] of Object.entries(grupos)){
    const panel=el('div',{class:'panel'}, el('h3',{},`${grupo} — GRÁTIS`), el('div',{class:'maneuver-chips'}, ...lista.map(m=>{
      const active=selected.has(m.id);
      return el('button',{class:`maneuver-chip ${active?'active':''}`, title: `${m.desc} • GRÁTIS`, onclick:()=>{ const novas=new Set(selected); if(novas.has(m.id)) novas.delete(m.id); else novas.add(m.id); onChange({manobras:[...novas]}); }}, `${m.nome}${active?' ✓':''}`);
    })));
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
  const wrap = el('div', {}, el('h2', {}, '🧠 Poderes & Psiquismo — Pot 5/3 + 2 pts/perícia (travado)'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Crie seus próprios poderes no final. Sistema trava se não houver pontos.'));

  const poderesAtuais = char.poderes || {};
  const poderesGrid = el('div', { class: 'grid cols-2', style: 'margin-top:1rem' });

  for (const poder of powersData.poderes||[]) {
    const atual = poderesAtuais[poder.id] || { potencia:0, pericias:[] };
    const potencia = atual.potencia||0;
    const custoPot = poder.custo;
    const podeAumentarPot = computed.pontos.disponivel >= custoPot;
    const card = el('div', { class: 'panel', style: potencia>0?'border-color:var(--gold)':'' },
      el('h3', {}, `${poder.nome} (${poder.sigla}) ${potencia>0?`— Pot ${potencia}`:''} ${poder.custom?'🧩 custom':''}`),
      el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, (poder.descricao||'').slice(0,160)+'…'),
      el('div', { class: 'pill gold', style: 'margin:.3rem 0' }, `${custoPot} pts/nível Potência`),
      el('div', { class: 'field-grid' },
        el('label', { class: 'field' }, 'Potência',
          el('div', { style: 'display:flex;gap:.3rem;align-items:center' },
            el('button', { class: 'btn small', onclick: () => { const nova=Math.max(0,potencia-1); const novos={...poderesAtuais,[poder.id]:{...atual,potencia:nova}}; if(nova===0) delete novos[poder.id]; onChange({poderes:novos}); } }, '−'),
            el('span', { style: 'min-width:28px;text-align:center;font-weight:700' }, String(potencia)),
            el('button', { class: `btn small ${!podeAumentarPot?'ghost':''}`, disabled: !podeAumentarPot, title: !podeAumentarPot?`Precisa ${custoPot} pts`:`+${custoPot} pts`, onclick: () => {
              if(!podeAumentarPot){ toast('Sem pontos para Potência!','bad'); return; }
              const nova=Math.min(25,potencia+1); const novos={...poderesAtuais,[poder.id]:{...atual,potencia:nova,pericias:atual.pericias||[]}}; onChange({poderes:novos});
            } }, '+'),
            el('span', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `= ${potencia*custoPot} pts`)
          )
        )
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
                } }, '+'),
                el('button', { class: 'btn small ghost', onclick: () => { const res=testarMargem(nivel||10,db); toast(`${per.nome} ${nivel}: ${res.rolagem} → ${res.sucesso?'Sucesso':'Falha'}`,'ok'); } }, '🎲')
              )
            );
          })
        ),
        // Add custom pericia to this poder
        el('div', { style: 'margin-top:.5rem;display:flex;gap:.3rem' },
          el('input', { type: 'text', placeholder: 'Nova perícia psi custom', id: `customPer_${poder.id}`, style: 'flex:1' }),
          el('button', { class: 'btn small', onclick: () => {
            const inp=document.getElementById(`customPer_${poder.id}`); const nome=inp?.value.trim(); if(!nome){ toast('Nome','warn'); return; }
            if(computed.pontos.disponivel < CUSTOS.periciaPsi.porNivel){ toast('Sem pontos para perícia custom','bad'); return; }
            const novas=[...(atual.pericias||[]), { id: `custom_${Date.now()}`, nome, nivel: 10 }];
            onChange({ poderes: { ...poderesAtuais, [poder.id]: { potencia, pericias: novas } } });
          } }, '➕ Perícia')
        )
      ) : ''
    );
    poderesGrid.append(card);
  }

  // Custom poderes existentes (que não estão no powersData)
  for (const [id, dados] of Object.entries(poderesAtuais)) {
    if ((powersData.poderes||[]).find(p=>p.id===id)) continue;
    const potencia = dados.potencia||0;
    const card = el('div', { class: 'panel', style: 'border-color:var(--accent);background:linear-gradient(180deg, rgba(156,43,35,.08), var(--panel))' },
      el('h3', {}, `🧩 ${dados.nome||id} — Pot ${potencia} — custom`),
      el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, dados.descricao||'Poder custom'),
      el('div', { class: 'pill bad' }, `${dados.custo||5} pts/nível • custom`),
      el('div', { style: 'display:flex;gap:.3rem;margin-top:.4rem' },
        el('button', { class: 'btn small', onclick: () => { const novos={...poderesAtuais,[id]:{...dados,potencia:Math.max(0,potencia-1)}}; if(novos[id].potencia===0) delete novos[id]; onChange({poderes:novos}); } }, '− Pot'),
        el('button', { class: 'btn small', onclick: () => {
          if(computed.pontos.disponivel < (dados.custo||5)){ toast('Sem pontos','bad'); return; }
          const novos={...poderesAtuais,[id]:{...dados,potencia:potencia+1}}; onChange({poderes:novos});
        } }, '+ Pot'),
        el('button', { class: 'btn small danger', onclick: () => { const novos={...poderesAtuais}; delete novos[id]; onChange({poderes:novos}); } }, '🗑️ Remover')
      )
    );
    poderesGrid.append(card);
  }

  wrap.append(poderesGrid);

  // Formulário criar poder próprio
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1.5rem;border-color:var(--gold)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Seu Próprio Poder'),
    el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, 'Defina Fonte, Foco, custo. Será adicionado como poder custom e entra no cálculo de pontos.'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome do Poder', el('input', { type: 'text', id: 'cpNome', placeholder: 'Ex: Cronocinese' })),
      el('label', { class: 'field' }, 'Sigla', el('input', { type: 'text', id: 'cpSigla', placeholder: 'CRON', maxlength: '6' })),
      el('label', { class: 'field' }, 'Custo pts/nível', el('select', { id: 'cpCusto' }, el('option', { value: '5' }, '5 pts — TP/PK/Teleporte'), el('option', { value: '3' }, '3 pts — PES/Cura/AntiPsi'))),
      el('label', { class: 'field' }, 'Potência inicial', el('input', { type: 'number', id: 'cpPot', value: '5', min: '1', max: '25' })),
      el('label', { class: 'field' }, 'Fonte', el('input', { type: 'text', id: 'cpFonte', placeholder: 'psíquica, mágica, chi, divino, cósmico' })),
      el('label', { class: 'field' }, 'Foco', el('input', { type: 'text', id: 'cpFoco', placeholder: 'tempo, mente, fogo...' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Descrição', el('textarea', { id: 'cpDesc', placeholder: 'O que faz, alcance, limitações...', rows: '3' }))
    ),
    el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: () => {
      const nome=document.getElementById('cpNome')?.value.trim();
      const sigla=document.getElementById('cpSigla')?.value.trim()||'CUS';
      const custo=parseInt(document.getElementById('cpCusto')?.value,10)||5;
      const pot=parseInt(document.getElementById('cpPot')?.value,10)||1;
      const fonte=document.getElementById('cpFonte')?.value.trim()||'psíquica';
      const foco=document.getElementById('cpFoco')?.value.trim()||'custom';
      const desc=document.getElementById('cpDesc')?.value.trim()||'Poder custom';
      if(!nome){ toast('Informe nome do poder','warn'); return; }
      const custoTotal = pot*custo;
      if(computed.pontos.disponivel < custoTotal){ toast(`Sem pontos! Precisa ${custoTotal} pts`,'bad'); return; }
      const id=`custom_${Date.now()}`;
      const novos={...poderesAtuais,[id]:{ nome, sigla, custo, potencia: pot, fonte, foco, descricao: desc, pericias: [], custom: true }};
      onChange({ poderes: novos });
      toast(`Poder ${nome} criado!`,'ok');
    } }, '✨ Criar Poder'))
  ));

  return wrap;
}

function renderMagias(char, db, computed, onChange, saveDraft) {
  const magicsData = db.magics || { escolas: [] };
  const wrap = el('div', {}, el('h2', {}, '🔮 Magias & Escolas — 3 pts/nível escola + 2 pts/magia (travado)'),
    el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Magia canaliza mana externa. Cada escola tem nível (potência) e magias individuais. Crie suas próprias magias no final.'));

  const magiasAtuais = char.magias || {};
  const grid = el('div', { class: 'grid cols-2', style: 'margin-top:1rem' });

  for (const esc of magicsData.escolas||[]) {
    const atual = magiasAtuais[esc.id] || { nivel:0, magias:[] };
    const nivel = atual.nivel||0;
    const custoEsc = esc.custo||3;
    const podeAum = computed.pontos.disponivel >= custoEsc;
    const card = el('div', { class: 'panel', style: nivel>0?'border-color:var(--gold)':'' },
      el('h3', {}, `${esc.nome} (${esc.sigla}) ${nivel>0?`— Nv ${nivel}`:''}`),
      el('p', { style: 'font-size:.8rem;color:var(--ink-dim)' }, (esc.descricao||'').slice(0,150)+'…'),
      el('div', { class: 'pill gold' }, `${custoEsc} pts/nível Escola — Fonte ${esc.fonte}`),
      el('div', { style: 'display:flex;gap:.3rem;align-items:center;margin-top:.5rem' },
        el('button', { class: 'btn small', onclick: () => { const nn=Math.max(0,nivel-1); const novos={...magiasAtuais,[esc.id]:{...atual,nivel:nn}}; if(nn===0) delete novos[esc.id]; onChange({magias:novos}); } }, '−'),
        el('span', { style: 'min-width:24px;text-align:center;font-weight:700' }, String(nivel)),
        el('button', { class: `btn small ${!podeAum?'ghost':''}`, disabled: !podeAum, onclick: () => {
          if(!podeAum){ toast('Sem pontos para escola!','bad'); return; }
          const nn=Math.min(20,nivel+1); const novos={...magiasAtuais,[esc.id]:{...atual,nivel:nn,magias:atual.magias||[]}}; onChange({magias:novos});
        } }, '+'),
        el('span', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `= ${nivel*custoEsc} pts`)
      ),
      nivel>0 ? el('div', { style: 'margin-top:.6rem' },
        el('div', { style: 'font-size:.8rem;font-weight:600;color:var(--gold2)' }, 'Magias — 2 pts/nível:'),
        el('div', { class: 'maneuver-chips' },
          ...(esc.magias||[]).map(m => {
            const tem=(atual.magias||[]).find(mm=>mm.id===m.id);
            const mnivel=tem?.nivel||0;
            const podeAumM = computed.pontos.disponivel >= CUSTOS.magia.pericia;
            return el('div', { style: `display:flex;flex-direction:column;gap:.2rem;border:1px solid var(--border);border-radius:8px;padding:.3rem .4rem;background:${mnivel>0?'rgba(201,165,92,.12)':'var(--panel2)'}` },
              el('div', { style: 'font-size:.78rem;font-weight:600' }, `${m.nome} ${mnivel>0?`— ${mnivel} (${mnivel*CUSTOS.magia.pericia}pts)`:''}`),
              el('div', { style: 'font-size:.7rem;color:var(--ink-faint)' }, `${m.tipo||''} • ${m.descricao.slice(0,80)}`),
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
                } }, '+'),
                el('button', { class: 'btn small ghost', onclick: () => { const res=testarMargem(mnivel||10,db); toast(`${m.nome} ${mnivel}: ${res.rolagem} → ${res.sucesso?'Sucesso':'Falha'}`,'ok'); } }, '🎲')
              )
            );
          })
        ),
        el('div', { style: 'margin-top:.5rem;display:flex;gap:.3rem' },
          el('input', { type: 'text', placeholder: 'Magia custom para esta escola', id: `customMag_${esc.id}`, style: 'flex:1' }),
          el('button', { class: 'btn small', onclick: () => {
            const inp=document.getElementById(`customMag_${esc.id}`); const nome=inp?.value.trim(); if(!nome){ toast('Nome','warn'); return; }
            if(computed.pontos.disponivel < CUSTOS.magia.pericia){ toast('Sem pontos','bad'); return; }
            const novas=[...(atual.magias||[]), { id: `custom_${Date.now()}`, nome, nivel: 1, custom: true }];
            onChange({ magias: { ...magiasAtuais, [esc.id]: { nivel, magias: novas } } });
          } }, '➕ Magia')
        )
      ) : ''
    );
    grid.append(card);
  }

  // Custom escolas
  for (const [id, dados] of Object.entries(magiasAtuais)) {
    if ((magicsData.escolas||[]).find(e=>e.id===id)) continue;
    const nivel=dados.nivel||0;
    const card=el('div',{class:'panel',style:'border-color:var(--accent);background:linear-gradient(180deg, rgba(156,43,35,.08), var(--panel))'},
      el('h3',{},`🧩 ${dados.nome||id} — Nv ${nivel} — custom`),
      el('div',{class:'pill bad'},`${dados.custo||3} pts/nível • custom`),
      el('div',{style:'display:flex;gap:.3rem;margin-top:.4rem'},
        el('button',{class:'btn small',onclick:()=>{ const novos={...magiasAtuais,[id]:{...dados,nivel:Math.max(0,nivel-1)}}; if(novos[id].nivel===0) delete novos[id]; onChange({magias:novos}); }},'− Nv'),
        el('button',{class:'btn small',onclick:()=>{
          if(computed.pontos.disponivel < (dados.custo||3)){ toast('Sem pontos','bad'); return; }
          const novos={...magiasAtuais,[id]:{...dados,nivel:nivel+1}}; onChange({magias:novos});
        }},'+ Nv'),
        el('button',{class:'btn small danger',onclick:()=>{ const novos={...magiasAtuais}; delete novos[id]; onChange({magias:novos}); }},'🗑️')
      )
    );
    grid.append(card);
  }

  wrap.append(grid);

  // Criar escola própria
  wrap.append(el('div', { class: 'field-group', style: 'margin-top:1.5rem;border-color:var(--gold)' },
    el('div', { class: 'field-group-title' }, '🧩 Criar Escola / Magia Própria'),
    el('div', { class: 'field-grid' },
      el('label', { class: 'field' }, 'Nome Escola', el('input', { type: 'text', id: 'cmNome', placeholder: 'Ex: Sangue' })),
      el('label', { class: 'field' }, 'Sigla', el('input', { type: 'text', id: 'cmSigla', placeholder: 'SAN' })),
      el('label', { class: 'field' }, 'Custo', el('select', { id: 'cmCusto' }, el('option', { value: '3' }, '3 pts'), el('option', { value: '5' }, '5 pts — Tempo'))),
      el('label', { class: 'field' }, 'Nível inicial', el('input', { type: 'number', id: 'cmNivel', value: '3', min: '1', max: '20' })),
      el('label', { class: 'field' }, 'Fonte', el('input', { type: 'text', id: 'cmFonte', placeholder: 'mágica, divino, sangue...' })),
      el('label', { class: 'field' }, 'Foco', el('input', { type: 'text', id: 'cmFoco', placeholder: 'sangue, morte...' })),
      el('label', { class: 'field', style: 'grid-column:1/-1' }, 'Descrição', el('textarea', { id: 'cmDesc', placeholder: 'O que faz...', rows: '2' }))
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
      const custoTotal=nivel*custo;
      if(computed.pontos.disponivel < custoTotal){ toast(`Sem pontos! Precisa ${custoTotal}`,'bad'); return; }
      const id=`custom_${Date.now()}`;
      const novos={...magiasAtuais,[id]:{ nome, sigla, custo, nivel, fonte, foco, descricao: desc, magias: [], custom: true }};
      onChange({ magias: novos });
      toast(`Escola ${nome} criada!`,'ok');
    } }, '✨ Criar Escola'))
  ));

  return wrap;
}

function renderEquipamentos(char, db, computed, onChange) {
  const wrap = el('div', {}, el('h2', {}, '🛡️ Equipamentos — GRÁTIS (não custam pontos)'), el('p', { style: 'color:var(--ink-dim);font-size:.9rem' }, 'Armas não custam pontos, apenas afetam carga e deslocamento.'));
  const list = el('div', { class: 'equip-grid', style: 'margin-top:1rem' });
  for (const eq of char.equipamentos||[]) list.append(el('div', { class: 'equip-card' }, el('div', { class: 'equip-name' }, eq.nome), el('div', { class: 'equip-stats' }, eq.dano?el('span',{class:'equip-stat'},eq.dano):'', eq.peso?el('span',{class:'equip-stat'},`${eq.peso}kg`):''), el('div', { class: 'btn-row' }, el('button', { class: 'btn small danger', onclick: () => { onChange({ equipamentos: (char.equipamentos||[]).filter(e=>e.nome!==eq.nome) }); } }, 'Remover'))));
  wrap.append(list);
  const allWeapons=db.getAllWeapons();
  const addPanel=el('div',{class:'field-group',style:'margin-top:1.2rem'}, el('div',{class:'field-group-title'},'➕ Arma do Grimório — GRÁTIS'), el('div',{style:'display:flex;gap:.5rem;margin-bottom:.8rem'}, el('input',{type:'search',id:'buscaArma',placeholder:'Buscar arma...',style:'flex:1',oninput:(e)=>{ const q=e.target.value.toLowerCase(); const container=document.getElementById('listaArmas'); if(!container) return; container.innerHTML=''; const filtradas=allWeapons.filter(w=>w.nome.toLowerCase().includes(q)).slice(0,30); for(const w of filtradas) container.append(renderArmaOption(w,char,onChange)); } }), el('button',{class:'btn small',onclick:()=>{ const container=document.getElementById('listaArmas'); if(!container) return; container.innerHTML=''; for(const w of allWeapons.slice(0,20)) container.append(renderArmaOption(w,char,onChange)); }},'Listar 20')), el('div',{id:'listaArmas',class:'equip-grid'}));
  setTimeout(()=>{ const container=document.getElementById('listaArmas'); if(container) for(const w of allWeapons.slice(0,12)) container.append(renderArmaOption(w,char,onChange)); },0);
  wrap.append(addPanel);
  return wrap;
}

function renderArmaOption(w, char, onChange) {
  return el('div', { class: 'equip-card' }, el('div', { class: 'equip-name' }, w.nome), el('div', { class: 'pill gold', style: 'margin:.2rem 0' }, `${w.categoria} — GRÁTIS`), el('div', { class: 'equip-stats' }, el('span',{class:'equip-stat'},w.dano), el('span',{class:'equip-stat'},`Média ${w.media}`)), el('div', { class: 'btn-row' }, el('button', { class: 'btn small primary', onclick: () => { const novo={...w,peso:estimatePeso(w),qtd:1}; onChange({ equipamentos: [...(char.equipamentos||[]), novo] }); toast(`${w.nome} equipada! GRÁTIS`,'ok'); } }, 'Equipar GRÁTIS')));
}
function estimatePeso(arma){ if(arma.media<=5) return 0.5; if(arma.media<=10) return 1.5; if(arma.media<=16) return 3; if(arma.media<=25) return 5; if(arma.media<=35) return 8; return 12; }

function renderFinal(char, db, computed, saveDraft) {
  const pts=computed.pontos;
  const wrap=el('div',{}, el('h2',{},'✨ Finalização & Pontos'), el('p',{style:'color:var(--ink-dim);font-size:.9rem'},'Revise ficha, pontos travados, história.'),
    el('div',{class:'panel',style:'border-color:var(--gold);margin-bottom:1rem'},
      el('h3',{},`💰 ${pts.pontosTotais} totais | ${pts.totalGasto} gastos | ${pts.disponivel} livres`),
      el('div',{class:'bar gold',style:'height:14px;margin:.6rem 0'}, el('i',{style:`width:${Math.min(100,(pts.totalGasto/pts.pontosTotais)*100)}%`})),
      el('table',{class:'pontos-table'},
        el('tr',{},el('th',{},'Categoria'),el('th',{},'Detalhe'),el('th',{class:'num'},'Custo')),
        el('tr',{},el('td',{},'Atributos 10pts/nível'),el('td',{},`${Object.entries(pts.breakdown.atributos.detalhe).map(([k,v])=>`${k}${v.valor}(${v.custo>=0?'+':''}${v.custo})`).join(', ')}`),el('td',{class:'num'},`${pts.breakdown.atributos.total} pts`)),
        el('tr',{},el('td',{},'Perícias 2pts'),el('td',{},`${pts.breakdown.pericias.detalhe.slice(0,4).map(p=>`${p.nome}${p.valor}(${p.custo})`).join(', ')}${pts.breakdown.pericias.detalhe.length>4?' +...':''}`),el('td',{class:'num'},`${pts.breakdown.pericias.total} pts`)),
        el('tr',{},el('td',{},'Manobras GRÁTIS'),el('td',{},`${pts.breakdown.manobras.quantidade} manobras`),el('td',{class:'num'},`0 pts`)),
        el('tr',{},el('td',{},'Empunhadura GRÁTIS'),el('td',{},char.empunhadura||'nenhuma'),el('td',{class:'num'},`0 pts`)),
        el('tr',{},el('td',{},'Poderes Pot 5/3 +2'),el('td',{},`${pts.breakdown.poderes.detalhe.map(d=>`${d.nome}Pot${d.potencia}(${d.subtotal})`).join(', ')||'nenhum'}`),el('td',{class:'num'},`${pts.breakdown.poderes.total} pts`)),
        el('tr',{},el('td',{},'Magias 3+2'),el('td',{},`${pts.breakdown.magias.detalhe.map(d=>`${d.nome}Nv${d.nivel}(${d.subtotal})`).join(', ')||'nenhum'}`),el('td',{class:'num'},`${pts.breakdown.magias.total} pts`)),
        el('tr',{style:'font-weight:700;background:var(--panel2)'},el('td',{},'TOTAL'),el('td',{},`${pts.disponivel>=0?'Dentro':'EXCEDIDO'}`),el('td',{class:'num'},`${pts.totalGasto}/${pts.pontosTotais}`))
      ),
      el('div',{class:'btn-row',style:'margin-top:.8rem'}, el('button',{class:'btn small',onclick:()=>{ char.pontosTotais=Math.max(0,(char.pontosTotais||150)-10); saveDraft(); location.hash=`#/criar/${char.id}/final`; }},'−10'), el('button',{class:'btn small',onclick:()=>{ char.pontosTotais=(char.pontosTotais||150)+10; saveDraft(); location.hash=`#/criar/${char.id}/final`; }},'+10'), el('button',{class:'btn small',onclick:()=>{ char.pontosTotais=(char.pontosTotais||150)+50; saveDraft(); location.hash=`#/criar/${char.id}/final`; }},'+50'), ...PONTOS_PRESETS.map(pre=>el('button',{class:'btn small ghost',onclick:()=>{ char.pontosTotais=pre.pontos; saveDraft(); location.hash=`#/criar/${char.id}/final`; }},`${pre.nome} ${pre.pontos}`))),
      el('p',{style:'font-size:.75rem;color:var(--ink-faint);margin-top:.5rem'},'Travado: sistema impede aumentar se não houver pontos livres. Manobras e equipamentos são grátis.')
    ),
    el('label',{class:'field',style:'margin-top:1rem'},'História / Background', el('textarea',{placeholder:'Background...',value:char.historia||'',rows:'6',oninput:(e)=>{ char.historia=e.target.value; saveDraft(); }})),
    el('div',{class:'grid cols-2',style:'margin-top:1rem'},
      el('div',{class:'panel'}, el('h3',{},'📊 Resumo'), el('div',{class:'breakdown'}, el('div',{class:'line'},el('span',{},'Nome'),el('b',{},computed.identidade.nome||'—')), el('div',{class:'line'},el('span',{},'Categoria'),el('b',{},`${computed.identidade.categoria.nome} (${computed.identidade.categoria.dados})`)), el('div',{class:'line'},el('span',{},'Desloc'),el('b',{},`${computed.derivados.deslocamento.atual} m/s`)), el('div',{class:'line'},el('span',{},'Perícias'),el('b',{},String(computed.pericias.length))), el('div',{class:'line'},el('span',{},'Poderes'),el('b',{},String(computed.poderes.length))), el('div',{class:'line'},el('span',{},'Magias'),el('b',{},String(computed.magias.length))) )),
      el('div',{class:'panel'}, el('h3',{},'🎲 Teste'), el('div',{class:'field-grid'}, el('label',{class:'field'},'Valor',el('input',{type:'number',id:'testeValor',value:'10'})), el('label',{class:'field'},'Roll',el('input',{type:'number',id:'testeRoll',placeholder:'vazio=aleatório'}))), el('div',{class:'btn-row'}, el('button',{class:'btn primary',onclick:()=>{ const val=parseInt(document.getElementById('testeValor')?.value,10)||10; const roll=document.getElementById('testeRoll')?.value?parseInt(document.getElementById('testeRoll').value,10):null; const res=testarMargem(val,db,roll); const resEl=document.getElementById('resultadoTeste'); if(!resEl) return; resEl.innerHTML=''; resEl.append(el('div',{class:`pill ${res.sucesso?'ok':'bad'}`},`${res.sucesso?'✅':'❌'} ${res.rolagem} ${res.critico?'CRÍTICO!':''}`), el('div',{style:'margin-top:.4rem'},`Margem ${res.margemTexto}`)); }},'🎲 Testar')), el('div',{id:'resultadoTeste',style:'margin-top:.8rem;padding:.6rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;min-height:40px'},'Resultado...'))
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
