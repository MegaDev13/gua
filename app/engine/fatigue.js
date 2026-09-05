/* GUA Rule Engine — Fadiga (PF)
 * Fontes:
 *  · FICHA OFICIAL G.A.U. (data/ficha.json → secundarios): PF = HT — a reserva de Pontos de Fadiga
 *    é igual à Vigor, não à Força. O gasto fica em `combate.fadiga` (nunca negativo).
 *  · Fadiga (p. 298–300, material legado 3d): a fadiga reduz a ST efetiva para fins de esforço
 *    físico — ST 3 → Deslocamento pela metade; ST 1 → desfalece; ST 0 → desmaia.
 *  · ESFORÇO EXTRA (data/proezas.json): 1 PF por uso, acerte ou erre.
 *  · NATAÇÃO/MAGIA: falhas e conjurações custam PF (energia) — ver magic.js.
 */

/** Reserva máxima de Pontos de Fadiga: PF = HT (secundário da ficha oficial). */
export function pfMax(personagem) {
  return Math.max(0, Number(personagem?.atributos?.HT) || 0);
}

/** PF atualmente disponíveis (reserva HT menos a fadiga acumulada). */
export function pfDisponiveis(personagem) {
  return Math.max(0, pfMax(personagem) - fadigaAtual(personagem));
}

/** Fadiga acumulada — limitada à reserva (HT), nunca negativa. */
export function fadigaAtual(personagem) {
  return Math.max(0, Math.min(personagem?.combate?.fadiga || 0, pfMax(personagem)));
}

/** ST efetiva para esforço físico: a fadiga continua pesando sobre a Força (legado p. 298). */
export function stEfetiva(personagem) {
  return Math.max(0, (Number(personagem?.atributos?.ST) || 0) - fadigaAtual(personagem));
}

/** Estado pela fadiga (p. 298–299) — avaliado sobre a ST efetiva. */
export function estadoFadiga(personagem) {
  const st = stEfetiva(personagem);
  const pf = pfDisponiveis(personagem);
  if (st <= 0 || pf <= 0) return { estado: 'desmaiado', nota: 'PF 0 / ST efetiva 0: desmaia; descansa até recuperar 1 PF e desperta.', pf, stEfetiva: st };
  if (st === 1) return { estado: 'desfalecido', nota: 'ST efetiva 1: só fala/faz magia; nenhuma atividade física.', pf, stEfetiva: st };
  if (st <= 3) return { estado: 'exausto', nota: 'ST efetiva ≤ 3: Deslocamento pela metade.', pf, stEfetiva: st };
  return { estado: 'normal', nota: '', pf, stEfetiva: st };
}

/** Custo de fadiga por atividade (p. 299–300 + Esforço Extra/Natação do material G.A.U). */
export function custoFadiga(db, personagem, atividade, params = {}) {
  const carga = params.nivelCarga ?? null;
  switch (atividade) {
    case 'luta': {
      if (carga === null) return { erro: 'nível de carga necessário' };
      let c = carga + 1; // Carga+1 por luta (p. 299)
      const notas = [`Carga ${carga} → ${c} ponto(s) por luta`];
      if (params.diaQuente) { c += 1; notas.push('+1 dia quente'); }
      if (params.armaduraPlacasOuSobretudo) { c += 2; notas.push('+2 armadura de placas/sobretudo (NT<8)'); }
      return { custo: c, notas };
    }
    case 'marcha': {
      if (carga === null) return { erro: 'nível de carga necessário' };
      let c = carga + 1;
      const notas = [`Carga ${carga} → ${c} ponto(s) por hora de marcha`];
      if (params.diaQuente) { c += 1; notas.push('+1 dia quente'); }
      return { custo: c, notas };
    }
    case 'corrida': return { custo: 0, teste: 'HT a cada 100 m; falha = 1 fadiga', notas: [] };
    case 'estafa': return { custo: 1, notas: ['1/turno acima de Carga muito pesada'] };
    case 'esforco-extra': return { custo: 1, notas: ['1 PF por uso, quer o teste dê certo ou errado (Esforço Extra)'] };
    case 'natacao': return { custo: 1, notas: ['1 PF por falha em Natação; novo teste em 5 segundos'] };
    case 'natacao-combate': return { custo: 1, notas: ['Teste a cada 5 s (2 s se completamente submerso); cada falha custa 1 PF'] };
    case 'noite': return { custo: 5, notas: ['Noite sem dormir'] };
    case 'meia-noite': return { custo: 2, notas: [] };
    case 'magia': return { custo: params.custoEnergia || 0, notas: ['Pago em ST/PF (fadiga) ou HT (energia vital: −1 NH de mágica por ponto perdido)'] };
    default: return { erro: 'atividade desconhecida' };
  }
}

/** Aplica gasto de fadiga com clamp na reserva (PF = HT); nunca negativa. */
export function gastarFadiga(personagem, pontos) {
  const atual = fadigaAtual(personagem);
  const max = pfMax(personagem);
  const novo = Math.max(0, Math.min(atual + (Number(pontos) || 0), max));
  const estado = estadoFadiga({ ...personagem, combate: { ...personagem.combate, fadiga: novo } });
  return { fadiga: novo, pontosEfetivos: novo - atual, pfMax: max, pfRestante: max - novo, ...estado };
}

/** Recuperação: 1 PF por 10 min de descanso (p. 300). */
export function recuperarFadiga(personagem, minutos) {
  const descanso = Math.max(0, Number(minutos) || 0);
  return Math.max(0, fadigaAtual(personagem) - Math.floor(descanso / 10));
}
