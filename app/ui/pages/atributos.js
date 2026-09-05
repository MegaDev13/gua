/* Aba ATRIBUTOS — valores, custos, derivados com breakdown completo. */
import { el, valorCalculado, fmtKg } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { ATRIBUTOS, custoAtributo, danoBasico, velocidadeBasica, limitesDeForca } from '../../engine/attributes.js';
import { margemDeSucesso } from '../../engine/resolution.js';

const NOMES = { ST: 'Força', DX: 'Destreza', IQ: 'Inteligência', HT: 'Vitalidade' };
const DESCR = {
  ST: 'Força muscular; fadiga = ST; dano básico baseado em ST.',
  DX: 'Agilidade e coordenação; base das perícias físicas e da Velocidade.',
  IQ: 'Capacidade mental e experiência; base das perícias mentais e magia.',
  HT: 'Energia e saúde; pontos de vida = HT.',
};

export function renderAtributos(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);

  const painelAtributos = el('div', { class: 'panel' },
    el('h3', {}, 'Atributos Básicos (p. 1–5)'),
    el('table', { class: 'tbl' },
      el('tr', {}, ['Atributo', 'Valor', 'Custo', 'Papel'].map(h => el('th', {}, h))),
      ATRIBUTOS.map(a => {
        const v = pc.atributos[a.key];
        const custo = custoAtributo(db, v);
        return el('tr', {},
          el('td', {}, el('strong', {}, `${a.key} — ${NOMES[a.key]}`)),
          el('td', {},
            el('input', {
              type: 'number', min: 1, max: 20, value: v, 'aria-label': `Valor de ${NOMES[a.key]}`,
              onchange: e => {
                const nv = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 10));
                store.update(p => p.atributos[a.key] = nv);
              },
            })),
          el('td', { class: 'num' }, custo === null ? 'N/D' : `${custo > 0 ? '+' : ''}${custo}`),
          el('td', { style: 'color:var(--ink-dim);font-size:.8rem' }, DESCR[a.key]),
        );
      }),
    ),
    el('p', { class: 'fonte' }, 'Custos 1–20 conforme tabela do material (p. 1–2). Valores acima de 20: REGRA NÃO DEFINIDA no material. Mudanças recalculam automaticamente derivados, perícias, combate, carga e magias.'),
  );

  const d = snap;
  const bdVel = [
    { fonte: `DX ${pc.atributos.DX} + HT ${pc.atributos.HT}`, valor: pc.atributos.DX + pc.atributos.HT },
    { fonte: '÷ 4 (não arredonda — p. 3)', valor: `= ${velocidadeBasica(pc.atributos)}` },
  ];
  const derivados = el('div', { class: 'panel' },
    el('h3', {}, 'Atributos Derivados'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Velocidade Básica'), valorCalculado(d.velocidadeBasica, bdVel)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Deslocamento'), valorCalculado(d.deslocamento.valor, d.deslocamento.breakdown)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Esquiva'), valorCalculado(d.esquiva, [{ fonte: 'Esquiva = Deslocamento (p. 228)' }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Carga'), valorCalculado(`${d.carga.nome}`, [{ fonte: `Peso carregado: ${fmtKg(d.carga.peso.kg)}` }, { fonte: `Limite do nível: ${d.carga.limite}` }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Dano GDP'), valorCalculado(d.danoBasico.gdp, [{ fonte: 'Tabela por ST (p. 190)' }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Dano Balanço'), valorCalculado(d.danoBasico.bal, [{ fonte: 'Tabela por ST (p. 190)' }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Defesa Passiva'), valorCalculado(d.defesaPassiva.dp, d.defesaPassiva.parts.map(p => ({ fonte: p.fonte, valor: `DP ${p.dp} / RD ${p.rd}` })))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Resist. a Dano (RD)'), valorCalculado(d.defesaPassiva.rd, d.defesaPassiva.parts.map(p => ({ fonte: p.fonte, valor: p.rd })))),
    ),
  );

  const lf = snap.limitesForca;
  const forca = el('div', { class: 'panel' },
    el('h3', {}, 'Limites de Força (p. 210)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Erguer 1 mão'), el('div', { class: 'value' }, fmtKg(lf.umaMao))),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Erguer 2 mãos'), el('div', { class: 'value' }, fmtKg(lf.duasMaos))),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Nas costas (máx.)'), el('div', { class: 'value' }, fmtKg(lf.costas))),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Empurrar'), el('div', { class: 'value' }, fmtKg(lf.empurrar))),
    ),
  );

  main.append(
    el('h1', { class: 'page-title' }, '🎲 Atributos'),
    painelAtributos, secundariosGAU(snap), parametrosGAU(snap), painelMargens(db, pc, snap), derivados, forca,
  );
}

/* ------------------------------------------------------------------ G.A.U. (d20) */

/** Secundários da planilha oficial: PV = ST × HT · VON = IQ · PER = IQ · PF = HT. */
function secundariosGAU(snap) {
  const s = snap.secundarios;
  const stat = (rotulo, bloco, extra = '') => el('div', { class: 'stat' },
    el('div', { class: 'label' }, `${rotulo} (${bloco.formula || ''})`),
    valorCalculado(bloco.valor, bloco.breakdown || [{ fonte: rotulo, valor: bloco.valor }]),
    extra ? el('div', { class: 'label' }, extra) : '');
  return el('div', { class: 'panel' },
    el('h3', {}, 'Secundários (ficha oficial G.A.U.)'),
    el('div', { class: 'grid cols-4' },
      stat('PV', s.PV, `atual ${s.PV.atual} · ferimentos ${s.PV.ferimentos}`),
      stat('VON', s.VON),
      stat('PER', s.PER),
      stat('PF', s.PF, `atual ${s.PF.atual} · fadiga ${s.PF.fadiga}`),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'RD de poderes'), el('div', { class: 'value' }, String(s.RD.valor))),
    ),
    el('p', { class: 'fonte' }, 'Fontes: data/ficha.json → secundarios. Ferimentos reduzem PV; a fadiga reduz a reserva de PF (PF = HT).'),
  );
}

/** Parâmetros da planilha: ATQ, ESQ, DSL, APAR, BLOQ. */
function parametrosGAU(snap) {
  const p = snap.parametros;
  const celula = (id) => {
    const bloco = p[id];
    const def = (p.definicoes || []).find(d => d.id === id);
    return el('div', { class: 'stat' },
      el('div', { class: 'label' }, `${id} — ${def?.nome || id}`),
      valorCalculado(bloco.valor, bloco.breakdown, `Como ${id} foi calculado`),
      el('div', { class: 'label' }, `margem ${bloco.margem?.texto ?? '—'} · crítico ${bloco.margem?.critico ?? '—'}`),
      el('div', { class: 'label', style: 'font-size:.7rem' }, def?.base || ''),
      bloco.aviso ? el('div', { class: 'label', style: 'color:var(--warn)' }, '⚠ regra não definida') : '');
  };
  return el('div', { class: 'panel' },
    el('h3', {}, 'Parâmetros'),
    el('div', { class: 'grid cols-5' }, celula('ATQ'), celula('ESQ'),
      el('div', { class: 'stat' },
        el('div', { class: 'label' }, 'DSL — Deslocamento'),
        valorCalculado(p.DSL.valor, p.DSL.breakdown, 'Como DSL foi calculado'),
        el('div', { class: 'label' }, `caminhada ${p.DSL.caminhada} (metade, arredondada para cima)`)),
      celula('APAR'), celula('BLOQ')),
    el('p', { class: 'fonte' }, p._aviso || 'Os parâmetros usam a referência publicada (atributo-base ou NH da arma). Clique em cada valor para ver o cálculo.'),
  );
}

/** Margens de sucesso do d20: o valor do atributo É a referência (não há CD arbitrária). */
function painelMargens(db, pc, snap) {
  return el('div', { class: 'panel' },
    el('h3', {}, 'Margens de sucesso (d20)'),
    el('table', { class: 'tbl' },
      el('tr', {}, ['Referência', 'Margem de sucesso', 'Valor crítico'].map(h => el('th', {}, h))),
      ...['ST', 'DX', 'IQ', 'HT'].map(k => el('tr', {},
        el('td', {}, `${k} ${pc.atributos[k]}`),
        el('td', { class: 'num' }, snap.gau.margens[k].texto),
        el('td', { class: 'num' }, String(snap.gau.margens[k].critico)))),
      ...Object.entries(snap.niveis || {}).filter(([nome]) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(nome)).slice(0, 14).map(([nome, nh]) => {
        const m = margemDeSucesso(db, nh);
        return el('tr', {},
          el('td', {}, `${nome} (NH ${nh})`),
          el('td', { class: 'num' }, m.texto),
          el('td', { class: 'num' }, String(m.critico)));
      }),
    ),
    el('p', { class: 'fonte' }, 'O próprio valor do atributo/habilidade determina a referência da jogada; o crítico é exatamente o valor da referência. 1 e 20, sozinhos, não decidem nada.'),
  );
}
