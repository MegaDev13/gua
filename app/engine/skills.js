/* GUA Rule Engine — Perícias
 * Fonte: Perícias (p. 100-112): tabela de custos, defaults, especialização,
 * familiaridade, pré-requisitos (NH>=12), limite de pontos por idade (2x idade).
 */
import { ATRIBUTOS } from './attributes.js';

const DIF_FIS = ['Fácil', 'Média', 'Difícil'];
const DIF_MEN = ['Fácil', 'Média', 'Difícil', 'Muito Difícil'];

function colIndex(dificuldade, tipo) {
  const cols = tipo === 'Física' ? DIF_FIS : DIF_MEN;
  const i = cols.indexOf(dificuldade);
  return i < 0 ? 1 : i;
}

/** Mapa completo offset→custo (inclui progressão acima de +5). */
export function tabelaCustos(db, tipo) {
  const ct = db.tables.custoPericias;
  const raw = tipo === 'Física' ? ct.fisicas : ct.mentais;
  const cols = tipo === 'Física' ? DIF_FIS : DIF_MEN;
  const extra = tipo === 'Física' ? 8 : (raw.acrescimoPorNivelMuitoDificil ?? raw.acrescimoPorNivel);
  const map = {};
  for (const [off, row] of Object.entries(raw.linhas)) {
    map[off] = {};
    cols.forEach((c, i) => map[off][c] = row[i]);
  }
  // progressão: +6..+20
  for (let o = 6; o <= 20; o++) {
    map[String(o)] = {};
    for (const c of cols) {
      let inc = extra;
      if (tipo === 'Mental' && c === 'Muito Difícil') inc = raw.acrescimoPorNivelMuitoDificil ?? 4;
      map[String(o)][c] = map[String(o - 1)][c] + inc;
    }
  }
  return map;
}

/** Nível alcançável com N pontos (offset relativo ao atributo-base). */
export function nivelParaPontos(db, pontos, tipo, dificuldade) {
  const map = tabelaCustos(db, tipo);
  const cols = tipo === 'Física' ? DIF_FIS : DIF_MEN;
  if (!cols.includes(dificuldade)) dificuldade = 'Média';
  let melhor = null;
  for (let off = 20; off >= -4; off--) {
    const c = map[String(off)]?.[dificuldade];
    if (c === null || c === undefined) continue;
    if (c <= pontos) { melhor = off; break; }
  }
  return melhor; // null = pontos insuficientes para o nível mínimo da tabela
}

/** Custo em pontos para alcançar um nível absoluto (atributo + offset). */
export function custoNivel(db, atributoBase, nivelAlvo, tipo, dificuldade) {
  const off = nivelAlvo - atributoBase;
  const map = tabelaCustos(db, tipo);
  const cols = tipo === 'Física' ? DIF_FIS : DIF_MEN;
  if (!cols.includes(dificuldade)) dificuldade = 'Média';
  return map[String(off)]?.[dificuldade] ?? null;
}

/** Custo para melhorar de um nível (já pago) para outro. */
export function custoMelhoria(db, atributoBase, de, para, tipo, dificuldade) {
  const a = custoNivel(db, atributoBase, de, tipo, dificuldade);
  const b = custoNivel(db, atributoBase, para, tipo, dificuldade);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}

const ATTR_RE = /(ST|DX|IQ|HT)\s*([+-]\d+)/g;

/** Interpreta a linha "Pré-definido como..." em candidatos estruturados. */
export function parseDefaults(skill) {
  const outs = [];
  for (const d of skill.defaults || []) {
    const txt = d.replace(/^Pr[ée]-definid[oa]:?\s*como\s*/i, '').trim();
    if (/^sem n[íi]vel pr[ée]-definido/i.test(txt)) continue;
    for (const m of txt.matchAll(ATTR_RE)) {
      outs.push({ tipo: 'atributo', attr: m[1], mod: parseInt(m[2], 10), origem: d });
    }
    // perícia: Nome-2 (nome pode ter acentos, espaços e "/")
    for (const m of txt.matchAll(/([A-ZÀ-Ü][A-Za-zÀ-ü/ ]{2,40}?)\s*([+-]\d+(?:,\d+)?)\b/g)) {
      const nome = m[1].trim().replace(/\s+(para|em|com|que|n[íi]vel).*$/i, '');
      if (['ST', 'DX', 'IQ', 'HT'].includes(nome)) continue;
      outs.push({ tipo: 'pericia', nome, mod: parseInt(m[2].replace(',', '.'), 10), origem: d });
    }
  }
  return outs;
}

/** Melhor default usável pelo personagem (atributos contam como máx. 20; sem cascata — p. 108-109). */
export function melhorDefault(personagem, skill, niveisPericias) {
  let melhor = null;
  for (const c of parseDefaults(skill)) {
    let valor = null;
    if (c.tipo === 'atributo') {
      const at = Math.min(personagem.atributos[c.attr] ?? 0, 20); // máx. 20 (p. 109)
      valor = at + c.mod;
    } else {
      // default a partir de outra perícia: só perícias TREINADAS (não default de default)
      const nh = niveisPericias[c.nome] ?? niveisPericias[c.nome.toLowerCase()] ?? null;
      if (nh !== null) valor = nh + c.mod;
    }
    if (valor !== null && (melhor === null || valor > melhor.valor)) {
      melhor = { ...c, valor };
    }
  }
  return melhor;
}

/** NH treinado de uma perícia comprada em pontos. */
export function nivelTreinado(db, personagem, skillEntry) {
  const skill = db.skill(skillEntry.id) || skillEntry;
  const baseAttr = skillEntry.atributoBase || attrPadrao(skill);
  const attrValor = personagem.atributos[baseAttr] ?? 10;
  const off = nivelParaPontos(db, skillEntry.pontos, skill.tipo, skill.dificuldade);
  if (off === null) return { nivel: null, offset: null, baseAttr, attrValor };
  return { nivel: attrValor + off, offset: off, baseAttr, attrValor };
}

/** Atributo-base padrão: Física→DX; Mental→IQ (exceções conhecidas do material). */
export function attrPadrao(skill) {
  const nome = (skill.nome || '').toLowerCase();
  if (nome.includes('sex-appeal') || nome.includes('sex appeal')) return 'HT';
  return skill.tipo === 'Física' ? 'DX' : 'IQ';
}

/**
 * Nível efetivo final = max(treinado, default) + modificadores.
 * Modificadores suportados: elmo (-1), escudo grande (-2, armas), fadiga (ST), choque, condições.
 */
export function nivelEfetivo(db, personagem, skillEntry, ctx = {}) {
  const skill = db.skill(skillEntry.id) || skillEntry;
  const baseAttr = skillEntry.atributoBase || attrPadrao(skill);
  const attrValor = personagem.atributos[baseAttr] ?? 10;
  const treino = nivelTreinado(db, personagem, skillEntry);
  const defaults = ctx.niveisPericias || {};
  const df = melhorDefault(personagem, skill, defaults);
  const nivelBase = Math.max(treino.nivel ?? -99, df?.valor ?? -99);
  const mods = [];
  // Elmo: -1 em perícias de combate com arma (p. 184) — só em perícias de combate
  if (ctx.elmo && (skill.categoria || '').includes('Combate')) mods.push({ fonte: 'Elmo', valor: -1 });
  // Escudo grande: -2 com a arma (p. 194-195)
  if (ctx.escudoGrande && (skill.categoria || '').includes('Combate')) mods.push({ fonte: 'Escudo grande', valor: -2 });
  // Fadiga reduz perícias baseadas em ST (p. 298)
  if (baseAttr === 'ST' && (personagem.combate?.fadiga ?? 0) > 0) {
    mods.push({ fonte: 'Fadiga', valor: -(personagem.combate.fadiga) });
  }
  // Choque do ferimento (p. 279): -PV perdidos no turno seguinte (aplicado como condição temporária)
  if (ctx.choque) mods.push({ fonte: 'Choque do ferimento', valor: -ctx.choque });
  if (ctx.modificadoresExtra) mods.push(...ctx.modificadoresExtra);
  const totalMods = mods.reduce((a, m) => a + m.valor, 0);
  return {
    skill, baseAttr, attrValor, pontos: skillEntry.pontos,
    offsetTreino: treino.offset,
    nivelTreinado: treino.nivel,
    default: df ? { origem: df.origem, valor: df.valor } : null,
    nivelBase,
    modificadores: mods,
    nivelEfetivo: nivelBase === -99 ? null : nivelBase + totalMods,
  };
}

/** Validação de compra: pontos, idade (2x), pré-requisitos NH>=12. */
export function podeComprarMelhoria(db, personagem, skillEntry, pontosAdicionais) {
  const erros = [];
  const skill = db.skill(skillEntry.id) || skillEntry;
  const baseAttr = skillEntry.atributoBase || attrPadrao(skill);
  const attrValor = personagem.atributos[baseAttr] ?? 10;
  const novoTotal = (skillEntry.pontos || 0) + pontosAdicionais;
  if (novoTotal < 0.5) erros.push('Mínimo de ½ ponto em uma perícia.');
  // pré-requisitos NH >= 12 (p. 112) — verificados nas perícias treinadas
  const niveis = niveisTreinados(db, personagem);
  for (const pre of skill.prereqs || []) {
    const ok = verificaPrereq(pre, niveis, personagem);
    if (!ok.ok) erros.push(`Pré-requisito não atendido: ${pre} (${ok.motivo})`);
  }
  // limite de idade na criação (p. 103)
  if (personagem.config?.emCriacao && personagem.idade) {
    const totalSkills = totalPontosEmPericias(db, personagem) + pontosAdicionais;
    if (totalSkills > 2 * personagem.idade) {
      erros.push(`Limite de pontos em perícias na criação: ${2 * personagem.idade} (2 × idade ${personagem.idade}).`);
    }
  }
  return { ok: erros.length === 0, erros };
}

export function niveisTreinados(db, personagem) {
  const out = {};
  for (const se of personagem.pericias || []) {
    const t = nivelTreinado(db, personagem, se);
    if (t.nivel !== null) {
      const skill = db.skill(se.id) || se;
      const key = (se.especialidade ? `${skill.nome} (${se.especialidade})` : skill.nome);
      out[key] = t.nivel;
      out[skill.nome.toLowerCase()] = Math.max(out[skill.nome.toLowerCase()] ?? -99, t.nivel);
    }
  }
  return out;
}

function verificaPrereq(pre, niveis, personagem) {
  // suporta: "Perícia X em nível >= 12", "Perícia", "Gravidade Zero"
  const m = pre.match(/n[íi]vel\s*(?:maior ou igual a|=|>=?)\s*(\d+)/i);
  const minimo = m ? parseInt(m[1], 10) : 12;
  const nomeM = pre.match(/^(.*?)(?:\s+em n[íi]vel|\s+n[íi]vel|\s+com)/);
  let nome = (nomeM ? nomeM[1] : pre).replace(/[:.]/g, '').trim();
  const nh = niveis[nome] ?? niveis[nome.toLowerCase()] ?? niveis[Object.keys(niveis).find(k => k.toLowerCase().startsWith(nome.toLowerCase().slice(0, 8)) || '')] ?? null;
  if (nh === null) return { ok: false, motivo: `requer ${nome} treinada em NH ≥ ${minimo}` };
  return nh >= minimo ? { ok: true } : { ok: false, motivo: `${nome} NH ${nh} < ${minimo}` };
}

export function totalPontosEmPericias(db, personagem) {
  return (personagem.pericias || []).reduce((a, s) => a + (s.pontos || 0), 0);
}
