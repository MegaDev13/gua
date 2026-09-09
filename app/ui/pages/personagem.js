/* Aba PERSONAGEM — identidade, pontos, progressão, retrato. */
import { el, fmtMoney, toast, baixar, valorCalculado, modal, confirmar } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { exportarPDF, exportarPNG } from '../exportar.js';
import { APARENCIA } from '../../engine/attributes.js';
import {
  presetsDePontos, limitesDePontos, escalaDoPersonagem, ajustarTotalDePontos,
  ajustarExtrasGanhos, ROTULOS_DE_CATEGORIA,
} from '../../engine/points.js';

export function renderPersonagem(main, { db }) {
  const pc = store.atual;
  if (!pc) { main.append(el('p', {}, 'Nenhum personagem. Crie um em Configurações.')); return; }
  const snap = computeAll(db, pc);
  const cont = snap.contagem;

  const campos = el('div', { class: 'grid cols-2' },
    campo('Nome', 'nome', pc.nome),
    campo('Conceito', 'conceito', pc.conceito, 'ex.: ladrão mirredo e ágil'),
    campo('Jogador', 'jogador', pc.jogador),
    campoIdade(pc),
    campo('Aparência física', 'fisico.descricao', pc.fisico?.descricao, 'altura, cabelos, olhos, pele…'),
    campo('Origem', 'origem', pc.origem, 'de onde veio, família…'),
    campo('História', 'historia', pc.historia, 'background do personagem'),
    campo('Observações', 'observacoes', pc.observacoes, 'anotações livres'),
  );

  const aparenciaSelect = el('label', { class: 'field' }, 'Nível de aparência',
    el('select', { onchange: e => store.update(p => p.aparenciaNivel = e.target.value) },
      Object.entries(APARENCIA).map(([k, v]) => el('option', { value: k, selected: pc.aparenciaNivel === k }, `${v.nome} (${v.custo > 0 ? '+' : ''}${v.custo} pts)`))));

  /* total configurável: presets publicados, campo livre e passos rápidos (orçamento único) */
  const escala = escalaDoPersonagem(db, pc);
  const limites = limitesDePontos(db);
  const totalInput = el('input', {
    type: 'number', min: limites.minimo, step: 1, value: pc.pontos.total, style: 'width:100px',
    'aria-label': 'Total de pontos do personagem', title: `Mínimo ${limites.minimo} pontos; sem teto`,
  });
  const extrasInput = el('input', {
    type: 'number', min: 0, step: 1, value: pc.pontos.extrasGanhos || 0, style: 'width:90px',
    'aria-label': 'Pontos extras ganhos em campanha', title: 'Pontos recebidos durante o jogo',
  });
  const aplicarTotais = () => store.update(p => {
    const novoTotal = Math.max(limites.minimo, Math.round(Number(totalInput.value) || p.pontos.total));
    const novoExtras = Math.max(0, Math.round(Number(extrasInput.value) || 0));
    ajustarTotalDePontos(db, p, novoTotal - (Number(p.pontos.total) || 0));
    ajustarExtrasGanhos(db, p, novoExtras - (Number(p.pontos.extrasGanhos) || 0));
  });

  const pts = el('div', { class: 'panel' },
    el('h3', {}, 'Pontos de Personagem'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Total'), valorCalculado(cont.total, [{ fonte: 'Total da criação' }, { fonte: 'Extras ganhos', valor: pc.pontos.extrasGanhos || 0 }], 'Pontos totais')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Gastos'), valorCalculado(cont.gastos, cont.partes.map(p => ({ fonte: `${p.tipo}: ${p.nome}`, valor: p.custo })), 'Contagem de pontos')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Disponíveis'), valorCalculado(cont.disponiveis, [{ fonte: 'Total' }, { fonte: '− Gastos', valor: -cont.gastos }], 'Pontos disponíveis')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Experiência'), el('div', { class: 'value' }, String(pc.pontos.extrasGanhos || 0))),
    ),
    el('p', { class: 'fonte', style: 'margin:.55rem 0 0' },
      'Faixa de campanha: ', el('b', {}, `${escala.pontos} — ${escala.nivel}`),
      escala.descricao ? ` · ${escala.descricao}` : '',
      ` · orçamento ${cont.orcamento === 'separado' ? 'separado (poderes têm orçamento próprio)' : 'único (poderes saem do mesmo total)'}`),
    presetsDePontos(db).length ? el('div', { class: 'chips', style: 'margin-top:.5rem' },
      ...presetsDePontos(db).map(preset => el('button', {
        class: preset.pontos === pc.pontos.total ? 'chip on' : 'chip',
        title: `${preset.descricao || ''} — define o total em ${preset.pontos} pontos`,
        onclick: () => store.update(p => { ajustarTotalDePontos(db, p, 0, { preset }); }),
      }, `${preset.nome} · ${preset.pontos}`))) : '',
    el('div', { class: 'btn-row', style: 'margin-top:.5rem' },
      el('span', { class: 'label' }, 'Total'), totalInput,
      ...limites.incrementos.flatMap(inc => [
        el('button', { class: 'btn small', title: `Reduzir o total em ${inc} pontos`, onclick: () => store.update(p => { ajustarTotalDePontos(db, p, -inc); }) }, `−${inc}`),
        el('button', { class: 'btn small', title: `Aumentar o total em ${inc} pontos`, onclick: () => store.update(p => { ajustarTotalDePontos(db, p, inc); }) }, `+${inc}`),
      ]),
      el('span', { class: 'label' }, 'Extras ganhos'), extrasInput,
      el('button', { class: 'btn small primary', title: 'Aplicar os valores digitados', onclick: aplicarTotais }, 'Aplicar'),
      el('a', { class: 'btn small ghost', href: '#/config', title: 'Breakdown por categoria e modo do orçamento' }, 'Orçamento…'),
    ),
    cont.validacoes.length ? el('div', { style: 'margin-top:.6rem' }, cont.validacoes.map(v => el('div', { class: 'pill bad' }, '⚠ ' + v))) : '',
    el('details', { style: 'margin-top:.6rem' }, el('summary', { class: 'fonte' }, 'Ver contabilidade completa'),
      el('table', { class: 'tbl' },
        el('tr', {}, el('th', {}, 'Onde'), el('th', {}, 'Detalhe'), el('th', { class: 'num' }, 'Pontos')),
        cont.partes.map(p => el('tr', {}, el('td', {}, ROTULOS_DE_CATEGORIA[p.tipo] || p.tipo), el('td', {}, `${p.nome}${p.detalhe ? ' — ' + p.detalhe : ''}`), el('td', { class: 'num' }, String(p.custo)))))),
  );

  const fisico = el('div', { class: 'panel' },
    el('h3', {}, 'Ficha Física e Social'),
    el('div', { class: 'grid cols-3' },
      aparenciaSelect,
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Dinheiro'), el('div', { class: 'value' }, fmtMoney(pc.riqueza?.dinheiro))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Status Social'), el('div', { class: 'value' }, String(pc.statusSocial ?? 0))),
    ),
    el('p', { class: 'fonte' }, 'Altura/peso e cores podem ser sorteados pelas tabelas do material (Livro → Aparência Física).'),
  );

  const acoes = el('div', { class: 'btn-row' },
    el('button', { class: 'btn', onclick: () => exportar(pc) }, '⬇ Exportar JSON'),
    el('button', { class: 'btn', onclick: () => janelaImportar() }, '⬆ Importar JSON'),
    el('button', { class: 'btn primary', title: 'Abre o diálogo de impressão — escolha "Salvar como PDF"', onclick: () => exportarPDF(computeAll(DB, store.atual)) }, '🖨 Exportar PDF'),
    el('button', { class: 'btn primary', title: 'Baixa uma ficha resumida em imagem', onclick: () => exportarPNG(computeAll(DB, store.atual)) }, '🖼 Exportar PNG'),
  );

  main.append(
    el('h1', { class: 'page-title' }, '🧑 Personagem', el('small', {}, pc.nome || 'sem nome')),
    el('div', { class: 'grid cols-2' }, pts, fisico),
    el('h2', { class: 'page-title', style: 'margin-top:1.2rem' }, 'Identidade'),
    campos,
    acoes,
  );
}

function campo(label, path, valor, placeholder = '') {
  const input = el('textarea', { placeholder, dataset: { path }, oninput: e => setPath(path, e.target.value) }, valor || '');
  if (['nome', 'conceito', 'jogador'].includes(path)) {
    return el('label', { class: 'field' }, label,
      el('input', { value: valor || '', placeholder, dataset: { path }, oninput: e => setPath(path, e.target.value) }));
  }
  return el('label', { class: 'field' }, label, input);
}
function campoIdade(pc) {
  return el('label', { class: 'field' }, 'Idade (limite de perícias na criação = 2× idade)',
    el('input', { type: 'number', min: 1, value: pc.idade ?? '', dataset: { path: 'idade' }, oninput: e => store.update(p => p.idade = parseInt(e.target.value, 10) || null) }));
}
function setPath(path, valor) {
  store.update(p => {
    const parts = path.split('.');
    let o = p;
    while (parts.length > 1) { const k = parts.shift(); o[k] = o[k] || {}; o = o[k]; }
    o[parts[0]] = valor;
  });
}
function exportar(pc) {
  baixar(`${(pc.nome || 'personagem').replace(/\s+/g, '-').toLowerCase()}-gua.json`, store.exportarAtual(), 'application/json');
  store.historico('export', 'Ficha exportada para JSON.');
}
function janelaImportar() {
  const input = el('input', { type: 'file', accept: '.json,application/json' });
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { store.importar(String(r.result)); toast('Personagem importado!', 'ok'); }
      catch (e) { toast('Falha ao importar: ' + e.message, 'bad'); }
    };
    r.readAsText(f);
  };
  modal('Importar personagem (JSON)', el('div', {}, el('p', {}, 'Selecione um arquivo .json exportado por este sistema. Nada é sobrescrito: um novo personagem será criado.'), input));
}
