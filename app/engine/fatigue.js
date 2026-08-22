/* GUA Rule Engine — Fadiga
 * Fonte: Fadiga (p. 298-300). Fadiga = perda de ST; nunca negativa; ST 3→½ Mov; ST 1→desfalece; ST 0→desmaia.
 * Dano básico de armas NÃO muda com fadiga. Perícias baseadas em ST sofrem redução.
 */
export function fadigaAtual(personagem) {
  return Math.min(personagem.combate?.fadiga || 0, personagem.atributos.ST);
}

export function stEfetiva(personagem) {
  return personagem.atributos.ST - fadigaAtual(personagem);
}

/** Estado pela fadiga (p. 298-299). */
export function estadoFadiga(personagem) {
  const st = stEfetiva(personagem);
  if (st <= 0) return { estado: 'desmaiado', nota: 'ST 0: desmaia; descansa até ST 1 e desperta' };
  if (st === 1) return { estado: 'desfalecido', nota: 'ST 1: só fala/faz magia; nenhuma atividade física' };
  if (st <= 3) return { estado: 'exausto', nota: 'ST ≤ 3: Deslocamento pela metade' };
  return { estado: 'normal', nota: '' };
}

/** Custo de fadiga por atividade (p. 299-300). */
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
    case 'esforco-extra': return { custo: 1, notas: ['1 por tentativa'] };
    case 'noite': return { custo: 5, notas: ['Noite sem dormir'] };
    case 'meia-noite': return { custo: 2, notas: [] };
    case 'magia': return { custo: params.custoEnergia || 0, notas: ['Pago em ST (fadiga) ou HT (lesão: -1 NH magia por ponto)'] };
    default: return { erro: 'atividade desconhecida' };
  }
}

/** Aplica gasto de fadiga com clamp (nunca negativa — p. 299). */
export function gastarFadiga(personagem, pontos) {
  const atual = personagem.combate?.fadiga || 0;
  const max = personagem.atributos.ST;
  const novo = Math.min(atual + pontos, max);
  const estado = estadoFadiga({ ...personagem, combate: { ...personagem.combate, fadiga: novo } });
  return { fadiga: novo, pontosEfetivos: novo - atual, ...estado };
}

/** Recuperação: 1 ponto de ST por 10 min de descanso (p. 300). */
export function recuperarFadiga(personagem, minutos) {
  const atual = personagem.combate?.fadiga || 0;
  return Math.max(0, atual - Math.floor(minutos / 10));
}
