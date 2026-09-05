/* GUA Rule Engine — Construtor Modular de Poderes
 * Fonte: CRIANDO SEUS PODERES — o sistema é um catálogo em que o jogador recebe um
 * orçamento e compra separadamente EFEITOS, EXTENSÃO, POTÊNCIA, CONDIÇÕES e BÔNUS.
 * Obrigatórios para um poder com efeito: Efeito + Extensão + Potência.
 * Condições: no máximo 3 por poder (os pontos são devolvidos ao jogador).
 * Dados: data/poderes.json — nada de valores duplicados aqui.
 */

/** Rótulos legíveis dos submódulos de Extensão e Potência (os dados trazem apenas descrições). */
export const ROTULOS_DE_SUBMODULO = {
  alcance: 'Alcance', area: 'Área', alvos: 'Quantidade de alvos', duracao: 'Duração',
  intensidade: 'Intensidade', dano: 'Dano', forca: 'Força', velocidade: 'Velocidade',
};

export const MODULOS_OBRIGATORIOS = ['efeito', 'extensao', 'potencia'];
export const MAX_CONDICOES = 3;

/** Estrutura de um poder novo (nada comprado). */
export function novoPoder(nome = 'Novo poder') {
  return {
    id: `pow-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    nome,
    descricao: '',
    efeito: null,                       // { grupo, id }
    extensao: { alcance: null, area: null, alvos: null, duracao: null },
    potencia: { intensidade: null, dano: null, forca: [], velocidade: [] },
    condicoes: [],                      // até 3 ids
    bonus: null,                        // { id, alvo }
    penalidade: null,                   // { id, alvo }
    pv: null,
    rd: null,
    outros: [],
    custosInformados: {},               // { [itemId]: pontos } para itens escalonáveis ("5+")
    usos: null,
    notas: '',
  };
}

/* ------------------------------------------------------------------ catálogo */

export function catalogo(db) {
  const p = db.poderes?.modulos || {};
  return {
    efeitos: p.efeitos?.grupos || [],
    extensao: p.extensao || {},
    potencia: p.potencia || {},
    condicoes: p.condicoes?.itens || [],
    bonus: p.bonus?.itens || [],
    penalidades: p.penalidades?.itens || [],
    pv: p.pv?.itens || [],
    rd: p.rd?.itens || [],
    outros: p.outros?.itens || [],
    maxCondicoes: p.condicoes?.maximo ?? MAX_CONDICOES,
  };
}

/** Localiza um item comprado no catálogo. Devolve também o módulo de origem. */
export function acharItem(db, { modulo, grupo = null, id }) {
  const cat = catalogo(db);
  if (!id) return null;
  switch (modulo) {
    case 'efeito': {
      for (const g of cat.efeitos) {
        const item = (g.itens || []).find(i => i.id === id);
        if (item) return { ...item, modulo, grupo: g.id, grupoNome: g.nome, moduloNome: 'Efeitos' };
      }
      return null;
    }
    case 'extensao': {
      const sub = cat.extensao[grupo];
      const item = (sub?.itens || []).find(i => i.id === id);
      return item ? { ...item, modulo, grupo, moduloNome: `Extensão — ${sub?.descricao || grupo}` } : null;
    }
    case 'potencia': {
      const sub = cat.potencia[grupo];
      const item = (sub?.itens || []).find(i => i.id === id);
      return item ? { ...item, modulo, grupo, moduloNome: `Potência — ${sub?.descricao || grupo}` } : null;
    }
    case 'condicao': {
      const item = cat.condicoes.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Condições' } : null;
    }
    case 'bonus': {
      const item = cat.bonus.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Bônus', rotulo: `+${item.bonus}` } : null;
    }
    case 'penalidade': {
      const item = cat.penalidades.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Penalidades', rotulo: `${item.penalidade}` } : null;
    }
    case 'pv': {
      const item = cat.pv.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Pontos de Vida' } : null;
    }
    case 'rd': {
      const item = cat.rd.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Redução de Dano' } : null;
    }
    case 'outros': {
      const item = cat.outros.find(i => i.id === id);
      return item ? { ...item, modulo, moduloNome: 'Outros bônus' } : null;
    }
    default: return null;
  }
}

/** Opções de compra de um módulo (para a interface do construtor). */
export function opcoesDe(db, modulo, grupo = null) {
  const cat = catalogo(db);
  switch (modulo) {
    case 'efeito': return cat.efeitos.map(g => ({ grupo: g.id, grupoNome: g.nome, descricao: g.descricao || null, itens: g.itens || [] }));
    case 'extensao': case 'potencia': {
      const fonte = modulo === 'extensao' ? cat.extensao : cat.potencia;
      return (fonte.submodulos || Object.keys(fonte).filter(k => !['titulo', 'descricao', 'submodulos'].includes(k)))
        .map(sub => ({ grupo: sub, grupoNome: ROTULOS_DE_SUBMODULO[sub] || sub, descricao: fonte[sub]?.descricao || null, itens: fonte[sub]?.itens || [] }));
    }
    case 'condicao': return [{ grupo: null, grupoNome: 'Condições', itens: cat.condicoes, maximo: cat.maxCondicoes }];
    case 'bonus': return [{ grupo: null, grupoNome: 'Bônus', itens: cat.bonus.map(i => ({ ...i, nome: i.nome || `+${i.bonus}` })) }];
    case 'penalidade': return [{ grupo: null, grupoNome: 'Penalidades', itens: cat.penalidades.map(i => ({ ...i, nome: i.nome || `${i.penalidade}` })) }];
    case 'pv': return [{ grupo: null, grupoNome: 'Pontos de Vida', itens: cat.pv }];
    case 'rd': return [{ grupo: null, grupoNome: 'Redução de Dano', itens: cat.rd }];
    case 'outros': return [{ grupo: null, grupoNome: 'Outros bônus', itens: cat.outros }];
    default: return [];
  }
}

/* ------------------------------------------------------------------ custo */

function pontosDe(db, poder, modulo, grupo, id, { rotulo = null } = {}) {
  const item = acharItem(db, { modulo, grupo, id });
  if (!item) return { id, modulo, grupo, nome: rotulo || id, pontos: 0, publicado: 0, escalonavel: false, desconhecido: true };
  const informado = poder.custosInformados?.[id];
  const escalonavel = !!item.escalonavel;
  return {
    id, modulo, grupo,
    moduloNome: item.moduloNome,
    grupoNome: item.grupoNome || ROTULOS_DE_SUBMODULO[grupo] || grupo || null,
    nome: rotulo || item.nome || item.rotulo || (item.bonus != null ? `+${item.bonus}` : item.penalidade != null ? `${item.penalidade}` : id),
    pontos: informado != null ? Number(informado) : (item.pontos ?? 0),
    publicado: item.pontos ?? 0,
    escalonavel,
    nota: escalonavel
      ? (informado != null
        ? `Custo informado pelo jogador (${informado}); o material publica "${item.pontos}+" sem definir o custo dos níveis adicionais.`
        : `Item publicado como "${item.pontos}+" — REGRA NÃO DEFINIDA para níveis adicionais; informe o custo pago.`)
      : null,
  };
}

/** Custo total de um poder, com a contabilidade módulo a módulo. */
export function custoDoPoder(db, poder) {
  const partes = [];
  const adicionar = (p) => { if (p) partes.push(p); };

  if (poder.efeito?.id) adicionar(pontosDe(db, poder, 'efeito', poder.efeito.grupo, poder.efeito.id));
  for (const [grupo, id] of Object.entries(poder.extensao || {})) {
    if (id) adicionar(pontosDe(db, poder, 'extensao', grupo, id));
  }
  const pot = poder.potencia || {};
  if (pot.intensidade) adicionar(pontosDe(db, poder, 'potencia', 'intensidade', pot.intensidade));
  if (pot.dano) adicionar(pontosDe(db, poder, 'potencia', 'dano', pot.dano));
  for (const id of pot.forca || []) adicionar(pontosDe(db, poder, 'potencia', 'forca', id));
  for (const id of pot.velocidade || []) adicionar(pontosDe(db, poder, 'potencia', 'velocidade', id));
  for (const id of poder.condicoes || []) adicionar(pontosDe(db, poder, 'condicao', null, id));
  if (poder.bonus?.id) adicionar(pontosDe(db, poder, 'bonus', null, poder.bonus.id, { rotulo: `Bônus +${acharItem(db, { modulo: 'bonus', id: poder.bonus.id })?.bonus ?? '?'}${poder.bonus.alvo ? ` em ${poder.bonus.alvo}` : ''}` }));
  if (poder.penalidade?.id) adicionar(pontosDe(db, poder, 'penalidade', null, poder.penalidade.id, { rotulo: `Penalidade ${acharItem(db, { modulo: 'penalidade', id: poder.penalidade.id })?.penalidade ?? '?'}${poder.penalidade.alvo ? ` em ${poder.penalidade.alvo}` : ''}` }));
  if (poder.pv) adicionar(pontosDe(db, poder, 'pv', null, poder.pv));
  if (poder.rd) adicionar(pontosDe(db, poder, 'rd', null, poder.rd));
  for (const id of poder.outros || []) adicionar(pontosDe(db, poder, 'outros', null, id));

  const total = partes.reduce((soma, p) => soma + (Number(p.pontos) || 0), 0);
  const validas = partes.filter(Boolean);
  return {
    total,
    partes: validas,
    escalonaveis: validas.filter(p => p.escalonavel),
    semCustoInformado: validas.filter(p => p.escalonavel && poder.custosInformados?.[p.id] == null),
    desconhecidos: validas.filter(p => p.desconhecido),
  };
}

/* ------------------------------------------------------------------ validação */

/** Valida o poder contra as regras publicadas (obrigatórios, limite de condições, orçamento). */
export function validarPoder(db, poder, { orcamento = null } = {}) {
  const erros = [];
  const avisos = [];
  const temEfeito = !!poder.efeito?.id;
  const temExtensao = Object.values(poder.extensao || {}).some(Boolean);
  const pot = poder.potencia || {};
  const temPotencia = !!pot.intensidade || !!pot.dano || (pot.forca || []).length > 0 || (pot.velocidade || []).length > 0;

  if (temEfeito) {
    if (!temExtensao) erros.push('Um poder com efeito deve possuir obrigatoriamente EXTENSÃO (alcance, área, quantidade de alvos ou duração).');
    if (!temPotencia) erros.push('Um poder com efeito deve possuir obrigatoriamente POTÊNCIA (intensidade, dano, força ou velocidade).');
  }
  const maxCond = db.poderes?.modulos?.condicoes?.maximo ?? MAX_CONDICOES;
  if ((poder.condicoes || []).length > maxCond) {
    erros.push(`Limite de Condições: até ${maxCond} por poder (o poder tem ${poder.condicoes.length}).`);
  }
  const custo = custoDoPoder(db, poder);
  if (custo.desconhecidos.length) {
    erros.push(`Itens fora do catálogo (data/poderes.json): ${custo.desconhecidos.map(p => `${p.modulo}/${p.grupo || '-'}:${p.id}`).join(', ')}.`);
  }
  if (custo.semCustoInformado.length) {
    avisos.push(`Itens escalonáveis sem custo informado (publicados com "+"): ${custo.semCustoInformado.map(p => p.nome).join(', ')}. O custo dos níveis adicionais é REGRA NÃO DEFINIDA.`);
  }
  if (orcamento != null && custo.total > orcamento) {
    erros.push(`Orçamento de pontos de poder excedido: o poder custa ${custo.total} e a saga disponibiliza ${orcamento} (faltam ${custo.total - orcamento}).`);
  }
  if (!poder.nome || !String(poder.nome).trim()) avisos.push('O poder está sem nome.');
  return { ok: erros.length === 0, erros, avisos, custo };
}

/* ------------------------------------------------------------------ orçamento */

/** Orçamento de pontos de poder da saga e quanto o personagem já gastou. */
export function orcamentoDePoder(db, personagem, { total = null } = {}) {
  const padrao = total ?? personagem?.pontosDePoder ?? db.rules?.configuraveis?.pontosDePoder?.default ?? db.poderes?.orcamento?.exemploPadrao ?? 150;
  const poderes = personagem?.poderes || [];
  const detalhados = poderes.map(p => ({ poder: p, custo: custoDoPoder(db, p) }));
  const gasto = detalhados.reduce((soma, d) => soma + d.custo.total, 0);
  return {
    total: padrao,
    gasto,
    disponivel: padrao - gasto,
    poderes: detalhados,
    fonte: db.poderes?.orcamento?.regra || '',
    nota: 'O valor é baseado no nível de poder da saga (o "arco" da história); normalmente se começa no nível Mundano.',
  };
}

/* ------------------------------------------------------------------ efeitos na ficha */

/** PV e RD concedidos por poderes (somam aos secundários da ficha). */
export function bonusDosPoderes(db, personagem) {
  let pv = 0, rd = 0;
  const partes = [];
  for (const poder of personagem?.poderes || []) {
    if (poder.pv) {
      const item = acharItem(db, { modulo: 'pv', id: poder.pv });
      if (item?.pv) { pv += item.pv; partes.push({ fonte: `${poder.nome}: ${item.nome}`, pv: item.pv, rd: 0 }); }
    }
    if (poder.rd) {
      const item = acharItem(db, { modulo: 'rd', id: poder.rd });
      if (item?.rd) { rd += item.rd; partes.push({ fonte: `${poder.nome}: ${item.nome}`, pv: 0, rd: item.rd }); }
    }
    for (const id of poder.outros || []) {
      // "Ataque Adicional", "Dano Adicional", "Deslocamento Adicional", "Usar Poder Sem Custo"
      // são registrados como características do poder; seus valores numéricos por nível
      // são REGRA NÃO DEFINIDA no material publicado.
    }
  }
  return { pv, rd, partes };
}

/** Linha "Caract:" da planilha oficial — resumo legível de tudo que foi comprado. */
export function resumoDoPoder(db, poder) {
  const linhas = [];
  const { partes } = custoDoPoder(db, poder);
  const porModulo = {};
  for (const p of partes) (porModulo[p.moduloNome] ||= []).push(p.nome);
  for (const [modulo, nomes] of Object.entries(porModulo)) linhas.push(`${modulo}: ${nomes.join(', ')}`);
  if (poder.descricao) linhas.push(`Descrição: ${poder.descricao}`);
  return linhas;
}
