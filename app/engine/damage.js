/* GUA Rule Engine — Dano: Grau de Dano, arsenal por era, arremesso e estruturas
 * Fontes:
 *  · GRAU DE DANO — #『📕』testes-e-combate (GD1 1–20 · GD2 21–64 · GD3 65+)
 *  · TABELAS DE DANO MUNDANO (armas medievais, modernas e futuristas) — data/armas.json
 *  · O Dano Provocado por Objetos Arremessados — data/armas.json → arremesso
 *  · SISTEMA DE DANO PARA ESTRUTURAS E OBJETOS (Limiar, PE, estados) — data/estruturas.json
 */
import { DICE, rolarDanoGenerico, mediaDeDano } from './dice.js';

/* ------------------------------------------------------------------ Grau de Dano */

/** GD 1 (Raspão 1–20) · GD 2 (Em cheio 21–64) · GD 3 (Letal 65+). */
export function grauDeDano(db, dano) {
  const graus = db.maneuvers?.grauDano?.graus || [
    { grau: 1, id: 'GD1', nome: 'Raspão', min: 1, max: 20 },
    { grau: 2, id: 'GD2', nome: 'Em cheio', min: 21, max: 64 },
    { grau: 3, id: 'GD3', nome: 'Letal', min: 65, max: null },
  ];
  const valor = Number(dano) || 0;
  if (valor <= 0) return { grau: 0, id: 'GD0', nome: 'Sem dano', dano: valor, faixa: '0', conceito: 'Nenhum dano passou da resistência do alvo.', detalhes: null };
  for (const g of graus) {
    const acimaDoMinimo = valor >= g.min;
    const abaixoDoMaximo = g.max === null || g.max === undefined || valor <= g.max;
    if (acimaDoMinimo && abaixoDoMaximo) {
      return {
        grau: g.grau, id: g.id, nome: g.nome, dano: valor,
        faixa: g.max == null ? `${g.min}+` : `${g.min}–${g.max}`,
        conceito: g.conceito || '',
        detalhes: db.maneuvers?.grauDano?.detalhes?.[g.id] || null,
      };
    }
  }
  const ultimo = graus[graus.length - 1];
  return { grau: ultimo.grau, id: ultimo.id, nome: ultimo.nome, dano: valor, faixa: `${ultimo.min}+`, conceito: ultimo.conceito || '', detalhes: null };
}

/** Dano final de um ataque G.A.U: dados da arma + bônus de manobra − RD, com Grau de Dano.
 *  A localização não altera o GD ("Um tiro de 30 de dano na mão → continua sendo GD 2"),
 *  apenas o efeito produzido — por isso ela é registrada, não multiplicada aqui. */
export function avaliarDanoGAU(db, {
  bruto = null, expr = null, rd = 0, local = 'Torso', bonus = 0, ignoraRD = 0,
  dadoExtra = 0, limiteGrau = null, dice = DICE,
} = {}) {
  const passos = [];
  let total = 0;
  if (bruto !== null && bruto !== undefined) {
    total = Number(bruto) || 0;
    passos.push({ passo: 'Dano informado (já rolado)', valor: total });
  } else if (expr) {
    const rolado = rolarDanoGenerico(expr, dice);
    total = rolado.total;
    passos.push({ passo: `Dano rolado (${rolado.expr})`, valor: total, dados: rolado.rolls });
  }
  if (bonus) { total += bonus; passos.push({ passo: 'Bônus de dano da manobra/poder', valor: bonus }); }
  if (dadoExtra) {
    const extra = rolarDanoGenerico(`${dadoExtra}d6`, dice);
    total += extra.total;
    passos.push({ passo: `+${dadoExtra}d de dano (Ataque Pesado / cenário)`, valor: extra.total, dados: extra.rolls });
  }
  const rdEfetiva = Math.max(0, (Number(rd) || 0) - (Number(ignoraRD) || 0));
  if (Number(rd) > 0) {
    passos.push({ passo: `Resistência a Dano do alvo (RD ${rd}${ignoraRD ? ` − ${ignoraRD} ignorada` : ''})`, valor: -rdEfetiva });
  }
  total = Math.max(0, total - rdEfetiva);
  let gd = grauDeDano(db, total);
  if (limiteGrau && gd.grau > limiteGrau) {
    const teto = db.maneuvers?.grauDano?.graus?.find(g => g.grau === limiteGrau);
    passos.push({ passo: `Dano limitado a Grau ${limiteGrau} (${teto?.nome || ''}) pela manobra`, valor: teto?.max ?? total });
    if (teto?.max != null && total > teto.max) { total = teto.max; gd = grauDeDano(db, total); }
  }
  passos.push({ passo: 'Dano final (PV perdidos)', valor: total });
  return { dano: total, grau: gd, rd: Number(rd) || 0, rdEfetiva, local, passos };
}

/* ------------------------------------------------------------------ arsenal */

/** Todas as armas das três eras, achatadas. */
export function arsenal(db) {
  return (db.armas?.eras || []).flatMap(era => (era.armas || []).map(arma => ({ ...arma, era: era.id, eraNome: era.nome })));
}

export function armasPorEra(db, eraId) {
  const era = (db.armas?.eras || []).find(e => e.id === eraId);
  return era ? era.armas || [] : [];
}

export function armaPorId(db, id) {
  return arsenal(db).find(a => a.id === id) || null;
}

export function armaPorNome(db, nome) {
  const alvo = String(nome || '').trim().toLowerCase();
  return arsenal(db).find(a => a.nome.toLowerCase() === alvo)
    || arsenal(db).find(a => a.nome.toLowerCase().includes(alvo)) || null;
}

/** Média publicada × média estatística — conferência da coluna "Média" das tabelas. */
export function mediaDaArma(arma) {
  return { publicada: arma?.media ?? null, calculada: mediaDeDano(arma?.dano), expr: arma?.dano };
}

/** Rola o dano de uma arma do arsenal (d4…d12). */
export function rolarDanoDaArma(db, armaOuId, { dice = DICE, bonus = 0 } = {}) {
  const arma = typeof armaOuId === 'string' ? armaPorId(db, armaOuId) : armaOuId;
  if (!arma?.dano) return { erro: 'Arma sem dano publicado.' };
  const rolado = rolarDanoGenerico(arma.dano, dice);
  const total = Math.max(0, rolado.total + (bonus || 0));
  return { ...rolado, arma: arma.nome, bonus, total, grau: grauDeDano(db, total), media: arma.media };
}

/** Bônus de precisão (PREC) por categoria de arma — manobra Apontar. */
export function precisaoDaArma(db, categoriaOuId) {
  const tabela = db.armas?.precisao?.tabela || [];
  const alvo = String(categoriaOuId || '').toLowerCase();
  return tabela.find(l => l.id === alvo || l.categoria.toLowerCase() === alvo) || null;
}

/* ------------------------------------------------------------------ arremesso */

/** Dano de objeto rombudo arremessado, por ST e faixa de peso (data/armas.json → arremesso). */
export function danoArremessado(db, st, pesoKg) {
  const tabela = db.armas?.arremesso?.tabela || [];
  const linha = tabela.find(l => st >= l.stMin && st <= l.stMax)
    || (st > (tabela[tabela.length - 1]?.stMax ?? 20) ? tabela[tabela.length - 1] : tabela[0]);
  if (!linha) return { erro: 'Tabela de arremesso não encontrada.' };
  const peso = Number(pesoKg) || 0;
  const coluna = peso <= 5 ? 'ate5kg' : peso <= 25 ? 'ate25kg' : peso <= 50 ? 'ate50kg' : 'acima50kg';
  const expr = linha[coluna];
  const rotuloColuna = db.armas?.arremesso?.colunas?.find(c => c.id === coluna)?.rotulo || coluna;
  if (expr == null) {
    return { expr: null, st, peso, coluna: rotuloColuna, erro: `ST ${st} não é capaz de arremessar um objeto de ${rotuloColuna} com dano (célula vazia na tabela).` };
  }
  return { expr, st, peso, coluna: rotuloColuna, media: mediaDeDano(expr), linha };
}

/** Distância do arremesso: ST + peso (arredondado para cima) em metros; com a perícia Arremesso, ST + 6. */
export function distanciaArremesso({ st, pesoKg = 0, periciaArremesso = false, nhArremesso = null } = {}) {
  if (periciaArremesso || nhArremesso != null) {
    const base = (nhArremesso ?? st) + 6;
    return { metros: Math.ceil(base), formula: 'ST+6 (perícia Arremesso)', base, nota: 'Aplica-se somente à Perícia Arremesso em geral, não a Perícias com "Armas arremessadas".' };
  }
  const peso = Math.ceil(Number(pesoKg) || 0);
  return { metros: Math.ceil(st + peso), formula: 'ST + peso (arredondado para cima)', base: st + peso };
}

/* ------------------------------------------------------------------ estruturas e objetos */

export function materiais(db) { return db.estruturas?.estruturas?.materiais || []; }

export function materialPorId(db, id) {
  const alvo = String(id || '').toLowerCase();
  return materiais(db).find(m => m.id === alvo) || materiais(db).find(m => m.material.toLowerCase().includes(alvo)) || null;
}

/** PE (Ponto de Impacto) por tamanho: pequeno (fechadura), médio (porta), grande (parede). */
export function peDe(db, materialId, tamanho = 'medio') {
  const material = materialPorId(db, materialId);
  if (!material) return { erro: `Material desconhecido: ${materialId}` };
  const definicao = (db.estruturas?.estruturas?.tamanhos || []).find(t => t.id === tamanho)
    || { campo: 'peMedio', nome: 'Médio' };
  return { material: material.material, tamanho: definicao.nome, pe: material[definicao.campo] ?? null, campo: definicao.campo };
}

/** Limiar de Dano (Dureza) do material — dano de contato brusco/impacto com o material. */
export function limiarDeDano(db, materialId, { dice = DICE } = {}) {
  const material = materialPorId(db, materialId);
  if (!material) return { erro: `Material desconhecido: ${materialId}` };
  const expr = material.limiarDeDano;
  // Faixa publicada ("4d6 a 6d6"): o material define um intervalo — role as duas pontas
  // e o GM escolhe dentro dela conforme o objeto específico.
  if (/^\d+d\d+ a \d+d\d+$/i.test(String(expr))) {
    const [a, b] = String(expr).split(/ a /i);
    const ra = rolarDanoGenerico(a, dice), rb = rolarDanoGenerico(b, dice);
    return {
      material: material.material, expr, faixa: true,
      rolagens: [ra, rb],
      menor: Math.min(ra.total, rb.total), maior: Math.max(ra.total, rb.total),
      valor: Math.min(ra.total, rb.total),
      nota: `Faixa publicada "${expr}": role as duas extremidades e o GM escolhe o resultado do objeto específico (aqui: ${ra.total} a ${rb.total}).`,
    };
  }
  const rolado = rolarDanoGenerico(expr, dice);
  return { material: material.material, expr, ...rolado, valor: rolado.total };
}

/** Estados de degradação: Intacto (100%), Danificado (≤50%), Destruído (0 PE). */
export function estadoDeDegradacao(db, peAtual, peTotal) {
  const estados = db.estruturas?.estruturas?.estados?.lista || [];
  if (peAtual <= 0) return estados.find(e => e.id === 'destruido') || { id: 'destruido', nome: 'Destruído' };
  if (peTotal > 0 && peAtual <= peTotal / 2) return estados.find(e => e.id === 'danificado') || { id: 'danificado', nome: 'Danificado' };
  return estados.find(e => e.id === 'intacto') || { id: 'intacto', nome: 'Intacto' };
}

/** Aplica dano a uma estrutura/objeto e devolve o novo PE, o estado e as consequências. */
export function danoEmEstrutura(db, { materialId, tamanho = 'medio', dano = 0, peAtual = null, bonusEstrutura = 0, dice = DICE } = {}) {
  const base = peDe(db, materialId, tamanho);
  if (base.erro) return base;
  const peTotal = base.pe;
  const material = materialPorId(db, materialId);
  const passos = [];
  let aplicado = Number(dano) || 0;
  if (bonusEstrutura) { aplicado += bonusEstrutura; passos.push({ passo: `Bônus contra estruturas (Ataque Demolidor: +${bonusEstrutura})`, valor: bonusEstrutura }); }
  let anterior = peAtual ?? peTotal;
  const restante = Math.max(0, anterior - aplicado);
  passos.push({ passo: `PE ${material.material} (${base.tamanho})`, valor: peTotal });
  passos.push({ passo: 'Dano aplicado', valor: -aplicado });
  passos.push({ passo: 'PE restante', valor: restante });
  return {
    material: material.material, tamanho: base.tamanho, peTotal,
    peAnterior: anterior, danoAplicado: aplicado, peRestante: restante,
    estado: estadoDeDegradacao(db, restante, peTotal),
    passos, limiar: material.limiarDeDano,
    consequencias: restante <= 0
      ? ['Destruído: o objeto deixa de funcionar, vira detritos e não pode ser reparado sem magia forte ou ferramentas de artífice e muito tempo.']
      : (anterior > peTotal / 2 && restante <= peTotal / 2
        ? ['Danificado: o objeto perde metade da sua utilidade (porta concede bônus para arrombamento; espada causa metade do dano ou tem chance de quebrar).']
        : []),
  };
}

/* ------------------------------------------------------------------ nível de tecnologia */

export function nivelTecnologico(db, nt) {
  return (db.estruturas?.nivelTecnologico?.tabela || []).find(l => l.nt === Number(nt)) || null;
}
