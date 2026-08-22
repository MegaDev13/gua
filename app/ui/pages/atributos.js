/* Aba ATRIBUTOS — valores, custos, derivados com breakdown completo. */
import { el, valorCalculado, fmtKg } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { ATRIBUTOS, custoAtributo, danoBasico, velocidadeBasica, limitesDeForca } from '../../engine/attributes.js';

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
    painelAtributos, derivados, forca,
  );
}
