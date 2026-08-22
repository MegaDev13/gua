/* GUA Rule Engine — Magia (Módulo de Poderes)
 * Fonte: Magia (p. 300-370). Magias = perícias Mental/Difícil ou Mental/Muito Difícil,
 * sem default, mínimo 1 ponto. Aptidão Mágica soma ao IQ (máx 3 níveis).
 * Custos: "2 para fazer; 1 para manter", "1 a 3", "1/10 por hex (mín 1)" etc.
 */
import { nivelParaPontos, tabelaCustos } from './skills.js';

const DIF_MEN = ['Fácil', 'Média', 'Difícil', 'Muito Difícil'];

/** IQ efetivo para magia = IQ + Aptidão Mágica + bônus Memória Eidética (p. 301). */
export function iqMagico(personagem) {
  let iq = personagem.atributos.IQ;
  const breakdown = [{ fonte: 'IQ', valor: iq }];
  const am = (personagem.vantagens || []).find(v => v.id === 'aptidao-magica');
  if (am) { const n = Math.min(am.niveis || 1, 3); iq += n; breakdown.push({ fonte: `Aptidão Mágica ${n}`, valor: n }); }
  const me = (personagem.vantagens || []).find(v => v.id === 'memoria-eidetica');
  if (me) { const b = (me.niveis || 1) >= 2 ? 2 : 1; iq += b; breakdown.push({ fonte: `Memória Eidética (aprendizado)`, valor: b }); }
  return { valor: iq, breakdown };
}

/** Nível de uma magia comprada com pontos (tabela mental, Difícil/Muito Difícil). */
export function nivelMagia(db, personagem, magiaEntry) {
  const spell = db.spell(magiaEntry.id) || magiaEntry;
  const dificuldade = /muito/i.test(spell.dificuldade || '') ? 'Muito Difícil' : 'Difícil';
  const iq = iqMagico(personagem).valor;
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

/** Pré-requisitos estruturados de uma magia (parse do texto). */
export function parsePrereqs(spell) {
  const txt = spell['Pré-requisitos'] || '';
  const reqs = [];
  for (const m of txt.matchAll(/([A-ZÀ-Ü][\wÀ-ü' ]{2,40}?)(?:\s+em n[íi]vel\s+)?(?:12|maior ou igual a 12)?/g)) {
    const nome = m[1].trim();
    if (nome.length > 2 && !['Pré', 'IQ', 'DX', 'Aptid', 'Utiliz'].some(x => nome.startsWith(x))) {
      reqs.push({ tipo: 'magia', nome });
    }
  }
  if (/Aptid[ãa]o M[áa]gica/i.test(txt)) {
    const n = txt.match(/Aptid[ãa]o M[áa]gica\s*(\d)/i);
    reqs.push({ tipo: 'potencial', niveis: n ? parseInt(n[1], 10) : 1 });
  }
  const iqMin = txt.match(/IQ\s*(?:maior ou igual a\s*)?(\d+)/i);
  if (iqMin) reqs.push({ tipo: 'atributo', key: 'IQ', min: parseInt(iqMin[1], 10) });
  return reqs;
}
