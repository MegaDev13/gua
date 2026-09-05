/* GUA Rule Engine — Proezas físicas, sentidos, vontade e pânico
 * Fontes (canal #『📕』testes-e-combate, transcrito em data/proezas.json):
 *  · CORRIDA · ESFORÇO EXTRA (1 PF por uso, sucesso ou não)
 *  · SALTOS (atributo ST; sem características sobrenaturais o salto se limita a 1,5 m)
 *  · ESCALADA (teste obrigatório; pré-definido DX−5 ou ST−5; tabela por tipo de superfície)
 *  · LEVANTAR E MOVER OBJETOS (1 mão 3×ST · 2 mãos 13×ST · costas 15×ST · empurrar 13×ST, 25×ST com impulso)
 *  · EMPURRAR E DERRUBAR OBJETOS · ARREMESSO (ST + peso; ST+6 com a perícia) · CAVAR · NATAÇÃO
 *  · APANHAR OBJETOS EM COMBATE · TESTES DE SENTIDO (Visão, Audição, Olfato/Paladar — todos IQ)
 *  · TESTES DE VONTADE (VON = IQ) · VERIFICAÇÃO DE PÂNICO (3d + margem da falha → tabela 4…40+)
 */
import { DICE } from './dice.js';
import { testeD20, testeDeAtributo, verificacaoDePanico, resultadoPanico } from './resolution.js';
import { danoArremessado, distanciaArremesso } from './damage.js';
import { deslocamentoGAU } from './derived.js';
import { nivelCarga } from './encumbrance.js';
import { bonusDeSentido, bonusDeVontade, bonusDePanico, ignoraPenalidadeDeLuz } from './vantagens.js';

/** Chave de efeito de vantagem correspondente a cada sentido publicado. */
const CHAVE_SENTIDO = { visao: 'visao', audicao: 'audicao', 'olfato-paladar': 'olfatoPaladar', olfatoPaladar: 'olfatoPaladar' };

const dados = db => db.proezas || {};
const teste = (db, personagem, opts) => testeD20(db, { categoria: personagem?.categoria || 'mundano', personagem, ...opts });

/* ------------------------------------------------------------------ corrida e esforço extra */

/** Corrida = Deslocamento total; caminhando, metade (arredondado para cima). */
export function corrida(db, personagem, ctx = {}) {
  return { ...deslocamentoGAU(db, personagem, ctx), regras: dados(db).corrida?.regras || [] };
}

/** Esforço Extra: 1 PF por uso, independentemente de o teste dar certo ou errado. */
export function esforcoExtra(db, personagem, { usos = 1, tarefa = null } = {}) {
  const cfg = dados(db).esforcoExtra || {};
  const custo = usos * (cfg.custoPF ?? 1);
  const pf = personagem?.combate?.pf ?? null;
  return {
    usos, tarefa, custoPF: custo, pfAtual: pf, pfRestante: pf != null ? pf - custo : null,
    excedePF: pf != null && custo > pf,
    regra: cfg.regra || 'Cada uso de esforço extra custa 1 Ponto de Fadiga (PF).',
    usosPublicados: cfg.usos || [],
    autorizacaoDoMestre: cfg.autorizacaoDoMestre || null,
  };
}

/* ------------------------------------------------------------------ saltos */

/** Sem características sobrenaturais o salto se limita a 1,5 m. */
export function limiteMundanoDeSalto(db) { return dados(db).saltos?.limiteMundano || { metros: 1.5 }; }

/** Salto: teste de ST (ou da Perícia Salto); acima de 1,5 m exige característica sobrenatural. */
export function saltar(db, personagem, { metros = 0, sobrenatural = false, comCarga = false, nhSalto = null, modificadores = [], dice = DICE } = {}) {
  const cfg = dados(db).saltos || {};
  const limite = limiteMundanoDeSalto(db);
  const mods = [...modificadores];
  let referencia = nhSalto ?? personagem?.atributos?.ST ?? 0;
  let base = nhSalto != null ? 'Perícia Salto (NH no lugar de ST ou DX)' : 'ST';
  if (comCarga) {
    const carga = nivelCarga(db, personagem)?.nivel ?? 0;
    referencia -= carga;
    mods.push({ fonte: `Saltando com Carga: − nível de Carga (${carga})`, valor: -carga });
  }
  const acimaDoLimite = metros > limite.metros;
  if (acimaDoLimite && !sobrenatural) {
    return {
      permitido: false, referencia, base, metros, limite,
      motivo: `${limite.regra || `Sem características sobrenaturais o salto se limita a ${limite.metros} m.`} O salto pedido é de ${metros} m.`,
      alternativa: 'Esforço Extra (1 PF por tentativa) ou um poder/característica sobrenatural.',
    };
  }
  const jogada = teste(db, personagem, { referencia, modificadores: mods, rotulo: `Salto (${base}) — ${metros} m`, dice });
  return {
    permitido: true, referencia, base, metros, limite, jogada,
    sobrenatural,
    sucesso: acimaDoLimite ? jogada.sucesso : true,
    regra: acimaDoLimite ? (cfg.saltoSobrenatural?.regra || '') : (cfg.regraGeral || ''),
    parabola: cfg.saltoSobrenatural?.parabola || null,
    esforcoExtra: cfg.esforcoExtra || null,
    emCombate: dados(db).saltoDuranteCombate?.regra || null,
  };
}

/* ------------------------------------------------------------------ escalada */

/** Tabela de escalada por tipo de superfície (modificador + velocidades curta/longa). */
export function tiposDeEscalada(db) { return dados(db).escalada?.tabela || []; }

export function tipoDeEscalada(db, tipo) {
  const alvo = String(tipo || '').toLowerCase();
  return tiposDeEscalada(db).find(t => t.tipo.toLowerCase() === alvo)
    || tiposDeEscalada(db).find(t => t.tipo.toLowerCase().includes(alvo)) || null;
}

/** Velocidade de escalada publicada: curta (em combate) ou longa (fora de combate). */
export function velocidadeDeEscalada(db, tipo, { longa = false } = {}) {
  const linha = tipoDeEscalada(db, tipo);
  if (!linha) return { erro: `Tipo de escalada desconhecido: ${tipo}` };
  return { tipo: linha.tipo, velocidade: longa ? linha.escaladaLonga : linha.escaladaCurta, modo: longa ? 'escalada longa' : 'escalada curta (combate)' };
}

/** Escalada: teste obrigatório no início e a cada 5 minutos; pré-definido DX−5 ou ST−5. */
export function escalar(db, personagem, { tipo = null, nivelDeCarga = null, longa = false, segundos = 0, modificadores = [], nhEscalada = null, dice = DICE } = {}) {
  const cfg = dados(db).escalada || {};
  const linha = tipoDeEscalada(db, tipo);
  const mods = [...modificadores];
  if (linha?.modificador != null) mods.push({ fonte: `Superfície: ${linha.tipo}`, valor: linha.modificador });
  if (linha?._aviso) mods.push({ fonte: linha._aviso, valor: 0 });
  const carga = nivelDeCarga ?? nivelCarga(db, personagem)?.nivel ?? 0;
  if (carga) mods.push({ fonte: `Nível de Carga subtraído do NH (${carga})`, valor: -carga });

  let referencia = nhEscalada ?? null;
  let base = 'Perícia Escalada';
  if (referencia == null) {
    const dx = personagem?.atributos?.DX ?? 0, st = personagem?.atributos?.ST ?? 0;
    referencia = Math.max(dx - 5, st - 5);
    base = cfg.default?.join(' ou ') || 'DX−5 ou ST−5';
  }
  const semJogada = linha?.semJogada === true;
  return {
    tipo: linha, semJogada,
    referencia, base,
    velocidade: linha ? velocidadeDeEscalada(db, linha.tipo, { longa }) : null,
    jogada: semJogada ? null : teste(db, personagem, { referencia, modificadores: mods, rotulo: `Escalada — ${linha?.tipo || tipo || 'superfície'}`, dice }),
    modificadores: mods,
    testes: semJogada ? 'Sem jogada (escada).' : `Um teste no início da escalada e mais um a cada 5 minutos${segundos ? ` (${segundos} s decorridos)` : ''}.`,
    falha: 'Uma falha significa que você caiu. Se estiver preso por uma corda, ficará suspenso por ela, a menos que a falha tenha sido crítica.',
    regras: cfg.regras || [],
  };
}

/* ------------------------------------------------------------------ levantamento */

/** Limites publicados de levantamento/movimentação, calculados a partir da ST. */
export function limitesDeLevantamento(db, st) {
  const limites = dados(db).levantamento?.limites || [];
  return limites.map(l => {
    const entrada = { id: l.id, nome: l.nome, formula: l.formula, nota: l.nota || null };
    if (l.multiplicador != null) entrada.kg = st * l.multiplicador;
    if (l.comImpulso != null) entrada.kgComImpulso = st * l.comImpulso;
    return entrada;
  });
}

/** Classifica uma tentativa de levantar/mover um peso. */
export function levantar(db, personagem, { pesoKg = 0, modo = 'costas', comImpulso = false } = {}) {
  const st = personagem?.atributos?.ST ?? 0;
  const limite = limitesDeLevantamento(db, st).find(l => l.id === modo);
  if (!limite) return { erro: `Modo de levantamento desconhecido: ${modo}`, disponiveis: limitesDeLevantamento(db, st) };
  const capacidade = comImpulso ? (limite.kgComImpulso ?? limite.kg) : limite.kg;
  if (capacidade == null) return { ...limite, pesoKg, resultado: 'Este limite não é expresso em kg — consulte a fórmula publicada.', regraGeral: dados(db).levantamento?.regraGeral || null };
  const dentro = pesoKg <= capacidade;
  return {
    ...limite, pesoKg, capacidade, comImpulso, dentroDoLimite: dentro,
    resultado: dentro
      ? `Dentro do limite de ${limite.formula} (${capacidade} kg).`
      : `Acima do limite de ${limite.formula} (${capacidade} kg) por ${Math.round(pesoKg - capacidade)} kg — exige esforço extra, ajuda de outros personagens ou um poder.`,
    erguer: dados(db).levantamento?.erguer || null,
    esforcoExtra: dados(db).levantamento?.esforcoExtra || null,
    regraGeral: dados(db).levantamento?.regraGeral || null,
    testeDeST: dentro ? null : 'Quando grandes pesos estiverem envolvidos, poderá ser necessário fazer um teste de ST.',
  };
}

/* ------------------------------------------------------------------ empurrar e derrubar */

/** Derrubar objeto: até 13×ST (o dobro com impulso de um turno inteiro). */
export function derrubarObjeto(db, personagem, { pesoKg = 0, comImpulso = false } = {}) {
  const cfg = dados(db).empurrarDerrubar || {};
  const st = personagem?.atributos?.ST ?? 0;
  const limite = st * (comImpulso ? 26 : 13);
  return {
    pesoKg, limite, comImpulso, st,
    dentroDoLimite: pesoKg <= limite,
    regra: cfg.limite || 'O peso máximo é 13×ST.',
    impulso: cfg.comImpulso || null,
    bomSenso: cfg.bomSenso || null,
    esforcoExtra: cfg.esforcoExtra || null,
    manobra: cfg.contexto || 'Em termos de manobra, isto se caracteriza como um ataque.',
    limiteDeAplicacao: cfg.limiteDeAplicacao || null,
  };
}

/** Encontrão em pessoa/criatura: Investida — disputa de ST; quem perde cai. */
export function encontrao(db, { stA, stB, dice = DICE, modificadoresA = [], modificadoresB = [] } = {}) {
  return {
    tipo: 'disputa',
    a: { rotulo: 'ST do investidor', referencia: stA, modificadores: modificadoresA },
    b: { rotulo: 'ST do alvo', referencia: stB, modificadores: modificadoresB },
    regra: 'Manobra Investida: disputa de ST contra ST — quem perde a disputa cai.',
    nota: dados(db).empurrarDerrubar?.limiteDeAplicacao || 'As regras de empurrar objetos se aplicam a objetos inanimados; para pessoas ou criaturas, veja os Encontrões.',
  };
}

/* ------------------------------------------------------------------ arremesso */

/** Arremesso de objeto: distância (ST + peso) e dano (tabela por ST e peso, em data/armas.json). */
export function arremessarObjeto(db, { st, pesoKg = 0, periciaArremesso = false, nhArremesso = null } = {}) {
  const cfg = dados(db).arremesso || {};
  const limite = st * 13;
  return {
    dano: danoArremessado(db, st, pesoKg),
    distancia: distanciaArremesso({ st, pesoKg, periciaArremesso, nhArremesso }),
    st, pesoKg,
    podeArremessar: pesoKg <= limite,
    limitePeso: cfg.limitePeso || `Tudo que você for capaz de erguer (≤ 13 × ST = ${limite} kg) pode ser arremessado.`,
    testeParaAtingir: cfg.testeParaAtingir?.opcoes || ['DX com redutor de −3', 'perícia Arremesso'],
    emCombate: cfg.emCombate || null,
    bomSenso: cfg.bomSenso || null,
  };
}

/** Apanhar objetos em combate: leve (≤ ST/2) com Preparar (1 s); pesado exige 2 s. */
export function apanharObjeto(db, personagem, { pesoKg = 0 } = {}) {
  const cfg = dados(db).apanharObjetos || {};
  const st = personagem?.atributos?.ST ?? 0;
  const leve = pesoKg <= st / 2;
  return {
    leve, pesoKg, limitePesoLeve: st / 2,
    segundos: leve ? 1 : 2,
    manobra: leve ? 'Preparar' : 'Preparar (2 segundos)',
    regra: leve ? cfg.objetoLeve : cfg.objetoPesado,
  };
}

/* ------------------------------------------------------------------ cavar */

/** Ritmo de escavação em m³/h: fator × ST, pela situação/ferramenta. */
export function ritmosDeEscavacao(db) { return dados(db).cavar?.ritmos || []; }

export function cavar(db, { st = 0, situacao = null, horas = 1 } = {}) {
  const ritmos = ritmosDeEscavacao(db);
  const alvo = String(situacao || '').toLowerCase();
  const linha = ritmos.find(r => r.situacao.toLowerCase() === alvo)
    || ritmos.find(r => r.situacao.toLowerCase().includes(alvo)) || ritmos[0];
  if (!linha) return { erro: 'Tabela de ritmos de escavação não encontrada.' };
  const porHora = (linha.fator || 0) * st;
  return {
    situacao: linha.situacao, formula: linha.formula, fator: linha.fator, st,
    metrosCubicosPorHora: Number(porHora.toFixed(3)),
    metrosCubicos: Number((porHora * horas).toFixed(3)), horas,
    nota: linha.nota || null,
    fadiga: dados(db).cavar?.fadiga || null,
    notas: dados(db).cavar?.notas || [],
  };
}

/* ------------------------------------------------------------------ natação */

/** Natação: pré-definido ST−5 ou DX−5; +3 por entrada intencional; −2× nível de Carga. */
export function nadar(db, personagem, { entradaIntencional = false, nivelDeCarga = null, obeso = false, nhNatacao = null, modificadores = [], dice = DICE, emCombate = false, submerso = false } = {}) {
  const cfg = dados(db).natacao || {};
  const mods = [...modificadores];
  const carga = nivelDeCarga ?? nivelCarga(db, personagem)?.nivel ?? 0;
  if (entradaIntencional) mods.push({ fonte: 'Entrada intencional na água', valor: cfg.modificadores?.entradaIntencional ?? 3 });
  if (carga) mods.push({ fonte: `Nível de Carga (−2 × ${carga})`, valor: -2 * carga });
  if (obeso) mods.push({ fonte: 'Obesidade', valor: 5 });
  if (emCombate) mods.push({ fonte: 'Combate na água: arma de perto −2; dano dividido ao meio', valor: -2 });
  if (submerso) mods.push({ fonte: 'Completamente submerso: redutores dobrados e teste a cada 2 segundos', valor: -2 });

  let referencia = nhNatacao ?? null;
  let base = 'Perícia Natação';
  if (referencia == null) {
    const st = personagem?.atributos?.ST ?? 0, dx = personagem?.atributos?.DX ?? 0;
    referencia = Math.max(st - 5, dx - 5);
    base = cfg.default?.join(' ou ') || 'ST−5 ou DX−5';
  }
  return {
    referencia, base, modificadores: mods,
    jogada: teste(db, personagem, { referencia, modificadores: mods, rotulo: 'Natação', dice }),
    falha: { pfPerdido: 1, proximoTesteEm: 5, regra: 'Ao falhar você engole água, perde 1 PF e faz novo teste em 5 segundos — até se afogar, ser salvo ou obter um sucesso e tirar a cabeça da água.' },
    intervaloDeTeste: emCombate ? (submerso ? 2 : 5) : 300,
    velocidade: cfg.velocidadeDeNado || null,
    combateNaAgua: cfg.combateNaAgua || null,
    regras: cfg.regras || [],
    livrarSeDeItens: cfg.modificadores?.itensParaRemover || null,
  };
}

/** Deslocamento nadando: metade do NH em Natação (arredondado para cima). */
export function velocidadeDeNado(db, { nhNatacao = 0, nivelDeCarga = 0 } = {}) {
  return {
    curtaDistancia: Math.ceil(nhNatacao / 2),
    longaDistanciaEm10s: Math.max(0, nhNatacao - 2 * nivelDeCarga),
    regra: dados(db).natacao?.velocidadeDeNado?.curtaDistancia || '',
    fadiga: dados(db).natacao?.velocidadeDeNado?.fadiga || '',
  };
}

/** Salvando vidas: Natação −5 ± (ST do salvador − ST da vítima). */
export function salvarAfogado(db, personagem, { stVitima = 0, nhNatacao = null, modificadores = [], dice = DICE } = {}) {
  const cfg = dados(db).natacao?.salvandoVidas || {};
  const stSalvador = personagem?.atributos?.ST ?? 0;
  const ajuste = stSalvador - stVitima;
  const mods = [
    ...modificadores,
    { fonte: 'Redutor base de salvamento', valor: cfg.redutorBase ?? -5 },
    { fonte: `Diferença de ST (salvador ${stSalvador} − vítima ${stVitima})`, valor: ajuste },
  ];
  let referencia = nhNatacao ?? null;
  if (referencia == null) {
    referencia = Math.max((personagem?.atributos?.ST ?? 0) - 5, (personagem?.atributos?.DX ?? 0) - 5);
  }
  const jogada = teste(db, personagem, { referencia, modificadores: mods, rotulo: 'Natação — salvar afogado', dice });
  return {
    referencia, modificadores: mods, jogada,
    consequencia: jogada.sucesso ? 'Salvamento bem sucedido.'
      : jogada.tipo === 'falha-critica' || jogada.tipo === 'falha-critica-3d'
        ? (cfg.falhaCritica || 'Falha crítica: a vítima quase o afogou (−10 ST) e você desistiu do salvamento.')
        : (cfg.falha || 'Falha: você engoliu água, −1 ST.'),
    regra: cfg.regra || '', dica: cfg.dica || null,
  };
}

/* ------------------------------------------------------------------ sentidos */

/** Visão, Audição e Olfato/Paladar — todos feitos contra IQ. */
export function sentidosDisponiveis(db) {
  const s = dados(db).sentidos || {};
  return [
    { id: 'visao', nome: 'Visão', dados: s.visao },
    { id: 'audicao', nome: 'Audição', dados: s.audicao },
    { id: 'olfato-paladar', nome: 'Olfato/Paladar', dados: s.olfatoPaladar },
  ].filter(x => x.dados);
}

export function testeDeSentido(db, personagem, { sentido = 'visao', modificadores = [], luz = null, dice = DICE, nhOverride = null } = {}) {
  const definicao = sentidosDisponiveis(db).find(s => s.id === sentido);
  if (!definicao) return { erro: `Sentido desconhecido: ${sentido}`, disponiveis: sentidosDisponiveis(db).map(s => s.id) };
  const mods = [...modificadores];
  if (luz) {
    const visaoNoturna = ignoraPenalidadeDeLuz(db, personagem, luz.nivel ?? luz.id ?? null);
    if (visaoNoturna.ignora && (luz.valor ?? 0) < 0) {
      mods.push({ fonte: 'Visão Noturna (Ciópitica)', valor: -(luz.valor ?? 0), nota: visaoNoturna.motivo });
    } else {
      mods.push({ fonte: `Luminosidade (${luz.nivel ?? luz.id ?? 'informada'})`, valor: luz.valor ?? 0, nota: visaoNoturna.motivo || undefined });
    }
  }
  const dasVantagens = bonusDeSentido(db, personagem, CHAVE_SENTIDO[sentido] || sentido);
  mods.push(...dasVantagens.partes);
  const nh = nhOverride ?? personagem?.atributos?.IQ ?? 0;
  return {
    sentido: definicao, nh, base: dados(db).sentidos?.atributoBase || 'IQ',
    jogada: teste(db, personagem, { referencia: nh, modificadores: mods, rotulo: `Sentido — ${definicao.nome}`, dice }),
    modificadores: mods,
    bonusDeVantagens: dasVantagens,
    limites: definicao.dados.limites || null,
    modificadoresPositivos: definicao.dados.modificadoresPositivos || null,
    modificadoresNegativos: definicao.dados.modificadoresNegativos || null,
    compreensao: definicao.dados.compreensao || null,
    nota: dados(db).sentidos?.regra || '',
  };
}

/* ------------------------------------------------------------------ vontade e pânico */

/** Teste de Vontade: VON = IQ — exigido em situações alarmantes ou para superar desvantagem mental. */
export function testeDeVontade(db, personagem, { motivo = null, fobiaGrave = false, emCombate = false, modificadores = [], dice = DICE, nhOverride = null } = {}) {
  const cfg = dados(db).vontade || {};
  const panico = dados(db).panico || {};
  const mods = [...modificadores];
  if (motivo) mods.push({ fonte: `Situação: ${motivo}`, valor: 0 });
  if (fobiaGrave) mods.push({ fonte: 'Fobia grave (objeto da fobia)', valor: -4 });
  if (emCombate) mods.push({ fonte: 'No calor da batalha', valor: panico.modificadores?.calorDaBatalha?.bonus ?? 5 });
  const bonusPanico = bonusDePanico(db, personagem);
  mods.push(...bonusPanico.partes);                             // Reflexos em Combate: +2 em Verificações de Pânico
  const vontade = bonusDeVontade(db, personagem, { ignorarDor: true });
  mods.push(...vontade.partes.filter(p => /vontade/i.test(p.fonte)));   // Força de Vontade (e Hipoalgia, a critério do GM)
  const nh = nhOverride ?? personagem?.atributos?.IQ ?? 0;
  return {
    nh, referencia: nh, modificadores: mods, base: 'VON = IQ',
    jogada: teste(db, personagem, { referencia: nh, modificadores: mods, rotulo: `Vontade${motivo ? ` — ${motivo}` : ''}`, dice }),
    regra: cfg.regra || '',
    desvantagens: cfg.desvantagens || null,
    redutoresPublicados: panico.bonusERedutores || null,
  };
}

/** Verificação de Pânico completa: teste de Vontade e, em caso de falha, 3d + margem → tabela. */
export function verificacaoDePanicoCompleta(db, personagem, opts = {}) {
  const vontade = testeDeVontade(db, personagem, opts);
  if (vontade.jogada.sucesso) return { ...vontade, panico: null, resultado: 'Manteve a compostura.' };
  const margemDaFalha = Math.abs(vontade.jogada.margem ?? 0);
  const panico = verificacaoDePanico(db, { margemDaFalha, dice: opts.dice || DICE });
  return { ...vontade, panico, resultado: panico.entrada?.efeito || null };
}

export { verificacaoDePanico, resultadoPanico };

/** Tabela de pânico publicada (3d + margem da falha → consequências 4…40+). */
export function tabelaDePanico(db) {
  const cfg = dados(db).panico || {};
  return { regra: cfg.rolagem?.regra || '', tabela: cfg.rolagem?.tabela || [], consequencias: cfg.rolagem?.consequencias || '', modificadores: cfg.modificadores || null };
}
