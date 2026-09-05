/* GUA Rule Engine — Secundários e Parâmetros da Planilha de Personagem
 * Fonte: #『📁』modelo-ficha (Impio, 04/09/2026 18:49 e 21:38):
 *   PV = ST × HT · VON = IQ · PER = IQ · PF = HT
 * Parâmetros: ATQ, ESQ, DSL, APAR, BLOQ — bases publicadas em DEFESAS ATIVAS e
 * MANOBRA BÁSICA: ATACAR (#『📕』testes-e-combate).
 *
 * Nenhum valor intermediário é arredondado; só onde o material manda
 * (ex.: caminhada = metade do deslocamento, arredondado PARA CIMA).
 */
import { deslocamento as deslocamentoLegado } from './encumbrance.js';
import { margemDeSucesso } from './resolution.js';
import { bonusDosPoderes } from './powers.js';
import { atributosEfetivos, bonusDeDefesaAtiva, rdNatural } from './vantagens.js';

/** Atributos com os bônus concedidos por vantagens (ex.: Sobrevivente do Inferno +2 ST/DX). */
function attr(db, personagem) {
  const efetivos = atributosEfetivos(db, personagem);
  delete efetivos._breakdown;
  return { ...(personagem?.atributos || {}), ...efetivos };
}

/** Personagem com os atributos efetivos — usado pelos cálculos derivados. */
function pcEfetivo(db, personagem) {
  const atributos = attr(db, personagem);
  return atributos === personagem?.atributos ? personagem : { ...personagem, atributos };
}

/* ------------------------------------------------------------------ secundários */

/** Pontos de Vida = ST × HT. */
export function pvTotal(personagem, { st = null } = {}) {
  const stValor = st ?? personagem?.atributos?.ST ?? 0;
  const ht = personagem?.atributos?.HT ?? 0;
  return {
    valor: stValor * ht,
    formula: 'ST × HT',
    breakdown: [
      { fonte: 'ST', valor: stValor },
      { fonte: '× HT', valor: ht },
      { fonte: 'PV total', valor: stValor * ht },
    ],
  };
}

/** Vontade = IQ (Testes de Vontade: "Normalmente Vontade é igual a IQ"). */
export function vontade(personagem) {
  const iq = personagem?.atributos?.IQ ?? 0;
  return { valor: iq, formula: 'IQ', breakdown: [{ fonte: 'IQ', valor: iq }] };
}

/** Percepção = IQ (Testes dos Sentidos são feitos contra o atributo IQ). */
export function percepcao(personagem) {
  const iq = personagem?.atributos?.IQ ?? 0;
  return { valor: iq, formula: 'IQ', breakdown: [{ fonte: 'IQ', valor: iq }] };
}

/** Pontos de Fadiga = HT. */
export function pfTotal(personagem) {
  const ht = personagem?.atributos?.HT ?? 0;
  return { valor: ht, formula: 'HT', breakdown: [{ fonte: 'HT', valor: ht }] };
}

/** Bloco completo de secundários (PV, VON, PER, PF) com valores atuais.
 *  Poderes modulares podem conceder PV e RD adicionais (data/poderes.json → pv, rd). */
export function secundarios(db, personagem) {
  const pc = pcEfetivo(db, personagem);
  const pv = pvTotal(pc);
  const pf = pfTotal(pc);
  const ferimentos = personagem?.combate?.ferimentos || 0;
  const fadiga = personagem?.combate?.fadiga || 0;
  const bonus = bonusDosPoderes(db, personagem);
  const rijeza = rdNatural(db, personagem);
  const pvMax = pv.valor + bonus.pv;
  return {
    PV: {
      ...pv,
      valor: pvMax, max: pvMax,
      atual: Math.max(pvMax - ferimentos, -pvMax),
      ferimentos,
      bonusPoderes: bonus.pv,
      breakdown: bonus.pv ? [...pv.breakdown, { fonte: 'PV concedidos por poderes', valor: bonus.pv }] : pv.breakdown,
    },
    VON: vontade(pc),
    PER: percepcao(pc),
    PF: { ...pf, atual: Math.max(pf.valor - fadiga, 0), fadiga, max: pf.valor },
    RD: {
      valor: bonus.rd + rijeza.rd, bonusPoderes: bonus.rd, rdNatural: rijeza.rd,
      partes: [...bonus.partes.filter(p => p.rd), ...rijeza.partes],
    },
    fontes: db.ficha?.blocos?.find(b => b.id === 'secundarios')?.contas || [],
  };
}

/* ------------------------------------------------------------------ deslocamento (DSL) */

/** DSL: corrida = Deslocamento total; caminhada = metade do deslocamento, arredondado para cima.
 *  Fonte: PROEZAS FÍSICAS → Corrida ("em um combate, uma corrida é equivalente ao Deslocamento
 *  total do usuário, enquanto caminhar você apenas pode se deslocar metade do seu deslocamento,
 *  arredondado para cima"). O valor de Deslocamento continua vindo de encumbrance.js. */
export function deslocamentoGAU(db, personagem, ctx = {}) {
  const base = deslocamentoLegado(db, personagem, ctx);
  const corrida = base.valor;
  const caminhada = Math.ceil(corrida / 2);
  return {
    ...base,
    corrida,
    caminhada,
    velocidade: base.velocidadeBasica,
    breakdownCorrida: [...base.breakdown, { fonte: 'Corrida = Deslocamento total', valor: corrida }],
    breakdownCaminhada: [
      { fonte: 'Deslocamento total', valor: corrida },
      { fonte: '÷ 2, arredondado para cima', valor: caminhada },
    ],
    nota: 'A velocidade de corrida é igual ao parâmetro Velocidade. Magia, poderes e outras características podem incorporar maior deslocamento e versatilidade.',
  };
}

/* ------------------------------------------------------------------ referências de combate */

/** Atributo usado por uma forma de ataque (o material só define as exceções). */
export function atributoDoAtaque(db, formaDeAtaque = 'simples') {
  const id = String(formaDeAtaque || '').toLowerCase();
  if (id.includes('acrob')) return { atributo: 'DX', fonte: 'Ataque Acrobático: "utiliza Destreza em vez de Força"' };
  if (id.includes('precis')) return { atributo: 'DX', fonte: 'Ataque Preciso: "utiliza sua Destreza"' };
  if (id.includes('pesad') || id.includes('potente') || id.includes('demolidor')) {
    return { atributo: 'ST', fonte: 'Ataque Pesado: "Utiliza Força"' };
  }
  return {
    atributo: 'ST',
    fonte: 'Ataque Simples usa Força por padrão (o material só especifica a troca para Destreza no Ataque Acrobático)',
    _aviso: 'REGRA NÃO DEFINIDA — a referência do Ataque Simples não é explicitada; assumida Força por contraste com o Ataque Acrobático.',
  };
}

/** ATQ: referência do ataque = NH da arma quando treinada; senão o atributo da forma de ataque. */
export function referenciaDeAtaque(db, personagem, { arma = null, forma = 'simples', niveisPericias = null, montado = null } = {}) {
  const attr = atributoDoAtaque(db, forma);
  const partes = [];
  let valor = null;
  let fonte = '';

  const nomePericia = arma?.pericia || arma?.periciaNome || null;
  const nh = nomePericia && niveisPericias
    ? (niveisPericias[nomePericia] ?? niveisPericias[String(nomePericia).toLowerCase()] ?? null)
    : (arma?.nh ?? null);

  if (nh !== null && nh !== undefined) {
    valor = nh;
    fonte = `NH em ${nomePericia || arma?.nome || 'arma'}`;
    partes.push({ fonte, valor });
  } else {
    valor = personagem?.atributos?.[attr.atributo] ?? 0;
    fonte = `${attr.atributo} (sem perícia treinada)`;
    partes.push({ fonte: attr.fonte, valor }, { fonte: `${attr.atributo} do personagem`, valor });
  }

  // Combate montado: "usa armas de mão com seu NH com a arma ou seu NH em Cavalgar, o que for menor"
  if (montado) {
    const cavalgar = montado.nhCavalgar ?? (niveisPericias ? (niveisPericias['Cavalgar'] ?? niveisPericias['cavalgar'] ?? null) : null);
    if (cavalgar !== null && cavalgar !== undefined) {
      const menor = Math.min(valor, cavalgar);
      partes.push({ fonte: `Cavalgar NH ${cavalgar} — usa-se o menor entre a arma e Cavalgar`, valor: menor });
      valor = menor;
      fonte = `menor entre arma (${fonte}) e Cavalgar`;
    }
  }

  return {
    valor,
    fonte,
    atributo: attr.atributo,
    breakdown: partes,
    margem: margemDeSucesso(db, valor),
    aviso: nh === null || nh === undefined ? attr._aviso || null : null,
  };
}

/* ------------------------------------------------------------------ defesas ativas */

/** ESQ: Esquiva baseada na DX. Exceção publicada: montaria usa DX ou Deslocamento, o que for maior. */
export function esquivaGAU(db, personagem, ctx = {}) {
  const dx = attr(db, personagem).DX ?? 0;
  const breakdown = [{ fonte: 'Esquiva: "Baseada na DX"', valor: dx }];
  let valor = dx;
  if (ctx?.montaria) {
    const mov = deslocamentoLegado(db, personagem, ctx).valor;
    valor = Math.max(dx, mov);
    breakdown.push({ fonte: 'Montaria: DX ou Deslocamento, o que for maior', valor: mov });
  }
  const defesas = bonusDeDefesaAtiva(db, personagem);
  valor += defesas.total;
  breakdown.push(...defesas.partes);
  return {
    valor,
    base: 'DX',
    breakdown,
    margem: margemDeSucesso(db, valor),
    nota: 'Pode ser usada contra qualquer ataque e não exige armas ou escudos; exige espaço e condições físicas para se movimentar.',
  };
}

/** APAR: baseada em uma arma ou em combate desarmado (Destreza / atributo da arma). */
export function apararGAU(db, personagem, { arma = null, niveisPericias = null } = {}) {
  const partes = [];
  let valor = null;
  const nh = arma?.nh ?? (arma?.pericia && niveisPericias
    ? (niveisPericias[arma.pericia] ?? niveisPericias[String(arma.pericia).toLowerCase()] ?? null)
    : null);
  if (nh !== null && nh !== undefined) {
    valor = nh;
    partes.push({ fonte: `NH da arma (${arma.nome || arma.pericia})`, valor });
  } else {
    valor = attr(db, personagem).DX ?? 0;
    partes.push({ fonte: 'Sem arma treinada: Destreza (combate desarmado)', valor });
  }
  const defesas = bonusDeDefesaAtiva(db, personagem);
  if (defesas.total) { valor += defesas.total; partes.push(...defesas.partes); }
  return {
    valor,
    base: arma ? 'arma' : 'DX',
    breakdown: partes,
    margem: margemDeSucesso(db, valor),
    nota: 'Serve contra ataques corpo a corpo (e alguns ataques à distância específicos). A arma utilizada deve ser capaz de alcançar ou interceptar o ataque.',
  };
}

/** BLOQ: baseado no uso de um escudo e na ST; o escudo fornece um bônus próprio. */
export function bloqueioGAU(db, personagem, { escudo = null } = {}) {
  const st = attr(db, personagem).ST ?? 0;
  const item = escudo || (personagem?.inventario || []).find(i => i.equipado && i.categoria === 'escudo') || null;
  const bonus = item ? (item.bonusDefesa ?? item.dp ?? 0) : 0;
  const defesas = bonusDeDefesaAtiva(db, personagem);
  const breakdown = [
    { fonte: 'Bloqueio: "Baseado no uso de um escudo e na ST"', valor: st },
    item ? { fonte: `Bônus do escudo (${item.nome})`, valor: bonus } : { fonte: 'Sem escudo equipado', valor: 0 },
    ...defesas.partes,
  ];
  return {
    valor: st + bonus + defesas.total,
    base: 'ST',
    escudo: item,
    bonusEscudo: bonus,
    breakdown,
    margem: margemDeSucesso(db, st + bonus + defesas.total),
    aviso: item && item.bonusDefesa == null
      ? 'REGRA NÃO DEFINIDA — o "bônus próprio do escudo" não foi publicado numericamente; usado o valor de DP cadastrado no equipamento.'
      : (!item ? 'Sem escudo equipado: o Bloqueio não pode ser usado (exige escudo).' : null),
    nota: 'Interpor algo entre o ataque e o corpo; protege contra ataques corpo a corpo e à distância.',
  };
}

/* ------------------------------------------------------------------ parâmetros da ficha */

/** Parâmetros exibidos na planilha oficial: ATQ, ESQ, DSL, APAR, BLOQ. */
export function parametros(db, personagem, ctx = {}) {
  const arma = ctx.arma || null;
  const atq = referenciaDeAtaque(db, personagem, { arma, forma: ctx.forma || 'simples', niveisPericias: ctx.niveisPericias || null, montado: ctx.montado });
  const esq = esquivaGAU(db, personagem, ctx);
  const apar = apararGAU(db, personagem, { arma, niveisPericias: ctx.niveisPericias || null });
  const bloq = bloqueioGAU(db, personagem, { escudo: ctx.escudo });
  const dsl = deslocamentoGAU(db, personagem, ctx);
  return {
    ATQ: { valor: atq.valor, breakdown: atq.breakdown, margem: atq.margem, aviso: atq.aviso, detalhe: atq },
    ESQ: { valor: esq.valor, breakdown: esq.breakdown, margem: esq.margem, detalhe: esq },
    DSL: { valor: dsl.corrida, caminhada: dsl.caminhada, breakdown: dsl.breakdownCorrida, detalhe: dsl },
    APAR: { valor: apar.valor, breakdown: apar.breakdown, margem: apar.margem, detalhe: apar },
    BLOQ: { valor: bloq.valor, breakdown: bloq.breakdown, margem: bloq.margem, aviso: bloq.aviso, detalhe: bloq },
    definicoes: db.ficha?.blocos?.find(b => b.id === 'parametros')?.definicoes || [],
  };
}
