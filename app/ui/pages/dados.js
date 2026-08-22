/* Aba DADOS — rolagens genéricas, testes 3d e tabela de probabilidades. */
import { el, dadosVisual, valorCalculado } from '../ui.js';
import { dice } from '../../engine/combat.js';
import { chance3d } from '../../engine/dice.js';

export function renderDados(main, { db }) {
  const log = el('div', { class: 'list' });
  const registrar = (html) => log.prepend(el('div', { class: 'row' }, el('span', { class: 'grow' }, html)));
  registrar('Pronto para rolar. 🎲');

  /* ---------------------------------------------- rolagem livre */
  const nDados = el('input', { type: 'number', min: 1, max: 50, value: 3, style: 'width:70px' });
  const faces = el('input', { type: 'number', min: 2, max: 100, value: 6, style: 'width:70px' });
  const mod = el('input', { type: 'number', value: 0, style: 'width:70px', title: 'Modificador' });
  const livre = el('div', { class: 'panel' },
    el('h3', {}, 'Rolagem livre'),
    el('div', { class: 'btn-row', style: 'margin:0' },
      el('span', { class: 'label' }, 'Dados:'), nDados,
      el('span', { class: 'label' }, 'Faces:'), faces,
      el('span', { class: 'label' }, 'Mod.:'), mod,
      el('button', { class: 'btn primary', onclick: () => {
        const n = Math.max(1, parseInt(nDados.value, 10) || 1);
        const f = Math.max(2, parseInt(faces.value, 10) || 6);
        const m = parseInt(mod.value, 10) || 0;
        const rolls = Array.from({ length: n }, () => dice.d(f));
        const total = rolls.reduce((a, b) => a + b, 0) + m;
        registrar(`${dadosVisual(rolls.slice(0, 12))} ${n}d${f}${m ? (m > 0 ? '+' + m : m) : ''} = <b>${total}</b>`);
      } }, '🎲 Rolar')),
  );

  /* ---------------------------------------------- teste de habilidade */
  const nh = el('input', { type: 'number', min: 3, max: 30, value: 10, style: 'width:80px' });
  const modTeste = el('input', { type: 'number', value: 0, style: 'width:80px', title: 'Modificadores somados ao NH' });
  const prob = el('span', { class: 'pill gold' });
  const atualizarProb = () => {
    const n = (parseInt(nh.value, 10) || 10) + (parseInt(modTeste.value, 10) || 0);
    prob.textContent = `chance ≈ ${(chance3d(Math.max(3, Math.min(16, n))) * 100).toFixed(1)}% (3d ≤ ${n})`;
  };
  nh.oninput = modTeste.oninput = atualizarProb;
  const teste = el('div', { class: 'panel' },
    el('h3', {}, 'Teste de habilidade (3d ≤ NH — p. 198–205)'),
    el('div', { class: 'btn-row', style: 'margin:0' },
      el('span', { class: 'label' }, 'NH:'), nh,
      el('span', { class: 'label' }, 'Mods:'), modTeste, prob,
      el('button', { class: 'btn primary', onclick: () => {
        const n = (parseInt(nh.value, 10) || 10) + (parseInt(modTeste.value, 10) || 0);
        const r = dice.check(n, { label: 'Teste' });
        registrar(`${dadosVisual(r.rolls, { crit: r.critico && r.sucesso, fail: r.critico && !r.sucesso })} NH ${n}: rolou <b>${r.total}</b> — <b>${r.descricao}</b> (margem ${r.margem > 0 ? '+' : ''}${r.margem})`);
      } }, '🎲 Testar')),
    el('p', { class: 'fonte' }, 'Decisivos: 3–4 sempre; 5 com NH≥15; 6 com NH≥16. Falha crítica: 18 sempre; 17 com NH<16; margem ≥ 10. (p. 200–202)'),
    atualizarProb(),
  );

  /* ---------------------------------------------- probabilidades */
  const probT = db.tables.probabilidades3d;
  const tabelaProb = probT ? el('details', { class: 'panel', style: 'padding:.6rem .9rem' },
    el('summary', { style: 'cursor:pointer;font-weight:600' }, `Tabela de probabilidades 3d (${probT.fonte || ''})`),
    el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'NH 3d ≤'), el('th', { class: 'num' }, 'Chance')),
      Object.entries(probT.tabela || {}).map(([nh, ch]) => el('tr', {}, el('td', {}, String(nh)), el('td', { class: 'num' }, String(ch))))))) : '';

  main.append(
    el('h1', { class: 'page-title' }, '🎲 Dados'),
    el('div', { class: 'grid cols-2' }, livre, teste),
    tabelaProb,
    el('div', { class: 'panel' }, el('h3', {}, 'Últimas rolagens'), log),
  );
}
