/* GUA Rule Engine — Sistema de Magia G.A.U
 * Fontes (canal #『📕』magias, transcrito em data/magia.json):
 *  · APTIDÃO MÁGICA (máximo 3) · APRENDENDO MAGIAS (IQ + Aptidão; mínimo 1 ponto)
 *  · PRÉ-REQUISITOS (outra mágica em NH ≥ 12; Aptidão; DX/IQ mínimos)
 *  · MANA (Muito Alta/Alta/Normal/Baixa/Nula — tables.mana) · RITUAIS POR NH (tables.rituaisMagia)
 *  · FAZENDO MAGIA (concentração, teste de habilidade, tempo, energia, duração/manutenção)
 *  · CLASSES (Comum, Área, Projétil, Informação, Resistível, Encantamento, Especial)
 *  · TOQUE DO MAGO · CAJADO E VARA · MAGIA CERIMONIAL E DE GRUPO
 *  · OBJETOS ENCANTADOS (Poder, rápido e sujo, lento e seguro, uso, permanentemente ativos)
 *  · ENTIDADES (demônios: fórmula 3D/3D/2D/4D/2D; elementais)
 * Lista de mágicas: data/spells.json (97 mágicas publicadas; 85 transcritas).
 *
 * CONFLITO (data/rules.json → conflitos.magia-3d-vs-d20): o capítulo de magia descreve "3 dados",
 * enquanto TESTES DE HABILIDADE define o d20 como base de resolução. Padrão: d20
 * (config.resolucaoMagia = 'd20'); o modo '3d' permanece disponível e fiel ao texto original.
 */
import { DICE, chance3d } from './dice.js';
import { testeD20 } from './resolution.js';

/* ------------------------------------------------------------------ mágicas (catálogo) */

export function listaDeMagicas(db) { return db.spells || []; }
export function magicaPorId(db, id) { return listaDeMagicas(db).find(m => m.id === id) || null; }
export function magicaPorNome(db, nome) {
  const alvo = String(nome || '').trim().toLowerCase();
  return listaDeMagicas(db).find(m => m.nome.toLowerCase() === alvo)
    || listaDeMagicas(db).find(m => m.nome.toLowerCase().includes(alvo)) || null;
}
export function resolverMagica(db, entrada) {
  if (!entrada) return null;
  if (typeof entrada === 'string') return magicaPorId(db, entrada) || magicaPorNome(db, entrada);
  if (entrada.id) return magicaPorId(db, entrada.id) || entrada;
  return entrada;
}
export function magicasPorClasse(db, classe) {
  const alvo = String(classe || '').toLowerCase();
  return listaDeMagicas(db).filter(m => String(m.classes || '').toLowerCase().includes(alvo));
}
export function magicasPorEscola(db, escola) {
  const alvo = String(escola || '').toLowerCase();
  return listaDeMagicas(db).filter(m => String(m.escola || '').toLowerCase().includes(alvo));
}
export function classesDeMagica(db) { return db.magia?.classes?.lista || []; }
export function classeDeMagica(db, id) { return classesDeMagica(db).find(c => c.id === id) || null; }

/** Campos da Lista de Mágicas (data/spells.json usa as chaves publicadas em português). */
export function camposDaMagica(m) {
  return {
    nome: m?.nome, classes: m?.classes, escola: m?.escola, descricao: m?.descricao,
    duracao: m?.['Duração'] ?? m?.duracao ?? null,
    custo: m?.['Custo'] ?? m?.custo ?? null,
    tempo: m?.['Tempo de operação'] ?? m?.tempo ?? '1 segundo de Concentração',
    preRequisitos: m?.['Pré-requisitos'] ?? m?.preRequisitos ?? null,
    objetos: m?.['Objetos'] ?? m?.objetos ?? null,
    muitoDificil: /\(MD\)/.test(String(m?.nome || '')) || m?.muitoDificil === true,
    fonte: m?.fonte ?? null,
  };
}

/* ------------------------------------------------------------------ aptidão mágica */

export function aptidaoMagica(db) { return db.magia?.aptidao || null; }

/** "Ninguém pode ter uma Aptidão Mágica maior do que 3." */
export function maximoDeAptidao(db) {
  const texto = String(db.magia?.aptidao?.limite || '');
  const m = texto.match(/maior do que (\d+)/);
  return m ? Number(m[1]) : 3;
}

/** IQ efetivo para aprender mágicas: IQ + Aptidão Mágica (ex.: IQ 12 + 3 = 15). */
export function iqParaMagia(db, personagem) {
  const iq = personagem?.atributos?.IQ ?? 0;
  const apt = Math.min(personagem?.aptidaoMagica ?? 0, maximoDeAptidao(db));
  const eidetica = personagem?.vantagens?.find?.(v => /mem[oó]ria eid[eé]tica/i.test(v.nome || v.id || ''))?.nivel || 0;
  const bonusEidetica = Math.min(eidetica, 2);
  return {
    IQ: iq, aptidao: apt, memoriaEidetica: bonusEidetica,
    efetivo: iq + apt + bonusEidetica,
    nota: bonusEidetica
      ? 'Memória Eidética: +1 no 1º nível, +2 no 2º — e nenhum outro bônus no aprendizado de mágicas.'
      : 'Seu nível de Aptidão Mágica é somado a seu atributo IQ para o aprendizado de mágicas.',
  };
}

/* ------------------------------------------------------------------ aprendizado e pré-requisitos */

/** Cada mágica é uma perícia: aprendê-la custa no mínimo 1 ponto. */
export function custoDeAprendizado(db, { pontos = 1 } = {}) {
  const minimo = 1;
  return {
    pontos: Math.max(minimo, Number(pontos) || minimo),
    minimo,
    regra: 'Para aprender uma mágica você precisa gastar no mínimo um ponto, mesmo que seja brilhante e abençoado com a Aptidão Mágica.',
    tipo: 'Mental/Difícil (ou Mental/Muito Difícil quando marcado com MD)',
  };
}

/** Pré-requisitos de uma mágica: outra mágica em NH ≥ 12, Aptidão Mágica e/ou DX/IQ mínimos. */
export function preRequisitosDe(db, personagem, magica) {
  const alvo = resolverMagica(db, magica);
  const texto = String(camposDaMagica(alvo).preRequisitos || '');
  const exigencias = [];
  const faltando = [];
  const niveisConhecidos = personagem?.magicas || personagem?.pericias || [];
  const nhDe = (nome) => {
    const n = niveisConhecidos.find(x => String(x.nome || x.id || '').toLowerCase() === String(nome).toLowerCase());
    return n ? (n.nh ?? n.nivel ?? null) : null;
  };

  const aptExigida = (texto.match(/aptid[ãa]o m[áa]gica (\d+)/i) || [])[1];
  if (aptExigida) {
    const necessario = Number(aptExigida);
    exigencias.push({ tipo: 'aptidao', necessario, atual: personagem?.aptidaoMagica ?? 0 });
    if ((personagem?.aptidaoMagica ?? 0) < necessario) faltando.push(`Aptidão Mágica ${necessario}`);
  }
  for (const attr of ['DX', 'IQ']) {
    const m = texto.match(new RegExp(`${attr}\\s*(\\d+)`, 'i'));
    if (m) {
      const necessario = Number(m[1]);
      exigencias.push({ tipo: attr, necessario, atual: personagem?.atributos?.[attr] ?? 0 });
      if ((personagem?.atributos?.[attr] ?? 0) < necessario) faltando.push(`${attr} ${necessario}`);
    }
  }
  // outras mágicas citadas: devem ser conhecidas em NH ≥ 12
  const outras = listaDeMagicas(db).filter(m => m.id !== alvo?.id && texto.toLowerCase().includes(m.nome.toLowerCase()));
  for (const outra of outras) {
    const nh = nhDe(outra.nome);
    exigencias.push({ tipo: 'magica', nome: outra.nome, necessario: 12, atual: nh });
    if (nh == null || nh < 12) faltando.push(`${outra.nome} em NH ≥ 12${nh == null ? ' (não conhecida)' : ` (NH ${nh})`}`);
  }
  if (/magos?/i.test(texto) && !aptExigida) {
    exigencias.push({ tipo: 'mago', necessario: 1, atual: (personagem?.aptidaoMagica ?? 0) >= 1 ? 1 : 0 });
    if ((personagem?.aptidaoMagica ?? 0) < 1) faltando.push('Ser mago (Aptidão Mágica ≥ 1)');
  }
  return {
    atendido: faltando.length === 0, faltando, exigencias, texto,
    regra: db.magia?.preRequisitos?.outraMagica || '',
  };
}

/* ------------------------------------------------------------------ mana */

export function niveisDeMana(db) {
  const niveis = db.tables?.mana?.niveis || db.magia?.mana?.niveis || {};
  return Object.entries(niveis).map(([nome, efeito]) => ({ nome, efeito, id: nome.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
}

export function manaDoCenario(db, nivel = 'Normal') {
  const alvo = String(nivel || 'Normal').toLowerCase();
  return niveisDeMana(db).find(m => m.id === alvo || m.nome.toLowerCase() === alvo) || null;
}

/** Efeito da mana no NH efetivo: Baixa = −5; Nula = magia impossível. */
export function modificadorDeMana(db, nivel = 'Normal') {
  const mana = manaDoCenario(db, nivel);
  if (!mana) return { valor: 0, mana: null };
  if (/^nula$/i.test(mana.nome)) return { valor: null, mana, bloqueado: true, motivo: mana.efeito };
  const m = String(mana.efeito).match(/NH\s*(-?\d+)/i);
  return { valor: m ? Number(m[1]) : 0, mana, bloqueado: false };
}

/* ------------------------------------------------------------------ rituais e redução de custo */

/** Ritual exigido pelo NH na mágica (tables.rituaisMagia). Sem ritual, sem mágica. */
export function ritualPorNH(db, nh) {
  const faixas = db.tables?.rituaisMagia?.faixas || [];
  return faixas.find(f => (f.nhMax != null && nh <= f.nhMax)
    || (f.nhMin != null && nh >= f.nhMin)
    || (typeof f.nh === 'string' && (() => { const [a, b] = f.nh.split('-').map(Number); return nh >= a && nh <= (b ?? a); })()))
    || null;
}

/** NH ≥ 15: −1 energia; ≥ 20: −2; ≥ 25: −3 (e a cada +5 NH: −1). Válido também para manutenção. */
export function reducaoDeCusto(db, nh) {
  if (nh >= 25) return { valor: -3 - Math.floor((nh - 25) / 5), nh, regra: db.tables?.reducaoCustoEnergia?.regra || '' };
  if (nh >= 20) return { valor: -2, nh, regra: db.tables?.reducaoCustoEnergia?.regra || '' };
  if (nh >= 15) return { valor: -1, nh, regra: db.tables?.reducaoCustoEnergia?.regra || '' };
  return { valor: 0, nh, regra: db.tables?.reducaoCustoEnergia?.regra || '' };
}

/** Extrai o custo publicado em energia do campo "Custo" (ex.: "3 para lançar e 2 para manter"). */
export function custoPublicado(magica) {
  const texto = String(camposDaMagica(magica).custo || '');
  const numeros = texto.match(/\d+/g)?.map(Number) || [];
  const manter = texto.match(/(\d+)\s*(?:para\s*)?manter/i);
  const lancar = texto.match(/(\d+)\s*(?:para\s*)?(?:lançar|fazer|lançar)/i) || texto.match(/^(\d+)/);
  const basico = /custo b[áa]sico/i.test(texto);
  return {
    texto,
    lancar: lancar ? Number(lancar[1]) : (numeros[0] ?? null),
    manter: manter ? Number(manter[1]) : (numeros.length > 1 ? numeros[1] : null),
    porHexagono: basico,
    variavel: /a\s+\d+/i.test(texto) || /\d+\s+a\s+\d+/i.test(texto),
    nota: basico ? 'Custo Básico: multiplicado pelo raio em hexágonos (mágicas de Área).' : null,
  };
}

/** Custo final em energia: total calculado ANTES da redução por NH alto. */
export function custoDeConjuracao(db, magica, { nh = 0, mana = 'Normal', hexagonos = 1, cerimonial = false } = {}) {
  const alvo = resolverMagica(db, magica);
  const publicado = custoPublicado(alvo);
  const base = (publicado.lancar ?? 0) * (publicado.porHexagono ? Math.max(1, hexagonos) : 1);
  const reducao = reducaoDeCusto(db, nh);
  const modMana = modificadorDeMana(db, mana);
  const energia = Math.max(0, base + reducao.valor);
  const manutencaoBase = publicado.manter ?? 0;
  return {
    magica: alvo, base, reducao: reducao.valor, energia,
    manutencao: Math.max(0, manutencaoBase + reducao.valor),
    tempo: camposDaMagica(alvo).tempo,
    tempoCerimonial: cerimonial ? `${(db.magia?.cerimonial?.multiplicadorTempo ?? 10)}× o tempo normal` : null,
    mana: modMana,
    publicado: publicado.texto,
    aviso: modMana.bloqueado ? `Mana ${modMana.mana?.nome}: ${modMana.mana?.efeito}` : null,
  };
}

/* ------------------------------------------------------------------ modificadores de conjuração */

/** Modificadores de longa distância (mágicas "Localizar" e similares). */
export function modificadorDistancia(db, metros) {
  const tabela = db.magia?.modificadoresLongaDistancia?.tabela || [];
  const faixas = [
    { max: 100, valor: 0 }, { max: 800, valor: -1 }, { max: 1500, valor: -2 }, { max: 5000, valor: -3 },
    { max: 15000, valor: -4 }, { max: 80000, valor: -5 }, { max: 150000, valor: -6 }, { max: 500000, valor: -7 },
    { max: 1500000, valor: -8 },
  ];
  const distancia = Number(metros) || 0;
  const linha = faixas.find(f => distancia < f.max || distancia <= f.max);
  if (linha) {
    const publicada = tabela[faixas.indexOf(linha)];
    return { valor: linha.valor, distancia, publicada: publicada?.distancia || null };
  }
  const extra = Math.ceil((distancia - 1500000) / 1500000);
  return { valor: -8 - extra, distancia, publicada: tabela.at(-1)?.distancia || 'Acima de 1500 km', nota: tabela.at(-1)?.modificador };
}

/** Mágicas Comuns: redutor = distância em metros quando o operador não pode tocar o alvo; −5 extra se não pode ver. */
export function modificadoresDeAlvo(db, { metros = 0, podeTocar = false, podeVer = true, tamanhoEmMetros = 1 } = {}) {
  const mods = [];
  if (!podeTocar && metros > 0) mods.push({ fonte: `Distância até o objetivo (${metros} m)`, valor: -metros });
  if (!podeTocar && !podeVer) mods.push({ fonte: 'Não pode tocar nem ver o objetivo', valor: -5 });
  if (tamanhoEmMetros > 1) mods.push({ fonte: `Objetivo maior que um hexágono (${tamanhoEmMetros} m): energia × tamanho`, valor: 0, multiplicadorDeEnergia: tamanhoEmMetros });
  return { mods, total: mods.reduce((a, m) => a + m.valor, 0) };
}

/** Toque do Mago cancela todas as penalidades de distância. */
export function toqueDoMago(db) { return db.magia?.toqueDoMago || null; }
export function cajadoEVara(db) { return db.magia?.cajadoEVara || null; }

/* ------------------------------------------------------------------ conjuração */

/** NH do operador em uma mágica (cada mágica é uma perícia própria). */
export function nhDaMagica(db, personagem, magica) {
  const alvo = resolverMagica(db, magica);
  const conhecidas = personagem?.magicas || [];
  const entrada = conhecidas.find(x => x.id === alvo?.id || String(x.nome || '').toLowerCase() === String(alvo?.nome || '').toLowerCase());
  return entrada?.nh ?? entrada?.nivel ?? personagem?.nhMagia ?? null;
}

/** Concentração: 1 turno (ou mais) e então o teste de habilidade no início do próximo turno. */
export function turnosDeConcentracao(db, magica) {
  const tempo = String(camposDaMagica(resolverMagica(db, magica)).tempo || '');
  const m = tempo.match(/(\d+)\s*(?:segundos?|turnos?)/i);
  return m ? Number(m[1]) : 1;
}

/** Faz uma mágica: teste de habilidade (d20 por padrão; 3d6 no modo publicado original). */
export function conjurar(db, personagem, {
  magica = null, nh = null, mana = 'Normal', distancia = 0, podeTocar = false, podeVer = true,
  hexagonos = 1, cerimonial = false, feridoDuranteConcentracao = 0, distraido = false,
  modificadores = [], resolucao = null, dice = DICE, categoria = 'mundano',
} = {}) {
  const alvo = resolverMagica(db, magica);
  if (!alvo) return { erro: 'Mágica não encontrada em data/spells.json.' };
  const modo = resolucao || db.rules?.configuraveis?.resolucaoMagia?.default || 'd20';
  const nhBase = nh ?? nhDaMagica(db, personagem, alvo);
  if (nhBase == null) return { erro: `O personagem não conhece "${alvo.nome}" — mágicas não têm nível pré-definido; é preciso ter sido treinado nelas.`, magica: alvo };

  const custo = custoDeConjuracao(db, alvo, { nh: nhBase, mana, hexagonos, cerimonial });
  const modMana = custo.mana;
  if (modMana.bloqueado) {
    return { erro: `Mana ${modMana.mana?.nome}: ${modMana.motivo || 'a mágica não funciona neste nível de mana.'}`, magica: alvo, custo };
  }

  const ritual = ritualPorNH(db, nhBase);
  const pre = preRequisitosDe(db, personagem, alvo);
  const mods = [...modificadores];
  if (modMana.valor) mods.push({ fonte: `Mana ${modMana.mana?.nome}`, valor: modMana.valor });
  if (!podeTocar) {
    const alvoMods = modificadoresDeAlvo(db, { metros: distancia, podeTocar, podeVer, tamanhoEmMetros: hexagonos });
    mods.push(...alvoMods.mods);
  } else {
    mods.push({ fonte: 'Toque do Mago: cancela todas as penalidades de distância', valor: 0 });
  }
  if (feridoDuranteConcentracao) mods.push({ fonte: `Ferido durante a concentração (−1 por PV perdido: ${feridoDuranteConcentracao})`, valor: -feridoDuranteConcentracao });
  if (cerimonial && (personagem?.assistentes ?? 0) > 0) mods.push({ fonte: `Assistentes no encantamento (−1 cada: ${personagem.assistentes})`, valor: -personagem.assistentes });

  const referencia = nhBase;
  let jogada;
  if (modo === '3d' || modo === '3d6') {
    const [a, b, c] = dice.roll3d();
    const total = a + b + c;
    const margem = referencia - total;
    jogada = {
      resolucao: '3d6', rolls: [a, b, c], total, referencia, margem,
      sucesso: total <= referencia,
      critico: total <= 4 || (total === 5 && referencia >= 15) || (total === 6 && referencia >= 16),
      falhaCritica: total === 18 || (total === 17 && referencia < 16) || (total - referencia >= 10) || (cerimonial && total === 16),
      chance: chance3d(referencia),
      nota: 'Modo publicado original (3 dados). Ver conflito magia-3d-vs-d20 em data/rules.json.',
    };
  } else {
    jogada = testeD20(db, { referencia, modificadores: mods, rotulo: `Conjurar ${alvo.nome}`, categoria, dice, personagem });
  }

  const energiaGasta = custo.energia; // gasta independentemente do sucesso (cerimonial: no fim do processo)
  const energia = personagem?.combate?.energia ?? null;
  const vital = personagem?.combate?.energiaVital === true;
  return {
    magica: alvo, campos: camposDaMagica(alvo), nh: nhBase, referencia, jogada, sucesso: jogada.sucesso,
    custo, ritual, preRequisitos: pre,
    turnosDeConcentracao: turnosDeConcentracao(db, alvo),
    energiaGasta,
    fonteDaEnergia: vital ? 'HT (energia vital — dano real ao operador)' : 'ST/PF (Fadiga, recuperável com descanso)',
    energiaRestante: energia != null ? energia - energiaGasta : null,
    manutencao: jogada.sucesso ? custo.manutencao : null,
    distraido: distraido ? { regra: db.magia?.distracaoEFerimentos?.regra, redutorVontade: db.magia?.distracaoEFerimentos?.redutorVontade ?? -3 } : null,
    aviso: pre.atendido ? null : `Pré-requisitos não atendidos: ${pre.faltando.join('; ')}.`,
  };
}

/** Manutenção: mesmo período da duração original, sem novo teste, gastando energia. */
export function manterMagica(db, personagem, { magica = null, nh = null, mana = 'Normal', minutos = 1 } = {}) {
  const alvo = resolverMagica(db, magica);
  const nivel = nh ?? nhDaMagica(db, personagem, alvo) ?? 0;
  const custo = custoDeConjuracao(db, alvo, { nh: nivel, mana });
  return {
    magica: alvo?.nome, duracao: camposDaMagica(alvo).duracao,
    custoPorMinuto: custo.manutencao, minutos, energiaTotal: custo.manutencao * minutos,
    regras: db.magia?.duracao?.regras || [],
    concentracaoConstante: db.magia?.duracao?.concentracao || null,
    nota: 'Não há necessidade de um novo teste de habilidade; apenas gastar mais energia.',
  };
}

/** Distração/ferimentos durante a concentração: teste de Vontade −3. */
export function manterConcentracao(db, personagem, { pvPerdidos = 0, dice = DICE, modificadores = [] } = {}) {
  const redutor = db.magia?.distracaoEFerimentos?.redutorVontade ?? -3;
  const von = personagem?.atributos?.IQ ?? 0;
  return {
    teste: testeD20(db, { referencia: von, modificadores: [...modificadores, { fonte: 'Distração/ferimento durante a concentração', valor: redutor }], rotulo: 'Vontade — manter a concentração', dice, personagem }),
    regra: db.magia?.distracaoEFerimentos?.regra,
    falha: 'Uma falha significa que ele deve começar novamente.',
    nhReduzido: pvPerdidos ? `NH efetivo da mágica reduzido em ${pvPerdidos} (pontos de vida perdidos).` : null,
  };
}

/* ------------------------------------------------------------------ cerimonial e em grupo */

/** Magia cerimonial: 10× o tempo, mesmo custo, energia gasta no fim do processo. */
export function magiaCerimonial(db, personagem, { magica = null, participantes = 1, nhParticipantes = [], energiaDisponivel = null, mana = 'Normal', dice = DICE, resolucao = null } = {}) {
  const base = conjurar(db, personagem, { magica, cerimonial: true, mana, dice, resolucao });
  if (base.erro) return base;
  const custoTotal = base.custo.energia;
  const circulo = (db.magia?.cerimonial?.cooperacao || []).find(c => c.id === 'circulo');
  const nhMinimo = circulo?.nhMinimo ?? 15;
  const qualificados = nhParticipantes.filter(nh => nh >= nhMinimo).length || (participantes > 0 ? 1 : 0);
  const porParticipante = qualificados ? Math.ceil(custoTotal / qualificados) : custoTotal;
  return {
    ...base,
    participantes, qualificados, nhMinimo,
    custoTotal, energiaPorParticipante: porParticipante,
    tempo: `${db.magia?.cerimonial?.multiplicadorTempo ?? 10}× o tempo indicado na Lista de Mágicas`,
    regras: circulo?.regras || [],
    ajudaLimitada: 'Quem não tem NH ≥ 15 na mágica pode ajudar de modo menos intenso: apenas 3 pontos de energia por mágica.',
    energiaDisponivel,
  };
}

/* ------------------------------------------------------------------ objetos encantados */

/** Poder do objeto: menor NH do operador entre Encantar e a mágica incorporada. Mínimo 15. */
export function poderDoObjeto(db, { nhEncantar = 0, nhDaMagicaIncorporada = 0, mana = 'Normal' } = {}) {
  const poder = Math.min(nhEncantar, nhDaMagicaIncorporada);
  const modMana = modificadorDeMana(db, mana);
  const efetivo = modMana.valor != null ? poder + modMana.valor : 0;
  return {
    poder, efetivo,
    funciona: efetivo >= 15,
    minimo: db.magia?.objetosEncantados?.poder?.minimo || 'O Poder de um objeto precisa ser maior ou igual a 15 ou ele não funcionará.',
    manaBaixa: /^baixa$/i.test(modMana.mana?.nome || '') ? 'Em área de mana baixa o Poder fica reduzido em 5: objetos com Poder < 20 não funcionam.' : null,
    manaNula: modMana.bloqueado ? 'Nenhum objeto encantado funciona numa área de intensidade zero.' : null,
    regra: db.magia?.objetosEncantados?.poder?.regra || '',
  };
}

/** "Rápido e sujo": 1 hora por 100 pontos de energia (arredondar para cima). */
export function encantamentoRapidoESujo(db, { energiaTotal = 0, assistentes = 0, nhOperador = 0, espectadores = 0 } = {}) {
  const cfg = db.magia?.objetosEncantados?.rapidoESujo || {};
  const horas = Math.ceil(energiaTotal / 100);
  const maxAssistentes = Math.max(0, nhOperador - 15);
  const mods = [];
  if (assistentes) mods.push({ fonte: `Assistentes (${assistentes} × ${cfg.penalidadePorAssistente ?? -1})`, valor: assistentes * (cfg.penalidadePorAssistente ?? -1) });
  if (espectadores) mods.push({ fonte: `Espectadores num raio de ${cfg.raioEspectadores ?? 10} m`, valor: cfg.penalidadeEspectadores ?? -1 });
  return {
    metodo: 'Rápido e sujo', horas, energiaTotal,
    assistentes, maxAssistentesPermitidos: maxAssistentes,
    excessoDeAssistentes: assistentes > maxAssistentes,
    modificadores: mods, totalModificadores: mods.reduce((a, m) => a + m.valor, 0),
    falha: cfg.falha || '',
    limiteOperador: cfg.limiteOperador || '',
  };
}

/** "Lento e seguro": 1 dia-mago por ponto de energia, jornadas de 8 horas. */
export function encantamentoLentoESeguro(db, { energiaTotal = 0, magos = 1, diasPerdidos = 0 } = {}) {
  const cfg = db.magia?.objetosEncantados?.lentoESeguro || {};
  const diasBase = Math.ceil(energiaTotal / Math.max(1, magos));
  const compensacao = diasPerdidos * 2;
  const custo = custoLentoEmDinheiro(db, energiaTotal);
  return {
    metodo: 'Lento e seguro',
    dias: diasBase + compensacao, diasBase, diasPerdidos, compensacaoPorDiaPerdido: diasPerdidos ? '2 dias para compensar cada dia pulado' : null,
    magos, energiaTotal, horasPorDia: 8,
    custo,
    falha: cfg.falha || '',
    perdaDeMago: cfg.perdaDeMago || '',
    testeFinal: 'O teste de habilidade final é feito no último dia; não há dispêndio de energia (ela foi aplicada gradualmente).',
  };
}

/** Economia da magia: $25 por ponto de energia (tabela em data/equipment.json → encantamentoCustoLento). */
export function custoLentoEmDinheiro(db, energiaTotal) {
  const tabela = db.equipment?.encantamentoCustoLento?.tabela || [];
  const linha = tabela.find(l => l.potencia === energiaTotal) || tabela.reduce((melhor, l) => (Math.abs(l.potencia - energiaTotal) < Math.abs((melhor?.potencia ?? Infinity) - energiaTotal) ? l : melhor), null);
  return {
    porPonto: 25,
    calculado: energiaTotal * 25,
    publicado: linha?.custo ?? null,
    potenciaDaTabela: linha?.potencia ?? null,
    nota: db.magia?.objetosEncantados?.custoFabricacao?.nota || '',
    recomendacao: energiaTotal > 270 ? 'Custo acima de 270 pontos de energia: use o método Lento e Seguro.' : null,
  };
}

/** Criação de objeto encantado: requisitos, poder, método e custo. */
export function criarObjetoEncantado(db, { magica = null, nhEncantar = 0, nhDaMagicaIncorporada = 0, metodo = 'lento', energiaTotal = 0, magos = 1, assistentes = 0, mana = 'Normal', objeto = null, dice = DICE } = {}) {
  const cfg = db.magia?.objetosEncantados?.criacao || {};
  const nhMinimo = /^baixa$/i.test(String(mana).toLowerCase()) ? (cfg.nhMinimoManaBaixa ?? 20) : (cfg.nhMinimo ?? 15);
  const erros = [];
  if (nhEncantar < nhMinimo) erros.push(`Requer conhecer a mágica Encantar em NH ≥ ${nhMinimo} (operador: ${nhEncantar}).`);
  if (nhDaMagicaIncorporada < nhMinimo) erros.push(`Requer conhecer a mágica a ser incorporada em NH ≥ ${nhMinimo} (operador: ${nhDaMagicaIncorporada}).`);
  const poder = poderDoObjeto(db, { nhEncantar, nhDaMagicaIncorporada, mana });
  const processo = metodo === 'rapido'
    ? encantamentoRapidoESujo(db, { energiaTotal, assistentes, nhOperador: Math.min(nhEncantar, nhDaMagicaIncorporada) })
    : encantamentoLentoESeguro(db, { energiaTotal, magos });
  return {
    ok: erros.length === 0, erros, magica: resolverMagica(db, magica)?.nome || null,
    objeto, poder, processo, requisitos: cfg.requisito || '', regras: db.magia?.objetosEncantados?.regras || [],
    materiais: cfg.materiais || '',
  };
}

/* ------------------------------------------------------------------ entidades */

/** Demônio gerado pela fórmula publicada: ST 3D · DX 3D · IQ 2D · HT 4D · Deslocamento 2D. */
export function criarDemonio(db, { dice = DICE } = {}) {
  const formula = db.magia?.entidades?.demonios?.formula || {};
  const rolar = (expr) => {
    const m = String(expr).match(/^(\d+)D$/i);
    if (!m) return { expr, total: null };
    const rolls = dice.roll(Number(m[1]), 6);
    return { expr, rolls, total: rolls.reduce((a, b) => a + b, 0) };
  };
  const atributos = {
    ST: rolar(formula.ST), DX: rolar(formula.DX), IQ: rolar(formula.IQ),
    HT: rolar(formula.HT), Deslocamento: rolar(formula.Deslocamento),
  };
  return {
    tipo: 'demonio', atributos,
    comportamento: db.magia?.entidades?.demonios?.comportamento || '',
    descricao: db.magia?.entidades?.demonios?.descricao || '',
    nota: formula.nota || '',
  };
}

export function entidades(db) { return db.magia?.entidades || null; }
export function elementais(db) { return db.magia?.entidades?.elementais?.tipos || []; }
export function elementalPorId(db, id) { return elementais(db).find(e => e.id === id) || null; }
