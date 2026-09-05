/* GUA Rule Engine — Magia (Módulo de Poderes)
 * Fonte: Magia (p. 300-370). Magias = perícias Mental/Difícil ou Mental/Muito Difícil,
 * sem default, mínimo 1 ponto. Aptidão Mágica soma ao IQ (máx 3 níveis).
 * Custos: "2 para fazer; 1 para manter", "1 a 3", "1/10 por hex (mín 1)" etc.
 */
import { nivelParaPontos, tabelaCustos } from './skills.js';
import { nivelDaVantagem, maximoDeAptidaoMagica } from './vantagens.js';

const DIF_MEN = ['Fácil', 'Média', 'Difícil', 'Muito Difícil'];

/** IQ efetivo para magia = IQ + Aptidão Mágica (máx. 3) + bônus Memória Eidética (p. 301 e canal #『📕』vantagens).
 *  `db` é opcional: sem ele, o nível é lido diretamente da entrada da ficha. */
export function iqMagico(personagem, db = null) {
  let iq = personagem.atributos.IQ;
  const breakdown = [{ fonte: 'IQ', valor: iq }];
  const limiteAptidao = db ? maximoDeAptidaoMagica(db) : 3;
  const aptidao = Math.max(
    Number(personagem.aptidaoMagica) || 0,
    nivelDaVantagem(db, personagem, 'aptidao-magica'),
  );
  const n = Math.min(aptidao, limiteAptidao);
  if (n) { iq += n; breakdown.push({ fonte: `Aptidão Mágica ${n}`, valor: n }); }
  const me = nivelDaVantagem(db, personagem, 'memoria-eidetica');
  if (me) { const b = me >= 2 ? 2 : 1; iq += b; breakdown.push({ fonte: `Memória Eidética (aprendizado)`, valor: b }); }
  return { valor: iq, breakdown };
}

/** Nível de uma magia comprada com pontos (tabela mental, Difícil/Muito Difícil). */
export function nivelMagia(db, personagem, magiaEntry) {
  const spell = db.spell(magiaEntry.id) || magiaEntry;
  const dificuldade = /muito/i.test(spell.dificuldade || '') ? 'Muito Difícil' : 'Difícil';
  const iq = iqMagico(personagem, db).valor;
  const off = nivelParaPontos(db, magiaEntry.pontos, 'Mental', dificuldade);
  if (off === null) return { nivel: null, offset: null, iq, dificuldade };
  return { nivel: iq + off, offset: off, iq, dificuldade };
}

/** Redução de custo por NH alto (p. 311): 15→-1; 20→-2; 25→-3 (a cada +5 a partir de 25: -1 a mais). */
export function reducaoCusto(nh) {
  if (nh >= 30) return 4;
  if (nh >= 25) return 3;
  if (nh >= 20) return 2;
  if (nh >= 15) return 1;
  return 0;
}

/** Custo base de execução (menor valor citado em "Custo"/"Custo Básico"). */
export function custoBase(spell) {
  const txt = `${spell.Custo || ''} ${spell['Custo Básico'] || ''}`;
  const nums = [...txt.matchAll(/\d+(?:[.,]\d+)?/g)].map(m => parseFloat(m[0].replace(',', '.')));
  if (!nums.length) return null;
  return Math.min(...nums);
}

/** Custo de manutenção (menor número após "manter"). */
export function custoManutencao(spell) {
  const txt = `${spell.Custo || ''} ${spell['Custo Básico'] || ''} ${spell.Manutenção || ''}`;
  const m = txt.match(/manter[^0-9]*(\d+(?:[.,]\d+)?)/i);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

/** Conjuração: teste + custo com reduções. mana: 'Muito Alta'|'Alta'|'Normal'|'Baixa'|'Nula' (p. 305-306). */
export function conjurar(db, personagem, magiaEntry, { mana = 'Normal', energiaExtra = 0, dice } = {}) {
  const spell = db.spell(magiaEntry.id) || magiaEntry;
  const nivel = nivelMagia(db, personagem, magiaEntry).nivel;
  if (nivel === null) return { erro: 'Magia não aprendida (mínimo 1 ponto).' };
  const erros = [];
  // Pré-requisitos (p. 302): magias NH>=12 / Aptidão Mágica N / IQ mínimo
  for (const pre of spell['Pré-requisitos'] ? [spell['Pré-requisitos']] : []) {
    erros.push({ aviso: `Verificar pré-requisitos: ${pre}` });
  }
  let nhEfetivo = nivel;
  if (mana === 'Baixa') nhEfetivo -= 5;
  if (mana === 'Nula') return { erro: 'Mana nula: ninguém pode conjurar (p. 306).' };
  if (mana === 'Muito Alta') erros.push({ aviso: 'Mana muito alta: magos não gastam energia; falha comum conta como crítica (p. 305).' });
  const base = custoBase(spell) ?? 0;
  const red = reducaoCusto(nivel);
  const custo = Math.max(0, base + energiaExtra - (mana === 'Muito Alta' ? base : red));
  const resultado = dice ? dice.check(nhEfetivo, { label: `Magia: ${spell.nome}` }) : null;
  let gasto = custo;
  if (resultado) {
    if (resultado.tipo === 'sucesso-decisivo') gasto = 0;
    else if (!resultado.sucesso) gasto = Math.min(1, custo);
  }
  return { spell, nivel, nhEfetivo, custoBase: base, reducao: red, custoFinal: custo, gasto, resultado, erros };
}

/**
 * Pré-requisitos estruturados de uma magia.
 * Quando recebe o banco, resolve nomes contra IDs reais em vez de tentar adivinhar
 * palavras por expressão regular. Trechos que ainda não podem ser automatizados
 * ficam como `texto` e devem ser exibidos como "verificação manual".
 */
export function parsePrereqs(spell, db = null) {
  const text = String(spell['Pré-requisitos'] || '').trim();
  if (!text) return [];
  const normalized = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const haystack = ` ${normalized(text)} `;
  const resolved = [];

  if (db) {
    // Nomes maiores primeiro evitam registrar "Empatia" dentro de "Empatia com Animais".
    const candidates = [
      ...(db.spells || []).filter(item => item.id !== spell.id).map(item => ({ tipo: 'magia', id: item.id, nome: item.nome })),
      ...(db.advantages || []).map(item => ({ tipo: 'vantagem', id: item.id, nome: item.nome })),
    ].sort((a, b) => normalized(b.nome).length - normalized(a.nome).length);
    const occupied = [];
    for (const candidate of candidates) {
      const needle = normalized(candidate.nome);
      if (needle.length < 3) continue;
      const start = haystack.indexOf(` ${needle} `);
      if (start < 0 || occupied.some(range => start >= range[0] && start < range[1])) continue;
      occupied.push([start, start + needle.length + 2]);
      resolved.push(candidate);
    }
  }

  // Aptidão e atributos são requisitos próprios, não referências a verbetes.
  if (/Aptid[ãa]o M[áa]gica/i.test(text)) {
    const match = text.match(/Aptid[ãa]o M[áa]gica\s*(\d)/i);
    // Remove a vantagem de mesmo nome para não exigir duas vezes.
    for (let index = resolved.length - 1; index >= 0; index--) if (resolved[index].tipo === 'vantagem' && /aptid/i.test(normalized(resolved[index].nome))) resolved.splice(index, 1);
    resolved.push({ tipo: 'potencial', niveis: match ? parseInt(match[1], 10) : 1 });
  }
  const iqMin = text.match(/IQ\s*(?:maior ou igual a\s*)?(\d+)/i);
  if (iqMin) resolved.push({ tipo: 'atributo', key: 'IQ', min: parseInt(iqMin[1], 10) });
  const dxMin = text.match(/DX\s*(?:maior ou igual a\s*)?(\d+)/i);
  if (dxMin) resolved.push({ tipo: 'atributo', key: 'DX', min: parseInt(dxMin[1], 10) });

  const hasOr = /\bou\b/i.test(text);
  if (hasOr && resolved.length > 1) return [{ tipo: 'grupo-ou', requisitos: resolved, texto: text }];
  if (resolved.length) {
    // Se há quantificadores/escolas não estruturados, preserva também o texto para revisão.
    if (/pelo menos|m[aá]gicas? de|qualquer|uma das/i.test(text)) resolved.push({ tipo: 'texto', texto: text });
    return resolved;
  }
  return [{ tipo: 'texto', texto: text }];
}
