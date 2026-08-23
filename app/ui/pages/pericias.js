/* Aba PERÍCIAS — catálogo com FilterEngine universal, níveis, defaults e requisitos. */
import { el, toast, valorCalculado, modal } from '../ui.js';
import { createFilterPanel } from '../filters.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { attrPadrao, podeComprarMelhoria } from '../../engine/skills.js';

export function renderPericias(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const entries = new Map((pc.pericias || []).map(entry => [entry.id, entry]));
  const catalog = db.skills.map(skill => {
    const entry = entries.get(skill.id);
    const effective = entry ? snap.pericias.find(item => item.entry === entry) : null;
    let canImprove = true;
    try { canImprove = podeComprarMelhoria(db, pc, entry || { id: skill.id, pontos: 0 }, .5).ok; } catch { canImprove = false; }
    return {
      ...skill, _skill: skill, _entry: entry, _effective: effective,
      atributo: attrPadrao(skill),
      status: entry ? 'Treinada' : 'Não treinada',
      nivel: effective?.nivelEfetivo ?? null,
      podeMelhorar: canImprove,
      tags: [skill.tipo, skill.dificuldade, attrPadrao(skill), ...(skill.prereqs?.length ? ['Com pré-requisito'] : ['Sem pré-requisito'])],
    };
  });

  const tbody = el('tbody');
  function desenhar(items) {
    tbody.innerHTML = '';
    const rows = items.map(item => linhaPericia(item._skill, item._entry, item._effective, snap));
    tbody.append(...(rows.length ? rows : [el('tr', {}, el('td', { colspan: 7, style: 'text-align:center' }, 'Nenhuma perícia corresponde aos filtros.'))]));
  }

  const filters = createFilterPanel({
    id: 'skills', items: catalog,
    searchFields: ['nome', 'descricao', 'defaults', 'prereqs', 'categoria', 'tags'],
    searchPlaceholder: 'Pesquisar perícia, default ou característica…',
    schema: [
      { key: 'categoria', label: 'Categoria', type: 'multi' },
      { key: 'tipo', label: 'Natureza', type: 'multi' },
      { key: 'dificuldade', label: 'Dificuldade', type: 'multi' },
      { key: 'atributo', label: 'Atributo-base', type: 'multi' },
      { key: 'status', label: 'Treinamento', type: 'multi' },
      { key: 'nivel', label: 'Nível efetivo', type: 'range' },
      { key: 'podeMelhorar', label: 'Somente o que posso melhorar', type: 'relation' },
      { key: 'tags', label: 'Tags', type: 'multi' },
    ],
    quickFilters: [
      { label: 'Minhas', apply: state => state.groups.status.include = ['Treinada'] },
      { label: 'Posso melhorar', apply: state => state.groups.podeMelhorar = true },
      { label: 'Físicas', apply: state => state.groups.tipo.include = ['Física'] },
      { label: 'Mentais', apply: state => state.groups.tipo.include = ['Mental'] },
      { label: 'Base DX', apply: state => state.groups.atributo.include = ['DX'] },
      { label: 'Base IQ', apply: state => state.groups.atributo.include = ['IQ'] },
    ],
    onChange: desenhar,
  });

  main.append(
    el('h1', { class: 'page-title' }, '📜 Perícias', el('small', {}, `${db.skills.length} perícias · pontos disponíveis: ${snap.contagem.disponiveis}`)),
    filters.node,
    el('div', { class: 'panel' },
      el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {}, ['Perícia', 'Tipo', 'Nível', 'Pontos', 'Default', 'Pré-req.', 'Ações'].map(title => el('th', {}, title)))),
        tbody))),
    el('p', { class: 'fonte' }, 'Dentro de cada filtro as opções são combinadas com OU; grupos diferentes são combinados com E. O nível continua sendo calculado exclusivamente pelo Rule Engine.'),
  );
}

function linhaPericia(skill, entry, effective, snap) {
  const level = effective ? effective.nivelEfetivo : '—';
  const base = effective ? effective.baseAttr : attrPadrao(skill);
  const defaultValue = effective?.default;
  const prereqs = (skill.prereqs || []).join('; ');
  const comprar = points => {
    const check = podeComprarMelhoria(snap._db, store.atual, entry || { id: skill.id, pontos: 0 }, points);
    if (!check.ok) { toast(check.erros[0] || 'Não é possível comprar.', 'bad'); return; }
    store.update(character => {
      const current = (character.pericias || []).find(item => item.id === skill.id);
      if (current) current.pontos += points;
      else character.pericias.push({ id: skill.id, pontos: points, especialidade: null });
    });
  };
  return el('tr', {},
    el('td', {}, el('strong', {}, skill.nome + (skill.nt ? '/NT' : '')),
      skill.especializacao ? el('span', { class: 'pill warn', title: `Especialização ${skill.especializacao}` }, skill.especializacao) : '',
      el('div', { class: 'meta fonte' }, (skill.descricao || '').slice(0, 110) + '…')),
    el('td', {}, `${skill.tipo === 'Física' ? 'Fís' : 'Men'}/${skill.dificuldade} · ${base}`),
    el('td', {}, entry
      ? (effective ? valorCalculado(level, [
          { fonte: `Atributo-base ${effective.baseAttr}`, valor: effective.attrValor },
          { fonte: `Pontos investidos (${effective.pontos})`, valor: effective.offsetTreino !== null ? `offset ${effective.offsetTreino >= 0 ? '+' : ''}${effective.offsetTreino}` : 'abaixo do mínimo' },
          ...(defaultValue ? [{ fonte: `Default ${defaultValue.origem}`, valor: defaultValue.valor }] : []),
          ...effective.modificadores.map(modifier => ({ fonte: modifier.fonte, valor: modifier.valor })),
        ]) : level)
      : (defaultValue ? valorCalculado(defaultValue.valor, [{ fonte: `Default: ${defaultValue.origem}` }]) : '—')),
    el('td', { class: 'num' }, entry ? String(entry.pontos) : '—'),
    el('td', { style: 'font-size:.75rem;color:var(--ink-dim)' }, (skill.defaults || []).join(' | ').replace(/Pré-definido:? como:? ?/g, '').slice(0, 90)),
    el('td', {}, prereqs ? el('span', { class: 'pill warn', title: prereqs }, prereqs.slice(0, 80)) : el('span', { class: 'pill' }, '—')),
    el('td', {}, el('div', { class: 'btn-row', style: 'margin:0' },
      el('button', { class: 'btn small', onclick: () => comprar(.5), title: 'Comprar ½ ponto' }, '+½'),
      el('button', { class: 'btn small', onclick: () => comprar(1), title: 'Comprar 1 ponto' }, '+1'),
      entry ? el('button', { class: 'btn small danger', title: 'Remover 1 ponto', onclick: () => store.update(character => {
        const current = character.pericias.find(item => item.id === skill.id);
        if (!current) return;
        current.pontos -= 1;
        if (current.pontos < .5) character.pericias = character.pericias.filter(item => item !== current);
      }) }, '−1') : '',
      el('button', { class: 'btn small ghost', title: 'Ver detalhes', onclick: () => detalhar(skill, entry, effective) }, '👁'),
      el('a', { class: 'btn small ghost', title: 'Ler regra no livro', href: `#/livro/ler/pericias/pericia-${skill.id}` }, '📖'),
    )),
  );
}

function detalhar(skill, entry, effective) {
  const defaultValue = effective?.default;
  modal(`Perícia: ${skill.nome}`, el('div', {},
    el('p', {}, el('b', {}, `${skill.tipo}/${skill.dificuldade}`), ` · base ${attrPadrao(skill)} · categoria ${skill.categoria}`),
    el('p', {}, skill.descricao || ''),
    el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Campo'), el('th', {}, 'Valor')),
      el('tr', {}, el('td', {}, 'Default'), el('td', {}, (skill.defaults || []).join(' | ') || 'Sem default')),
      (skill.prereqs || []).map(prereq => el('tr', {}, el('td', {}, 'Pré-requisito'), el('td', {}, prereq))),
      entry ? el('tr', {}, el('td', {}, 'Pontos'), el('td', {}, String(entry.pontos))) : '',
      effective?.nivelEfetivo != null ? el('tr', {}, el('td', {}, 'Nível efetivo'), el('td', {}, String(effective.nivelEfetivo))) : '',
      defaultValue ? el('tr', {}, el('td', {}, 'Default ativo'), el('td', {}, `${defaultValue.valor} (${defaultValue.origem})`)) : ''),
    el('p', { class: 'fonte' }, `Fonte: material, ${skill.fonte || ''}`),
    el('a', { class: 'btn', href: `#/livro/ler/pericias/pericia-${skill.id}` }, '📖 Ver no livro')));
}
