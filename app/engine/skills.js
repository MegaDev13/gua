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

/* ==================================================================================
 * MODELO G.A.U. DE PERÍCIAS — publicação oficial PERÍCIAS
 * (canal #『📕』perícias, Impio 02/08/2026 09:19 e adendo 05/08/2026 20:35;
 *  transcrito em data/skills.json + regras do capítulo em data/pericias.json)
 *
 * "A compra e o avanço de perícias em G.A.U ocorre quando um jogador comprar uma
 *  perícia, já no nível 1, e deposita pontos adicionais nela. Cada ponto representa o
 *  nível do jogador naquela perícia […] se você comprou uma perícia que custa 3 Pontos,
 *  e depoista 1 ponto nela, esta perícia é nível 2."
 *  → nível = 1 + pontos adicionais; custo total = custo publicado + (nível − 1).
 * ================================================================================ */
import { nivelCarga } from './encumbrance.js';
import { temVantagem, nivelDaVantagem } from './vantagens.js';

/** Modelo ativo: 'gau' (publicação oficial) ou 'legado' (tabela de dificuldade 3d6). */
export function modeloDePericias(db, personagem) {
  return personagem?.config?.modeloPericias || db?.rules?.configuraveis?.modeloPericias?.default || 'gau';
}

/** Custo em pontos publicado para a perícia (null quando a publicação traz só a dificuldade). */
export function custoPublicado(skill) {
  const custo = Number(skill?.custoPontos);
  return Number.isFinite(custo) ? custo : null;
}

/** Nível comprado na ficha G.A.U.: `nivel` explícito ou 1 + pontos adicionais depositados. */
export function nivelComprado(entrada) {
  if (!entrada) return null;
  if (Number.isFinite(entrada.nivel)) return Math.max(1, Math.round(entrada.nivel));
  if (Number.isFinite(entrada.pontosAdicionais)) return Math.max(1, 1 + Math.round(entrada.pontosAdicionais));
  return null;
}

/**
 * Nível da entrada aceitando fichas antigas (modelo legado por pontos): quando só existe
 * `pontos`, o NH legado (atributo + offset da tabela de dificuldade) é usado como nível.
 * A conversão entre os dois modelos não é definida pela publicação — fica registrada em
 * data/pericias.json → migracaoDeModelo e no histórico da ficha.
 */
export function nivelDaEntrada(db, personagem, entrada) {
  const comprado = nivelComprado(entrada);
  if (comprado !== null) return comprado;
  if (Number.isFinite(entrada?.pontos)) {
    const legado = nivelTreinado(db, personagem, entrada);
    if (legado?.nivel !== null && legado?.nivel !== undefined) return legado.nivel;
  }
  return null;
}

/** Custo total de uma perícia G.A.U. no nível informado (custo publicado + 1 por nível acima de 1). */
export function custoDaPericiaGAU(skill, nivel = 1) {
  const base = custoPublicado(skill);
  if (base === null) return null;
  return base + Math.max(0, (Number(nivel) || 1) - 1);
}

/** Soma dos custos das perícias da ficha, com a origem de cada valor. */
export function custoPericiasGAU(db, personagem) {
  const partes = [];
  let total = 0;
  let semCusto = 0;
  for (const entrada of personagem?.pericias || []) {
    const skill = db.skill(entrada.id) || entrada;
    const nivel = nivelDaEntrada(db, personagem, entrada) ?? 1;
    const custo = custoDaPericiaGAU(skill, nivel);
    if (custo === null) {
      semCusto++;
      partes.push({ id: skill.id, nome: skill.nome, nivel, custo: 0, custoNaoPublicado: true,
                    motivo: skill._avisoCusto || 'custo em pontos não publicado' });
      continue;
    }
    total += custo;
    partes.push({
      id: skill.id, nome: skill.nome, nivel, custo,
      detalhe: `${custoPublicado(skill)} pts (compra, nível 1) + ${nivel - 1} pt(s) depositado(s)`,
      especialidade: entrada.especialidade || null,
    });
  }
  return { total, partes, semCustoPublicado: semCusto };
}

/** Limite de pontos em perícias na criação: o dobro da idade (não se aplica após a criação). */
export function limitePontosNaCriacao(db, personagem) {
  const regra = db?.pericias?.escolhaInicial || {};
  const idade = Number(personagem?.idade);
  if (!Number.isFinite(idade) || idade <= 0) {
    return { aplicavel: false, limite: null, usado: 0, excedido: false, formula: regra.limiteDePontos?.formula || '2 × idade',
             motivo: 'idade não informada na ficha' };
  }
  const limite = 2 * idade;
  const usado = custoPericiasGAU(db, personagem).total;
  return {
    aplicavel: !!personagem?.config?.emCriacao, limite, usado,
    excedido: usado > limite,
    formula: regra.limiteDePontos?.formula || '2 × idade',
    exemplo: regra.limiteDePontos?.exemplo || null,
    aposCriacao: regra.aposCriacao || 'Este limite não se aplica às perícias acrescentadas após a criação do personagem.',
  };
}

/**
 * Modo de leitura dos pré-definidos (conflito rules.conflitos → pericias-pre-definidos):
 *  · 'publicado' — vale a notação de cada entrada ("IQ 10" absoluto, "IQ-5" relativo)
 *  · 'absoluto'  — tudo lido como valor absoluto
 *  · 'relativo'  — tudo lido como atributo/perícia − N (convenção do material-base)
 */
export function modoPreDefinido(db, personagem) {
  return personagem?.config?.modoPreDefinido || db?.rules?.configuraveis?.modoPreDefinido?.default || 'publicado';
}

/** Nível de Carga informado pela mesa (nome ou índice 0–5) — mesmos nomes de encumbrance.js. */
export function cargaInformada(db, carga) {
  const nomes = ['nenhuma', 'leve', 'media', 'pesada', 'muito pesada', 'acima do maximo'];
  const idx = Number.isFinite(carga) ? Math.max(0, Math.min(5, Math.round(carga)))
    : nomes.indexOf(String(carga || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  const nivel = idx < 0 ? 0 : idx;
  return { nivel, nome: ['Nenhuma', 'Leve', 'Média', 'Pesada', 'Muito Pesada', 'ACIMA DO MÁXIMO'][nivel],
           penalidade: Math.min(4, nivel), informado: true };
}

/** Pré-definidos publicados: melhor fonte usável (atributo, outra perícia treinada, sentido ou referência genérica). */
export function defaultGAU(db, personagem, skill, niveisPericias = {}) {
  if (skill?.semNivelPreDefinido) return null;
  const modo = modoPreDefinido(db, personagem);
  const efetivo = fonte => (modo === 'publicado' ? fonte.modo
    : (modo === 'absoluto' ? 'absoluto' : 'relativo'));
  const numero = fonte => (fonte.modo === 'relativo' ? Math.abs(fonte.ajuste || 0) : (fonte.valor ?? 0));
  const fontes = skill?.preDefinido || [];
  let melhor = null;
  for (const fonte of fontes) {
    let valor = null;
    if (fonte.tipo === 'atributo') {
      const base = Math.min(Number(personagem?.atributos?.[fonte.atributo]) || 0, 20);
      valor = efetivo(fonte) === 'relativo' ? base - numero(fonte) : (fonte.modo === 'relativo' ? base + (fonte.ajuste || 0) : (fonte.valor ?? base));
    } else if (fonte.tipo === 'pericia') {
      // sem cascata: só vale perícia efetivamente treinada
      const nh = niveisPericias[fonte.pericia] ?? niveisPericias[fonte.periciaNome] ?? null;
      if (nh === null) continue;
      valor = efetivo(fonte) === 'relativo' ? nh - numero(fonte) : (fonte.modo === 'relativo' ? nh + (fonte.ajuste || 0) : (fonte.valor ?? nh));
    } else if (fonte.tipo === 'sentido') {
      const per = Math.min(Number(personagem?.atributos?.IQ) || 0, 20);
      valor = efetivo(fonte) === 'relativo' ? per - numero(fonte) : (fonte.modo === 'relativo' ? per + (fonte.ajuste || 0) : (fonte.valor ?? per));
    } else if (fonte.tipo === 'generica') {
      // "qualquer perícia Médica apropriada 5": só se aplica se houver uma perícia treinada daquele tipo
      continue;
    }
    if (valor === null || !Number.isFinite(valor)) continue;
    if (melhor === null || valor > melhor.valor) melhor = { ...fonte, valor, modoLido: efetivo(fonte) };
  }
  return melhor;
}

/** Mapa id/nome → nível efetivo das perícias treinadas (usado pelos pré-definidos e disputas). */
export function niveisPericiasGAU(db, personagem, ctx = {}) {
  const porId = {};
  const porNome = {};
  for (const entrada of personagem?.pericias || []) {
    const skill = db.skill(entrada.id) || entrada;
    const nivel = nivelDaEntrada(db, personagem, entrada);
    if (nivel === null) continue;
    porId[skill.id || entrada.id] = nivel;
    const chave = entrada.especialidade ? `${skill.nome} (${entrada.especialidade})` : skill.nome;
    porNome[chave] = nivel;
    porNome[skill.nome] = Math.max(porNome[skill.nome] ?? -99, nivel);
    porNome[String(skill.nome).toLowerCase()] = porNome[skill.nome];
  }
  return { ...porNome, ...porId };
}

/**
 * Modificadores publicados para a perícia, aplicáveis ao personagem no contexto dado.
 * Só entram os que a ficha permite avaliar: vantagem possuída, carga, familiaridade,
 * nível de especialista e modificadores passados pelo chamador (`ctx.situacoes`).
 */
export function modificadoresPublicadosGAU(db, personagem, skill, entrada = {}, ctx = {}) {
  const mods = [];
  const situacoes = ctx.situacoes || [];
  const nivel = nivelDaEntrada(db, personagem, entrada);

  /* bônus concedidos por vantagens (vínculo publicado em skills.json → modificadores[].vantagem) */
  for (const mod of skill?.modificadores || []) {
    if (!mod.vantagem || !temVantagem(db, personagem, mod.vantagem)) continue;
    if (mod.valor == null) {
      mods.push({ fonte: `${mod.vantagemNome || mod.vantagem}`, valor: 0, situacao: mod.situacao,
                  nota: mod.nota || 'valor depende do nível da vantagem' });
      continue;
    }
    mods.push({ fonte: mod.vantagemNome || mod.vantagem, valor: mod.valor, situacao: mod.situacao,
                origem: 'vantagem', nota: mod.nota || null });
  }

  /* Carisma em Liderança: bônus por nível da vantagem */
  if ((skill?.modificadores || []).some(m => m.vantagem === 'carisma' && m.valor == null)) {
    const carisma = nivelDaVantagem(db, personagem, 'carisma');
    if (carisma) mods.push({ fonte: `Carisma ${carisma}`, valor: carisma, origem: 'vantagem',
                             situacao: 'Liderança: Carisma (se você tiver)',
                             nota: 'a publicação não fixa o valor por nível; usa-se o nível de Carisma' });
  }

  /* nível de especialista publicado (ex.: NH ≥ 20 em Diplomacia/Lábia/Tática/Comércio) */
  if (skill?.nivelEspecialista && nivel !== null && nivel >= skill.nivelEspecialista) {
    for (const mod of skill?.modificadores || []) {
      if (mod.valor == null || !/NH\s*[≥>=]|especialista/i.test(`${mod.situacao || ''} ${mod.nota || ''}`)) continue;
      if (mod.vantagem) continue;
      mods.push({ fonte: `Especialista (NH ≥ ${skill.nivelEspecialista})`, valor: mod.valor,
                  situacao: mod.situacao, origem: 'especialista' });
    }
  }

  /* "menos seu nível de Carga" (Escalada, Furtividade) */
  if ((skill?.modificadores || []).some(m => m.valor == null && /n[íi]vel de Carga/i.test(m.situacao || ''))) {
    const carga = ctx.carga ? cargaInformada(db, ctx.carga) : nivelCarga(db, personagem);
    const penalidade = Number(carga?.nivel ?? carga?.penalidade ?? 0) || 0;
    if (penalidade) mods.push({ fonte: `Carga (${carga?.nome || carga?.nivel || 'nível'})`, valor: -penalidade,
                                origem: 'carga', situacao: 'menos seu nível de Carga' });
  }

  /* Familiaridade: redutor publicado no capítulo (-2) quando a ficha marca equipamento não familiar.
     Não duplica um modificador situacional de "não familiar" já escolhido na mesa. */
  const familiaridadeJaEscolhida = situacoes.some(x => /n[aã]o familiar/i.test(String(x)));
  if (skill?.familiaridadeAplicavel && entrada.familiarizado === false && !familiaridadeJaEscolhida) {
    const redutor = db?.pericias?.familiaridade?.redutor ?? -2;
    mods.push({ fonte: 'Familiaridade', valor: redutor, origem: 'familiaridade',
                situacao: 'tipo de ferramenta com o qual não está familiarizada',
                nota: db?.pericias?.familiaridade ? `${db.pericias.familiaridade.horasParaFamiliarizar} horas de prática tornam o novo modelo familiar` : null });
  }

  /* modificadores situacionais escolhidos na mesa (a publicação lista cada um com seu valor) */
  for (const mod of skill?.modificadores || []) {
    if (mod.vantagem || mod.valor == null) continue;
    const escolhida = situacoes.find(s => s === mod.situacao || s === mod.id || (mod.chave && s === mod.chave));
    if (!escolhida) continue;
    mods.push({ fonte: mod.situacao, valor: mod.valor, origem: 'situacao', nota: mod.nota || mod.faixa || null });
  }

  if (ctx.modificadoresExtra) mods.push(...ctx.modificadoresExtra);
  return mods;
}

/**
 * Nível efetivo G.A.U.: o maior entre o nível comprado e o pré-definido aplicável, somados
 * os modificadores publicados. `nivelEfetivo === null` quando a perícia não é treinada e não
 * tem pré-definido (a publicação diz "Sem nível pré-definido").
 */
export function nivelEfetivoGAU(db, personagem, entrada, ctx = {}) {
  const skill = db.skill(entrada?.id) || entrada || {};
  const niveis = ctx.niveisPericias || niveisPericiasGAU(db, personagem);
  const comprado = nivelDaEntrada(db, personagem, entrada);
  const df = defaultGAU(db, personagem, skill, niveis);
  const mods = modificadoresPublicadosGAU(db, personagem, skill, entrada, ctx);
  const base = Math.max(comprado ?? -Infinity, df?.valor ?? -Infinity);
  const total = mods.reduce((soma, m) => soma + (Number(m.valor) || 0), 0);
  return {
    entrada,
    skill,
    nivelComprado: comprado,
    convertidoDoLegado: comprado !== null && !Number.isFinite(entrada?.nivel) && Number.isFinite(entrada?.pontos),
    custoPublicado: custoPublicado(skill),
    custo: comprado === null ? null : custoDaPericiaGAU(skill, comprado),
    default: df ? { fonte: df.texto || df.base || df.periciaNome, tipo: df.tipo, modo: df.modo, modoLido: df.modoLido, valor: df.valor } : null,
    semNivelPreDefinido: !!skill.semNivelPreDefinido,
    nivelBase: Number.isFinite(base) ? base : null,
    modificadores: mods,
    nivelEfetivo: Number.isFinite(base) ? base + total : null,
    treinada: comprado !== null,
    grupo: skill.grupo || skill.categoria || null,
    especialidade: entrada?.especialidade || null,
  };
}

/** Todas as perícias da ficha com nível efetivo, custo e origem (fachada para UI/engine). */
export function periciasGAU(db, personagem, ctx = {}) {
  const niveis = niveisPericiasGAU(db, personagem);
  const itens = (personagem?.pericias || []).map(entrada => nivelEfetivoGAU(db, personagem, entrada, { ...ctx, niveisPericias: niveis }));
  const custo = custoPericiasGAU(db, personagem);
  return { itens, custo, limiteCriacao: limitePontosNaCriacao(db, personagem), niveis };
}

/**
 * Validação das perícias contra o que foi publicado: pré-requisitos com nível mínimo,
 * limite de pontos na criação (2 × idade), NT mínimo e entradas sem custo publicado.
 */
export function validarPericiasGAU(db, personagem) {
  const erros = [];
  const avisos = [];
  const niveis = niveisPericiasGAU(db, personagem);
  for (const entrada of personagem?.pericias || []) {
    const skill = db.skill(entrada.id) || entrada;
    const nivel = nivelDaEntrada(db, personagem, entrada);

    /* pré-requisito de nível publicado (ex.: Bioquímica exige Química 12+) */
    for (const req of [].concat(skill.prerequisitoNivel || [])) {
      const nh = niveis[req.pericia] ?? null;
      if (nh === null) erros.push(`${skill.nome}: pré-requisito ${db.skill(req.pericia)?.nome || req.pericia} ${req.nivel}+ não treinada.`);
      else if (nh < req.nivel) erros.push(`${skill.nome}: ${db.skill(req.pericia)?.nome || req.pericia} ${nh} < ${req.nivel} (pré-requisito publicado).`);
    }

    /* pré-requisito textual (perícia exigida) */
    if ((skill.prereqs || []).length && !skill.prerequisitoNivel) {
      for (const texto of skill.prereqs) {
        const nome = String(texto).replace(/^pr[eé]-requisitos?:?\s*/i, '').trim();
        const chave = nome.toLowerCase();
        const achou = Object.keys(niveis).some(k => k.toLowerCase().includes(chave.slice(0, 12)) || chave.includes(k.toLowerCase()));
        if (!achou) avisos.push(`${skill.nome}: pré-requisito declarado “${nome}” não consta na ficha.`);
      }
    }

    /* NT mínimo publicado */
    const ntCenario = Number(personagem?.cenario?.nt ?? personagem?.config?.nt ?? NaN);
    if (skill.ntMinimo && Number.isFinite(ntCenario) && ntCenario < skill.ntMinimo) {
      erros.push(`${skill.nome}: disponível apenas em NT ${skill.ntMinimo}+ (cenário em NT ${ntCenario}).`);
    }

    /* sem custo em pontos publicado */
    if (custoPublicado(skill) === null && nivel !== null) {
      avisos.push(`${skill.nome}: ${skill._avisoCusto || 'custo em pontos não publicado'} — nenhum custo foi somado.`);
    }
  }

  const limite = limitePontosNaCriacao(db, personagem);
  if (limite.aplicavel && limite.excedido) {
    erros.push(`Pontos em perícias (${limite.usado}) excedem o limite de criação ${limite.limite} (${limite.formula}).`);
  }
  return { ok: erros.length === 0, erros, avisos };
}

/** Regra de Familiaridade publicada no capítulo (para UI e consultas). */
export function regraDeFamiliaridade(db) {
  const fam = db?.pericias?.familiaridade || {};
  return {
    redutor: fam.redutor ?? -2,
    horasParaFamiliarizar: fam.horasParaFamiliarizar ?? 8,
    limiteDeTipos: fam.limiteDeTipos ?? null,
    testeApos6Tipos: fam.testeApos6Tipos || null,
    pericias: (db?.skills || []).filter(s => s.familiaridadeAplicavel).map(s => s.nome),
    texto: fam.texto || '',
  };
}

/**
 * Compra/venda de níveis no modelo G.A.U. — a perícia entra no nível 1 pelo custo publicado e
 * cada ponto adicional depositado vale +1 nível (canal #『📕』perícias).
 * `disponiveis` e `limiteCriacao` vêm do snapshot (contagemDePontos / limitePontosNaCriacao)
 * para não criar dependência circular com character.js.
 */
export function podeComprarNivelGAU(db, personagem, entrada, delta = 1, { disponiveis = null, limiteCriacao = null } = {}) {
  const erros = [];
  const avisos = [];
  const skill = db.skill(entrada?.id) || entrada || {};
  const nivelAtual = nivelComprado(entrada);
  const temEntrada = Array.isArray(personagem?.pericias) && personagem.pericias.some(e => e.id === skill.id);
  const nivelFinal = temEntrada && nivelAtual !== null ? nivelAtual + delta : (delta > 0 ? 1 : null);

  if (nivelFinal === null) { erros.push('Esta perícia não está na ficha.'); return { ok: false, erros, avisos, custo: 0, nivel: null }; }
  if (nivelFinal < 1) { erros.push('O nível mínimo de uma perícia comprada é 1.'); return { ok: false, erros, avisos, custo: 0, nivel: nivelAtual }; }

  const publicado = custoPublicado(skill);
  if (publicado === null && delta > 0) {
    avisos.push(skill._avisoCusto || 'A publicação não informa o custo em pontos desta perícia — o nível é anotado na ficha, mas não entra na conta de pontos.');
  }
  const custo = delta > 0
    ? (temEntrada && nivelAtual !== null ? delta : (publicado ?? 0))
    : (temEntrada && nivelAtual === 1 ? -(publicado ?? 0) : delta);

  /* pré-requisitos publicados (outra perícia em nível mínimo, NT, vantagem) */
  if (delta > 0) {
    for (const pre of [skill.prerequisitoNivel || []].flat()) {
      if (!pre || typeof pre !== 'object') continue;
      const treinada = (personagem?.pericias || []).find(e => e.id === pre.pericia);
      const nh = treinada ? nivelDaEntrada(db, personagem, treinada) : null;
      if (nh === null || nh < (pre.nivel ?? 1)) {
        erros.push(`Pré-requisito publicado: ${pre.periciaNome || pre.pericia} em nível ${pre.nivel ?? 1} ou mais.`);
      }
    }
    /* pré-requisitos escritos em texto (sem nível publicado): lembrados, não bloqueiam */
    if (!(skill.prerequisitoNivel || []).length && (skill.prereqs || []).length) {
      avisos.push(`Pré-requisito publicado: ${skill.prereqs.join('; ')}`);
    }
    const ntDaFicha = Number(personagem?.nt ?? personagem?.config?.nt ?? NaN);
    if (skill.ntMinimo) {
      if (!Number.isFinite(ntDaFicha)) avisos.push(`Exige NT ${skill.ntMinimo} ou superior (a ficha não declara NT).`);
      else if (ntDaFicha < Number(skill.ntMinimo)) erros.push(`Exige NT ${skill.ntMinimo} ou superior (a ficha declara NT ${ntDaFicha}).`);
    }
  }
  if (disponiveis !== null && custo > disponiveis) {
    erros.push(`Pontos insuficientes: a compra custa ${custo} e restam ${disponiveis}.`);
  }
  if (limiteCriacao !== null && custo > 0) {
    const jaGasto = custoPericiasGAU(db, personagem).total;
    if (jaGasto + custo > limiteCriacao) {
      erros.push(`Limite de criação: ${jaGasto + custo} pontos em perícias ultrapassam ${limiteCriacao} (2 × idade).`);
    }
  }
  return { ok: erros.length === 0, erros, avisos, custo, nivel: nivelFinal };
}
