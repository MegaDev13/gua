/* VANTAGENS / DESVANTAGENS / PECULIARIDADES — catálogo com filtros universais. */
import { el, toast, modal } from '../ui.js';
import { createFilterPanel } from '../filters.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { parseCusto, MAX_PECULIARIDADES, custoTrait } from '../../engine/traits.js';

export function renderVantagens(main, { db }) {
  const pc = store.atual;
  const snapshot = computeAll(db, pc);
  const ownedAdvantages = new Set((pc.vantagens || []).map(item => item.id));
  const ownedDisadvantages = new Set((pc.desvantagens || []).map(item => item.id));

  const listAdvantages = el('div', { class: 'list' });
  const listDisadvantages = el('div', { class: 'list' });
  const enrich = (definition, owned) => {
    const parsed = parseCusto(definition.custo || '');
    return {
      ...definition, _definition: definition,
      status: owned.has(definition.id) ? 'Possuída' : 'Disponível',
      tipoCusto: costType(parsed, definition),
      custoNumerico: numericCost(parsed, definition),
      tags: [
        definition.niveis ? 'Níveis estruturados' : null,
        parsed.modo === 'por-nivel' ? 'Por nível' : null,
        parsed.modo === 'variavel' || parsed.modo === 'escolha' ? 'Custo variável' : null,
      ].filter(Boolean),
    };
  };
  const advantages = db.advantages.map(item => enrich(item, ownedAdvantages));
  const disadvantages = db.disadvantages.map(item => enrich(item, ownedDisadvantages));
  const draw = (root, kind, owned) => items => {
    root.innerHTML = '';
    const ordered = [...items].sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)) || a.nome.localeCompare(b.nome, 'pt-BR'));
    root.append(...(ordered.length ? ordered.map(item => traitRow(item._definition, kind)) : [el('div', { class: 'row' }, 'Nenhum traço corresponde aos filtros.')]))
  };
  const commonSchema = [
    { key: 'status', label: 'Status', type: 'multi' },
    { key: 'tipoCusto', label: 'Tipo de custo', type: 'multi' },
    { key: 'custoNumerico', label: 'Custo em pontos', type: 'range' },
    { key: 'tags', label: 'Tags', type: 'multi' },
  ];
  const advantageFilters = createFilterPanel({
    id: 'advantages', items: advantages, schema: commonSchema,
    searchFields: ['nome', 'descricao', 'custo', 'tags'], searchPlaceholder: 'Pesquisar vantagem ou efeito…',
    quickFilters: [
      { label: 'Minhas', apply: state => { state.groups.status.include = ['Possuída']; } },
      { label: 'Por nível', apply: state => { state.groups.tags.include = ['Por nível']; } },
      { label: 'Custo variável', apply: state => { state.groups.tags.include = ['Custo variável']; } },
    ], onChange: draw(listAdvantages, 'vantagem', ownedAdvantages),
  });
  const disadvantageFilters = createFilterPanel({
    id: 'disadvantages', items: disadvantages, schema: commonSchema,
    searchFields: ['nome', 'descricao', 'custo', 'tags'], searchPlaceholder: 'Pesquisar desvantagem ou efeito…',
    quickFilters: [
      { label: 'Minhas', apply: state => { state.groups.status.include = ['Possuída']; } },
      { label: 'Por nível', apply: state => { state.groups.tags.include = ['Por nível']; } },
      { label: 'Custo variável', apply: state => { state.groups.tags.include = ['Custo variável']; } },
    ], onChange: draw(listDisadvantages, 'desvantagem', ownedDisadvantages),
  });

  /* Peculiaridades */
  const quirkInput = el('input', { type: 'text', placeholder: 'Ex.: Detesta dizer “não”!', style: 'flex:1' });
  const quirkList = el('div', { class: 'list' });
  function drawQuirks() {
    quirkList.innerHTML = '';
    quirkList.append(...(pc.peculiaridades || []).map((quirk, index) => el('div', { class: 'row' },
      el('span', { class: 'grow' }, quirk), el('span', { class: 'pill bad' }, '−1 pt'),
      el('button', { class: 'btn small danger', onclick: () => store.update(character => { character.peculiaridades.splice(index, 1); }) }, '✕'))));
    if (!(pc.peculiaridades || []).length) quirkList.append(el('div', { class: 'row' }, 'Nenhuma peculiaridade.'));
  }
  const addQuirk = () => {
    const text = quirkInput.value.trim();
    if (!text) return;
    if ((pc.peculiaridades || []).length >= MAX_PECULIARIDADES) { toast(`Máximo de ${MAX_PECULIARIDADES} peculiaridades (p. 88).`, 'bad'); return; }
    store.update(character => { character.peculiaridades.push(text); });
    quirkInput.value = '';
  };
  quirkInput.onkeydown = event => { if (event.key === 'Enter') addQuirk(); };

  main.append(
    el('h1', { class: 'page-title' }, '⚖️ Vantagens & Desvantagens', el('small', {}, `disponíveis: ${snapshot.contagem.disponiveis} pts`)),
    el('div', { class: 'grid cols-2 trait-columns' },
      el('section', {}, el('h2', {}, 'Vantagens (p. 17–40)'), advantageFilters.node, listAdvantages),
      el('section', {}, el('h2', {}, 'Desvantagens (p. 40–88)'), disadvantageFilters.node, listDisadvantages)),
    el('div', { class: 'panel', style: 'margin-top:.9rem' },
      el('h3', {}, `Peculiaridades (${(pc.peculiaridades || []).length}/${MAX_PECULIARIDADES} · −1 ponto cada)`),
      el('div', { class: 'btn-row', style: 'margin:0 0 .6rem' }, quirkInput, el('button', { class: 'btn', onclick: addQuirk }, '＋ Adicionar')),
      quirkList,
      el('details', { style: 'margin-top:.5rem' }, el('summary', { class: 'fonte' }, 'Exemplos do material'),
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem' }, (db.quirks.exemplos || []).map(example => el('button', {
          class: 'btn small ghost', title: 'Usar este exemplo', onclick: () => {
            if ((store.atual.peculiaridades || []).length >= MAX_PECULIARIDADES) return toast('Máximo alcançado.', 'bad');
            store.update(character => { character.peculiaridades.push(example); });
          },
        }, example))))));
  drawQuirks();
}

function traitRow(definition, kind) {
  const pc = store.atual;
  const list = kind === 'vantagem' ? pc.vantagens : pc.desvantagens;
  const entry = list.find(item => item.id === definition.id);
  const effectiveCost = entry ? custoTrait(pc, entry, definition) : null;
  const parsed = parseCusto(definition.custo || '');
  const leveled = definition.niveis || parsed.modo === 'por-nivel' || definition.custoPorNivel;

  const toggle = () => {
    if (entry) store.update(character => {
      const target = kind === 'vantagem' ? character.vantagens : character.desvantagens;
      const index = target.findIndex(item => item.id === definition.id);
      if (index >= 0) target.splice(index, 1);
    });
    else store.update(character => {
      const created = { id: definition.id, nome: definition.nome };
      if (definition.niveis) created.nivel = definition.niveis.find(level => level.custo === 0)?.nome || definition.niveis[0].nome;
      if (leveled) created.niveis = 1;
      if (parsed.modo === 'escolha' || parsed.modo === 'variavel') created.custoEscolhido = parsed.valores?.[0] || 0;
      (kind === 'vantagem' ? character.vantagens : character.desvantagens).push(created);
    });
  };
  const changeLevel = delta => store.update(character => {
    const current = (kind === 'vantagem' ? character.vantagens : character.desvantagens).find(item => item.id === definition.id);
    if (definition.niveis) {
      const index = definition.niveis.findIndex(level => level.nome === current.nivel);
      current.nivel = definition.niveis[Math.max(0, Math.min(definition.niveis.length - 1, index + delta))].nome;
    } else current.niveis = Math.max(1, (current.niveis || 1) + delta);
  });

  return el('div', { class: 'row' },
    el('div', { class: 'grow' }, el('div', { class: 'name' }, definition.nome), el('div', { class: 'meta' }, (definition.descricao || '').slice(0, 150))),
    el('span', { class: 'pill gold', title: definition.custo || '' }, entry && effectiveCost ? `${effectiveCost.custo > 0 ? '+' : ''}${effectiveCost.custo} pts` : definition.custo || 'variável'),
    entry && definition.niveis ? el('button', { class: 'btn small', onclick: () => changeLevel(-1) }, '◀') : '',
    entry && definition.niveis ? el('span', { class: 'pill' }, entry.nivel) : '',
    entry && definition.niveis ? el('button', { class: 'btn small', onclick: () => changeLevel(1) }, '▶') : '',
    entry && leveled && !definition.niveis ? el('button', { class: 'btn small', onclick: () => changeLevel(1) }, `nível ${entry.niveis || 1} +`) : '',
    el('button', { class: `btn small ${entry ? 'danger' : ''}`, onclick: toggle }, entry ? 'Remover' : 'Adquirir'),
    el('button', { class: 'btn small ghost', onclick: () => detail(definition) }, '👁'),
    el('a', { class: 'btn small ghost', href: `#/livro/ler/vantagens/${kind}-${definition.id}`, title: 'Ver no livro' }, '📖'));
}

function detail(definition) {
  const prefix = definition.custo?.trim().startsWith('-') ? 'desvantagem' : 'vantagem';
  let levels = '';
  if (definition.niveis) {
    const rows = definition.niveis.map(level => {
      const effect = level.efeito || (level.multiplicadorRecursos ? `${level.multiplicadorRecursos}× recursos` : '');
      return el('tr', {}, el('td', {}, level.nome), el('td', { class: 'num' }, String(level.custo)), el('td', {}, effect));
    });
    levels = el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Nível'), el('th', {}, 'Custo'), el('th', {}, 'Efeito')),
      rows);
  }
  modal(definition.nome, el('div', {},
    el('p', {}, el('b', {}, 'Custo: '), definition.custo || 'variável'),
    levels,
    el('p', {}, definition.descricao || ''),
    el('p', { class: 'fonte' }, `Fonte: material, ${definition.fonte || ''}`),
    el('a', { class: 'btn', href: `#/livro/ler/vantagens/${prefix}-${definition.id}` }, '📖 Ver no livro')));
}

function numericCost(parsed, definition) {
  if (definition.niveis?.length) return Math.min(...definition.niveis.map(level => Number(level.custo)).filter(Number.isFinite));
  if (parsed.modo === 'fixo') return parsed.valor;
  if (parsed.modo === 'por-nivel') return parsed.unitario * (parsed.negativo ? -1 : 1);
  if (parsed.valores?.length) return Math.min(...parsed.valores);
  return null;
}
function costType(parsed, definition) {
  if (definition.niveis) return 'Níveis estruturados';
  return ({ fixo: 'Fixo', 'por-nivel': 'Por nível', escolha: 'Escolha', tiers: 'Faixas', variavel: 'Variável', zero: 'Não informado' })[parsed.modo] || parsed.modo;
}
