/* GUA Rule Engine — Vantagens/Desvantagens/Peculiaridades
 * Fonte: p. 17-99. Custos: fixos ("5 pontos"), por nível ("2 pontos/nível"),
 * compostos (Riqueza/Status/Aparência com tabelas), variáveis (Aliado/Patrono — fórmulas no data).
 * Peculiaridades: máx 5, -1 ponto cada (p. 88-89).
 */
const RE_PER_LEVEL = /(\d+)\s*pontos?\s*\/\s*n[íi]vel/i;
const RE_TIERS = /^(\d+)\/(\d+)/;
const RE_LIST = /-?\d+/g;

/** Interpreta o texto de custo em uma estrutura computável. */
export function parseCusto(txt) {
  if (!txt) return { modo: 'zero' };
  const pl = txt.match(RE_PER_LEVEL);
  if (pl) return { modo: 'por-nivel', unitario: parseInt(pl[1], 10), negativo: /-/ .test(txt) };
  const tiers = txt.match(RE_TIERS);
  if (tiers && /pontos/.test(txt)) {
    return { modo: 'tiers', valores: (txt.match(RE_LIST) || []).map(Number) };
  }
  const nums = txt.match(RE_LIST);
  if (nums && nums.length) {
    const vals = nums.map(Number);
    if (txt.includes('ou') || txt.includes(',') || txt.includes('-') && vals.length > 1) {
      return { modo: 'escolha', valores: vals };
    }
    return { modo: 'fixo', valor: vals[0] };
  }
  if (/vari[áa]vel/i.test(txt)) return { modo: 'variavel' };
  return { modo: 'zero' };
}

/** Custo efetivo de uma vantagem/desvantagem do personagem. */
export function custoTrait(personagem, entrada, def) {
  // nível composto estruturado (Riqueza, Status, Aparência)
  if (def?.niveis) {
    const nivel = def.niveis.find(n => n.nome === entrada.nivel) || def.niveis.find(n => n.custo === 0);
    return { custo: nivel ? nivel.custo : 0, modo: 'nivel', detalhe: nivel?.nome || '' };
  }
  if (def?.custoPorNivel) {
    return { custo: def.custoPorNivel * (entrada.niveis || 1) * (entrada.sinal || 1), modo: 'por-nivel', detalhe: `${entrada.niveis || 1} nível(is)` };
  }
  const p = parseCusto(entrada.custoTexto || def?.custo || '');
  switch (p.modo) {
    case 'fixo': return { custo: p.valor, modo: 'fixo' };
    case 'por-nivel': {
      const n = entrada.niveis || 1;
      return { custo: p.unitario * n * (p.negativo ? -1 : 1), modo: 'por-nivel', detalhe: `${n} nível(is) × ${p.unitario}` };
    }
    case 'escolha': {
      const v = entrada.custoEscolhido ?? p.valores[0];
      return { custo: v, modo: 'escolha', opcoes: p.valores };
    }
    case 'tiers': {
      const i = Math.min((entrada.niveis || 1) - 1, p.valores.length - 1);
      return { custo: p.valores[i], modo: 'tiers', opcoes: p.valores };
    }
    case 'variavel': return { custo: entrada.custoEscolhido ?? 0, modo: 'variavel' };
    default: return { custo: 0, modo: 'zero' };
  }
}

export const MAX_PECULIARIDADES = 5;

export function pontosPeculiaridades(personagem) {
  const n = (personagem.peculiaridades || []).length;
  return { pontos: -n, quantidade: n, maximo: MAX_PECULIARIDADES };
}
