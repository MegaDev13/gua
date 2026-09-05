/* GUA Rule Engine — Pontos de Personagem (orçamento único)
 *
 * Um personagem tem um TOTAL de pontos configurável (presets de 25 a 1.000+). Tudo o que é
 * comprado sai do mesmo orçamento: atributos, aparência, status, vantagens, perícias, poderes
 * e mágicas. Desvantagens e peculiaridades DEVOLVEM pontos (custo negativo).
 *
 * Os custos por categoria NÃO são definidos aqui — vêm das fontes oficiais já transcritas:
 *   atributos   → data/tables.json (custoAtributos)            via attributes.js
 *   vantagens   → data/advantages.json                         via traits.js / vantagens.js
 *   desvantagens→ data/disadvantages.json (+ data/desvantagens.json)
 *   perícias    → data/skills.json (custo publicado G.A.U.)    via skills.js
 *   poderes     → data/poderes.json (construtor modular)       via powers.js  — INTACTO
 *   mágicas     → data/magia.json / data/spells.json           via magic.js / spells.js
 * Este módulo só organiza o orçamento, as faixas de campanha e o travamento de gasto.
 * Fonte das faixas/presets: data/pontos.json (integrado da branch arena/01a0543b-gua).
 */
import { contagemDePontos } from './character.js';
import { registrarHistorico } from './economy.js';

/** Presets de total de pontos (25 → 1.000+). */
export function presetsDePontos(db) {
  return db?.pontos?.presets || [];
}

/** Faixas de campanha ("25 a 50 → Pessoas Comuns"). */
export function escalasDePontos(db) {
  return db?.pontos?.escalas || [];
}

/** Itens que não custam pontos (manobras, empunhaduras). */
export function itensGratuitos(db) {
  return (db?.pontos?.gratis || []).map(item => ({ ...item, custo: 0 }));
}

const numero = texto => {
  const limpo = String(texto || '').replace(/\./g, '').replace(',', '.');
  const achados = [...limpo.matchAll(/(\d+)/g)].map(m => Number(m[1]));
  return achados;
};

/** Em qual faixa de campanha o total de pontos cai. */
export function escalaDoPersonagem(db, personagem) {
  const total = totalDePontos(personagem);
  for (const escala of escalasDePontos(db)) {
    const texto = String(escala.pontos || '');
    const [a, b] = numero(texto);
    if (/abaixo/i.test(texto)) { if (total < (a ?? Infinity)) return { ...escala, total }; continue; }
    if (b === undefined) { if (total >= (a ?? 0)) return { ...escala, total }; continue; }
    if (total >= (a ?? 0) && total <= b) return { ...escala, total };
  }
  const ultima = escalasDePontos(db).at(-1);
  return ultima ? { ...ultima, total, acimaDaEscala: true } : { pontos: '—', nivel: '—', descricao: '', total };
}

/** Preset cujo total mais se aproxima do valor pedido (para sugestões na UI). */
export function presetMaisProximo(db, total) {
  const presets = presetsDePontos(db);
  if (!presets.length) return null;
  return presets.reduce((melhor, p) => (Math.abs(p.pontos - total) < Math.abs(melhor.pontos - total) ? p : melhor), presets[0]);
}

/** Total de pontos do personagem (base + extras ganhos em campanha). */
export function totalDePontos(personagem) {
  return (Number(personagem?.pontos?.total) || 0) + (Number(personagem?.pontos?.extrasGanhos) || 0);
}

/** 'unificado' (padrão: tudo sai do mesmo total) ou 'separado' (orçamento próprio de pontos de poder). */
export function modoDoOrcamento(db, personagem) {
  return personagem?.config?.orcamentoPontos || db?.pontos?.orcamento?.padrao || 'unificado';
}

/** Pode estourar o orçamento? (decisão do MJ, fora da criação) */
export function permiteEstourar(db, personagem) {
  return personagem?.config?.permitirEstourarPontos === true;
}

/**
 * Orçamento completo: total, gastos por categoria, o que resta e a faixa de campanha.
 * É a visão única pedida: "se eu gastar em atributo, em poder fica o restante".
 */
export function orcamentoDePontos(db, personagem) {
  const contagem = contagemDePontos(db, personagem);
  const modo = modoDoOrcamento(db, personagem);
  const porCategoria = {};
  for (const parte of contagem.partes || []) {
    const chave = parte.tipo || 'outros';
    porCategoria[chave] ||= { tipo: chave, custo: 0, itens: [] };
    porCategoria[chave].custo += Number(parte.custo) || 0;
    porCategoria[chave].itens.push({ nome: parte.nome, custo: parte.custo, detalhe: parte.detalhe || null });
  }
  /* contagemDePontos já lista os gratuitos; aqui só entra o que faltou (banco antigo). */
  if (!porCategoria.gratis) {
    for (const gratis of itensGratuitos(db)) {
      porCategoria.gratis ||= { tipo: 'gratis', custo: 0, itens: [] };
      porCategoria.gratis.itens.push({ nome: gratis.nome, custo: 0, detalhe: gratis.regra || 'GRÁTIS — não custa pontos' });
    }
  }
  const total = contagem.total;
  const gastos = contagem.gastos;
  return {
    modo,
    total,
    gastos,
    disponiveis: contagem.disponiveis,
    estourado: contagem.disponiveis < 0,
    faltam: contagem.disponiveis < 0 ? -contagem.disponiveis : 0,
    porCategoria: Object.values(porCategoria).sort((a, b) => b.custo - a.custo),
    poderes: contagem.pontosDePoder,
    escala: escalaDoPersonagem(db, personagem),
    preset: presetMaisProximo(db, total),
    permiteEstourar: permiteEstourar(db, personagem),
    validacoes: contagem.validacoes,
    partes: contagem.partes,
  };
}

/**
 * Travamento de gasto: uma compra só passa se couber no que resta.
 * `custo` pode ser negativo (venda/devolução) — nesse caso nunca bloqueia.
 */
export function podeGastar(db, personagem, custo, { categoria = null, item = null } = {}) {
  const valor = Number(custo) || 0;
  const orcamento = orcamentoDePontos(db, personagem);
  if (valor <= 0) return { ok: true, custo: valor, disponiveis: orcamento.disponiveis, faltam: 0, motivo: null };
  if (orcamento.permiteEstourar) {
    return {
      ok: true, custo: valor, disponiveis: orcamento.disponiveis, faltam: 0, motivo: null,
      aviso: orcamento.disponiveis < valor
        ? `Vai estourar o orçamento em ${valor - orcamento.disponiveis} ponto(s) — permitido por config.permitirEstourarPontos.`
        : null,
    };
  }
  if (valor > orcamento.disponiveis) {
    const faltam = valor - orcamento.disponiveis;
    return {
      ok: false, custo: valor, disponiveis: orcamento.disponiveis, faltam,
      motivo: `Sem pontos: ${item ? `${item} custa ` : 'a compra custa '}${valor} e restam ${orcamento.disponiveis} (faltam ${faltam}).`
        + (categoria ? ` [${categoria}]` : ''),
    };
  }
  return { ok: true, custo: valor, disponiveis: orcamento.disponiveis - valor, faltam: 0, motivo: null };
}

/** Limite mínimo/máximo e incrementos publicados para o total de pontos. */
export function limitesDePontos(db) {
  const limites = db?.pontos?.limites || {};
  return {
    minimo: limites.minimo ?? 25,
    maximo: limites.maximo ?? null,
    incrementos: limites.incrementos || [10, 50],
    notaMaximo: limites._notaMaximo || null,
  };
}

/**
 * Ajusta o TOTAL de pontos do personagem (presets, ±10/±50 do widget, campanha).
 * Não inventa limite superior: só respeita o mínimo publicado e registra no histórico.
 */
export function ajustarTotalDePontos(db, personagem, delta, { motivo = null, preset = null } = {}) {
  const { minimo, maximo } = limitesDePontos(db);
  const atual = Number(personagem?.pontos?.total) || 0;
  let novo = preset ? Number(preset.pontos) : atual + (Number(delta) || 0);
  if (Number.isFinite(minimo)) novo = Math.max(minimo, novo);
  if (maximo != null) novo = Math.min(maximo, novo);
  novo = Math.round(novo);
  if (!personagem?.pontos) personagem.pontos = { total: novo, extrasGanhos: 0 };
  const antes = personagem.pontos.total;
  personagem.pontos.total = novo;
  const texto = motivo
    || (preset ? `Total de pontos definido pelo preset "${preset.nome}" (${preset.pontos} pts${preset.descricao ? ` — ${preset.descricao}` : ''}).`
      : `Total de pontos ${novo > antes ? 'aumentado' : 'reduzido'} de ${antes} para ${novo}.`);
  if (novo !== antes) registrarHistorico(personagem, 'pontos', texto);
  return { total: novo, antes, delta: novo - antes, texto };
}

/** Pontos ganhos/perdidos em campanha (campo próprio, somado ao total). */
export function ajustarExtrasGanhos(db, personagem, delta, motivo = null) {
  const atual = Number(personagem?.pontos?.extrasGanhos) || 0;
  const novo = atual + (Number(delta) || 0);
  personagem.pontos ||= { total: 100, extrasGanhos: 0 };
  personagem.pontos.extrasGanhos = novo;
  if (novo !== atual) {
    registrarHistorico(personagem, 'pontos', motivo
      || `Pontos extras de campanha: ${atual} → ${novo} (${novo > atual ? '+' : ''}${novo - atual}).`);
  }
  return { extrasGanhos: novo, total: totalDePontos(personagem) };
}

/** Rótulos amigáveis das categorias de gasto (para o breakdown do orçamento). */
export const ROTULOS_DE_CATEGORIA = {
  atributo: 'Atributos',
  vantagem: 'Vantagens (inclui Aparência/Status)',
  desvantagem: 'Desvantagens (devolvem)',
  peculiaridade: 'Peculiaridades (devolvem)',
  pericias: 'Perícias',
  poderes: 'Poderes',
  magicas: 'Mágicas (G.A.U.)',
  magias: 'Magias (legado 3d)',
  gratis: 'Gratuitos (manobras, empunhaduras)',
  outros: 'Outros',
};

/**
 * Travamento de gasto SEM efeito colateral: aplica `mutar` num clone do personagem e diz
 * se o orçamento único aguenta. A UI chama isto antes de `store.update(...)`: se `ok` for
 * falso, mostra `motivo` e não grava nada (o campo volta ao valor anterior).
 */
export function simularGasto(db, personagem, mutar, rotulo = 'essa compra') {
  const modo = modoDoOrcamento(db, personagem);
  if (permiteEstourar(db, personagem) || db?.pontos?.travamentoDeGasto === false) {
    return { ok: true, modo, aviso: null, motivo: null };
  }
  let rascunho;
  try { rascunho = JSON.parse(JSON.stringify(personagem)); } catch { return { ok: true, modo, aviso: null, motivo: null }; }
  const antes = orcamentoDePontos(db, rascunho).disponiveis;
  try { mutar(rascunho); } catch { return { ok: true, modo, aviso: null, motivo: null }; }
  const orcamento = orcamentoDePontos(db, rascunho);
  if (orcamento.disponiveis >= 0) {
    return {
      ok: true, modo, motivo: null,
      livres: orcamento.disponiveis, gastos: orcamento.gastos,
      aviso: orcamento.disponiveis < antes ? null : null,
    };
  }
  const faltam = -orcamento.disponiveis;
  return {
    ok: false, modo, livres: antes, gastos: orcamento.gastos, faltam, aviso: null,
    motivo: `Pontos insuficientes: ${rotulo} deixaria o orçamento ${faltam} ponto(s) negativo`
      + ` (restam ${antes} de ${orcamento.total}). Aumente o total em Configurações`
      + ' (presets até 1.000+), remova outro gasto ou ligue "Permitir estourar o total".',
  };
}

/** Resumo para o widget do topo: total, gastos, livres, barra e faixa de campanha. */
export function resumoDePontos(db, personagem) {
  const orcamento = orcamentoDePontos(db, personagem);
  const usado = orcamento.total > 0 ? Math.max(0, Math.min(100, Math.round((orcamento.gastos / orcamento.total) * 100))) : 0;
  return {
    total: orcamento.total,
    gastos: orcamento.gastos,
    livres: orcamento.disponiveis,
    porcentagemUsada: usado,
    estourado: orcamento.estourado,
    faltam: orcamento.faltam,
    escala: orcamento.escala,
    modo: orcamento.modo,
    porCategoria: orcamento.porCategoria,
    incrementos: limitesDePontos(db).incrementos,
    presets: presetsDePontos(db),
  };
}
