/* GUA Rule Engine — Combate
 * Fonte: Sistema Básico (p. 220-233), Avançado (p. 233-275), Ferimentos (p. 276-300).
 * Ataque: 3d ≤ NH. Defesa: 3d ≤ PD + defesa ativa. Dano: dados + bônus de arma − RD × multiplicador.
 */
import { danoBasico } from './attributes.js';
import { nivelEfetivo } from './skills.js';
import { deslocamento as calcMov, defesaPassiva, penalidadesEscudo } from './encumbrance.js';

/* O gerador de dados é um singleton compartilhado (dice.js) — usado também pelo núcleo d20.
 * Reexportado aqui por compatibilidade com os módulos e testes já existentes. */
import { DICE as dice, setRNG } from './dice.js';
export { dice, setRNG };

/* ------------------------------------------------------------------ Aparar/Bloqueio/Esquiva */
export function aparar(personagem, skillEntry, ctx = {}) {
  const ef = nivelEfetivo(ctx.db, personagem, skillEntry, ctx);
  if (ef.nivelEfetivo === null) return { valor: null, motivo: 'Perícia não treinada e sem default' };
  const nome = (ef.skill.nome || '').toLowerCase();
  let frac = 1 / 2, extra = '';
  if (nome.includes('bastão')) { frac = 2 / 3; extra = 'Bastão: 2/3 do NH (p. 230)'; }
  else if (nome.includes('esgrima')) { frac = 2 / 3; extra = 'Esgrima: 2/3 com equipamento adequado (p. 230)'; }
  else if (nome.includes('faca')) extra = 'Faca: −1 ao aparar (p. 230)';
  let valor = Math.floor(ef.nivelEfetivo * frac) + (nome.includes('faca') ? -1 : 0);
  // escudo grande: -1 no Aparar (p. 195)
  const esc = penalidadesEscudo(personagem);
  if (esc.escudoGrande) { valor -= 1; }
  return { valor, base: ef.nivelEfetivo, fracao: frac, nota: extra };
}

export function bloqueio(personagem, ctx = {}) {
  const escSkill = (personagem.pericias || []).find(s => ['escudo', 'broquel'].includes(s.id));
  const ef = escSkill ? nivelEfetivo(ctx.db, personagem, escSkill, ctx) : null;
  if (!ef || ef.nivelEfetivo === null) {
    // Escudo improvisado: DX-4 (p. 194)
    return { valor: personagem.atributos.DX - 4, base: personagem.atributos.DX, nota: 'Escudo improvisado: DX-4' };
  }
  return { valor: Math.floor(ef.nivelEfetivo / 2), base: ef.nivelEfetivo, nota: '½ NH Escudo (p. 228)' };
}

export function esquiva(db, personagem, ctx = {}) {
  const mov = calcMov(db, personagem, ctx);
  return { valor: mov.valor, nota: 'Esquiva = Deslocamento (p. 228)', breakdown: mov.breakdown };
}

/* ------------------------------------------------------------------ Ataque */
/** NH de ataque com arma: perícia da arma + mods (elmo, escudo grande, ST mínima, choque, atordoamento). */
export function nhAtaque(db, personagem, arma, ctx = {}) {
  const skillEntry = arma.periciaId
    ? (personagem.pericias || []).find(s => s.id === arma.periciaId)
    : null;
  const mods = [];
  let base = null, fonte = '';
  if (skillEntry) {
    const ef = nivelEfetivo(db, personagem, skillEntry, { ...ctx, elmo: ctx.elmo, escudoGrande: penalidadesEscudo(personagem).escudoGrande && arma.categoria === 'arma' });
    base = ef.nivelEfetivo; fonte = ef.skill.nome;
  } else if (arma.pericia === 'DX' || !arma.pericia) {
    base = personagem.atributos.DX; fonte = 'DX (soco/arma improvisada)';
  } else {
    base = personagem.atributos.DX; fonte = `${arma.pericia} (não treinada — ver default)`;
  }
  // ST mínima da arma: -1 por ponto de ST faltante (p. 194)
  if (arma.stMin && personagem.atributos.ST < arma.stMin) {
    const p = personagem.atributos.ST - arma.stMin;
    mods.push({ fonte: `ST mínima ${arma.stMin} (faltam ${-p})`, valor: p });
  }
  if (ctx.choque) mods.push({ fonte: 'Choque do ferimento', valor: -ctx.choque });
  const atordoado = (personagem.combate?.condicoes || []).some(c => c.id === 'atordoado');
  if (atordoado) mods.push({ fonte: 'Atordoado (não pode agir)', valor: -999 });
  const total = base + mods.reduce((a, m) => a + m.valor, 0);
  return { base, fonte, modificadores: mods, total };
}

/** Executa jogada de ataque (3d ≤ NH efetivo). */
export function rolarAtaque(db, personagem, arma, ctx = {}) {
  const nh = nhAtaque(db, personagem, arma, ctx);
  const mods = ctx.modificadoresAtaque || [];
  const nhFinal = nh.total + mods.reduce((a, m) => a + m.valor, 0);
  const res = dice.check(nhFinal, { label: `Ataque: ${arma.nome}`, modifiers: [...nh.modificadores, ...mods] });
  return { ...res, nh, nhFinal };
}

/** Dano de uma arma: substitui GDP/Bal pelo dano básico do atacante + bônus da arma; DM limita (p. 193). */
export function danoArma(db, personagem, arma) {
  const st = personagem.atributos.ST; // dano básico NÃO é afetado por fadiga (p. 298)
  const basic = danoBasico(db, st);
  const breakdown = [`Dano básico ST ${st}: GDP ${basic.gdp} / Bal ${basic.bal}`];
  let expr = null;
  const d = arma.dano || '';
  const m = String(d).match(/^(GDP|Bal)\s*([+-]\s*\d+)?$/i);
  if (m) {
    const tipo = m[1].toUpperCase() === 'GDP' ? 'gdp' : 'bal';
    const mod = m[2] ? parseInt(m[2].replace(/\s/g, ''), 10) : 0;
    const baseExpr = basic[tipo];
    expr = combinar(baseExpr, mod);
    breakdown.push(`${arma.nome}: ${d} → ${expr}`);
  } else if (/^\d+\s*[dD]/.test(d)) {
    expr = d; breakdown.push(`${arma.nome}: dano fixo ${d}`);
  } else if (d) {
    expr = d; breakdown.push(`${arma.nome}: ${d}`);
  }
  if (arma.dm) breakdown.push(`DM (dano máximo): ${arma.dm}`);
  return { expr, breakdown, tipoDano: arma.tipoDano || 'contusão', dm: arma.dm || null };
}
function combinar(baseExpr, mod) {
  const m = baseExpr.match(/^(\d+)D([+-]\d+)?$/);
  const dados = parseInt(m[1], 10);
  const bmod = m[2] ? parseInt(m[2], 10) : 0;
  const total = bmod + mod;
  return `${dados}D${total ? (total > 0 ? '+' + total : total) : ''}`;
}

/** Avaliação de dano completa: rola dados, aplica RD e multiplicador por tipo (p. 188-191, 230). */
export function avaliarDano(db, { danoExpr, bruto = null, tipoDano = 'contusão', rd = 0, local = 'Tronco', dm = null, perfuranteArmaDeFogo = false }) {
  // bruto = dano já rolado fora (ex.: mestre informa o total); senão rola a expressão
  const rolado = bruto !== null ? { total: bruto, rolls: [] } : dice.damage(danoExpr);
  let detalhes = [bruto !== null
    ? { passo: 'Dano informado (já rolado)', valor: bruto, dados: [] }
    : { passo: `Dano rolado (${danoExpr})`, valor: rolado.total, dados: rolado.rolls }];
  let dano = rolado.total;
  if (dm !== null && dano > dm) { dano = dm; detalhes.push({ passo: 'DM — dano máximo da arma', valor: dm }); }
  const passa = dano - rd;
  detalhes.push({ passo: `Resistência a Dano do alvo (RD ${rd})`, valor: -rd });
  let final = Math.max(0, passa);
  let mult = 1, multTxt = null;
  if (tipoDano === 'corte') { mult = 1.5; multTxt = 'corte +50% (p. 191)'; }
  if (tipoDano === 'perfuracao' || tipoDano === 'perfuração') {
    if (perfuranteArmaDeFogo) { mult = 0.5; multTxt = 'bala perfurante: ÷2 após RD (p. 191)'; }
    else { mult = 2; multTxt = 'perfurante ×2 (p. 191)'; }
  }
  if (local === 'Órgãos vitais' && (tipoDano === 'perfuracao' || tipoDano === 'perfuração' || perfuranteArmaDeFogo)) {
    mult = 3; multTxt = 'vitals: ×3 (p. 245)';
  }
  if ((local === 'Braço' || local === 'Perna' || local === 'Mão' || local === 'Pé') && (tipoDano === 'perfuracao' || tipoDano === 'perfuração' || perfuranteArmaDeFogo)) {
    mult = 1; multTxt = 'perfurante em membro: sem bônus (p. 245)';
  }
  if (multTxt) {
    final = mult >= 1 ? Math.floor(final * mult) : Math.floor(final * mult);
    detalhes.push({ passo: `Multiplicador (${multTxt})`, fator: mult });
  }
  detalhes.push({ passo: 'Dano final (PV perdidos)', valor: final });
  return { rolls: rolado.rolls, bruto: rolado.total, aposRD: Math.max(0, passa), final, detalhes, tipoDano, local };
}

/** Aplica ferimento ao alvo (personagem): registra PV, choque, prostração, nocaute, atordoamento (p. 277-281). */
export function aplicarFerimento(db, alvo, avaliacao) {
  const pv = avaliacao.final;
  const ht = alvo.atributos.HT;
  const ferimentos = (alvo.combate?.ferimentos || 0) + pv;
  const eventos = [`Perdeu ${pv} PV (total: ${ferimentos}; HT base ${ht}).`];
  const efeitos = [];
  const htAtual = ht - ferimentos;
  // Choque: -PV no próximo turno (p. 279)
  if (pv > 0) efeitos.push({ tipo: 'choque', valor: -pv, duracao: 'próximo turno' });
  // Prostração: perda > HT/2 num golpe (p. 280)
  if (pv > ht / 2) efeitos.push({ tipo: 'prostracao', teste: 'HT', duracao: 'imediato', nota: 'Teste HT: falha = cai; sucesso = atordoado' });
  // Nocaute na cabeça (p. 280)
  if (avaliacao.local === 'Cabeça' && pv >= 1) efeitos.push({ tipo: 'nocaute', teste: 'HT', nota: 'Golpe na cabeça: teste HT ou inconsciente' });
  if (avaliacao.local === 'Cérebro' && pv > ht / 2) efeitos.push({ tipo: 'nocaute-automatico', nota: 'Cérebro com perda > HT/2: nocaute automático' });
  // Atordoamento (p. 280)
  if (pv > ht / 2) efeitos.push({ tipo: 'atordoado', recuperacao: 'Teste HT no início do turno' });
  // Lesão incapacitante (p. 280-281)
  const loc = avaliacao.local;
  if ((loc === 'Mão' || loc === 'Pé') && pv >= ht / 3) efeitos.push({ tipo: 'membro-incapacitado', local: loc, nota: `≥ HT/3 (${Math.ceil(ht / 3)})` });
  if ((loc === 'Braço' || loc === 'Perna') && pv >= ht / 2) efeitos.push({ tipo: 'membro-incapacitado', local: loc, nota: `≥ HT/2 (${Math.ceil(ht / 2)})` });
  // Limiares de morte (p. 277-279)
  if (htAtual <= 0) efeitos.push({ tipo: 'teste-consciencia', nota: 'HT ≤ 0: teste HT (com Vontade) no início de cada turno ou desmaia' });
  if (ferimentos >= ht) efeitos.push({ tipo: 'teste-morte', nota: `HT = -HT (${ferimentos} ≥ ${ht}): teste HT ou morre; novo teste a cada 5 PV` });
  if (ferimentos >= 6 * ht) efeitos.push({ tipo: 'morte-automatica', nota: '−5×HT: morte automática' });
  return { ferimentos, htAtual, efeitos, eventos };
}
