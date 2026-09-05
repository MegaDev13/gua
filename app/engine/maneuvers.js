/* GUA Rule Engine — Árvore de Manobras (combate G.A.U)
 * Fonte: MANOBRA BÁSICA: MOVIMENTO / ATACAR / PREPARAR / APONTAR / ANALISAR / FAZER NADA
 * — canal #『📕』testes-e-combate. Dados em data/maneuvers.json (efeitos transcritos 1:1).
 *
 * A interface escolhe o caminho na árvore; este módulo devolve os modificadores publicados
 * e resolve a jogada em d20 contra a margem de sucesso da referência (resolution.js).
 */
import { DICE } from './dice.js';
import { testeD20, avaliarDisputa, penalidadeDeLuz } from './resolution.js';
import { referenciaDeAtaque, esquivaGAU, apararGAU, bloqueioGAU } from './derived.js';
import { avaliarDanoGAU, grauDeDano, armaPorId, rolarDanoDaArma } from './damage.js';

/* ------------------------------------------------------------------ navegação na árvore */

function coletar(no, trilha, origem, lista) {
  if (!no || typeof no !== 'object') return lista;
  if (no.id && no.nome) {
    lista.push({
      ...no,
      manobra: origem.manobra,
      manobraNome: origem.manobraNome,
      grupo: origem.grupo,
      trilha: [...trilha, no.nome],
      caminho: no.rotulo || null,
    });
  }
  const ramo = no.nome ? [...trilha, no.nome] : trilha;
  for (const chave of ['estilos', 'formas', 'caminhos', 'derivacoes', 'opcoes']) {
    for (const filho of no[chave] || []) coletar(filho, ramo, origem, lista);
  }
  return lista;
}

/** Lista achatada de todos os nós da árvore (manobras básicas, estilos, caminhos e derivações). */
export function listaManobras(db) {
  const lista = [];
  for (const manobra of db.maneuvers?.manobras || []) {
    const origem = { manobra: manobra.id, manobraNome: manobra.nome, grupo: manobra.tipo };
    coletar(manobra, [], origem, lista);
  }
  return lista;
}

/** Localiza um nó da árvore pelo id (ex.: 'finta', 'ataque-pesado', 'zatoichi'). */
export function acharManobra(db, id) {
  return listaManobras(db).find(n => n.id === id) || null;
}

/** Nós filhos diretos de um nó (para montar a árvore na interface). */
export function filhosDe(db, id) {
  const todos = listaManobras(db);
  const pai = todos.find(n => n.id === id);
  if (!pai) return [];
  const trilhaPai = pai.trilha.join(' › ');
  return todos.filter(n => n.trilha.length === pai.trilha.length + 1 && n.trilha.slice(0, -1).join(' › ') === trilhaPai);
}

/* ------------------------------------------------------------------ empunhaduras */

export function empunhaduras(db) { return db.maneuvers?.empunhaduras?.lista || []; }

export function empunhadura(db, id) { return empunhaduras(db).find(e => e.id === id) || null; }

/** Bônus da empunhadura aplicáveis ao contexto atual (nada é somado sem gatilho publicado). */
export function bonusDeEmpunhadura(db, empunhaduraId, ctx = {}) {
  const e = empunhadura(db, empunhaduraId);
  if (!e?.bonus) return { bonus: [], total: 0, empunhadura: e };
  const bonus = [];
  const b = e.bonus;
  if (b.ataquesDeForca && ctx.atributoDoAtaque === 'ST') bonus.push({ fonte: `${e.nome}: +1 em ataques baseados em Força`, valor: b.ataquesDeForca });
  if (b.ataquesDuranteMovimento && ctx.duranteMovimento) bonus.push({ fonte: `${e.nome}: +1 em ataques realizados durante Movimento`, valor: b.ataquesDuranteMovimento });
  if (b.primeiroAtaqueAposSaque && ctx.aposSaqueRapido) bonus.push({ fonte: `${e.nome}: +2 no primeiro ataque após Saque Rápido`, valor: b.primeiroAtaqueAposSaque });
  if (b.ataquesAcrobaticos && ctx.ataqueAcrobatico) bonus.push({ fonte: `${e.nome}: +1 em Ataques Acrobáticos`, valor: b.ataquesAcrobaticos });
  return { bonus, total: bonus.reduce((a, x) => a + x.valor, 0), empunhadura: e };
}

/* ------------------------------------------------------------------ apontar */

/** Precisão Extraordinária: PREC da arma no 1º segundo + 1 por segundo adicional + arma firmada. */
export function bonusDeApontar(db, { arma = null, segundos = 1, firmada = false, categoriaPrecisao = null } = {}) {
  const partes = [];
  const categoria = categoriaPrecisao || arma?.categoriaPrecisao || arma?.precisaoCategoria || null;
  const linha = categoria
    ? (db.armas?.precisao?.tabela || []).find(l => l.id === categoria || l.categoria.toLowerCase() === String(categoria).toLowerCase())
    : null;
  if (linha) partes.push({ fonte: `PREC da arma (${linha.categoria})`, valor: linha.prec });
  else if (arma) partes.push({ fonte: 'PREC: categoria da arma não listada na Tabela de Precisão', valor: 0, aviso: 'REGRA NÃO DEFINIDA — a tabela publicada cobre apenas categorias de ataque à distância.' });

  const adicionais = Math.max(0, (Number(segundos) || 1) - 1);
  if (adicionais > 0) partes.push({ fonte: `Pontaria Certeira: +1 por segundo adicional (${adicionais}s)`, valor: adicionais });

  if (firmada) {
    const elegivel = !categoria || /besta|pistola|fuzil|carabina|rifle|submetralhadora|espingarda|metralhadora|sniper|laser|energia|precis/i.test(String(categoria));
    if (elegivel) partes.push({ fonte: 'Arma Firmada: besta ou arma de fogo apoiada em superfície estável', valor: 1 });
    else partes.push({ fonte: 'Arma Firmada exige besta ou arma de fogo apoiada', valor: 0 });
  }
  return { bonus: partes, total: partes.reduce((a, p) => a + p.valor, 0), segundos, linha };
}

/* ------------------------------------------------------------------ modificadores da árvore */

/** Efeitos publicados de um caminho da árvore, prontos para aplicar em uma jogada. */
export function efeitosDeManobra(db, manobraId, ctx = {}) {
  const no = acharManobra(db, manobraId);
  const resultado = {
    id: manobraId,
    no,
    nome: no?.nome || manobraId,
    trilha: no?.trilha || [],
    ataque: [],
    defesasDoAlvo: [],
    ataques: 1,
    penalidadesPorAtaque: [],
    danoExtraDados: 0,
    danoFixoExtra: 0,
    danoExtraEstruturas: 0,
    ignoraRD: 0,
    localizacao: false,
    ignoraPenalidadeLocal: false,
    condicao: null,
    area: null,
    grauMaximo: null,
    arremesso: null,
    recuo: null,
    atravessaAlvo: false,
    requisitos: [],
    notas: [],
    aviso: null,
    forma: 'simples',
  };
  if (!no) { resultado.aviso = `Caminho '${manobraId}' não encontrado na árvore de manobras.`; return resultado; }

  const efeitos = no.efeitos || {};
  const trilhaLower = resultado.trilha.join(' ').toLowerCase();
  resultado.forma = trilhaLower.includes('acrob') ? 'acrobatico'
    : trilhaLower.includes('pesad') ? 'pesado'
      : trilhaLower.includes('distância') || trilhaLower.includes('saraivada') || trilhaLower.includes('tiro') ? 'distancia'
        : (no.ataque === 'pesado' ? 'pesado' : no.ataque === 'distancia' ? 'distancia' : 'simples');
  if (no.ataque === 'pesado') resultado.forma = 'pesado';
  if (no.ataque === 'distancia') resultado.forma = 'distancia';

  if (typeof efeitos.modsAtaque === 'number' && efeitos.modsAtaque) resultado.ataque.push({ fonte: `${no.nome}: ${efeitos.modsAtaque > 0 ? '+' : ''}${efeitos.modsAtaque}`, valor: efeitos.modsAtaque });
  if (typeof efeitos.modsDefesaAlvo === 'number' && efeitos.modsDefesaAlvo) resultado.defesasDoAlvo.push({ fonte: `${no.nome}: alvo ${efeitos.modsDefesaAlvo} nas Defesas Ativas`, valor: efeitos.modsDefesaAlvo });
  if (efeitos.ataques) resultado.ataques = efeitos.ataques;
  if (Array.isArray(efeitos.penalidadesPorAtaque)) resultado.penalidadesPorAtaque = efeitos.penalidadesPorAtaque;
  if (efeitos.ignoraRD) resultado.ignoraRD = efeitos.ignoraRD;
  if (efeitos.danoFixoExtra) resultado.danoFixoExtra = efeitos.danoFixoExtra;
  if (efeitos.danoExtraEstruturas) resultado.danoExtraEstruturas = efeitos.danoExtraEstruturas;
  if (efeitos.localizacao) resultado.localizacao = true;
  if (efeitos.ignoraPenalidadeLocal) resultado.ignoraPenalidadeLocal = true;
  if (efeitos.condicao) resultado.condicao = efeitos.condicao;
  if (efeitos.area) resultado.area = efeitos.area;
  if (efeitos.grauMaximo) resultado.grauMaximo = efeitos.grauMaximo;
  if (efeitos.arremesso) resultado.arremesso = efeitos.arremesso;
  if (efeitos.atravessaAlvo) resultado.atravessaAlvo = true;
  if (efeitos.recuoAte) resultado.recuo = efeitos.recuoAte;
  if (efeitos.danoExtra === '+1d') resultado.danoExtraDados += 1;
  if (efeitos.danoCenario === '+1d') resultado.danoExtraDados += 1;

  if (no.requisitos) resultado.requisitos.push(...no.requisitos);
  if (no.textoEfeito) resultado.notas.push(no.textoEfeito);
  if (no.descricao) resultado.notas.push(no.descricao);

  // Saraivada/Semiautomático/Automático: penalidades publicadas por disparo
  if (resultado.id === 'semiautomatico' && !resultado.penalidadesPorAtaque.length) resultado.penalidadesPorAtaque = Array(5).fill(-2);
  if (db.maneuvers?._avisoDistancia && resultado.forma === 'simples') resultado.aviso = db.maneuvers._avisoDistancia;
  return resultado;
}

/* ------------------------------------------------------------------ execução do ataque */

/** Resolve um ataque completo: referência → d20 dentro da margem → dano → Grau de Dano. */
export function executarAtaque(db, personagem, {
  manobra = 'ataque-simples', arma = null, empunhaduraId = null,
  segundosApontando = 0, armaFirmada = false, categoriaPrecisao = null,
  distancia = null, luz = 'luz-total', rdAlvo = 0, local = 'Torso',
  alvo = null, niveisPericias = null, montado = null, duranteMovimento = false,
  aposSaqueRapido = false, modificadores = [], categoria = null, modo = 'melhor',
  dice = DICE, danoInformado = null,
} = {}) {
  const efeitos = efeitosDeManobra(db, manobra);
  const armaResolvida = resolverArma(db, arma);
  const mods = [...modificadores];

  // modificadores publicados da árvore
  mods.push(...efeitos.ataque);

  // empunhadura
  const emp = bonusDeEmpunhadura(db, empunhaduraId, {
    atributoDoAtaque: efeitos.forma === 'acrobatico' ? 'DX' : 'ST',
    duranteMovimento: duranteMovimento || /investida|mover-e-atacar|combo-com-cenario|grande-salto|cambalhota/.test(manobra),
    ataqueAcrobatico: efeitos.forma === 'acrobatico',
    aposSaqueRapido,
  });
  mods.push(...emp.bonus);

  // apontar (manobra própria: só se o personagem passou segundos apontando)
  const apontar = segundosApontando > 0
    ? bonusDeApontar(db, { arma: armaResolvida, segundos: segundosApontando, firmada: armaFirmada, categoriaPrecisao })
    : null;
  if (apontar) mods.push(...apontar.bonus.filter(p => !p.aviso));

  // luminosidade
  const luzPen = penalidadeDeLuz(db, luz);
  if (luzPen.valor) mods.push({ fonte: `Luminosidade (${luzPen.nivel})`, valor: luzPen.valor });

  // distância mínima do ataque à distância
  if (efeitos.forma === 'distancia' && distancia != null && distancia < (db.maneuvers?.manobras?.find(m => m.id === 'atacar')?.distanciaMinima ?? 10)) {
    mods.push({ fonte: `Alvo a ${distancia} m: distância inferior a 10 m não é a condição ideal para um ataque à distância`, valor: 0, aviso: 'REGRA NÃO DEFINIDA — o valor da penalidade para distância curta não foi publicado.' });
  }

  const referencia = referenciaDeAtaque(db, personagem, {
    arma: armaResolvida ? { ...armaResolvida, nh: armaResolvida.nh } : null,
    forma: efeitos.forma === 'acrobatico' ? 'acrobatico' : efeitos.forma === 'pesado' ? 'pesado' : 'simples',
    niveisPericias, montado,
  });

  const ataques = [];
  const totalAtaques = Math.max(1, efeitos.ataques || 1);
  for (let i = 0; i < totalAtaques; i++) {
    const modsDoGolpe = [...mods];
    const pen = efeitos.penalidadesPorAtaque?.[i];
    if (pen) modsDoGolpe.push({ fonte: `${efeitos.nome}: ${i + 1}º ataque (${pen})`, valor: pen });
    const jogada = testeD20(db, {
      referencia: referencia.valor,
      modificadores: modsDoGolpe,
      rotulo: `${armaResolvida?.nome || 'Ataque'} — ${efeitos.nome}${totalAtaques > 1 ? ` (${i + 1}/${totalAtaques})` : ''}`,
      categoria: categoria || personagem?.categoria || 'mundano',
      modo, dice, personagem,
    });
    let dano = null;
    if (jogada.sucesso) {
      dano = avaliarDanoGAU(db, {
        bruto: danoInformado ?? (armaResolvida?.dano ? rolarDanoDaArma(db, armaResolvida, { dice }).total : null),
        expr: danoInformado == null && !armaResolvida?.dano ? '1d6' : null,
        rd: rdAlvo,
        local,
        bonus: efeitos.danoFixoExtra,
        ignoraRD: efeitos.ignoraRD,
        dadoExtra: efeitos.danoExtraDados,
        limiteGrau: efeitos.grauMaximo,
        dice,
      });
    }
    ataques.push({ indice: i + 1, jogada, dano });
  }

  const acertos = ataques.filter(a => a.jogada.sucesso);
  const danoTotal = acertos.reduce((soma, a) => soma + (a.dano?.dano || 0), 0);
  return {
    manobra: efeitos,
    arma: armaResolvida,
    referencia,
    empunhadura: emp.empunhadura,
    apontar,
    luz: luzPen,
    ataques,
    acertos: acertos.length,
    danoTotal,
    grau: grauDeDano(db, danoTotal),
    condicaoImposta: acertos.length && efeitos.condicao ? efeitos.condicao : null,
    defesasDoAlvo: efeitos.defesasDoAlvo,
    alvo,
    aviso: referencia.aviso || efeitos.aviso || null,
  };
}

/** Arma: pode vir do arsenal (id/nome), do inventário da ficha, ou ser um objeto livre. */
export function resolverArma(db, arma) {
  if (!arma) return null;
  if (typeof arma === 'string') return armaPorId(db, arma) || { nome: arma, dano: null };
  if (arma.id) {
    const doArsenal = armaPorId(db, arma.id);
    if (doArsenal) return { ...doArsenal, ...arma, dano: arma.dano || doArsenal.dano };
  }
  return arma;
}

/* ------------------------------------------------------------------ defesas ativas */

/** Defesa ativa contra um ataque: Disputa de Habilidades (vence o mais próximo do próprio crítico). */
export function defender(db, alvo, { tipo = 'esquiva', ataque = null, arma = null, escudo = null, niveisPericias = null, modificadores = [], criterio = 'proximidade-do-critico', dice = DICE, contexto = {} } = {}) {
  const bases = {
    esquiva: () => esquivaGAU(db, alvo, contexto),
    aparar: () => apararGAU(db, alvo, { arma, niveisPericias }),
    bloqueio: () => bloqueioGAU(db, alvo, { escudo }),
  };
  const fabrica = bases[tipo];
  if (!fabrica) return { erro: `Defesa ativa desconhecida: ${tipo} (use esquiva, aparar ou bloqueio).` };
  const defesa = fabrica();
  if (tipo === 'bloqueio' && !defesa.escudo) {
    return { erro: 'Bloqueio exige um escudo: "Baseado no uso de um escudo e na ST".', defesa };
  }
  const mods = [...modificadores, ...(ataque?.defesasDoAlvo || [])];
  const jogada = testeD20(db, {
    referencia: defesa.valor,
    modificadores: mods,
    rotulo: `${tipo === 'esquiva' ? 'Esquiva' : tipo === 'aparar' ? 'Aparar' : 'Bloqueio'} (${defesa.base})`,
    categoria: alvo?.categoria || 'mundano',
    dice, personagem: alvo,
  });
  if (!ataque) return { tipo, defesa, jogada, resultado: jogada.sucesso ? 'defendeu' : 'não defendeu' };
  const disputa = avaliarDisputa(db, ataque.jogada || ataque, jogada, { criterio });
  return {
    tipo, defesa, jogada, disputa,
    resultado: disputa.vencedor === 'B' ? 'defendeu' : disputa.vencedor === 'A' ? 'foi atingido' : 'empate',
    motivo: disputa.motivo,
  };
}

/* ------------------------------------------------------------------ condições e estado */

export const CONDICOES_GAU = [
  { id: 'atordoado', nome: 'Atordoado', nota: 'Solta tudo que estiver segurando; só pode realizar a manobra Fazer Nada até seu próximo turno.' },
  { id: 'caido', nome: 'Caído', nota: 'Caiu da sela/foi ao chão — calcule o resultado da queda ou colisão.' },
  { id: 'cego', nome: 'Cego', nota: 'Personagens cegos ou em lugares completamente escuros não são capazes de ver nada.' },
  { id: 'surdo', nome: 'Surdo', nota: 'Personagens surdos não são capazes de ouvir nada.' },
  { id: 'engolindo-agua', nome: 'Engolindo água', nota: 'Falha em Natação: perde 1 PF e faz novo teste em 5 segundos.' },
  { id: 'inconsciente', nome: 'Inconsciente', nota: 'Sem ações; ver regras de ferimentos e pânico.' },
];

/** Manobras permitidas para um personagem atordoado. */
export function manobraPermitida(db, personagem, manobraId) {
  const atordoado = (personagem?.combate?.condicoes || []).some(c => c.id === 'atordoado');
  if (atordoado && manobraId !== 'fazer-nada') {
    return { ok: false, motivo: 'Atordoado: solta tudo que estiver segurando e só pode realizar a manobra Fazer Nada até seu próximo turno.' };
  }
  return { ok: true };
}
