/* GUA Rule Engine — Sistema Universal de Requisitos
 * checkRequirement(character, requirement) → { ok, motivo, detalhe }
 * Tipos suportados: atributo, pericia, magia, vantagem, desvantagem, equipamento, dinheiro,
 * idade, potencial (Aptidão Mágica), condicao, atributoMaximo.
 */
export function checkRequirement(db, personagem, req) {
  const r = { ok: false, motivo: '', detalhe: null };
  const ctxNiveis = req._niveis || {};
  switch (req.tipo) {
    case 'atributo': {
      const v = personagem.atributos[req.key];
      r.ok = v >= req.min;
      r.motivo = `${req.key} ${v} ${r.ok ? '≥' : '<'} ${req.min}`;
      r.detalhe = v;
      break;
    }
    case 'atributo-exato': {
      const v = personagem.atributos[req.key];
      r.ok = v === req.valor;
      r.motivo = `${req.key} deve ser ${req.valor} (atual ${v})`;
      break;
    }
    case 'pericia': {
      const nh = ctxNiveis[req.nome] ?? req.nhAtual ?? null;
      if (nh === null) { r.motivo = `${req.nome} não treinada (exige NH ≥ ${req.min ?? 12})`; break; }
      r.ok = nh >= (req.min ?? 12);
      r.motivo = `${req.nome} NH ${nh} ${r.ok ? '≥' : '<'} ${req.min ?? 12}`;
      break;
    }
    case 'magia': {
      const nh = ctxNiveis[req.nome] ?? null;
      if (nh === null) { r.motivo = `Magia ${req.nome} não conhecida (exige NH ≥ ${req.min ?? 12})`; break; }
      r.ok = nh >= (req.min ?? 12);
      r.motivo = `${req.nome} NH ${nh} ${r.ok ? '≥' : '<'} ${req.min ?? 12}`;
      break;
    }
    case 'vantagem': {
      const v = (personagem.vantagens || []).find(x => x.id === req.id);
      r.ok = !!v && (req.niveis ? (v.niveis || 1) >= req.niveis : true);
      r.motivo = v ? `${v.nome}${req.niveis ? ` (nível ${v.niveis || 1} de ${req.niveis})` : ''}` : `Requer vantagem: ${req.nome || req.id}`;
      break;
    }
    case 'desvantagem': {
      const v = (personagem.desvantagens || []).find(x => x.id === req.id);
      r.ok = !!v; r.motivo = v ? v.nome : `Requer desvantagem: ${req.nome || req.id}`;
      break;
    }
    case 'equipamento': {
      const v = (personagem.inventario || []).find(x => x.id === req.id || x.nome === req.nome);
      r.ok = !!v; r.motivo = v ? `Possui: ${v.nome}` : `Requer item: ${req.nome || req.id}`;
      break;
    }
    case 'dinheiro': {
      const m = personagem.riqueza?.dinheiro || 0;
      r.ok = m >= req.min;
      r.motivo = r.ok ? `$${m} ≥ $${req.min}` : `Faltam $${req.min - m} (tem $${m}, precisa $${req.min})`;
      break;
    }
    case 'idade': {
      r.ok = (personagem.idade || 0) >= req.min;
      r.motivo = `Idade ${personagem.idade || '?'} ${r.ok ? '≥' : '<'} ${req.min}`;
      break;
    }
    case 'potencial': { // Aptidão Mágica N (pré-requisito de magias, p. 302)
      const am = (personagem.vantagens || []).find(x => x.id === 'aptidao-magica');
      const n = am ? (am.niveis || 1) : 0;
      r.ok = n >= (req.niveis || 1);
      r.motivo = `Aptidão Mágica ${n} ${r.ok ? '≥' : '<'} ${req.niveis || 1}`;
      break;
    }
    case 'condicao': {
      const c = (personagem.combate?.condicoes || []).find(x => x.id === req.id);
      r.ok = !req.presente ? !!c : !c;
      r.motivo = c ? `Condição presente: ${c.nome}` : `Condição ausente: ${req.nome || req.id}`;
      break;
    }
    case 'st-minima': { // ST mínima de arma (não bloqueia uso; aplica penalidade — p. 194)
      r.ok = personagem.atributos.ST >= req.min;
      r.motivo = r.ok ? `ST ${personagem.atributos.ST} ≥ ${req.min}` : `ST insuficiente (${personagem.atributos.ST} < ${req.min}): -1 NH por ponto e +1 fadiga ao fim da luta`;
      break;
    }
    default:
      r.motivo = `Tipo de requisito desconhecido: ${req.tipo} (REGRA NÃO DEFINIDA)`;
  }
  return r;
}

export function checkRequirements(db, personagem, reqs, niveis) {
  const resultados = (reqs || []).map(req => checkRequirement(db, personagem, { ...req, _niveis: niveis || {} }));
  return { ok: resultados.every(r => r.ok), resultados };
}
