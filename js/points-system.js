/* GAU — Sistema de Pontos Visual
   Baseado em GURPS-like + escalas do powers.json
   - Total configurável (25 a 1000+)
   - Custos visuais para tudo
   - Widget em todas as páginas
*/

export const PONTOS_PRESETS = [
  { id: 'fraco', nome: 'Fraco', pontos: 25, desc: 'Crianças, zumbis, reféns' },
  { id: 'comum', nome: 'Comum', pontos: 50, desc: 'Camponês, civil, trabalhador' },
  { id: 'competente', nome: 'Competente', pontos: 75, desc: 'Policial local, atleta amador' },
  { id: 'profissional', nome: 'Profissional', pontos: 100, desc: 'Soldado raso, investigador' },
  { id: 'heroi', nome: 'Herói Padrão', pontos: 150, desc: 'Protagonista pulp, clássico' },
  { id: 'cinematico', nome: 'Cinematográfico', pontos: 250, desc: 'Herói Hollywood, cavaleiro lendário' },
  { id: 'lendario', nome: 'Lendário', pontos: 400, desc: 'Mitologia, caçador elite' },
  { id: 'super', nome: 'Super-humano', pontos: 600, desc: 'Super-herói, semideus' },
  { id: 'divino', nome: 'Divino', pontos: 1000, desc: 'Altera destino de nações' },
];

export const CUSTOS = {
  atributo: { base: 10, porNivel: 10 }, // (valor-10)*10, negativo se abaixo de 10
  pericia: { porNivel: 2, minimo: 1 }, // (valor - baseAttr)*2, mas mínimo 1 se treinada
  periciaPsi: { porNivel: 2 },
  manobra: 0, // manobras de combate NÃO custam pontos (regra do usuário)
  empunhadura: 0, // empunhadura também não custa
  poder: {
    telepatia: 5,
    psicocinese: 5,
    psicoteleporte: 5,
    pes: 3,
    cura: 3,
    antipsi: 3,
    // fallback
    default: 5
  },
  magia: {
    porNivel: 3, // magia custa 3 pts por nível de poder + 2 por perícia
    pericia: 2
  }
};

export function custoAtributo(valor, base = 10) {
  return (valor - base) * CUSTOS.atributo.porNivel;
}

export function custoAtributos(atributos) {
  let total = 0;
  const detalhe = {};
  for (const [k, v] of Object.entries(atributos || {})) {
    const c = custoAtributo(v, 10);
    detalhe[k] = { valor: v, custo: c };
    total += c;
  }
  return { total, detalhe };
}

export function custoPericias(pericias, atributos) {
  let total = 0;
  const detalhe = [];
  for (const p of pericias || []) {
    const baseVal = atributos?.[p.atributoBase] ?? 10;
    // custo = (valor - baseVal)*2, se valor <= baseVal então custo mínimo 1 se treinada, ou 0 se pré-definido?
    // Para perícias que já vem no base (Arrombamento etc) consideramos custo extra apenas acima do pré-definido
    const diff = (p.valor ?? baseVal) - baseVal;
    // Se for perícia inicial do template, permite custo 0 até valor base?
    // Simplifica: custo = max(1, diff*2) se treinada, mas se diff<=0 então 1 pt (treino básico)
    let c;
    if (p.valor == null) c = 0;
    else if (diff <= 0) c = CUSTOS.pericia.minimo; // 1 pt para ter a perícia mesmo abaixo
    else c = diff * CUSTOS.pericia.porNivel;
    // Se tem redutor pré-definido (ex IQ-5) não cobra negativo
    if (p.redutor) {
      // ajusta: valor efetivo = base - redutor + investimento, então custo = (valor - (base-redutor))*2
      const baseEfetiva = baseVal - p.redutor;
      const diff2 = (p.valor ?? 0) - baseEfetiva;
      c = Math.max(0, diff2 * CUSTOS.pericia.porNivel);
    }
    detalhe.push({ nome: p.nome, base: baseVal, valor: p.valor, custo: c });
    total += c;
  }
  return { total, detalhe };
}

export function custoManobras(manobras) {
  const total = (manobras?.length || 0) * CUSTOS.manobra;
  return { total, porUnidade: CUSTOS.manobra, quantidade: manobras?.length || 0 };
}

export function custoEmpunhadura(empId) {
  return empId ? CUSTOS.empunhadura : 0;
}

export function custoPoderes(poderesRaw, powersDef) {
  let total = 0;
  const detalhe = [];
  for (const [poderId, dados] of Object.entries(poderesRaw || {})) {
    const def = (powersDef?.poderes || []).find(p => p.id === poderId);
    // custom poderes podem ter custo próprio
    const custoPorNivel = dados.custo ?? def?.custo ?? CUSTOS.poder.default;
    const pot = dados.potencia || 0;
    const custoPot = pot * custoPorNivel;
    let custoPer = 0;
    const perDetalhe = [];
    for (const pp of dados.pericias || []) {
      const c = (pp.nivel || 0) * CUSTOS.periciaPsi.porNivel;
      perDetalhe.push({ nome: pp.nome || pp.id, nivel: pp.nivel, custo: c });
      custoPer += c;
    }
    const subtotal = custoPot + custoPer;
    detalhe.push({ id: poderId, nome: dados.nome || def?.nome || poderId, potencia: pot, custoPorNivel, custoPot, pericias: perDetalhe, custoPer, subtotal, custom: !!dados.custom });
    total += subtotal;
  }
  return { total, detalhe };
}

export function custoMagias(magiasRaw, magicsDef) {
  let total = 0;
  const detalhe = [];
  // magiasRaw pode ser objeto { fogo: { nivel: 5, magias: [{id,nivel}] } } ou array
  const entries = Array.isArray(magiasRaw) ? magiasRaw.map(m => [m.id || m.escola || 'custom', m]) : Object.entries(magiasRaw || {});
  for (const [magiaId, dados] of entries) {
    const def = (magicsDef?.escolas || []).find(e => e.id === magiaId) || (magicsDef?.magias || []).find(m => m.id === magiaId);
    const custoPorNivel = dados.custo ?? def?.custo ?? CUSTOS.magia.porNivel;
    const nivel = dados.nivel || dados.potencia || 0;
    const custoNivel = nivel * custoPorNivel;
    let custoPer = 0;
    const perDetalhe = [];
    for (const pp of dados.magias || dados.pericias || []) {
      const c = (pp.nivel || 0) * CUSTOS.magia.pericia;
      perDetalhe.push({ nome: pp.nome || pp.id, nivel: pp.nivel, custo: c });
      custoPer += c;
    }
    const subtotal = custoNivel + custoPer;
    detalhe.push({ id: magiaId, nome: dados.nome || def?.nome || magiaId, nivel, custoPorNivel, custoNivel, pericias: perDetalhe, custoPer, subtotal, custom: !!dados.custom });
    total += subtotal;
  }
  return { total, detalhe };
}

export function calcularCustoTotal(char, db) {
  const atributos = char.atributos || { ST: 10, DX: 10, IQ: 10, HT: 10 };
  const ca = custoAtributos(atributos);
  const cp = custoPericias(char.pericias || [], atributos);
  const cm = custoManobras(char.manobras || []);
  const ce = custoEmpunhadura(char.empunhadura);
  const cpod = custoPoderes(char.poderes || {}, db?.powers);
  const cmag = custoMagias(char.magias || {}, db?.magics);

  const totalGasto = ca.total + cp.total + cm.total + ce + cpod.total + cmag.total;
  const pontosTotais = char.pontosTotais ?? 150;
  const disponivel = pontosTotais - totalGasto;

  return {
    pontosTotais,
    totalGasto,
    disponivel,
    breakdown: {
      atributos: ca,
      pericias: cp,
      manobras: cm,
      empunhadura: { total: ce },
      poderes: cpod,
      magias: cmag
    }
  };
}

export function formatarCusto(c) {
  if (c > 0) return `+${c}`;
  if (c < 0) return `${c}`;
  return '0';
}
