/* Aba COMBATE — estado vital, fadiga, condições, ataques, defesas e ferimentos.
 * Toda a matemática vem do engine (combat.js, fatigue.js). A UI só desenha e chama.
 */
import { el, toast, modal, valorCalculado, dadosVisual, fmtKg } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { dice, aparar, bloqueio, rolarAtaque, nhAtaque, danoArma, avaliarDano, aplicarFerimento } from '../../engine/combat.js';
import { gastarFadiga, recuperarFadiga, custoFadiga, estadoFadiga } from '../../engine/fatigue.js';
import { chance3d } from '../../engine/dice.js';

const CONDICOES = [
  { id: 'atordoado', nome: 'Atordoado', nota: 'Não pode agir; teste HT no início do turno (p. 280)' },
  { id: 'prostrado', nome: 'Prostrado', nota: 'Cai no chão; −2 defesa (p. 280)' },
  { id: 'inconsciente', nome: 'Inconsciente', nota: 'Desmaiado (p. 281)' },
  { id: 'membro-incapacitado', nome: 'Membro incapacitado', nota: 'Braço/perna/mão/pé fora de uso (p. 280-281)' },
  { id: 'cego', nome: 'Cego', nota: '−6 atacar; adversário defesa total (p. 236)' },
  { id: 'surdo', nome: 'Surdo', nota: 'Perde iniciativa; −4 em condições que dependam de audição' },
];

export function renderCombate(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const log = el('div', { class: 'list', id: 'combateLog', style: 'max-height:340px;overflow:auto' });
  const registrar = (html) => {
    log.prepend(el('div', { class: 'row' }, el('span', { class: 'grow' }, html)));
  };

  /* ------------------------------------------------ estado vital */
  const cb = snap.combate;
  const vital = el('div', { class: 'panel' },
    el('h3', {}, 'Estado Vital (Ferimentos p. 276–281)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'HT atual'),
        valorCalculado(cb.htAtual, [{ fonte: `HT ${pc.atributos.HT}` }, { fonte: '− Ferimentos', valor: -cb.ferimentos }], 'Pontos de Vida')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Ferimentos (PV)'),
        el('input', { type: 'number', min: 0, value: cb.ferimentos, onchange: e => store.update(p => p.combate.ferimentos = Math.max(0, parseInt(e.target.value, 10) || 0)) })),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Limiares de morte'),
        el('div', { class: 'value', style: 'font-size:.8rem' }, String(db.tables.ferimentos?.morteAutomatica || 'ver p. 277–279'))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Fadiga (ST perdida)'),
        el('input', { type: 'number', min: 0, max: pc.atributos.ST, value: cb.fadiga, onchange: e => store.update(p => p.combate.fadiga = Math.min(pc.atributos.ST, Math.max(0, parseInt(e.target.value, 10) || 0))) })),
    ),
    el('div', { class: 'btn-row', style: 'margin-top:.6rem' },
      el('button', { class: 'btn', onclick: () => aplicarDanoDireto(db, registrar) }, '🗡 Sofrer dano'),
      el('button', { class: 'btn', onclick: () => testeHT(db, registrar) }, '🫀 Teste de HT'),
      el('button', { class: 'btn', onclick: () => {
        let r = null;
        store.update(p => {
          const c = custoFadiga(db, p, 'luta', { nivelCarga: snap.carga.nivel });
          if (c.erro) { r = c; return; }
          const g = gastarFadiga(p, c.custo);
          p.combate.fadiga = g.fadiga;
          r = { ...c, ...g };
        });
        registrar(`Luta: +${r.pontosEfetivos} fadiga (${r.notas.join('; ')}). Estado: <b>${r.estado}</b>.`);
      } }, '💤 Fadiga de luta'),
      el('button', { class: 'btn', onclick: () => {
        let novo = 0;
        store.update(p => { p.combate.fadiga = novo = recuperarFadiga(p, 60); });
        registrar('Descanso de 60 min: recuperou 1 ponto de ST por 10 min (p. 300).');
      } }, '🌿 Descansar 1h'),
      el('button', { class: 'btn danger', onclick: () => store.update(p => { p.combate.ferimentos = 0; p.combate.fadiga = 0; p.combate.condicoes = []; }) }, '♻ Zerar combate'),
    ),
    estadoAviso(cb),
  );

  /* ------------------------------------------------ condições */
  const condList = el('div', { class: 'list' });
  function desenharCond() {
    condList.innerHTML = '';
    const ativas = store.atual.combate?.condicoes || [];
    condList.append(el('div', { class: 'btn-row', style: 'flex-wrap:wrap;margin:0' },
      CONDICOES.map(c => {
        const on = ativas.some(a => a.id === c.id);
        return el('button', {
          class: `btn small ${on ? 'danger' : 'ghost'}`, title: c.nota,
          onclick: () => store.update(p => {
            const lst = p.combate.condicoes;
            const i = lst.findIndex(a => a.id === c.id);
            if (i >= 0) lst.splice(i, 1); else lst.push({ id: c.id, nome: c.nome });
          }),
        }, (on ? '✓ ' : '') + c.nome);
      })));
    if (snap.combate.desmaiado) condList.append(el('p', { class: 'pill bad' }, 'MORTE AUTOMÁTICA: ferimentos ≥ 5×HT (p. 279).'));
    if (snap.combate.inconscienteRisco) condList.append(el('p', { class: 'pill warn' }, 'HT ≤ 0: teste HT no início de cada turno ou desmaia (p. 281).'));
  }
  const condicoes = el('div', { class: 'panel' }, el('h3', {}, 'Condições (p. 280–281, 236)'), condList);

  /* ------------------------------------------------ ataques */
  const armas = [];
  for (const it of (pc.inventario || [])) {
    if (it.equipado && (it.categoria === 'arma' || it.dano)) armas.push({ ...it, pericia: it.periciaId ? null : 'DX' });
  }
  for (const nat of db.equipment.ataquesNaturais || []) armas.push({ ...nat, id: nat.id || nat.nome, natural: true, pericia: nat.pericia?.includes('DX') ? 'DX' : null });
  if (!armas.length) armas.push({ id: 'soco', nome: 'Soco (mãos limpas)', dano: 'GDP-2', tipoDano: 'contusão', pericia: 'DX', fonte: 'p. 232' });

  const rdAlvo = el('input', { type: 'number', min: 0, value: 0, style: 'width:70px', 'aria-label': 'RD do alvo', title: 'Resistência a Dano do alvo' });
  const localSel = el('select', { 'aria-label': 'Local do impacto', title: 'Local de impacto' },
    ['Tronco', 'Cabeça', 'Cérebro', 'Braço', 'Perna', 'Mão', 'Pé', 'Órgãos vitais'].map(l => el('option', { value: l }, l)));
  const ataques = el('div', { class: 'panel' },
    el('h3', {}, 'Ataques (3d ≤ NH — p. 220–232)'),
    el('div', { class: 'btn-row', style: 'margin:0 0 .5rem' },
      el('span', { class: 'label' }, 'RD do alvo: '), rdAlvo, el('span', { class: 'label' }, 'Local: '), localSel),
    el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, ['Arma', 'NH', 'Dano', 'Ações'].map(h => el('th', {}, h)))),
      armas.map(a => {
        const nh = combatNH(db, pc, a, snap);
        const dano = danoArma(db, pc, a);
        const atacar = () => {
          const res = rolarAtaque(db, store.atual, a, {});
          const visual = dadosVisual(res.rolls, { crit: res.critico && res.sucesso, fail: res.critico && !res.sucesso });
          let extra = '';
          if (res.sucesso) {
            const av = avaliarDano(db, {
              danoExpr: dano.expr || '1D', tipoDano: dano.tipoDano, rd: parseInt(rdAlvo.value, 10) || 0,
              local: localSel.value, dm: dano.dm,
            });
            extra = ` → <b>dano ${av.final} PV</b> (${av.bruto} rolado − RD ${rdAlvo.value}${av.detalhes.find(d => d.fator) ? ' × mult.' : ''})`;
          }
          registrar(`${visual} <b>${a.nome}</b>: NH ${res.nhFinal}, rolou <b>${res.total}</b> — ${res.descricao}.${extra}`);
        };
        return el('tr', {},
          el('td', {}, el('strong', {}, a.nome), el('div', { class: 'meta fonte' }, `${dano.expr || 'N/D'} ${dano.tipoDano}${a.stMin ? ` · ST mín ${a.stMin}` : ''}${a.natural ? ' · ataque natural' : ''}`)),
          el('td', {}, valorCalculado(nh.total, [
            { fonte: nh.fonte, valor: nh.base },
            ...nh.modificadores.map(m => ({ fonte: m.fonte, valor: m.valor })),
          ])),
          el('td', {}, valorCalculado(dano.expr || '—', dano.breakdown.map(b => ({ fonte: b })), 'Dano da arma')),
          el('td', {}, el('button', { class: 'btn small primary', onclick: atacar }, '⚔ Atacar')),
        );
      }),
    ),
    el('p', { class: 'fonte' }, 'Golpes Fulminantes/Erros Críticos: REGRA NÃO DEFINIDA no material fornecido (tabelas não incluídas).'),
  );

  /* ------------------------------------------------ defesas */
  const esc = snap.escudo;
  const melhorAparar = melhorPericiaAparar(db, pc, snap);
  const bloq = bloqueio(pc, { db });
  const defesas = el('div', { class: 'panel' },
    el('h3', {}, 'Defesas (p. 224–231)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Esquiva'), valorCalculado(snap.esquiva, snap.deslocamento.breakdown.map(b => ({ fonte: b.fonte, valor: b.valor })), 'Esquiva = Deslocamento')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Aparar (melhor)'),
        melhorAparar ? valorCalculado(melhorAparar.valor, [{ fonte: `NH ${melhorAparar.base} em ${melhorAparar.nome}` }, { fonte: melhorAparar.fracao === 2 / 3 ? '× 2/3 (Bastão/Esgrima)' : '× ½ (p. 230)' }]) : el('div', { class: 'value' }, '—')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Bloqueio'), valorCalculado(bloq.valor, [{ fonte: bloq.nota }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Defesa Passiva'), valorCalculado(`${snap.defesaPassiva.dp}/${snap.defesaPassiva.rd}`,
        snap.defesaPassiva.parts.map(p => ({ fonte: p.fonte, valor: `DP ${p.dp}/RD ${p.rd}` })))),
    ),
    el('p', { class: 'fonte' }, 'Defesa ativa: 3d ≤ valor da defesa, 1× por turno (p. 224). Escudo grande equipado penaliza perícias (p. 195).' + (esc.escudoGrande ? ' [escudo grande detectado]' : '')),
  );

  /* ------------------------------------------------ log */
  const logPanel = el('div', { class: 'panel' }, el('h3', {}, 'Registro de combate'), log);

  main.append(
    el('h1', { class: 'page-title' }, '🗡️ Combate', el('small', {}, `carga ${snap.carga.nome} · ${fmtKg(snap.carga.peso.kg)}`)),
    el('div', { class: 'grid cols-2' }, vital, condicoes),
    ataques, defesas, logPanel,
  );
  desenharCond();
  if (!log.children.length) registrar('Combate iniciado. Turno = 1 segundo (p. 220).');
}

/* ---------------------------------------------------------------- helpers */

function combatNH(db, pc, arma) {
  return nhAtaque(db, pc, arma, {});
}

function melhorPericiaAparar(db, pc, snap) {
  let melhor = null;
  for (const p of snap.pericias) {
    if (p.nivelEfetivo === null) continue;
    const nome = (p.skill?.nome || '').toLowerCase();
    const fisica = p.skill?.tipo === 'Física' || /arma|espada|bastão|faca|lança|maça|machado|esgrima|briga|caratê|judô|adaga|rapieira|sabre|clava/.test(nome);
    if (!fisica) continue;
    try {
      const a = aparar(pc, p.entry, { db });
      if (a.valor === null) continue;
      if (!melhor || a.valor > melhor.valor) melhor = { ...a, nome: p.skill.nome };
    } catch { /* perícia sem aparar */ }
  }
  return melhor;
}

function aplicarDanoDireto(db, registrar) {
  const inpDano = el('input', { type: 'number', min: 0, value: 0, style: 'width:90px' });
  const inpRd = el('input', { type: 'number', min: 0, value: 0, style: 'width:70px' });
  const selLocal = el('select', {}, ['Tronco', 'Cabeça', 'Cérebro', 'Braço', 'Perna', 'Mão', 'Pé', 'Órgãos vitais'].map(l => el('option', { value: l }, l)));
  const selTipo = el('select', {}, ['contusão', 'corte', 'perfuração'].map(t => el('option', { value: t }, t)));
  modal('Sofrer dano', el('div', { class: 'grid cols-2' },
    el('label', { class: 'field' }, 'Dano rolado (PV brutos)', inpDano),
    el('label', { class: 'field' }, 'RD do alvo', inpRd),
    el('label', { class: 'field' }, 'Local', selLocal),
    el('label', { class: 'field' }, 'Tipo', selTipo),
  ), {
    acoes: [el('button', { class: 'btn primary', onclick: () => {
      const bruto = parseInt(inpDano.value, 10) || 0;
      const rd = parseInt(inpRd.value, 10) || 0;
      let av = null, res = null;
      store.update(p => {
        av = avaliarDano(db, { bruto, tipoDano: selTipo.value, rd, local: selLocal.value });
        res = aplicarFerimento(db, p, av);
        p.combate.ferimentos = res.ferimentos;
      });
      const multTxt = av.detalhes.find(d => d.fator) ? ` (×${av.detalhes.find(d => d.fator).fator})` : '';
      registrar(`Dano sofrido: ${bruto} − RD ${rd}${multTxt} = <b>${av.final} PV</b>. ${res.eventos.join(' ')} ${res.efeitos.map(e => `[${e.tipo}]`).join(' ')}`);
      document.querySelector('.modal-back')?.remove();
    } }, 'Aplicar')],
  });
}

function testeHT(db, registrar) {
  const res = dice.check(store.atual.atributos.HT, { label: 'Teste de HT' });
  registrar(`${dadosVisual(res.rolls)} Teste de HT ${store.atual.atributos.HT}: <b>${res.total}</b> — ${res.descricao}.`);
}

function estadoAviso(cb) {
  if (cb.estadoFadiga.estado !== 'normal') return el('p', { class: 'pill warn', style: 'margin-top:.5rem' }, `FADIGA — ${cb.estadoFadiga.estado}: ${cb.estadoFadiga.nota} (ST efetiva ${cb.stEfetiva})`);
  return '';
}
