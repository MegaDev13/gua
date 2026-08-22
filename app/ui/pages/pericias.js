/* Aba PERÍCIAS — catálogo completo com compra de níveis, defaults e pré-requisitos. */
import { el, toast, requisitoBadge, valorCalculado, modal } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { nivelParaPontos, custoNivel, attrPadrao, melhorDefault } from '../../engine/skills.js';
import { podeComprarMelhoria } from '../../engine/skills.js';

export function renderPericias(main, { db, ir }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const porCategoria = {};
  for (const s of db.skills) (porCategoria[s.categoria] ||= []).push(s);

  const minhas = new Map((pc.pericias || []).map(e => [e.id + '::' + (e.especialidade || ''), e]));

  const catSelect = el('select', { 'aria-label': 'Filtrar categoria' },
    el('option', { value: '' }, 'Todas as categorias'),
    Object.keys(porCategoria).map(c => el('option', { value: c }, c)));
  const busca = el('input', { type: 'search', placeholder: 'Buscar perícia… (ex.: espadas)', 'aria-label': 'Buscar perícia' });
  const soMinhas = el('label', { class: 'pill', style: 'cursor:pointer' }, 'Só as minhas ', el('input', { type: 'checkbox' }));

  const lista = el('div', { class: 'list' });
  const tbody = el('div');

  function desenhar() {
    tbody.innerHTML = '';
    const f = busca.value.trim().toLowerCase();
    const cat = catSelect.value;
    const rows = [];
    for (const s of db.skills) {
      if (cat && s.categoria !== cat) continue;
      if (f && !s.nome.toLowerCase().includes(f) && !(s.defaults || []).some(d => d.toLowerCase().includes(f))) continue;
      const entry = (pc.pericias || []).find(e => e.id === s.id);
      const ef = snap.pericias.find(p => p.entry === entry);
      if (soMinhas.querySelector('input').checked && !entry) continue;
      rows.push(linhaPericia(s, entry, ef, snap));
    }
    tbody.append(...(rows.length ? rows : [el('div', { class: 'row' }, 'Nenhuma perícia encontrada.')]));
  }
  busca.oninput = catSelect.onchange = () => desenhar();
  soMinhas.querySelector('input').onchange = () => desenhar();

  main.append(
    el('h1', { class: 'page-title' }, '📜 Perícias', el('small', {}, `${db.skills.length} perícias do material · pontos disponíveis: ${snap.contagem.disponiveis}`)),
    el('div', { class: 'panel no-print' },
      el('div', { class: 'btn-row', style: 'margin:0' }, catSelect, busca, soMinhas)),
    el('div', { class: 'panel' },
      el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {}, ['Perícia', 'Tipo', 'Nível', 'Pontos', 'Default', 'Pré-req.', 'Ações'].map(h => el('th', {}, h)))),
        tbody)),
    el('p', { class: 'fonte' }, 'Nível efetivo = atributo-base + pontos investidos (tabela p. 104–105) ou melhor default, aplicados modificadores (elmo, escudo grande, fadiga em perícias de ST). Clique nos valores para ver o cálculo.'),
    lista,
  );
  desenhar();
}

function linhaPericia(s, entry, ef, snap) {
  const nivelTxt = ef ? ef.nivelEfetivo : '—';
  const base = ef ? ef.baseAttr : attrPadrao(s);
  const df = ef?.default;
  const pre = (s.prereqs || []).length ? (s.prereqs).join('; ') : '';
  const comprar = (pontos) => {
    const teste = podeComprarMelhoria(snap._db, store.atual, entry || { id: s.id, pontos: 0 }, pontos);
    // _niveis para prereq check
    if (!teste.ok) { toast(teste.erros[0] || 'Não é possível comprar.', 'bad'); return; }
    store.update(p => {
      const e = (p.pericias || []).find(x => x.id === s.id);
      if (e) e.pontos += pontos; else p.pericias.push({ id: s.id, pontos, especialidade: null });
    });
  };
  return el('tr', {},
    el('td', {}, el('strong', {}, s.nome + (s.nt ? '/NT' : '')),
      s.especializacao ? el('span', { class: 'pill warn', title: `Especialização ${s.especializacao}` }, s.especializacao) : '',
      el('div', { class: 'meta fonte' }, (s.descricao || '').slice(0, 110) + '…')),
    el('td', {}, `${s.tipo === 'Física' ? 'Fís' : 'Men'}/${s.dificuldade} · ${base}`),
    el('td', {}, entry
      ? (ef ? valorCalculado(nivelTxt, [
          { fonte: `Atributo-base ${ef.baseAttr}`, valor: ef.attrValor },
          { fonte: `Pontos investidos (${ef.pontos})`, valor: ef.offsetTreino !== null ? `offset ${ef.offsetTreino >= 0 ? '+' : ''}${ef.offsetTreino}` : 'abaixo do mínimo' },
          ...(df ? [{ fonte: `Default ${df.origem}`, valor: df.valor }] : []),
          ...ef.modificadores.map(m => ({ fonte: m.fonte, valor: m.valor })),
        ]) : nivelTxt)
      : (df ? valorCalculado(df.valor, [{ fonte: `Default: ${df.origem}` }]) : '—')),
    el('td', { class: 'num' }, entry ? String(entry.pontos) : '—'),
    el('td', { style: 'font-size:.75rem;color:var(--ink-dim)' }, (s.defaults || []).join(' | ').replace(/Pré-definido:? como:? ?/g, '').slice(0, 90)),
    el('td', {}, pre ? requisitoBadge(preOk(s, snap), pre.slice(0, 80)) : el('span', { class: 'pill' }, '—')),
    el('td', {},
      el('div', { class: 'btn-row', style: 'margin:0' },
        el('button', { class: 'btn small', onclick: () => comprar(0.5), title: 'Comprar ½ ponto' }, '+½'),
        el('button', { class: 'btn small', onclick: () => comprar(1), title: 'Comprar 1 ponto' }, '+1'),
        entry ? el('button', { class: 'btn small danger', title: 'Remover 1 ponto', onclick: () => store.update(p => {
          const e = p.pericias.find(x => x.id === s.id);
          if (!e) return;
          e.pontos -= 1;
          if (e.pontos < 0.5) p.pericias = p.pericias.filter(x => x !== e);
        }) }, '−1') : '',
        el('button', { class: 'btn small ghost', title: 'Ver detalhes e regra no livro', onclick: () => detalhar(s, entry, ef) }, '👁'),
      )),
  );
}

function preOk(s, snap) {
  // pré-requisito aproximado: existe perícia treinada com nome citado
  const txt = (s.prereqs || []).join(' ');
  if (!txt) return true;
  for (const nome of Object.keys(snap.niveis)) {
    if (nome.length > 3 && txt.toLowerCase().includes(nome.toLowerCase())) {
      if ((snap.niveis[nome] || 0) >= 12) return true;
    }
  }
  return false;
}

function detalhar(s, entry, ef) {
  const df = ef?.default;
  modal(`Perícia: ${s.nome}`, el('div', {},
    el('p', {}, el('b', {}, `${s.tipo}/${s.dificuldade}`), ` · base ${attrPadrao(s)} · categoria ${s.categoria}`),
    el('p', {}, s.descricao || ''),
    el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Campo'), el('th', {}, 'Valor')),
      el('tr', {}, el('td', {}, 'Default'), el('td', {}, (s.defaults || []).join(' | ') || 'Sem default')),
      (s.prereqs || []).map(p => el('tr', {}, el('td', {}, 'Pré-requisito'), el('td', {}, p))),
      entry ? el('tr', {}, el('td', {}, 'Pontos'), el('td', {}, String(entry.pontos))) : '',
      ef && ef.nivelEfetivo !== null ? el('tr', {}, el('td', {}, 'Nível efetivo'), el('td', {}, String(ef.nivelEfetivo))) : '',
      df ? el('tr', {}, el('td', {}, 'Default ativo'), el('td', {}, `${df.valor} (${df.origem})`)) : '',
    ),
    el('p', { class: 'fonte' }, `Fonte: material, ${s.fonte || ''}`),
  ));
}
