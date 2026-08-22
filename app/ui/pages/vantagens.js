/* Aba VANTAGENS / DESVANTAGENS / PECULIARIDADES — catálogo com custos e efeitos. */
import { el, toast, modal } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { parseCusto, MAX_PECULIARIDADES } from '../../engine/traits.js';
import { custoTrait } from '../../engine/traits.js';
import { APARENCIA } from '../../engine/attributes.js';

export function renderVantagens(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);

  const minhasV = new Set((pc.vantagens || []).map(v => v.id));
  const minhasD = new Set((pc.desvantagens || []).map(v => v.id));

  const buscaV = el('input', { type: 'search', placeholder: 'Buscar vantagem…', 'aria-label': 'Buscar vantagem' });
  const buscaD = el('input', { type: 'search', placeholder: 'Buscar desvantagem…', 'aria-label': 'Buscar desvantagem' });
  const listaV = el('div', { class: 'list' });
  const listaD = el('div', { class: 'list' });

  function desenharV() {
    listaV.innerHTML = '';
    const f = buscaV.value.trim().toLowerCase();
    const itens = db.advantages.filter(a => !f || a.nome.toLowerCase().includes(f) || (a.descricao || '').toLowerCase().includes(f));
    // primeiro as minhas, depois o catálogo
    const ordenadas = [...itens].sort((a, b) => (minhasV.has(b.id) ? 1 : 0) - (minhasV.has(a.id) ? 1 : 0));
    listaV.append(...ordenadas.map(a => linhaTrait(a, 'vantagem', minhasV.has(a.id))));
  }
  function desenharD() {
    listaD.innerHTML = '';
    const f = buscaD.value.trim().toLowerCase();
    const itens = db.disadvantages.filter(a => !f || a.nome.toLowerCase().includes(f) || (a.descricao || '').toLowerCase().includes(f));
    const ordenadas = [...itens].sort((a, b) => (minhasD.has(b.id) ? 1 : 0) - (minhasD.has(a.id) ? 1 : 0));
    listaD.append(...ordenadas.map(a => linhaTrait(a, 'desvantagem', minhasD.has(a.id))));
  }
  buscaV.oninput = desenharV; buscaD.oninput = desenharD;

  /* peculiaridades */
  const pecInput = el('input', { type: 'text', placeholder: 'Ex.: Detesta dizer "não"!', style: 'flex:1' });
  const pecList = el('div', { class: 'list' });
  function desenharPec() {
    pecList.innerHTML = '';
    pecList.append(...(pc.peculiaridades || []).map((q, i) => el('div', { class: 'row' },
      el('span', { class: 'grow' }, q),
      el('span', { class: 'pill bad' }, '−1 pt'),
      el('button', { class: 'btn small danger', onclick: () => store.update(p => p.peculiaridades.splice(i, 1)) }, '✕'))));
    if (!(pc.peculiaridades || []).length) pecList.append(el('div', { class: 'row' }, 'Nenhuma peculiaridade.'));
  }
  const addPec = () => {
    const txt = pecInput.value.trim();
    if (!txt) return;
    if ((pc.peculiaridades || []).length >= MAX_PECULIARIDADES) { toast(`Máximo de ${MAX_PECULIARIDADES} peculiaridades (p. 88).`, 'bad'); return; }
    store.update(p => p.peculiaridades.push(txt));
    pecInput.value = '';
  };
  pecInput.onkeydown = e => { if (e.key === 'Enter') addPec(); };

  main.append(
    el('h1', { class: 'page-title' }, '⚖️ Vantagens & Desvantagens', el('small', {}, `disponíveis: ${snap.contagem.disponiveis} pts`)),
    el('div', { class: 'grid cols-2' },
      el('div', { class: 'panel' }, el('h3', {}, 'Vantagens (p. 17–40)'), buscaV, listaV),
      el('div', { class: 'panel' }, el('h3', {}, 'Desvantagens (p. 40–88)'), buscaD, listaD),
    ),
    el('div', { class: 'panel', style: 'margin-top:.9rem' },
      el('h3', {}, `Peculiaridades (${(pc.peculiaridades || []).length}/${MAX_PECULIARIDADES} · −1 ponto cada — p. 88–99)`),
      el('div', { class: 'btn-row', style: 'margin:0 0 .6rem' }, pecInput, el('button', { class: 'btn', onclick: addPec }, '＋ Adicionar')),
      pecList,
      el('details', { style: 'margin-top:.5rem' }, el('summary', { class: 'fonte' }, 'Exemplos do material'),
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem' },
          (db.quirks.exemplos || []).map(ex => el('button', { class: 'btn small ghost', title: 'Usar este exemplo', onclick: () => {
            if ((store.atual.peculiaridades || []).length >= MAX_PECULIARIDADES) { toast('Máximo alcançado.', 'bad'); return; }
            store.update(p => p.peculiaridades.push(ex));
          } }, ex)))),
    ),
  );
  desenharV(); desenharD(); desenharPec();
}

function linhaTrait(def, kind, tem) {
  const pc = store.atual;
  const listaAtual = kind === 'vantagem' ? pc.vantagens : pc.desvantagens;
  const entrada = listaAtual.find(x => x.id === def.id);
  const custo = entrada ? custoTrait(pc, entrada, def) : null;
  const p = parseCusto(def.custo || '');
  const ehNivel = def.niveis || p.modo === 'por-nivel' || def.custoPorNivel;

  const togglear = () => {
    if (entrada) {
      store.update(p2 => {
        const lst = kind === 'vantagem' ? p2.vantagens : p2.desvantagens;
        const i = lst.findIndex(x => x.id === def.id);
        if (i >= 0) lst.splice(i, 1);
      });
    } else {
      const nova = { id: def.id, nome: def.nome };
      if (def.niveis) nova.nivel = def.niveis.find(n => n.custo === 0)?.nome || def.niveis[0].nome;
      if (ehNivel) nova.niveis = 1;
      if (p.modo === 'escolha' || p.modo === 'variavel') nova.custoEscolhido = p.valores ? p.valores[0] : 0;
      store.update(p2 => (kind === 'vantagem' ? p2.vantagens : p2.desvantagens).push(nova));
    }
  };
  const mudaNivel = (d) => store.update(p2 => {
    const e = (kind === 'vantagem' ? p2.vantagens : p2.desvantagens).find(x => x.id === def.id);
    if (def.niveis) {
      const i = def.niveis.findIndex(n => n.nome === e.nivel);
      const ni = Math.max(0, Math.min(def.niveis.length - 1, i + d));
      e.nivel = def.niveis[ni].nome;
    } else {
      e.niveis = Math.max(1, (e.niveis || 1) + d);
    }
  });

  return el('div', { class: 'row' },
    el('div', { class: 'grow' },
      el('div', { class: 'name' }, def.nome),
      el('div', { class: 'meta' }, (def.descricao || '').slice(0, 150))),
    el('span', { class: 'pill gold', title: def.custo || '' }, entrada && custo ? `${custo.custo > 0 ? '+' : ''}${custo.custo} pts` : (def.custo || 'custo variável')),
    entrada && def.niveis ? el('button', { class: 'btn small', onclick: () => mudaNivel(-1) }, '◀') : '',
    entrada && def.niveis ? el('span', { class: 'pill' }, entrada.nivel) : '',
    entrada && def.niveis ? el('button', { class: 'btn small', onclick: () => mudaNivel(1) }, '▶') : '',
    entrada && ehNivel && !def.niveis ? el('span', { class: 'pill' }, `nível ${entrada.niveis || 1}`) : '',
    entrada && ehNivel && !def.niveis ? el('button', { class: 'btn small', onclick: () => mudaNivel(1) }, '+nível') : '',
    el('button', { class: `btn small ${entrada ? 'danger' : ''}`, onclick: togglear }, entrada ? 'Remover' : 'Adquirir'),
    el('button', { class: 'btn small ghost', onclick: () => detalhar(def) }, '👁'),
  );
}

function detalhar(def) {
  modal(def.nome, el('div', {},
    el('p', {}, el('b', {}, 'Custo: '), def.custo || 'variável'),
    def.niveis ? el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Nível'), el('th', {}, 'Custo'), el('th', {}, 'Efeito')),
      def.niveis.map(n => el('tr', {}, el('td', {}, n.nome), el('td', { class: 'num' }, String(n.custo)), el('td', {}, n.efeito || n.multiplicadorRecursos + '× recursos' || '')))) : '',
    el('p', {}, def.descricao || ''),
    el('p', { class: 'fonte' }, `Fonte: material, ${def.fonte || ''}`),
  ));
}
