/* GAU — Motor de Dados d20 com Margens
   Sistema: Atributo determina margem, d20 determina sucesso dentro da margem
*/

export function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

export function rollDice(expr) {
  // Suporta NdX, NdX+Y, NdX-Y, ex: 2d8, 3d10, 1d6+2
  const m = expr.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!m) return { total: 0, rolls: [], expr, error: 'Expressão inválida' };
  const n = parseInt(m[1], 10);
  const faces = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  const rolls = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * faces) + 1;
    rolls.push(r);
    total += r;
  }
  total += mod;
  return { total, rolls, mod, faces, count: n, expr };
}

export function parseDamage(expr) {
  // mesma lógica, mas retorna média também
  const m = expr.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const faces = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  const media = n * (faces + 1) / 2 + mod;
  return { n, faces, mod, media, expr };
}

export function getGrauDano(valor) {
  if (valor <= 0) return { grau: 0, nome: 'Nenhum', desc: 'Sem efeito' };
  if (valor <= 20) return { grau: 1, nome: 'Raspão', id: 'raspao', desc: 'Ferimento limitado' };
  if (valor <= 64) return { grau: 2, nome: 'Em cheio', id: 'cheio', desc: 'Ferimento grave' };
  return { grau: 3, nome: 'Letal', id: 'letal', desc: 'Potencialmente fatal' };
}

export function testarMargem(valorAtributo, db, rolagem = null) {
  // valorAtributo = atributo ou perícia
  // rolagem = se null, rola d20
  const margem = db.getMarginForValue(valorAtributo);
  if (!margem || !margem.margem) {
    return { sucesso: false, critico: false, rolagem: rolagem ?? 0, margem, valor: valorAtributo, motivo: 'Sem margem (valor 1 = nenhuma)' };
  }
  const roll = rolagem ?? rollD20();
  const [low, high] = margem.margem;
  const dentro = roll >= low && roll <= high;
  const critico = roll === margem.critico;
  return {
    sucesso: dentro,
    critico,
    rolagem: roll,
    margem,
    valor: valorAtributo,
    margemTexto: margem.margemTexto,
    distanciaCritico: Math.abs(roll - margem.critico)
  };
}

export function disputaHabilidades(testeA, testeB) {
  // Ambos já são resultados de testarMargem
  // Vence quem estiver mais próximo do próprio crítico, dentro da própria margem
  // Se um sucesso e outro falha, sucesso vence
  // Se ambos sucesso ou ambos falha, menor distância ao crítico vence
  if (testeA.sucesso && !testeB.sucesso) return { vencedor: 'A', motivo: 'A sucesso, B falha' };
  if (!testeA.sucesso && testeB.sucesso) return { vencedor: 'B', motivo: 'B sucesso, A falha' };
  // ambos sucesso ou ambos falha: compara distância ao crítico
  if (testeA.distanciaCritico < testeB.distanciaCritico) return { vencedor: 'A', motivo: `Mais próximo do crítico (${testeA.distanciaCritico} vs ${testeB.distanciaCritico})` };
  if (testeB.distanciaCritico < testeA.distanciaCritico) return { vencedor: 'B', motivo: `Mais próximo do crítico (${testeB.distanciaCritico} vs ${testeA.distanciaCritico})` };
  return { vencedor: 'empate', motivo: 'Mesma distância ao crítico' };
}

export function calcularCarga(ST, pesoKg) {
  // Baseado nas regras: níveis de carga
  // Nenhuma: ST, Leve: 2xST, Média: 3xST, Pesada: 6xST, Muito Pesada: 10xST, Máx: 15xST
  const limites = {
    nenhuma: ST,
    leve: 2 * ST,
    media: 3 * ST,
    pesada: 6 * ST,
    muitoPesada: 10 * ST,
    max: 15 * ST
  };
  let nivel = 0;
  let nome = 'Nenhuma';
  let penalidade = 0;
  if (pesoKg > limites.muitoPesada) { nivel = 5; nome = 'Acima do máximo'; penalidade = 5; }
  else if (pesoKg > limites.pesada) { nivel = 4; nome = 'Muito Pesada'; penalidade = 4; }
  else if (pesoKg > limites.media) { nivel = 3; nome = 'Pesada'; penalidade = 3; }
  else if (pesoKg > limites.leve) { nivel = 2; nome = 'Média'; penalidade = 2; }
  else if (pesoKg > limites.nenhuma) { nivel = 1; nome = 'Leve'; penalidade = 1; }
  else { nivel = 0; nome = 'Nenhuma'; penalidade = 0; }
  return { nivel, nome, penalidade, limites, peso: pesoKg, excesso: pesoKg > limites.max };
}

export function calcularLevantamento(ST) {
  return {
    umaMao: 3 * ST,
    duasMaos: 13 * ST,
    costas: 15 * ST,
    empurrar: 13 * ST,
    empurrarImpulso: 25 * ST,
    deslocarLigeiramente: 50 * ST
  };
}
