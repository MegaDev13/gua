/* GUA Rule Engine — Economia
 * Fonte: Riqueza e Status (p. 12-13), Dinheiro (p. 181). Moeda genérica $.
 * Compra: verifica preço, dinheiro, requisitos; bloqueia e explica o motivo.
 */
export function recursosIniciais(personagem, mediaDoCenario) {
  const mult = personagem.riqueza?.multiplicador ?? 1;
  return Math.round(mediaDoCenario * mult);
}

export function podeComprar(personagem, item, qtd = 1) {
  const dinheiro = personagem.riqueza?.dinheiro || 0;
  const preco = (item.custo ?? 0) * qtd;
  const motivos = [];
  if (item.custo === null || item.custo === undefined) motivos.push('Preço não definido no material (REGRA NÃO DEFINIDA).');
  if (preco > dinheiro) motivos.push(`Dinheiro insuficiente: tem $${dinheiro}, preço $${preco} (faltam $${preco - dinheiro}).`);
  return { ok: motivos.length === 0, motivos, preco, dinheiro };
}

export function comprar(personagem, item, qtd = 1) {
  const v = podeComprar(personagem, item, qtd);
  if (!v.ok) return v;
  personagem.riqueza.dinheiro -= v.preco;
  const existente = (personagem.inventario || []).find(i => i.id === item.id && !i.armazenado);
  if (existente) existente.qtd = (existente.qtd || 1) + qtd;
  else personagem.inventario.push(novoItem(item, qtd));
  registrarHistorico(personagem, 'compra', `Comprou ${qtd}× ${item.nome} por $${v.preco}. Saldo: $${personagem.riqueza.dinheiro}.`);
  return { ok: true, ...v };
}

/** Venda: REGRA NÃO DEFINIDA no material (preço de revenda não publicado) — usa valor integral por padrão, configurável. */
export function vender(personagem, itemId, qtd = 1, fator = 1) {
  const item = (personagem.inventario || []).find(i => i.id === itemId);
  if (!item) return { ok: false, motivos: ['Item não encontrado no inventário.'] };
  if ((item.qtd || 1) < qtd) return { ok: false, motivos: [`Quantidade insuficiente (tem ${item.qtd || 1}).`] };
  const ganho = Math.round((item.custo || 0) * qtd * fator);
  item.qtd -= qtd;
  if (item.qtd <= 0) personagem.inventario = personagem.inventario.filter(i => i !== item);
  personagem.riqueza.dinheiro += ganho;
  registrarHistorico(personagem, 'venda', `Vendeu ${qtd}× ${item.nome} por $${ganho}. Saldo: $${personagem.riqueza.dinheiro}.`);
  return { ok: true, ganho, nota: fator === 1 ? 'Material não define preço de revenda (REGRA NÃO DEFINIDA) — usado o valor integral.' : '' };
}

export function novoItem(def, qtd = 1) {
  return {
    id: def.id || `item-${Date.now()}`,
    nome: def.nome, categoria: def.categoria || 'outro',
    custo: def.custo ?? null, peso: def.peso ?? 0, qtd,
    dp: def.dp ?? undefined, rd: def.rd ?? undefined,
    dano: def.dano ?? undefined, tipoDano: def.tipoDano ?? undefined,
    stMin: def.stMin ?? undefined, dm: def.dm ?? undefined,
    alcance: def.alcance ?? undefined, prec: def.prec ?? undefined,
    tr: def.tr ?? undefined, meioDano: def.meioDano ?? undefined, max: def.max ?? undefined,
    periciaId: def.periciaId ?? undefined, notas: def.notas ?? '',
    equipado: false, armazenado: false,
  };
}

export function registrarHistorico(personagem, tipo, texto) {
  personagem.historico = personagem.historico || [];
  personagem.historico.unshift({ quando: new Date().toISOString(), tipo, texto });
  if (personagem.historico.length > 500) personagem.historico.pop();
}
