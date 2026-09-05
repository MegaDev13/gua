/* Aba PROEZAS — proezas físicas, sentidos, vontade e pânico (G.A.U).
 * Fonte: PROEZAS FÍSICAS / TESTES DOS SENTIDOS / TESTES DE VONTADE / VERIFICAÇÃO DE PÂNICO
 * (data/proezas.json). Todos os cálculos vêm de app/engine/proezas.js.
 */
import { el, toast, valorCalculado, fmtKg } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import {
  corrida, esforcoExtra, saltar, escalar, tiposDeEscalada, limitesDeLevantamento, levantar,
  derrubarObjeto, arremessarObjeto, apanharObjeto, cavar, ritmosDeEscavacao, nadar,
  velocidadeDeNado, salvarAfogado, testeDeSentido, sentidosDisponiveis, testeDeVontade,
  verificacaoDePanicoCompleta, tabelaDePanico,
} from '../../engine/proezas.js';
import { penalidadeDeLuz } from '../../engine/resolution.js';

const numero = (id, padrao = 0) => {
  const campo = document.getElementById(id);
  return campo ? (parseFloat(String(campo.value).replace(',', '.')) || padrao) : padrao;
};

export function renderProezas(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const saida = el('div', { class: 'panel', id: 'proezas-saida' },
    el('p', { class: 'fonte' }, 'Escolha uma proeza e role. Os resultados aparecem aqui com a regra publicada e o cálculo completo.'));

  const imprimir = (titulo, blocos) => {
    saida.innerHTML = '';
    saida.append(el('h3', {}, titulo), ...blocos);
  };
  const linha = (rotulo, valor) => el('div', { class: 'row', style: 'justify-content:space-between' }, el('span', {}, rotulo), el('strong', {}, String(valor)));
  const jogadaBox = (j) => j ? el('div', { class: 'card' },
    el('div', { class: 'row', style: 'justify-content:space-between' },
      el('strong', {}, j.rotulo),
      el('span', { class: `pill ${j.sucesso ? 'ok' : 'bad'}` }, j.tipo),
    ),
    el('div', {}, `d20: ${j.rolls.join(', ')} → ${j.valor}`),
    el('div', { class: 'fonte' }, `Margem de sucesso ${j.margem.texto} (crítico ${j.margem.critico}) · referência ${j.referencia}`),
    j.modificadores?.length ? el('ul', { class: 'lista' }, ...j.modificadores.map(m => el('li', {}, `${m.fonte}: ${m.valor > 0 ? '+' : ''}${m.valor}`))) : '',
    el('div', {}, j.descricao),
  ) : '';

  main.append(
    el('h1', { class: 'page-title' }, '🏃 Proezas'),
    painelMovimento(db, pc, snap, imprimir, linha),
    painelForca(db, pc, snap, imprimir, linha, jogadaBox),
    painelAgua(db, pc, imprimir, linha, jogadaBox),
    painelSentidos(db, pc, snap, imprimir, jogadaBox),
    painelPanico(db, pc, imprimir, jogadaBox),
    saida,
  );
}

/* ------------------------------------------------------------------ movimento */

function painelMovimento(db, pc, snap, imprimir, linha) {
  const cor = corrida(db, pc, { niveisPericias: snap.niveis });
  return el('div', { class: 'panel' },
    el('h3', {}, 'Corrida, deslocamento e esforço extra'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Corrida (DSL)'), valorCalculado(cor.corrida, cor.breakdownCorrida)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Caminhada'), valorCalculado(cor.caminhada, cor.breakdownCaminhada)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PF disponíveis'), valorCalculado(snap.gau.pf.disponiveis, [{ fonte: 'PF = HT', valor: snap.gau.pf.max }, { fonte: '− fadiga', valor: -snap.gau.pf.fadiga }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Estado'), el('div', { class: 'value' }, snap.combate.estadoFadiga.estado)),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn small', onclick: () => {
        const e = esforcoExtra(db, pc, { usos: numero('esforco-usos', 1) });
        imprimir('Esforço Extra', [
          linha('Usos', e.usos), linha('Custo', `${e.custoPF} PF`),
          linha('PF restantes', e.pfRestante ?? '—'),
          e.excedePF ? el('p', { class: 'aviso bad' }, 'O gasto excede a reserva de PF (PF = HT).') : '',
          el('p', { class: 'fonte' }, e.regra),
          el('ul', { class: 'lista' }, ...(e.usosPublicados || []).map(u => el('li', {}, u))),
          el('div', { class: 'btn-row' }, el('button', { class: 'btn small', onclick: () => {
            store.update(p => { p.combate.fadiga = Math.min(e.pfRestante != null ? (p.atributos.HT - e.pfRestante) : p.combate.fadiga, p.atributos.HT); });
            store.historico('fadiga', `Esforço Extra: −${e.custoPF} PF.`);
            toast(`${e.custoPF} PF gastos.`);
          } }, 'Aplicar gasto de PF')),
        ]);
      } }, 'Esforço Extra'),
      el('input', { id: 'esforco-usos', type: 'number', value: 1, min: 1, style: 'width:5rem', 'aria-label': 'Usos de esforço extra' }),
      el('button', { class: 'btn small ghost', onclick: () => {
        const metros = numero('salto-metros', 1.5);
        const r = saltar(db, pc, { metros, sobrenatural: document.getElementById('salto-sobre')?.checked, comCarga: document.getElementById('salto-carga')?.checked });
        imprimir(`Salto — ${metros} m`, r.permitido === false
          ? [el('p', { class: 'aviso bad' }, r.motivo), el('p', { class: 'fonte' }, r.alternativa)]
          : [linha('Referência', `${r.referencia} (${r.base})`), linha('Limite mundano', `${r.limite.metros} m`),
             r.jogada ? blocoJogada(r.jogada) : '', el('p', { class: 'fonte' }, r.regra),
             r.parabola ? el('p', { class: 'fonte' }, r.parabola) : '']);
      } }, 'Saltar'),
      el('input', { id: 'salto-metros', type: 'number', value: 1.5, step: 0.5, min: 0, style: 'width:6rem', 'aria-label': 'Metros do salto' }),
      el('label', { class: 'chk' }, el('input', { id: 'salto-sobre', type: 'checkbox' }), 'sobrenatural'),
      el('label', { class: 'chk' }, el('input', { id: 'salto-carga', type: 'checkbox' }), 'com carga'),
    ),
    el('p', { class: 'fonte' }, 'Para personagens sem características sobrenaturais o salto se limita a 1,5 m. Apanhar objeto leve (≤ ST/2) usa a manobra Preparar (1 s); objeto pesado exige 2 s.'),
    el('div', { class: 'btn-row' },
      el('input', { id: 'apanhar-kg', type: 'number', value: 3, min: 0, style: 'width:6rem', 'aria-label': 'Peso do objeto em kg' }),
      el('button', { class: 'btn small ghost', onclick: () => {
        const r = apanharObjeto(db, pc, { pesoKg: numero('apanhar-kg', 0) });
        imprimir('Apanhar objeto em combate', [
          linha('Peso', fmtKg(r.pesoKg)), linha('Leve (≤ ST/2)', r.leve ? 'sim' : 'não'),
          linha('Tempo', `${r.segundos} s`), linha('Manobra', r.manobra), el('p', { class: 'fonte' }, r.regra),
        ]);
      } }, 'Calcular'),
    ),
  );
}

function blocoJogada(j) {
  return el('div', { class: 'card' },
    el('div', { class: 'row', style: 'justify-content:space-between' },
      el('strong', {}, j.rotulo || 'Teste'),
      el('span', { class: `pill ${j.sucesso ? 'ok' : 'bad'}` }, j.tipo),
    ),
    el('div', {}, `d20: ${(j.rolls || []).join(', ')} → ${j.valor}`),
    el('div', { class: 'fonte' }, `Margem ${j.margem?.texto} · crítico ${j.margem?.critico} · referência ${j.referencia}`),
    (j.modificadores || []).length ? el('ul', { class: 'lista' }, ...j.modificadores.map(m => el('li', {}, `${m.fonte}: ${m.valor > 0 ? '+' : ''}${m.valor}`))) : '',
    el('div', {}, j.descricao || ''),
  );
}

/* ------------------------------------------------------------------ força */

function painelForca(db, pc, snap, imprimir, linha, jogadaBox) {
  const limites = limitesDeLevantamento(db, pc.atributos.ST);
  return el('div', { class: 'panel' },
    el('h3', {}, 'Escalada, levantamento, empurrar e arremesso'),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('label', {}, 'Superfície', el('select', { id: 'escalada-tipo' }, ...tiposDeEscalada(db).map(t => el('option', { value: t.tipo }, t.tipo)))),
      el('label', { class: 'chk' }, el('input', { id: 'escalada-longa', type: 'checkbox' }), 'escalada longa'),
      el('button', { class: 'btn small', onclick: () => {
        const r = escalar(db, pc, { tipo: document.getElementById('escalada-tipo').value, longa: document.getElementById('escalada-longa').checked });
        imprimir(`Escalada — ${r.tipo?.tipo || ''}`, [
          linha('Referência', `${r.referencia} (${r.base})`),
          r.semJogada ? el('p', { class: 'pill ok' }, 'Sem jogada necessária') : jogadaBox(r.jogada),
          r.velocidade ? linha('Velocidade', `${r.velocidade.velocidade} (${r.velocidade.modo})`) : '',
          el('p', { class: 'fonte' }, r.testes), el('p', { class: 'fonte' }, r.falha),
        ]);
      } }, 'Escalar'),
    ),
    el('table', { class: 'tbl' },
      el('tr', {}, ['Limite', 'Fórmula', `ST ${pc.atributos.ST}`].map(h => el('th', {}, h))),
      ...limites.map(l => el('tr', {},
        el('td', {}, l.nome), el('td', { class: 'fonte' }, l.formula),
        el('td', { class: 'num' }, l.kg != null ? fmtKg(l.kg) + (l.kgComImpulso ? ` (${fmtKg(l.kgComImpulso)} c/ impulso)` : '') : '—'))),
    ),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('input', { id: 'levantar-kg', type: 'number', value: 100, min: 0, style: 'width:7rem', 'aria-label': 'Peso em kg' }),
      el('select', { id: 'levantar-modo' }, ...limites.filter(l => l.kg != null).map(l => el('option', { value: l.id }, l.nome))),
      el('button', { class: 'btn small', onclick: () => {
        const r = levantar(db, pc, { pesoKg: numero('levantar-kg', 0), modo: document.getElementById('levantar-modo').value });
        if (r.erro) { toast(r.erro, 'erro'); return; }
        imprimir('Levantar e mover objeto', [
          linha('Peso', fmtKg(r.pesoKg)), linha('Capacidade', fmtKg(r.capacidade)),
          el('p', { class: r.dentroDoLimite ? 'pill ok' : 'aviso bad' }, r.resultado),
          r.testeDeST ? el('p', { class: 'fonte' }, r.testeDeST) : '',
        ]);
      } }, 'Levantar'),
      el('button', { class: 'btn small ghost', onclick: () => {
        const r = derrubarObjeto(db, pc, { pesoKg: numero('levantar-kg', 0), comImpulso: true });
        imprimir('Empurrar / derrubar objeto', [
          linha('Peso', fmtKg(r.pesoKg)), linha('Limite', fmtKg(r.limite)),
          el('p', { class: r.dentroDoLimite ? 'pill ok' : 'aviso bad' }, r.dentroDoLimite ? 'Dentro do limite (13×ST, dobrado com impulso).' : 'Acima do limite — exige esforço extra ou ajuda.'),
          el('p', { class: 'fonte' }, r.regra), el('p', { class: 'fonte' }, r.impulso),
        ]);
      } }, 'Derrubar (com impulso)'),
    ),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('input', { id: 'arr-peso', type: 'number', value: 10, min: 0, style: 'width:7rem', 'aria-label': 'Peso do objeto arremessado' }),
      el('label', { class: 'chk' }, el('input', { id: 'arr-pericia', type: 'checkbox' }), 'perícia Arremesso'),
      el('button', { class: 'btn small', onclick: () => {
        const r = arremessarObjeto(db, { st: pc.atributos.ST, pesoKg: numero('arr-peso', 0), periciaArremesso: document.getElementById('arr-pericia').checked });
        imprimir('Arremesso de objeto', [
          linha('Dano', r.dano.expr ? `${r.dano.expr} (média ${r.dano.media})` : r.dano.erro || '—'),
          linha('Coluna de peso', r.dano.coluna),
          linha('Distância', `${r.distancia.metros} m — ${r.distancia.formula}`),
          linha('Pode arremessar?', r.podeArremessar ? 'sim (≤ 13×ST)' : 'não'),
          el('p', { class: 'fonte' }, `Para atingir: ${r.testeParaAtingir.join(' ou ')}.`),
          el('p', { class: 'fonte' }, r.emCombate || ''),
        ]);
      } }, 'Arremessar'),
    ),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('select', { id: 'cavar-sit' }, ...ritmosDeEscavacao(db).map(r => el('option', { value: r.situacao }, r.situacao))),
      el('input', { id: 'cavar-horas', type: 'number', value: 1, min: 0.1, step: 0.5, style: 'width:6rem', 'aria-label': 'Horas cavando' }),
      el('button', { class: 'btn small ghost', onclick: () => {
        const r = cavar(db, { st: pc.atributos.ST, situacao: document.getElementById('cavar-sit').value, horas: numero('cavar-horas', 1) });
        imprimir('Cavar', [
          linha('Ritmo', `${r.metrosCubicosPorHora} m³/h (${r.formula})`),
          linha(`Em ${r.horas} h`, `${r.metrosCubicos} m³`),
          el('p', { class: 'fonte' }, `Fadiga por hora: ${JSON.stringify(r.fadiga?.custoPorHora || {})}`),
          el('ul', { class: 'lista' }, ...(r.notas || []).map(n => el('li', {}, n))),
        ]);
      } }, 'Cavar'),
    ),
  );
}

/* ------------------------------------------------------------------ água */

function painelAgua(db, pc, imprimir, linha, jogadaBox) {
  return el('div', { class: 'panel' },
    el('h3', {}, 'Natação e salvamento'),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('label', { class: 'chk' }, el('input', { id: 'nado-intencional', type: 'checkbox' }), 'entrada intencional'),
      el('label', { class: 'chk' }, el('input', { id: 'nado-combate', type: 'checkbox' }), 'em combate'),
      el('label', { class: 'chk' }, el('input', { id: 'nado-submerso', type: 'checkbox' }), 'submerso'),
      el('button', { class: 'btn small', onclick: () => {
        const r = nadar(db, pc, {
          entradaIntencional: document.getElementById('nado-intencional').checked,
          emCombate: document.getElementById('nado-combate').checked,
          submerso: document.getElementById('nado-submerso').checked,
        });
        imprimir('Natação', [
          linha('Referência', `${r.referencia} (${r.base})`),
          jogadaBox(r.jogada),
          el('p', { class: 'fonte' }, r.falha.regra),
          linha('Intervalo de teste', `${r.intervaloDeTeste} s`),
          el('p', { class: 'fonte' }, r.velocidade?.curtaDistancia || ''),
          el('p', { class: 'fonte' }, r.combateNaAgua?.regra || ''),
        ]);
      } }, 'Nadar'),
      el('button', { class: 'btn small ghost', onclick: () => {
        const v = velocidadeDeNado(db, { nhNatacao: numero('nado-nh', 10), nivelDeCarga: 0 });
        imprimir('Velocidade de nado', [
          linha('Curta distância', `${v.curtaDistancia} m/s (metade do NH, arredondado para cima)`),
          linha('Longa distância', `${v.longaDistanciaEm10s} m em 10 s (NH − 2× Carga)`),
          el('p', { class: 'fonte' }, v.fadiga),
        ]);
      } }, 'Velocidade'),
      el('input', { id: 'nado-nh', type: 'number', value: 10, min: 0, style: 'width:6rem', 'aria-label': 'NH em Natação' }),
    ),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('input', { id: 'salvar-st', type: 'number', value: 10, min: 0, style: 'width:6rem', 'aria-label': 'ST da vítima' }),
      el('input', { id: 'salvar-nh', type: 'number', value: 12, min: 0, style: 'width:6rem', 'aria-label': 'NH em Natação do salvador' }),
      el('button', { class: 'btn small', onclick: () => {
        const r = salvarAfogado(db, pc, { stVitima: numero('salvar-st', 10), nhNatacao: numero('salvar-nh', null) });
        imprimir('Salvar afogado', [
          linha('Referência', r.referencia),
          jogadaBox(r.jogada),
          el('p', { class: r.jogada.sucesso ? 'pill ok' : 'aviso bad' }, r.consequencia),
          el('p', { class: 'fonte' }, r.regra),
        ]);
      } }, 'Resgatar'),
    ),
    el('p', { class: 'fonte' }, 'Salvamento: Natação com −5, mais ou menos a diferença entre a ST do salvador e a da vítima.'),
  );
}

/* ------------------------------------------------------------------ sentidos */

function painelSentidos(db, pc, snap, imprimir, jogadaBox) {
  const niveis = db.maneuvers?.luminosidade?.tabela || [];
  return el('div', { class: 'panel' },
    el('h3', {}, 'Sentidos (Visão · Audição · Olfato/Paladar — todos contra IQ)'),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('select', { id: 'sentido' }, ...sentidosDisponiveis(db).map(s => el('option', { value: s.id }, s.nome))),
      el('select', { id: 'luz' }, ...niveis.map(l => el('option', { value: l.id }, `${l.nivel} (${l.penalidadeMin} a ${l.penalidadeMax})`))),
      el('button', { class: 'btn small', onclick: () => {
        const luz = penalidadeDeLuz(db, document.getElementById('luz').value);
        const r = testeDeSentido(db, pc, { sentido: document.getElementById('sentido').value, luz });
        imprimir(`Sentido — ${r.sentido.nome}`, [
          linha('Referência', `${r.nh} (${r.base})`),
          jogadaBox(r.jogada),
          r.sentido.limites ? el('p', { class: 'fonte' }, r.sentido.limites) : '',
          r.sentido.modificadoresNegativos ? el('ul', { class: 'lista' }, ...r.sentido.modificadoresNegativos.map(m => el('li', {}, m))) : '',
          el('p', { class: 'fonte' }, r.nota),
        ]);
      } }, 'Testar sentido'),
    ),
    el('div', { class: 'btn-row' },
      el('input', { id: 'vontade-motivo', type: 'text', placeholder: 'Situação (ex.: fobia, intimidação)', style: 'min-width:14rem', 'aria-label': 'Motivo do teste de Vontade' }),
      el('label', { class: 'chk' }, el('input', { id: 'vontade-combate', type: 'checkbox' }), 'no calor da batalha (+5)'),
      el('label', { class: 'chk' }, el('input', { id: 'vontade-fobia', type: 'checkbox' }), 'fobia grave (−4)'),
      el('button', { class: 'btn small', onclick: () => {
        const r = testeDeVontade(db, pc, {
          motivo: document.getElementById('vontade-motivo').value || null,
          emCombate: document.getElementById('vontade-combate').checked,
          fobiaGrave: document.getElementById('vontade-fobia').checked,
        });
        imprimir('Teste de Vontade', [
          linha('Referência', `${r.referencia} (VON = IQ)`),
          jogadaBox(r.jogada),
          el('p', { class: 'fonte' }, r.regra),
        ]);
      } }, 'Testar Vontade'),
    ),
  );
}

/* ------------------------------------------------------------------ pânico */

function painelPanico(db, pc, imprimir, jogadaBox) {
  const tabela = tabelaDePanico(db);
  return el('div', { class: 'panel' },
    el('h3', {}, 'Verificação de Pânico'),
    el('p', { class: 'fonte' }, tabela.regra),
    el('div', { class: 'btn-row' },
      el('label', { class: 'chk' }, el('input', { id: 'panico-combate', type: 'checkbox' }), 'no calor da batalha (+5)'),
      el('label', { class: 'chk' }, el('input', { id: 'panico-fobia', type: 'checkbox' }), 'objeto de fobia grave (−4)'),
      el('button', { class: 'btn', onclick: () => {
        const r = verificacaoDePanicoCompleta(db, pc, {
          emCombate: document.getElementById('panico-combate').checked,
          fobiaGrave: document.getElementById('panico-fobia').checked,
        });
        imprimir('Verificação de Pânico', [
          jogadaBox(r.jogada),
          r.panico ? el('div', { class: 'card' },
            el('div', {}, `3d: ${r.panico.rolls.join(', ')} = ${r.panico.total3d} + margem da falha ${r.panico.margemDaFalha} → ${r.panico.total}`),
            el('strong', {}, r.resultado || '—'),
          ) : el('p', { class: 'pill ok' }, 'Manteve a compostura — sem consulta à tabela.'),
          el('p', { class: 'fonte' }, tabela.consequencias),
        ]);
      } }, 'Verificar pânico'),
      el('button', { class: 'btn ghost', onclick: () => {
        imprimir('Tabela de Pânico (3d + margem da falha)', [
          el('div', { class: 'scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, ['Resultado', 'Efeito'].map(h => el('th', {}, h))),
            ...tabela.tabela.map(l => el('tr', {}, el('td', { class: 'num' }, l.resultado), el('td', {}, l.efeito)))),
          ),
        ]);
      } }, 'Ver tabela'),
    ),
  );
}
