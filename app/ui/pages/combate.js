/* Aba COMBATE — dois modos:
 *  · G.A.U. (d20, padrão): árvore de manobras, referência × margem de sucesso, Grau de Dano,
 *    defesas ativas como disputas, luminosidade, combate montado e em veículos.
 *    Fontes: data/maneuvers.json, data/armas.json, data/resolucao.json.
 *  · Legado 3d (GURPS 3ª ed.): mantido como material subsidiário (data/rules.json → material).
 * Toda a matemática vem do engine (maneuvers.js, derived.js, damage.js, combat.js, fatigue.js).
 */
import { el, toast, modal, valorCalculado, dadosVisual, fmtKg } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { dice, aparar, bloqueio, rolarAtaque, nhAtaque, danoArma, avaliarDano, aplicarFerimento } from '../../engine/combat.js';
import { gastarFadiga, recuperarFadiga, custoFadiga } from '../../engine/fatigue.js';
import {
  listaManobras, acharManobra, filhosDe, efeitosDeManobra, executarAtaque, defender,
  empunhaduras, bonusDeApontar, CONDICOES_GAU, manobraPermitida, resolverArma,
} from '../../engine/maneuvers.js';
import { arsenal, armasPorEra, grauDeDano, precisaoDaArma } from '../../engine/damage.js';
import { disputa, disputaNormal, penalidadeDeLuz, margemDeSucesso } from '../../engine/resolution.js';
import { parametros } from '../../engine/derived.js';

let dbAtual = null;

const CONDICOES_LEGADO = [
  { id: 'prostrado', nome: 'Prostrado', nota: 'Cai no chão; −2 defesa (p. 280)' },
  { id: 'membro-incapacitado', nome: 'Membro incapacitado', nota: 'Braço/perna/mão/pé fora de uso (p. 280-281)' },
];

/* estado local da aba (não persistido: é a mesa de jogo do momento) */
const mesa = {
  manobra: 'ataque-simples',
  arma: null,
  empunhadura: null,
  segundosApontando: 0,
  armaFirmada: false,
  luz: 'luz-total',
  distancia: null,
  rdAlvo: 0,
  local: 'Torso',
  montado: false,
  nhCavalgar: 10,
  ultimaJogada: null,
};

export function renderCombate(main, { db }) {
  dbAtual = db;
  const pc = store.atual;
  const modo = pc.config?.modoCombate || 'gau';
  const snap = computeAll(db, pc);
  const log = el('div', { class: 'list', id: 'combateLog', style: 'max-height:340px;overflow:auto' });
  const registrar = (conteudo) => {
    log.prepend(typeof conteudo === 'string' ? el('div', { class: 'row' }, el('span', { class: 'grow', html: conteudo })) : conteudo);
  };

  main.append(
    el('h1', { class: 'page-title' }, '🗡️ Combate',
      el('small', {}, `carga ${snap.carga.nome} · ${fmtKg(snap.carga.peso.kg)}`),
      el('span', { class: 'pill' }, modo === 'gau' ? 'G.A.U. · d20' : 'Legado · 3d')),
    el('div', { class: 'btn-row' },
      el('button', { class: `btn small ${modo === 'gau' ? 'primary' : 'ghost'}`, onclick: () => { store.update(p => { p.config.modoCombate = 'gau'; }); } }, 'G.A.U. (d20)'),
      el('button', { class: `btn small ${modo === 'legado' ? 'primary' : 'ghost'}`, onclick: () => { store.update(p => { p.config.modoCombate = 'legado'; }); } }, 'Legado (3d)'),
    ),
  );

  if (modo === 'gau') renderGAU(main, { db, pc, snap, registrar, log });
  else renderLegado(main, { db, pc, snap, registrar, log });

  if (!log.children.length) {
    registrar(modo === 'gau'
      ? 'Combate G.A.U. iniciado. A sequência do turno é determinada pelo deslocamento (maior primeiro).'
      : 'Combate legado iniciado. Turno = 1 segundo (p. 220).');
  }
}

/* ================================================================== G.A.U. (d20) */

function renderGAU(main, { db, pc, snap, registrar, log }) {
  main.append(
    painelSequencia(db, snap),
    painelEstadoGAU(db, pc, snap, registrar),
    painelArvore(db, pc, snap, registrar),
    painelAtaqueGAU(db, pc, snap, registrar),
    painelDefesasGAU(db, pc, snap, registrar),
    painelDisputas(db, pc, registrar),
    painelReferencia(db, snap),
    painelMontado(db, pc, snap),
    el('div', { class: 'panel' }, el('h3', {}, 'Registro de combate'), log),
  );
}

function painelSequencia(db, snap) {
  const seq = db.maneuvers?.sequencia || {};
  const tipos = db.maneuvers?.tiposCombate || {};
  return el('div', { class: 'panel' },
    el('h3', {}, 'Sequência do turno e tipos de combate'),
    el('div', { class: 'grid cols-2' },
      el('div', {},
        el('strong', {}, 'Ordem do turno'),
        el('ol', { class: 'lista' }, ...(seq.ordem || seq.passos || []).map(p => el('li', {}, typeof p === 'string' ? p : p.nome || p.texto || ''))),
        seq.regra ? el('p', { class: 'fonte' }, seq.regra) : '',
        seq.desempate ? el('p', { class: 'fonte' }, seq.desempate) : ''),
      el('div', {},
        el('strong', {}, 'Tipos de combate'),
        el('ul', { class: 'lista' }, ...(tipos.lista || []).map(t => el('li', {}, el('strong', {}, t.nome || t.id), ` — ${t.descricao || ''}`))),
        tipos.regra ? el('p', { class: 'fonte' }, tipos.regra) : ''),
    ),
    el('p', { class: 'fonte' }, `Deslocamento (DSL): corrida ${snap.parametros.DSL.valor} m · caminhada ${snap.parametros.DSL.caminhada} m.`),
  );
}

function painelEstadoGAU(db, pc, snap, registrar) {
  const sec = snap.secundarios;
  const ativas = pc.combate?.condicoes || [];
  const condicoes = [...CONDICOES_GAU, ...CONDICOES_LEGADO];
  return el('div', { class: 'panel' },
    el('h3', {}, 'Estado vital (PV = ST × HT · PF = HT)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PV'),
        valorCalculado(sec.PV.valor, sec.PV.breakdown, 'PV = ST × HT'),
        el('div', { class: 'label' }, `atual ${sec.PV.atual}`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Ferimentos'),
        el('input', { type: 'number', min: 0, value: sec.PV.ferimentos, 'aria-label': 'Ferimentos acumulados',
          onchange: e => store.update(p => { p.combate.ferimentos = Math.max(0, parseInt(e.target.value, 10) || 0); }) })),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'PF'),
        valorCalculado(sec.PF.valor, sec.PF.breakdown, 'PF = HT'),
        el('div', { class: 'label' }, `atual ${sec.PF.atual} · fadiga ${sec.PF.fadiga}`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'RD de poderes'), el('div', { class: 'value' }, String(sec.RD.valor))),
    ),
    el('div', { class: 'btn-row', style: 'margin-top:.6rem;flex-wrap:wrap' },
      ...condicoes.map(c => {
        const on = ativas.some(a => a.id === c.id);
        return el('button', {
          class: `btn small ${on ? 'danger' : 'ghost'}`, title: c.nota,
          onclick: () => store.update(p => {
            const lista = p.combate.condicoes ||= [];
            const i = lista.findIndex(a => a.id === c.id);
            if (i >= 0) lista.splice(i, 1); else lista.push({ id: c.id, nome: c.nome });
          }),
        }, (on ? '✓ ' : '') + c.nome);
      }),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn small', onclick: () => {
        let r = null;
        store.update(p => {
          const c = custoFadiga(db, p, 'luta', { nivelCarga: snap.carga.nivel });
          if (c.erro) { r = c; return; }
          const g = gastarFadiga(p, c.custo);
          p.combate.fadiga = g.fadiga;
          r = { ...c, ...g };
        });
        registrar(`Luta: −${r.pontosEfetivos ?? r.custo} PF (${(r.notas || []).join('; ')}). Estado: <b>${r.estado}</b>.`);
      } }, '💤 Fadiga de luta'),
      el('button', { class: 'btn small', onclick: () => {
        store.update(p => { p.combate.fadiga = recuperarFadiga(p, 60); });
        registrar('Descanso de 60 min: 1 PF por 10 minutos.');
      } }, '🌿 Descansar 1h'),
      el('button', { class: 'btn small ghost', onclick: () => aplicarDanoGAU(db, registrar) }, '🩸 Sofrer dano'),
      el('button', { class: 'btn small danger', onclick: () => store.update(p => { p.combate.ferimentos = 0; p.combate.fadiga = 0; p.combate.condicoes = []; }) }, '♻ Zerar combate'),
    ),
    snap.combate.estadoFadiga.estado !== 'normal'
      ? el('p', { class: 'pill warn' }, `FADIGA — ${snap.combate.estadoFadiga.estado}: ${snap.combate.estadoFadiga.nota} (ST efetiva ${snap.combate.stEfetiva})`)
      : '',
  );
}

/* ------------------------------------------------ árvore de manobras */

function painelArvore(db, pc, snap, registrar) {
  const nos = listaManobras(db);
  const manobras = db.maneuvers?.manobras || [];
  const selecionado = acharManobra(db, mesa.manobra);
  const efeitos = efeitosDeManobra(db, mesa.manobra);
  const trilha = el('div', { class: 'trilha' }, ...(selecionado?.trilha || []).map((t, i) => el('span', {}, i ? ` › ${t}` : t)));

  const arvores = db.maneuvers?.arvores || {};
  const seletor = el('select', { 'aria-label': 'Manobra básica', onchange: e => {
    const manobra = manobras.find(m => m.id === e.target.value);
    const primeiro = manobra ? (listaManobras(db).find(n => n.manobra === manobra.id && n.trilha.length > 1)?.id || manobra.id) : 'fazer-nada';
    mesa.manobra = primeiro;
    rerender(db);
  } }, ...manobras.map(m => el('option', {
    value: m.id, selected: selecionado?.manobra === m.id,
  }, m.nome)));

  const caminhos = el('div', { class: 'chips' }, ...nos
    .filter(n => n.manobra === selecionado?.manobra && n.id !== selecionado?.manobra)
    .map(n => el('button', {
      class: `chip${mesa.manobra === n.id ? ' on' : ''}`,
      title: n.trilha.join(' › '),
      onclick: () => { mesa.manobra = n.id; rerender(db); },
    }, `${n.trilha.slice(1).join(' › ') || n.nome}`)));

  return el('div', { class: 'panel' },
    el('h3', {}, 'Manobra do turno'),
    el('div', { class: 'row', style: 'gap:.6rem;align-items:center;flex-wrap:wrap' }, seletor, trilha),
    caminhos,
    selecionado?.descricao ? el('p', {}, selecionado.descricao) : '',
    selecionado?.textoEfeito ? el('p', { class: 'fonte' }, selecionado.textoEfeito) : '',
    efeitos.notas.length ? el('ul', { class: 'lista' }, ...efeitos.notas.map(n => el('li', {}, n))) : '',
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Ataques'), el('div', { class: 'value' }, String(efeitos.ataques))),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Mod. no ataque'), el('div', { class: 'value' }, efeitos.ataque.length ? efeitos.ataque.map(m => `${m.valor > 0 ? '+' : ''}${m.valor}`).join(', ') : '—')),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Dano extra'), el('div', { class: 'value' }, [efeitos.danoExtraDados ? `+${efeitos.danoExtraDados}d` : null, efeitos.danoFixoExtra ? `+${efeitos.danoFixoExtra}` : null].filter(Boolean).join(' ') || '—')),
      el('div', { class: 'stat small' }, el('div', { class: 'label' }, 'Efeito'), el('div', { class: 'value', style: 'font-size:.75rem' }, efeitos.condicao || (efeitos.area ? 'área' : efeitos.localizacao ? 'localização' : '—'))),
    ),
    efeitos.requisitos.length ? el('p', { class: 'aviso' }, `Requisitos: ${efeitos.requisitos.join('; ')}`) : '',
    efeitos.aviso ? el('p', { class: 'aviso' }, efeitos.aviso) : '',
    manobraPermitida(db, pc, mesa.manobra).ok ? '' : el('p', { class: 'pill bad' }, manobraPermitida(db, pc, mesa.manobra).motivo),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn small ghost', onclick: () => modal('Árvores de manobra (transcrição literal)',
        el('div', { class: 'scroll' }, ...Object.entries(arvores).filter(([k]) => k !== '_nota').map(([k, v]) => el('div', {},
          el('h4', {}, k), el('pre', { class: 'arvore' }, v)))),
      ) }, 'Ver árvores'),
      el('button', { class: 'btn small ghost', onclick: () => {
        store.update(p => { p.combate.manobra = mesa.manobra; });
        registrar(`Manobra declarada: <b>${(selecionado?.trilha || []).join(' › ')}</b>.`);
      } }, 'Declarar manobra'),
    ),
  );
}

/* ------------------------------------------------ ataque G.A.U. */

function painelAtaqueGAU(db, pc, snap, registrar) {
  const armasDisponiveis = [];
  for (const era of db.armas?.eras || []) {
    for (const a of era.armas || []) armasDisponiveis.push({ ...a, era: era.nome, eraId: era.id });
  }
  for (const it of pc.inventario || []) {
    if (it.categoria === 'arma' || it.dano) armasDisponiveis.push({ ...it, era: 'Inventário', eraId: 'inventario' });
  }
  const armaSel = el('select', { 'aria-label': 'Arma', onchange: e => { mesa.arma = e.target.value || null; rerender(db); } },
    el('option', { value: '' }, '— combate desarmado / sem arma —'),
    ...armasDisponiveis.map(a => el('option', {
      value: a.id, selected: mesa.arma === a.id,
    }, `${a.nome}${a.era ? ` (${a.era})` : ''}${a.dano ? ` · ${a.dano}` : ''}`)));

  const empSel = el('select', { 'aria-label': 'Empunhadura', onchange: e => { mesa.empunhadura = e.target.value || null; rerender(db); } },
    el('option', { value: '' }, '— empunhadura —'),
    ...empunhaduras(db).map(e => el('option', { value: e.id, selected: mesa.empunhadura === e.id }, `${e.nome}${e.bonus?.descricao ? ` · ${e.bonus.descricao}` : ''}`)));

  const luzSel = el('select', { 'aria-label': 'Luminosidade', onchange: e => { mesa.luz = e.target.value; rerender(db); } },
    ...(db.maneuvers?.luminosidade?.tabela || []).map(l => el('option', { value: l.id, selected: mesa.luz === l.id },
      `${l.nivel} (${l.penalidadeMin} a ${l.penalidadeMax})`)));

  const armaAtual = mesa.arma ? resolverArma(db, armasDisponiveis.find(a => a.id === mesa.arma) || mesa.arma) : null;
  const ref = snap.parametros.ATQ;
  const luzPen = penalidadeDeLuz(db, mesa.luz);
  const precisaoInfo = armaAtual?.categoriaPrecisao ? precisaoDaArma(db, armaAtual.categoriaPrecisao) : null;
  const apontarInfo = mesa.segundosApontando > 0 ? bonusDeApontar(db, { arma: armaAtual, segundos: mesa.segundosApontando, firmada: mesa.armaFirmada }) : null;

  return el('div', { class: 'panel' },
    el('h3', {}, 'Ataque (d20 dentro da margem de sucesso)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Referência (ATQ)'),
        valorCalculado(ref.valor, ref.breakdown, 'Como a referência de ataque foi calculada'),
        el('div', { class: 'label' }, `margem ${ref.margem.texto} · crítico ${ref.margem.critico}`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Arma'),
        el('div', { class: 'value', style: 'font-size:.8rem' }, armaAtual ? `${armaAtual.nome} · ${armaAtual.dano || '—'}` : 'desarmado')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Luminosidade'), el('div', { class: 'value' }, `${luzPen.valor}`), el('div', { class: 'label' }, luzPen.nivel)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Apontar'), el('div', { class: 'value' }, apontarInfo ? `+${apontarInfo.total}` : '—'),
        el('div', { class: 'label' }, precisaoInfo ? `PREC ${precisaoInfo.prec} (${precisaoInfo.categoria})` : '')),
    ),
    ref.aviso ? el('p', { class: 'aviso' }, ref.aviso) : '',
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('label', {}, 'Arma', armaSel),
      el('label', {}, 'Empunhadura', empSel),
      el('label', {}, 'Luz', luzSel),
      el('label', {}, 'Segundos apontando', el('input', {
        type: 'number', min: 0, max: 10, value: mesa.segundosApontando, style: 'width:5rem', 'aria-label': 'Segundos apontando',
        onchange: e => { mesa.segundosApontando = Math.max(0, parseInt(e.target.value, 10) || 0); rerender(db); },
      })),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: mesa.armaFirmada, onchange: e => { mesa.armaFirmada = e.target.checked; rerender(db); } }), 'arma firmada (+1)'),
      el('label', {}, 'RD do alvo', el('input', {
        type: 'number', min: 0, value: mesa.rdAlvo, style: 'width:5rem', 'aria-label': 'RD do alvo',
        onchange: e => { mesa.rdAlvo = Math.max(0, parseInt(e.target.value, 10) || 0); rerender(db); },
      })),
      el('label', {}, 'Local', el('select', { 'aria-label': 'Local do impacto', onchange: e => { mesa.local = e.target.value; rerender(db); } },
        ...(db.maneuvers?.localizacao?.locais || ['Cérebro', 'Olho', 'Órgãos vitais', 'Torso', 'Braço', 'Perna', 'Mão', 'Pé']).map(l => {
          const nome = typeof l === 'string' ? l : l.nome || l.local;
          return el('option', { value: nome, selected: mesa.local === nome }, nome);
        }))),
      el('label', {}, 'Distância (m)', el('input', {
        type: 'number', min: 0, value: mesa.distancia ?? '', style: 'width:6rem', 'aria-label': 'Distância até o alvo',
        onchange: e => { mesa.distancia = e.target.value === '' ? null : parseInt(e.target.value, 10); rerender(db); },
      })),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: mesa.montado, onchange: e => { mesa.montado = e.target.checked; rerender(db); } }), 'montado'),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn primary', onclick: () => {
        const resultado = executarAtaque(db, store.atual, {
          manobra: mesa.manobra,
          arma: armaAtual,
          empunhaduraId: mesa.empunhadura,
          segundosApontando: mesa.segundosApontando,
          armaFirmada: mesa.armaFirmada,
          distancia: mesa.distancia,
          luz: mesa.luz,
          rdAlvo: mesa.rdAlvo,
          local: mesa.local,
          montado: mesa.montado ? { nhCavalgar: mesa.nhCavalgar } : null,
          duranteMovimento: /investida|mover-e-atacar|combo-com-cenario|grande-salto|cambalhota|saque-em-movimento/.test(mesa.manobra),
          aposSaqueRapido: /saque/.test(mesa.manobra),
          niveisPericias: snap.niveis,
        });
        mesa.ultimaJogada = resultado.ataques?.[0]?.jogada || null;
        registrarLinhaAtaque(registrar, resultado);
        if (resultado.danoTotal > 0) {
          store.update(p => { p.combate.ultimoDanoCausado = resultado.danoTotal; });
        }
        if (resultado.condicaoImposta) registrar(`Condição imposta ao alvo: <b>${resultado.condicaoImposta}</b>.`);
        if (resultado.aviso) registrar(`⚠ ${resultado.aviso}`);
      } }, '⚔ Atacar'),
      el('button', { class: 'btn ghost', onclick: () => modal('Tabela de Grau de Dano',
        el('div', {}, ...grauDeDano(db, 0).detalhes ? [] : [],
          el('table', { class: 'tbl' },
            el('tr', {}, ['Grau', 'Faixa', 'Nome', 'Conceito'].map(h => el('th', {}, h))),
            ...(db.maneuvers?.grauDano?.graus || []).map(g => el('tr', {},
              el('td', {}, g.id), el('td', { class: 'num' }, g.max == null ? `${g.min}+` : `${g.min}–${g.max}`),
              el('td', {}, g.nome), el('td', { class: 'fonte' }, g.conceito || '')))),
        )),
      }, 'Grau de Dano'),
      el('button', { class: 'btn ghost', onclick: () => modal('Localização do impacto (humanoides)',
        el('div', {}, ...(db.maneuvers?.localizacao?.notas || db.maneuvers?.localizacao?.regras || []).map(n => el('p', { class: 'fonte' }, typeof n === 'string' ? n : n.texto || JSON.stringify(n))))),
      }, 'Localização'),
    ),
  );
}

function registrarLinhaAtaque(registrar, r) {
  const linhas = r.ataques.map(a => {
    const j = a.jogada;
    const dado = `d20 ${j.rolls.join('/')} → ${j.valor}`;
    const margem = `margem ${j.margem.texto} (crítico ${j.margem.critico})`;
    if (!j.sucesso) return `<b>${j.rotulo}</b>: ${dado} — falha (${margem}).`;
    const d = a.dano;
    const passos = (d?.passos || []).map(p => `${p.passo}: ${p.valor > 0 ? '' : ''}${p.valor}`).join(' · ');
    return `<b>${j.rotulo}</b>: ${dado} — ${j.tipo.toUpperCase()} (${margem}) → dano <b>${d?.dano ?? 0}</b> [${d?.grau?.id} ${d?.grau?.nome}] · ${passos}`;
  });
  registrar(`${linhas.join('<br>')}${r.acertos > 1 ? `<br>Total: <b>${r.danoTotal}</b> de dano (${r.grau.id} ${r.grau.nome}).` : ''}`);
}

/* ------------------------------------------------ defesas ativas */

function painelDefesasGAU(db, pc, snap, registrar) {
  const p = snap.parametros;
  const celula = (id, rotulo) => el('div', { class: 'stat' },
    el('div', { class: 'label' }, `${id} — ${rotulo}`),
    valorCalculado(p[id].valor, p[id].breakdown, `Como ${id} foi calculado`),
    el('div', { class: 'label' }, `margem ${p[id].margem?.texto ?? '—'} · crítico ${p[id].margem?.critico ?? '—'}`),
    p[id].aviso ? el('div', { class: 'label', style: 'color:var(--warn)' }, '⚠') : '');

  const rolar = (tipo) => {
    const arma = mesa.arma
      ? resolverArma(db, (pc.inventario || []).find(i => i.id === mesa.arma) || mesa.arma)
      : null;
    const r = defender(db, store.atual, {
      tipo, arma, niveisPericias: snap.niveis,
      ataque: mesa.ultimaJogada ? { jogada: mesa.ultimaJogada, defesasDoAlvo: [] } : null,
      criterio: pc.config?.criterioDisputa || 'proximidade-do-critico',
    });
    if (r.erro) { registrar(`⚠ ${r.erro}`); toast(r.erro, 'erro'); return; }
    registrar(`<b>${tipo === 'esquiva' ? 'Esquiva' : tipo === 'aparar' ? 'Aparar' : 'Bloqueio'}</b> (${r.defesa.base} = ${r.defesa.valor}): d20 ${r.jogada.rolls.join('/')} → ${r.jogada.valor}, margem ${r.jogada.margem.texto} — ${r.jogada.tipo}${r.disputa ? ` · disputa: ${r.motivo}` : ''}`);
  };

  return el('div', { class: 'panel' },
    el('h3', {}, 'Defesas ativas (teste oposto em resposta ao ataque)'),
    el('div', { class: 'grid cols-4' },
      celula('ESQ', 'Esquiva'), celula('APAR', 'Aparar'), celula('BLOQ', 'Bloqueio'),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Cavalgar (NH)'),
        el('input', { type: 'number', min: 0, value: mesa.nhCavalgar, style: 'width:5rem', 'aria-label': 'NH em Cavalgar',
          onchange: e => { mesa.nhCavalgar = parseInt(e.target.value, 10) || 0; } })),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn small', onclick: () => rolar('esquiva') }, 'Esquiva'),
      el('button', { class: 'btn small', onclick: () => rolar('aparar') }, 'Aparar'),
      el('button', { class: 'btn small', onclick: () => rolar('bloqueio') }, 'Bloqueio'),
      el('span', { class: 'fonte' }, mesa.ultimaJogada ? 'A defesa disputa contra o último ataque rolado nesta aba.' : 'Role um ataque primeiro para disputar contra ele.'),
    ),
    el('ul', { class: 'lista' }, ...(db.maneuvers?.defesasAtivas?.tabela || []).map(d => el('li', {},
      el('strong', {}, d.defesa), ` — base: ${d.base}; equipamento: ${d.equipamento}. ${db.maneuvers?.defesasAtivas?.descricoes?.[d.id] || ''}`))),
    el('p', { class: 'fonte' }, db.maneuvers?.defesasAtivas?.regra || ''),
  );
}

/* ------------------------------------------------ disputas */

function painelDisputas(db, pc, registrar) {
  const refA = el('input', { type: 'number', value: pc.atributos.ST, style: 'width:5rem', 'aria-label': 'Referência A' });
  const refB = el('input', { type: 'number', value: 10, style: 'width:5rem', 'aria-label': 'Referência B' });
  const rotA = el('input', { type: 'text', value: 'Personagem', style: 'width:9rem', 'aria-label': 'Nome de A' });
  const rotB = el('input', { type: 'text', value: 'Oponente', style: 'width:9rem', 'aria-label': 'Nome de B' });
  const criterio = el('select', { 'aria-label': 'Critério de desempate' },
    el('option', { value: 'proximidade-do-critico' }, 'mais próximo do próprio crítico (padrão)'),
    el('option', { value: 'maior-margem' }, 'maior margem de sucesso'));

  const rodar = (normal) => {
    const a = { rotulo: rotA.value, referencia: parseInt(refA.value, 10) || 0 };
    const b = { rotulo: rotB.value, referencia: parseInt(refB.value, 10) || 0 };
    const r = normal
      ? disputaNormal(db, { a, b, criterio: criterio.value, tentativas: 3 })
      : disputa(db, { a, b, criterio: criterio.value });
    const final = normal ? r.final : r;
    registrar(`<b>Disputa ${normal ? 'normal' : 'rápida'}</b>: ${a.rotulo} (${final.resA?.valor}) × ${b.rotulo} (${final.resB?.valor}) — ${final.empate ? 'EMPATE' : `vence <b>${final.vencedor === 'A' ? a.rotulo : b.rotulo}</b>`}. ${final.motivo}`);
  };

  return el('div', { class: 'panel' },
    el('h3', {}, 'Disputas de habilidades'),
    el('div', { class: 'row', style: 'gap:.6rem;flex-wrap:wrap;align-items:flex-end' },
      el('label', {}, 'A', rotA), el('label', {}, 'Referência', refA),
      el('label', {}, 'B', rotB), el('label', {}, 'Referência', refB),
      el('label', {}, 'Critério', criterio),
      el('button', { class: 'btn small', onclick: () => rodar(false) }, 'Disputa rápida'),
      el('button', { class: 'btn small ghost', onclick: () => rodar(true) }, 'Disputa normal'),
    ),
    el('p', { class: 'fonte' }, 'Em uma Disputa de Habilidades vence quem obtiver o resultado mais próximo de seu próprio valor crítico. A disputa normal pode durar vários turnos: em caso de empate, tenta-se de novo.'),
  );
}

/* ------------------------------------------------ referência rápida */

function painelReferencia(db, snap) {
  const gd = db.maneuvers?.grauDano?.graus || [];
  const luz = db.maneuvers?.luminosidade?.tabela || [];
  const emp = empunhaduras(db);
  return el('div', { class: 'panel' },
    el('h3', {}, 'Referência rápida'),
    el('div', { class: 'grid cols-3' },
      el('div', {}, el('strong', {}, 'Grau de Dano'),
        el('table', { class: 'tbl' }, el('tr', {}, ['Grau', 'Faixa', 'Nome'].map(h => el('th', {}, h))),
          ...gd.map(g => el('tr', {}, el('td', {}, g.id), el('td', { class: 'num' }, g.max == null ? `${g.min}+` : `${g.min}–${g.max}`), el('td', {}, g.nome))))),
      el('div', {}, el('strong', {}, 'Luminosidade'),
        el('table', { class: 'tbl' }, el('tr', {}, ['Nível', 'Penalidade'].map(h => el('th', {}, h))),
          ...luz.map(l => el('tr', {}, el('td', {}, l.nivel), el('td', { class: 'num' }, `${l.penalidadeMin} a ${l.penalidadeMax}`))))),
      el('div', {}, el('strong', {}, 'Empunhaduras'),
        el('ul', { class: 'lista' }, ...emp.map(e => el('li', {}, el('strong', {}, e.nome), ` — ${e.descricao || e.bonus?.descricao || ''}`)))),
    ),
    el('p', { class: 'fonte' }, `Margens: referência ${snap.parametros.ATQ.valor} → ${snap.parametros.ATQ.margem.texto} (crítico ${snap.parametros.ATQ.margem.critico}). O modificador é aplicado na jogada, não na referência.`),
  );
}

/* ------------------------------------------------ montado e veículos */

function painelMontado(db, pc, snap) {
  const m = db.maneuvers?.montado || {};
  const v = db.maneuvers?.veiculos || {};
  return el('div', { class: 'panel' },
    el('h3', {}, 'Combate montado e em veículos'),
    el('div', { class: 'grid cols-2' },
      el('div', {},
        el('strong', {}, 'Montado'),
        m.regra ? el('p', { class: 'fonte' }, m.regra) : '',
        el('ul', { class: 'lista' }, ...(m.regras || m.notas || []).map(r => el('li', {}, typeof r === 'string' ? r : r.texto || ''))),
        m.armas ? el('p', { class: 'fonte' }, `Armas de cavalaria: ${Array.isArray(m.armas) ? m.armas.join(', ') : JSON.stringify(m.armas)}`) : '',
        m.defesa ? el('p', { class: 'fonte' }, `Defesa da montaria: ${typeof m.defesa === 'string' ? m.defesa : JSON.stringify(m.defesa)}`) : ''),
      el('div', {},
        el('strong', {}, 'Veículos'),
        v.regra ? el('p', { class: 'fonte' }, v.regra) : '',
        el('ul', { class: 'lista' }, ...(v.regras || v.notas || []).map(r => el('li', {}, typeof r === 'string' ? r : r.texto || '')))),
    ),
    mesa.montado ? el('p', { class: 'pill warn' }, `Combate montado ativo: a referência de ataque é o menor valor entre o NH da arma e Cavalgar (${mesa.nhCavalgar}).`) : '',
  );
}

/* ------------------------------------------------ dano direto G.A.U. */

function aplicarDanoGAU(db, registrar) {
  const inpDano = el('input', { type: 'number', min: 0, value: 0, style: 'width:90px' });
  const inpRd = el('input', { type: 'number', min: 0, value: 0, style: 'width:70px' });
  const selLocal = el('select', {}, ['Torso', 'Cabeça', 'Cérebro', 'Olho', 'Órgãos vitais', 'Braço', 'Perna', 'Mão', 'Pé'].map(l => el('option', { value: l }, l)));
  modal('Sofrer dano (G.A.U.)', el('div', { class: 'grid cols-2' },
    el('label', { class: 'field' }, 'Dano rolado (já deduzido dos dados)', inpDano),
    el('label', { class: 'field' }, 'RD do personagem', inpRd),
    el('label', { class: 'field' }, 'Local', selLocal),
  ), {
    acoes: [el('button', { class: 'btn primary', onclick: () => {
      const bruto = parseInt(inpDano.value, 10) || 0;
      const rd = parseInt(inpRd.value, 10) || 0;
      const final = Math.max(0, bruto - rd);
      const gd = grauDeDano(db, final);
      store.update(p => { p.combate.ferimentos = (p.combate.ferimentos || 0) + final; });
      registrar(`Dano sofrido: ${bruto} − RD ${rd} = <b>${final} PV</b> → <b>${gd.id} ${gd.nome}</b> (${gd.faixa}). Local: ${selLocal.value}.`);
      document.querySelector('.modal-back')?.remove();
    } }, 'Aplicar')],
  });
}

/* ================================================================== Legado 3d */

function renderLegado(main, { db, pc, snap, registrar, log }) {
  const cb = snap.combate;
  const statHT = el('div', { class: 'stat' },
    el('div', { class: 'label' }, 'HT atual'),
    valorCalculado(cb.htAtual, [{ fonte: `HT ${pc.atributos.HT}` }, { fonte: '− Ferimentos', valor: -cb.ferimentos }], 'Pontos de Vida'));
  const statFer = el('div', { class: 'stat' },
    el('div', { class: 'label' }, 'Ferimentos'),
    el('input', { type: 'number', min: 0, value: cb.ferimentos, 'aria-label': 'Ferimentos', onchange: e => store.update(p => { p.combate.ferimentos = Math.max(0, parseInt(e.target.value, 10) || 0); }) }));
  const statFad = el('div', { class: 'stat' },
    el('div', { class: 'label' }, 'Fadiga'),
    el('input', { type: 'number', min: 0, max: pc.atributos.HT, value: cb.fadiga, 'aria-label': 'Fadiga', onchange: e => store.update(p => { p.combate.fadiga = Math.min(pc.atributos.HT, Math.max(0, parseInt(e.target.value, 10) || 0)); }) }));
  const statLim = el('div', { class: 'stat' },
    el('div', { class: 'label' }, 'Limiares'),
    el('div', { class: 'value', style: 'font-size:.8rem' }, String(db.tables.ferimentos?.morteAutomatica || 'ver p. 277–279')));
  const vital = el('div', { class: 'panel' },
    el('h3', {}, 'Estado Vital (Ferimentos p. 276–281)'),
    el('div', { class: 'grid cols-4' }, statHT, statFer, statFad, statLim),
    el('div', { class: 'btn-row', style: 'margin-top:.6rem' },
      el('button', { class: 'btn', onclick: () => aplicarDanoDireto(db, registrar) }, '🗡 Sofrer dano'),
      el('button', { class: 'btn', onclick: () => {
        const res = dice.check(store.atual.atributos.HT, { label: 'Teste de HT' });
        registrar(`${dadosVisual(res.rolls)} Teste de HT ${store.atual.atributos.HT}: <b>${res.total}</b> — ${res.descricao}.`);
      } }, '🫀 Teste de HT'),
      el('button', { class: 'btn danger', onclick: () => store.update(p => { p.combate.ferimentos = 0; p.combate.fadiga = 0; p.combate.condicoes = []; }) }, '♻ Zerar combate')),
    cb.estadoFadiga.estado !== 'normal'
      ? el('p', { class: 'pill warn', style: 'margin-top:.5rem' }, `FADIGA — ${cb.estadoFadiga.estado}: ${cb.estadoFadiga.nota}`)
      : '');

  const armas = [];
  for (const it of (pc.inventario || [])) if (it.equipado && (it.categoria === 'arma' || it.dano)) armas.push(it);
  for (const nat of db.equipment.ataquesNaturais || []) armas.push({ ...nat, id: nat.id || nat.nome, natural: true });
  if (!armas.length) armas.push({ id: 'soco', nome: 'Soco (mãos limpas)', dano: 'GDP-2', tipoDano: 'contusão', fonte: 'p. 232' });

  const rdAlvo = el('input', { type: 'number', min: 0, value: 0, style: 'width:70px', 'aria-label': 'RD do alvo' });
  const localSel = el('select', { 'aria-label': 'Local do impacto' },
    ['Tronco', 'Cabeça', 'Cérebro', 'Braço', 'Perna', 'Mão', 'Pé', 'Órgãos vitais'].map(l => el('option', { value: l }, l)));

  const ataques = el('div', { class: 'panel' },
    el('h3', {}, 'Ataques (3d ≤ NH — p. 220–232)'),
    el('div', { class: 'btn-row', style: 'margin:0 0 .5rem' },
      el('span', { class: 'label' }, 'RD do alvo: '), rdAlvo, el('span', { class: 'label' }, 'Local: '), localSel),
    el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, ['Arma', 'NH', 'Dano', 'Ações'].map(h => el('th', {}, h)))),
      armas.map(a => {
        const nh = nhAtaque(db, pc, a, {});
        const dano = danoArma(db, pc, a);
        return el('tr', {},
          el('td', {}, el('strong', {}, a.nome), el('div', { class: 'meta fonte' }, `${dano.expr || 'N/D'} ${dano.tipoDano || ''}`)),
          el('td', {}, valorCalculado(nh.total, [{ fonte: nh.fonte, valor: nh.base }, ...nh.modificadores.map(m => ({ fonte: m.fonte, valor: m.valor }))])),
          el('td', {}, valorCalculado(dano.expr || '—', dano.breakdown.map(b => ({ fonte: b })), 'Dano da arma')),
          el('td', {}, el('button', { class: 'btn small primary', onclick: () => {
            const res = rolarAtaque(db, store.atual, a, {});
            let extra = '';
            if (res.sucesso) {
              const av = avaliarDano(db, { danoExpr: dano.expr || '1D', tipoDano: dano.tipoDano, rd: parseInt(rdAlvo.value, 10) || 0, local: localSel.value, dm: dano.dm });
              extra = ` → <b>dano ${av.final} PV</b>`;
            }
            registrar(`${dadosVisual(res.rolls, { crit: res.critico && res.sucesso, fail: res.critico && !res.sucesso })} <b>${a.nome}</b>: NH ${res.nhFinal}, rolou <b>${res.total}</b> — ${res.descricao}.${extra}`);
          } }, '⚔ Atacar')),
        );
      }),
    ),
  );

  const esc = snap.escudo;
  const bloq = bloqueio(pc, { db });
  const melhorApar = melhorPericiaAparar(db, pc, snap);
  const defesas = el('div', { class: 'panel' },
    el('h3', {}, 'Defesas (p. 224–231)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Esquiva'), valorCalculado(snap.esquiva, snap.deslocamento.breakdown.map(b => ({ fonte: b.fonte, valor: b.valor })), 'Esquiva = Deslocamento')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Aparar (melhor)'),
        melhorApar ? valorCalculado(melhorApar.valor, [{ fonte: `NH ${melhorApar.base} em ${melhorApar.nome}` }, { fonte: melhorApar.fracao === 2 / 3 ? '× 2/3 (Bastão/Esgrima)' : '× ½ (p. 230)' }]) : el('div', { class: 'value' }, '—')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Bloqueio'), valorCalculado(bloq.valor, [{ fonte: bloq.nota }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Defesa Passiva'), valorCalculado(`${snap.defesaPassiva.dp}/${snap.defesaPassiva.rd}`,
        snap.defesaPassiva.parts.map(p => ({ fonte: p.fonte, valor: `DP ${p.dp}/RD ${p.rd}` })))),
    ),
    el('p', { class: 'fonte' }, 'Defesa ativa: 3d ≤ valor da defesa, 1× por turno (p. 224).' + (esc.escudoGrande ? ' [escudo grande detectado]' : '')),
  );

  main.append(
    el('div', { class: 'panel' }, el('p', { class: 'aviso' }, 'Modo legado (GURPS 3ª edição, 3d6). Material subsidiário — o sistema principal é G.A.U. com d20.')),
    vital, ataques, defesas,
    el('div', { class: 'panel' }, el('h3', {}, 'Registro de combate'), log),
  );
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
      registrar(`Dano sofrido: ${bruto} − RD ${rd} = <b>${av.final} PV</b>. ${res.eventos.join(' ')} ${res.efeitos.map(e => `[${e.tipo}]`).join(' ')}`);
      document.querySelector('.modal-back')?.remove();
    } }, 'Aplicar')],
  });
}

/* ------------------------------------------------ utils */

/** Re-renderiza a aba preservando o estado da mesa (manobra, arma, luz…). */
function rerender(db) {
  dbAtual = db || dbAtual;
  const main = document.getElementById('main');
  if (!main || !dbAtual) return;
  main.innerHTML = '';
  renderCombate(main, { db: dbAtual });
}
