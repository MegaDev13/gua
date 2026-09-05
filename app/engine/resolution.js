/* GUA Rule Engine — Núcleo de Resolução d20 (modulação G.A.U)
 * Fonte: TESTES DE HABILIDADE — canal #『📕』testes-e-combate (Impio, 16/08/2026).
 *
 * Regras implementadas (todas com origem em data/resolucao.json):
 *  1. Rola-se 1d20 (ou mais dados, conforme a CATEGORIA de poder = escala).
 *  2. Sucesso = resultado DENTRO da margem de sucesso da referência (atributo ou NH).
 *  3. Crítico = o próprio valor da referência (ex.: referência 10 → crítico 10).
 *  4. "1 e 20 não importam mais": nada é decidido pelo número isolado, só pela margem.
 *  5. Modificadores são aplicados à JOGADA (o texto diz "recebe a penalidade diretamente
 *     no seu ataque" / "adiciona ao teste de ataque o bônus de precisão"), não à referência.
 *  6. Disputa de Habilidades: vence o resultado mais próximo do próprio valor crítico
 *     (critério alternativo publicado: maior margem de sucesso / menor margem de falha).
 */
import { DICE } from './dice.js';

/* ------------------------------------------------------------------ margens */

/** Margem de sucesso e crítico de uma referência (tabela 1–20 do material). */
export function margemDeSucesso(db, referencia) {
  const tabela = db.resolucao?.margens?.tabela || {};
  const valor = Math.trunc(Number(referencia));
  if (!Number.isFinite(valor)) {
    return { referencia, definida: false, min: null, max: null, critico: null, texto: '—', largura: 0, nota: 'Referência inválida.' };
  }
  const linha = tabela[String(valor)];
  if (!linha) {
    return {
      referencia: valor, definida: false, min: null, max: null, critico: null,
      texto: 'REGRA NÃO DEFINIDA', largura: 0,
      nota: valor < 1
        ? 'Referência abaixo de 1: a tabela começa no valor 1 ("Nenhuma" margem).'
        : (db.resolucao?.margens?.acimaDe20 || 'A tabela publicada vai até o valor 20; referências maiores exigem categoria superior.'),
    };
  }
  if (linha.min === null || linha.max === null) {
    return { referencia: valor, definida: false, min: null, max: null, critico: linha.critico ?? null, texto: linha.texto, largura: 0, nota: 'Valor 1: nenhuma margem de sucesso — a ação não pode ser tentada.' };
  }
  return {
    referencia: valor, definida: true,
    min: linha.min, max: linha.max, critico: linha.critico ?? valor,
    texto: linha.texto, largura: linha.largura ?? (linha.max - linha.min + 1),
    nota: null,
  };
}

/** O valor crítico é sempre o próprio valor da referência ("10 = crítico"). */
export function criticoDe(db, referencia) {
  return margemDeSucesso(db, referencia).critico;
}

/* ------------------------------------------------------------------ categorias */

/** Dados da categoria de poder do personagem (escala). Mundano = 1d20. */
export function dadosDaCategoria(db, categoriaId = 'mundano') {
  const lista = db.resolucao?.categorias?.lista || [];
  const cat = lista.find(c => c.id === categoriaId) || lista[0];
  return {
    id: cat?.id || categoriaId,
    nome: cat?.nome || categoriaId,
    dados: cat?.dados ?? 1,
    indefinida: cat?.dados == null || !!cat?._aviso,
    nota: cat?.nota || '',
  };
}

/** Teste determinado por categoria: o mestre indica a categoria necessária. */
export function testePorCategoria(db, personagem, categoriaExigida) {
  const lista = db.resolucao?.categorias?.lista || [];
  const atual = dadosDaCategoria(db, personagem?.categoria || 'mundano');
  const exigida = dadosDaCategoria(db, categoriaExigida);
  const indiceAtual = Math.max(0, lista.findIndex(c => c.id === atual.id));
  const indiceExigido = Math.max(0, lista.findIndex(c => c.id === exigida.id));
  const recurso = (personagem?.recursosCategoria || []).find(r => r.permita === categoriaExigida);
  if (indiceAtual >= indiceExigido || recurso) {
    return {
      ok: true, categoria: atual, exigida,
      motivo: recurso
        ? `Categoria inferior, mas o personagem possui um recurso específico: ${recurso.nome || recurso.id}.`
        : `${atual.nome} atende à categoria exigida (${exigida.nome}).`,
    };
  }
  return {
    ok: false, categoria: atual, exigida,
    motivo: `Teste determinado por categoria: exige ${exigida.nome}; o personagem é ${atual.nome}. Sem um recurso específico, a ação não pode ser executada.`,
  };
}

/* ------------------------------------------------------------------ avaliação da jogada */

const distancia = (valor, min, max) => {
  if (valor < min) return min - valor;
  if (valor > max) return valor - max;
  return 0;
};

/** Como os dados de uma categoria superior são combinados.
 *  REGRA NÃO DEFINIDA no material (data/resolucao.json → categorias.agregacaoDeDados):
 *  'melhor' e 'cada-dado' avaliam cada d20 contra a margem; 'soma' é hipótese marcada. */
export function avaliarJogada(db, { referencia, rolls, modificadores = [], modo = 'melhor' }) {
  const margem = margemDeSucesso(db, referencia);
  const totalMods = (modificadores || []).reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  const porDado = rolls.map(dado => {
    const valor = dado + totalMods;
    return {
      dado, valor,
      dentro: margem.definida && valor >= margem.min && valor <= margem.max,
      critico: margem.definida && valor === margem.critico,
      distancia: margem.definida ? distancia(valor, margem.min, margem.max) : null,
      folga: margem.definida
        ? (valor >= margem.min && valor <= margem.max ? Math.min(valor - margem.min, margem.max - valor) : -distancia(valor, margem.min, margem.max))
        : null,
      distanciaCritico: margem.definida && margem.critico != null ? Math.abs(valor - margem.critico) : null,
    };
  });

  let valor;
  let nota = null;
  if (modo === 'soma' && rolls.length > 1) {
    const soma = rolls.reduce((a, b) => a + b, 0) + totalMods;
    const fator = rolls.length;
    const min = margem.definida ? margem.min * fator : null;
    const max = margem.definida ? margem.max * fator : null;
    nota = `Modo 'soma' (HIPÓTESE — REGRA NÃO DEFINIDA): ${rolls.length}d20 somados contra a margem ×${fator}.`;
    return {
      ...baseAvaliacao(margem, modificadores, totalMods, rolls, porDado, modo),
      valor: soma, min, max,
      dentro: margem.definida && soma >= min && soma <= max,
      critico: false,
      nota: (db.resolucao?.categorias?.agregacaoDeDados?._aviso ? `${db.resolucao.categorias.agregacaoDeDados._aviso}. ` : '') + nota,
      distanciaCritico: null, folga: null,
    };
  }

  const sucesso = porDado.find(p => p.dentro);
  if (sucesso) {
    // entre os dados dentro da margem, o "melhor" é o mais próximo do crítico
    const melhor = porDado.filter(p => p.dentro).sort((a, b) => (a.distanciaCritico ?? 99) - (b.distanciaCritico ?? 99))[0];
    valor = melhor.valor;
  } else {
    const quase = [...porDado].sort((a, b) => (a.distancia ?? 99) - (b.distancia ?? 99))[0];
    valor = quase.valor;
  }
  const escolhido = porDado.find(p => p.valor === valor) || porDado[0];
  if (rolls.length > 1) {
    nota = modo === 'cada-dado'
      ? `${rolls.length} dados avaliados individualmente contra a margem (cada um pode ser sucesso, crítico ou falha).`
      : `${rolls.length} dados; considerado o melhor resultado dentro da margem.`;
    const aviso = db.resolucao?.categorias?.agregacaoDeDados?._aviso;
    if (aviso) nota = `${aviso}: ${nota}`;
  }

  return {
    ...baseAvaliacao(margem, modificadores, totalMods, rolls, porDado, modo),
    valor,
    dentro: !!escolhido?.dentro,
    critico: !!escolhido?.critico,
    distanciaCritico: escolhido?.distanciaCritico ?? null,
    folga: escolhido?.folga ?? null,
    nota,
  };
}

function baseAvaliacao(margem, modificadores, totalMods, rolls, porDado, modo) {
  return {
    referencia: margem.referencia,
    margem,
    rolls,
    porDado,
    modificadores: modificadores || [],
    totalModificadores: totalMods,
    modo,
    min: margem.min,
    max: margem.max,
    criticoValor: margem.critico,
  };
}

/* ------------------------------------------------------------------ teste completo */

/** Teste de Habilidade G.A.U: 1d20 (ou Nd20 por categoria) dentro da margem da referência. */
export function testeD20(db, {
  referencia, modificadores = [], categoria = 'mundano', modo = 'melhor',
  rotulo = 'Teste', dice = DICE, categoriaExigida = null, personagem = null,
}) {
  if (categoriaExigida) {
    const checagem = testePorCategoria(db, personagem || { categoria }, categoriaExigida);
    if (!checagem.ok) {
      return {
        rotulo, referencia, bloqueado: true, motivo: checagem.motivo,
        sucesso: false, critico: false, tipo: 'bloqueado', descricao: 'Bloqueado por categoria',
        rolls: [], valor: null, margem: margemDeSucesso(db, referencia),
      };
    }
  }
  const escala = dadosDaCategoria(db, categoria);
  const quantidade = Math.max(1, escala.dados || 1);
  const rolls = dice.roll(quantidade, 20);
  const avaliacao = avaliarJogada(db, { referencia, rolls, modificadores, modo: quantidade > 1 ? modo : 'melhor' });
  const res = {
    rotulo,
    referencia: avaliacao.referencia,
    margem: avaliacao.margem,
    rolls,
    dados: quantidade,
    categoria: escala,
    modificadores,
    totalModificadores: avaliacao.totalModificadores,
    valor: avaliacao.valor,
    modo: avaliacao.modo,
    nota: avaliacao.nota,
    distanciaCritico: avaliacao.distanciaCritico,
    folga: avaliacao.folga,
    porDado: avaliacao.porDado,
    sucesso: false, critico: false, tipo: 'falha', descricao: '',
    bloqueado: false,
    indefinido: !avaliacao.margem.definida,
  };
  if (!avaliacao.margem.definida) {
    res.tipo = 'indefinido';
    res.descricao = avaliacao.margem.nota || 'Margem não definida para esta referência';
    return res;
  }
  if (avaliacao.critico) {
    res.sucesso = true; res.critico = true; res.tipo = 'critico';
    res.descricao = `CRÍTICO — resultado ${avaliacao.valor} é exatamente o valor da referência (${avaliacao.margem.critico})`;
  } else if (avaliacao.dentro) {
    res.sucesso = true; res.tipo = 'sucesso';
    res.descricao = `Sucesso — ${avaliacao.valor} está dentro da margem ${avaliacao.margem.texto}`;
  } else {
    res.tipo = 'falha';
    res.descricao = `Falha — ${avaliacao.valor} está fora da margem ${avaliacao.margem.texto}`;
  }
  dice.history?.unshift({ quando: new Date().toISOString(), sistema: 'd20', ...res, porDado: undefined });
  if (dice.history && dice.history.length > 200) dice.history.pop();
  return res;
}

/** Teste de referência a partir de um atributo do personagem (o atributo É a referência). */
export function testeDeAtributo(db, personagem, atributo, opcoes = {}) {
  const referencia = personagem?.atributos?.[atributo];
  if (referencia === undefined) return { erro: `Atributo ${atributo} inexistente.` };
  return testeD20(db, {
    referencia,
    rotulo: opcoes.rotulo || `Teste de ${atributo}`,
    personagem,
    categoria: opcoes.categoria || personagem?.categoria || 'mundano',
    ...opcoes,
  });
}

/** Bloco publicado de testes com níveis pré-definidos (data/resolucao.json → testesPreDefinidos). */
export function testesPreDefinidos(db) {
  const cfg = db.resolucao?.testesPreDefinidos || {};
  return { regra: cfg.regra || '', condicionadas: cfg.condicionadas || '', exemplos: cfg.exemplos || [] };
}

/** Teste com nível pré-definido: NH = característica base + redutor (Arrombamento = IQ, Cavalgar = DX…). */
export function testePreDefinido(db, personagem, { base, redutor = 0, rotulo = '', ...resto }) {
  const valorBase = typeof base === 'string' ? personagem?.atributos?.[base] : base;
  if (valorBase == null) return { erro: 'Base do teste pré-definido não encontrada.' };
  const referencia = valorBase + redutor;
  return testeD20(db, {
    referencia,
    rotulo: rotulo || `Teste pré-definido (${base}${redutor ? redutor > 0 ? '+' + redutor : redutor : ''})`,
    modificadores: [{ fonte: `Pré-definido: ${base} ${valorBase} ${redutor >= 0 ? '+' : '−'} ${Math.abs(redutor)}`, valor: 0, informativo: true }],
    personagem,
    ...resto,
  });
}

/* ------------------------------------------------------------------ disputas */

/** Disputa de Habilidades (rápida ou normal).
 *  Regra geral G.A.U.: vence o resultado mais próximo do próprio valor crítico.
 *  Critério alternativo publicado: maior margem de sucesso / menor margem de falha. */
export function disputa(db, { a, b, criterio = 'proximidade-do-critico', dice = DICE, tipo = 'rapida' }) {
  const resA = testeD20(db, { ...a, dice });
  const resB = testeD20(db, { ...b, dice });
  return avaliarDisputa(db, resA, resB, { criterio, tipo });
}

/** Avalia dois testes já rolados — usado pela ficha (defesa ativa vs. ataque) e pelos testes. */
export function avaliarDisputa(db, resA, resB, { criterio = 'proximidade-do-critico', tipo = 'rapida' } = {}) {
  const ambosDefinidos = !resA.indefinido && !resB.indefinido && !resA.bloqueado && !resB.bloqueado;
  if (!ambosDefinidos) {
    return {
      vencedor: null, empate: false, criterio, tipo, resA, resB,
      motivo: resA.bloqueado ? resA.motivo : resB.bloqueado ? resB.motivo : 'Uma das referências não possui margem definida (REGRA NÃO DEFINIDA).',
    };
  }
  // 1) um succeeds e o outro falha → vencedor óbvio
  if (resA.sucesso !== resB.sucesso) {
    const vencedor = resA.sucesso ? 'A' : 'B';
    return {
      vencedor, empate: false, criterio, tipo, resA, resB,
      motivo: `${vencedor === 'A' ? resA.rotulo : resB.rotulo} foi bem sucedido e o oponente falhou — o vencedor é óbvio.`,
    };
  }
  // 2) ambos bem sucedidos ou ambos falhando → critério
  const metrica = criterio === 'maior-margem'
    ? r => (r.folga ?? -Infinity)
    : r => -(r.distanciaCritico ?? Infinity);
  const mA = metrica(resA), mB = metrica(resB);
  const nomeCriterio = criterio === 'maior-margem'
    ? 'maior margem de sucesso (ou menor margem de falha)'
    : 'resultado mais próximo do próprio valor crítico';
  if (mA === mB) {
    return {
      vencedor: null, empate: true, criterio, tipo, resA, resB,
      motivo: `Empate (${nomeCriterio}): ninguém venceu — os dois agarraram a arma simultaneamente, ou as facas atingiram o alvo à mesma distância da mosca.`,
      detalhe: { mA, mB },
    };
  }
  const vencedor = mA > mB ? 'A' : 'B';
  return {
    vencedor, empate: false, criterio, tipo, resA, resB,
    motivo: `Ambos ${resA.sucesso ? 'bem sucedidos' : 'falharam'}; venceu ${vencedor === 'A' ? resA.rotulo : resB.rotulo} por ${nomeCriterio}.`,
    detalhe: { mA, mB, nomeCriterio },
  };
}

/** Disputa Normal: pode durar vários turnos — se ambos têm o mesmo resultado, tenta-se de novo. */
export function disputaNormal(db, { a, b, criterio, dice = DICE, tentativas = 1 }) {
  const resultados = [];
  for (let i = 0; i < tentativas; i++) {
    const r = disputa(db, { a, b, criterio, dice, tipo: 'normal' });
    resultados.push(r);
    if (!r.empate) break;
  }
  return { resultados, final: resultados[resultados.length - 1], tentativas: resultados.length };
}

/* ------------------------------------------------------------------ utilidades */

/** "1 e 20 não importam mais": nada é decidido fora da margem/crítico. */
export function umEVinteImportam() { return false; }

/** Sucesso automático: nenhuma jogada é exigida quando falha crítica e sucesso decisivo são impossíveis. */
export function sucessoAutomatico(db, situacao = {}) {
  return {
    exigeTeste: situacao.chanceDeFalha !== false,
    regra: db.resolucao?.sucessoAutomatico?.regra || '',
    exemplos: db.resolucao?.sucessoAutomatico?.exemplos || {},
  };
}

/** Verificação de Pânico: 3d + margem da falha → tabela de consequências (data/proezas.json). */
export function verificacaoDePanico(db, { margemDaFalha = 0, dice = DICE, modificadores = [] }) {
  const rolls = dice.roll3d();
  const total = rolls.reduce((a, b) => a + b, 0) + Math.abs(Math.trunc(margemDaFalha) || 0);
  const entrada = resultadoPanico(db, total);
  return { rolls, total3d: rolls.reduce((a, b) => a + b, 0), margemDaFalha, total, entrada, modificadores };
}

/** Consulta a tabela de pânico por valor (4…40+). */
export function resultadoPanico(db, valor) {
  const tabela = db.proezas?.panico?.rolagem?.tabela || [];
  for (const linha of tabela) {
    const partes = String(linha.resultado).split(',').map(p => p.trim());
    for (const parte of partes) {
      if (parte.endsWith('+')) {
        if (valor >= parseInt(parte, 10)) return linha;
      } else if (valor === parseInt(parte, 10)) return linha;
    }
  }
  return tabela.length ? tabela[tabela.length - 1] : null;
}

/** Modificadores de iluminação aplicados diretamente ao ataque/defesa e aos testes de Visão. */
export function penalidadeDeLuz(db, nivelLuz, { padrao = -1 } = {}) {
  const tabela = db.maneuvers?.luminosidade?.tabela || [];
  const linha = tabela.find(l => l.id === nivelLuz || l.nivel === nivelLuz);
  if (!linha) return { valor: 0, nivel: 'Luz Total', indefinido: !tabela.length };
  // a faixa publicada é um intervalo (ex.: Penumbra −3 a −4); usa-se o extremo mais próximo de 0,
  // e o GM pode escolher dentro da faixa — o intervalo completo é devolvido para exibição.
  return {
    valor: linha.penalidadeMax ?? padrao,
    faixa: [linha.penalidadeMax, linha.penalidadeMin],
    nivel: linha.nivel,
    exemplos: linha.exemplos,
    escuridaoTotal: linha.id === 'escuridao-total',
    regras: db.maneuvers?.luminosidade?.combate || null,
  };
}
