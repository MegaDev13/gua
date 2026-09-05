/* Aba DADOS — rolagens genéricas, testes 3d (legado), testes d20 (G.A.U.) e tabelas. */
import { el, dadosVisual, valorCalculado } from '../ui.js';
import { dice } from '../../engine/combat.js';
import { chance3d } from '../../engine/dice.js';
import { testeD20, disputa, verificacaoDePanico, dadosDaCategoria } from '../../engine/resolution.js';
import { store } from '../store.js';

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

  /* ---------------------------------------------- teste G.A.U. (d20) */
  const categorias = db.resolucao?.categorias?.lista || [];
  const cfg = store.atual?.config || {};
  const refGau = el('input', { type: 'number', min: 1, max: 20, value: 10, style: 'width:80px', title: 'Valor de referência (atributo, perícia ou valor publicado)' });
  const modGau = el('input', { type: 'number', value: 0, style: 'width:80px', title: 'Modificadores somados à referência' });
  const catGau = el('select', { style: 'width:150px' },
    ...categorias.map(c => el('option', { value: c.id, selected: c.id === 'mundano' }, `${c.nome}${c.dados ? ` (${c.dados}d20)` : ''}`)));
  const modoGau = el('select', { style: 'width:170px' },
    ['melhor', 'cada-dado', 'soma'].map(m => el('option', { value: m, selected: m === (cfg.modoEscala || 'melhor') },
      m === 'melhor' ? 'melhor dado' : m === 'cada-dado' ? 'cada dado avaliado' : 'soma dos dados (hipótese)')));
  const infoGau = el('span', { class: 'pill gold' });
  const atualizarInfoGau = () => {
    const escala = dadosDaCategoria(db, catGau.value);
    const margem = db.resolucao?.margens?.tabela?.[Math.max(1, Math.min(20, parseInt(refGau.value, 10) || 10))];
    infoGau.textContent = margem
      ? `${escala.dados || 1}d20 · margem ${margem.texto} · crítico ${margem.critico ?? '—'}`
      : `${escala.dados || 1}d20 · margem NÃO DEFINIDA para esta referência`;
  };
  refGau.oninput = catGau.onchange = atualizarInfoGau;
  const testeGau = el('div', { class: 'panel' },
    el('h3', {}, 'Teste G.A.U. (d20 dentro da margem)'),
    el('div', { class: 'btn-row', style: 'margin:0' },
      el('span', { class: 'label' }, 'Ref.:'), refGau,
      el('span', { class: 'label' }, 'Mods:'), modGau,
      el('span', { class: 'label' }, 'Categoria:'), catGau,
      el('span', { class: 'label' }, 'Escala:'), modoGau, infoGau,
      el('button', { class: 'btn primary', onclick: () => {
        const mod = parseInt(modGau.value, 10) || 0;
        const r = testeD20(db, {
          referencia: parseInt(refGau.value, 10) || 10,
          modificadores: mod ? [{ id: 'manual', rotulo: 'modificador', valor: mod }] : [],
          categoria: catGau.value, modo: modoGau.value, rotulo: 'Teste d20',
        });
        const mods = r.totalModificadores ? ` (${r.totalModificadores > 0 ? '+' : ''}${r.totalModificadores})` : '';
        registrar(`${dadosVisual(r.rolls, { crit: r.critico, fail: r.tipo === 'falha' })} d20 → <b>${r.valor ?? '—'}</b>${mods} contra ref. ${r.referencia} (margem ${r.margem?.texto || '—'}): <b>${r.descricao}</b>${r.nota ? ` — ${r.nota}` : ''}`);
      } }, '🎲 Rolar d20')),
    el('p', { class: 'fonte' }, 'O resultado do d20 precisa cair DENTRO da margem de sucesso da referência; 1 e 20 não são falha/sucesso automáticos. O valor exato da referência é crítico.'),
    atualizarInfoGau(),
  );

  /* ---------------------------------------------- disputa de habilidades */
  const refA = el('input', { type: 'number', min: 1, max: 20, value: 12, style: 'width:70px' });
  const refB = el('input', { type: 'number', min: 1, max: 20, value: 10, style: 'width:70px' });
  const criterio = el('select', { style: 'width:210px' },
    [['proximidade-do-critico', 'mais próximo do crítico'], ['maior-margem', 'maior margem de sucesso']]
      .map(([v, t]) => el('option', { value: v, selected: v === (cfg.criterioDisputa || 'proximidade-do-critico') }, t)));
  const disputaPanel = el('div', { class: 'panel' },
    el('h3', {}, 'Disputa de habilidades (d20 × d20)'),
    el('div', { class: 'btn-row', style: 'margin:0' },
      el('span', { class: 'label' }, 'A:'), refA, el('span', { class: 'label' }, 'B:'), refB,
      el('span', { class: 'label' }, 'Vitória por:'), criterio,
      el('button', { class: 'btn primary', onclick: () => {
        const r = disputa(db, {
          a: { referencia: parseInt(refA.value, 10) || 10, rotulo: 'Lado A' },
          b: { referencia: parseInt(refB.value, 10) || 10, rotulo: 'Lado B' },
          criterio: criterio.value, tipo: 'rapida',
        });
        const resumo = lado => `${dadosVisual(lado.rolls)} = <b>${lado.valor ?? '—'}</b> (${lado.tipo})`;
        registrar(`Disputa — A: ${resumo(r.resA)} · B: ${resumo(r.resB)} → <b>${r.empate ? 'EMPATE' : `vence ${r.vencedor}`}</b>. ${r.motivo || ''}${r.distanciaCriticoA != null ? ` Distância do crítico: A ${r.distanciaCriticoA} · B ${r.distanciaCriticoB}.` : ''}`);
      } }, '⚔ Disputar')),
    el('p', { class: 'fonte' }, 'Disputa rápida: uma jogada cada. Se um succeede e o outro falha, o vencedor é óbvio; caso contrário vale o critério escolhido.'),
  );

  /* ---------------------------------------------- verificação de pânico */
  const margemFalha = el('input', { type: 'number', min: 0, max: 30, value: 0, style: 'width:80px', title: 'Margem da falha no teste de Vontade' });
  const panico = el('div', { class: 'panel' },
    el('h3', {}, 'Verificação de pânico (3d + margem da falha)'),
    el('div', { class: 'btn-row', style: 'margin:0' },
      el('span', { class: 'label' }, 'Margem da falha:'), margemFalha,
      el('button', { class: 'btn', onclick: () => {
        const r = verificacaoDePanico(db, { margemDaFalha: parseInt(margemFalha.value, 10) || 0 });
        registrar(`${dadosVisual(r.rolls)} 3d = ${r.total3d} + margem ${r.margemDaFalha} → <b>${r.total}</b>: ${r.entrada ? `<b>${r.entrada.resultado}</b> — ${r.entrada.efeito}` : 'resultado fora da tabela publicada'}`);
      } }, '😱 Verificar pânico')),
    el('p', { class: 'fonte' }, db.proezas?.panico?.rolagem?.regra || 'Some a margem da falha no teste de Vontade ao resultado de 3d e consulte a tabela (4 a 40+).'),
  );

  /* ---------------------------------------------- tabela de margens */
  const margens = db.resolucao?.margens?.tabela || {};
  const tabelaMargens = Object.keys(margens).length ? el('details', { class: 'panel', style: 'padding:.6rem .9rem' },
    el('summary', { style: 'cursor:pointer;font-weight:600' }, `Tabela de margens de sucesso (d20) — ${db.resolucao?.margens?.fonte || ''}`),
    el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Referência'), el('th', { class: 'num' }, 'Margem'), el('th', { class: 'num' }, 'Crítico'), el('th', { class: 'num' }, 'Largura')),
      Object.entries(margens).map(([ref, m]) => el('tr', {},
        el('td', {}, String(ref)), el('td', { class: 'num' }, m.texto || '—'),
        el('td', { class: 'num' }, m.critico ?? '—'), el('td', { class: 'num' }, m.largura ?? '—'))))),
    el('p', { class: 'fonte' }, db.resolucao?.margens?.nota || '')) : '';

  main.append(
    el('h1', { class: 'page-title' }, '🎲 Dados'),
    el('div', { class: 'grid cols-2' }, testeGau, disputaPanel),
    el('div', { class: 'grid cols-2', style: 'margin-top:.9rem' }, panico, livre),
    el('div', { class: 'grid cols-2', style: 'margin-top:.9rem' }, teste, tabelaProb),
    tabelaMargens,
    el('div', { class: 'panel' }, el('h3', {}, 'Últimas rolagens'), log),
  );
}
