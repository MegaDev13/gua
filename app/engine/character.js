/* GUA Rule Engine — Modelo de Personagem e Contagem de Pontos
 * Estrutura modular: novos campos podem ser adicionados sem quebrar versões antigas.
 *
 * v2 (G.A.U. d20 — data/ficha.json): acrescenta categoria de poder, poderes modulares com
 * orçamento próprio de pontos de poder, línguas (escritas/faladas), biografia e mágicas.
 * v3 (VANTAGENS — canal #『📕』vantagens): ids de vantagens normalizados
 * ('aptid-o-m-gica' → 'aptidao-magica'), níveis estruturados por nome (Rijeza "RD 2",
 * Memória Eidética "2º nível", Sorte "Extraordinária") e remoção da entrada corrompida
 * vinda da extração do PDF. `migrarPersonagem()` traz fichas v1/v2 para v3 sem perda de dados.
 * v4 (PERÍCIAS — canal #『📕』perícias): modelo G.A.U. de compra de perícias — a perícia é
 * comprada no nível 1 pelo custo publicado e cada ponto adicional depositado vale +1 nível.
 * Fichas antigas (pontos investidos) são convertidas pelo NH legado, sem apagar nada.
 */
import { custoAtributo, APARENCIA } from './attributes.js';
import { custoTrait, pontosPeculiaridades, MAX_PECULIARIDADES } from './traits.js';
import {
  totalPontosEmPericias, modeloDePericias, custoPericiasGAU, validarPericiasGAU, nivelDaEntrada,
} from './skills.js';
import { registrarHistorico } from './economy.js';
import { custoDoPoder } from './powers.js';
import { definicaoDaVantagem, normalizarEntradaDeVantagem, validarVantagens, nivelDaVantagem } from './vantagens.js';

export const VERSAO_FICHA = 4;

export function novoPersonagem(nome = 'Novo Personagem', pontos = 100, db = null) {
  return {
    versao: VERSAO_FICHA,
    id: `pc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    criadoEm: new Date().toISOString(),
    nome, conceito: '', jogador: '', idade: null, mano: 'destro',
    pontos: { total: pontos, extrasGanhos: 0 },
    atributos: { ST: 10, DX: 10, IQ: 10, HT: 10 },
    aparenciaNivel: 'comum',
    fisico: { altura: '', peso: '', cabelos: '', olhos: '', pele: '', descricao: '' },
    riqueza: { nivel: 'Médio', multiplicador: 1, recursosBase: 1000, dinheiro: 1000 },
    statusSocial: 0,
    reputacoes: [],
    vantagens: [], desvantagens: [], peculiaridades: [],
    pericias: [],
    magias: [],            // legado 3d (pontos gastos na ficha)
    magicas: [],           // G.A.U.: cada mágica é uma perícia — { id, nome, nh, pontos }
    inventario: [],
    /* --- G.A.U. (data/ficha.json) --- */
    categoria: 'mundano',  // categoria de poder / escala (data/resolucao.json → categorias)
    poderes: [],           // poderes modulares (data/poderes.json) — ver app/engine/powers.js
    linguas: { escritas: [], faladas: [] },
    biografia: '',
    aptidaoMagica: 0,      // máximo 3 (data/magia.json → aptidao.limite)
    pontosDePoder: {
      total: db?.poderes?.orcamento?.exemploPadrao ?? 150,
      nivelSaga: db?.poderes?.orcamento?.nivelInicial ?? 'mundano',
    },
    combate: { ferimentos: 0, fadiga: 0, condicoes: [], manobra: null, rodada: 0, pv: null, pf: null, energia: null },
    config: {
      emCriacao: true, modoCombate: 'gau', limiteDesvantagens: null, resolucaoMagia: null,
      modoEscala: 'melhor', criterioDisputa: 'proximidade-do-critico',
      modeloPericias: db?.rules?.configuraveis?.modeloPericias?.default ?? 'gau',
      modoPreDefinido: db?.rules?.configuraveis?.modoPreDefinido?.default ?? 'publicado',
    },
    historico: [{ quando: new Date().toISOString(), tipo: 'criacao', texto: 'Personagem criado.' }],
  };
}

/** Traz uma ficha antiga (v1) para o modelo G.A.U. (v2), preservando tudo que já existia. */
export function migrarPersonagem(db, personagem) {
  if (!personagem || typeof personagem !== 'object') return personagem;
  if (personagem.versao === VERSAO_FICHA) return personagem;
  const base = novoPersonagem(personagem.nome || 'Novo Personagem', personagem.pontos?.total ?? 100, db);
  const migrado = {
    ...base,
    ...personagem,
    versao: VERSAO_FICHA,
    pontos: { total: personagem.pontos?.total ?? 100, extrasGanhos: personagem.pontos?.extrasGanhos ?? 0 },
    atributos: { ...base.atributos, ...(personagem.atributos || {}) },
    linguas: { escritas: [], faladas: [], ...(personagem.linguas || {}) },
    poderes: Array.isArray(personagem.poderes) ? personagem.poderes : [],
    magicas: Array.isArray(personagem.magicas) ? personagem.magicas
      : (personagem.magias || []).map(m => ({ id: m.id, nome: m.nome || db.spell?.(m.id)?.nome || m.id, nh: m.nh ?? null, pontos: m.pontos ?? 0, legado: true })),
    combate: { ...base.combate, ...(personagem.combate || {}) },
    config: { ...base.config, ...(personagem.config || {}) },
    historico: [
      ...(personagem.historico || []),
      { quando: new Date().toISOString(), tipo: 'migracao', texto: `Ficha migrada para o modelo G.A.U. (v${VERSAO_FICHA}): categoria de poder, poderes modulares, línguas, biografia e secundários PV/VON/PER/PF.` },
    ],
  };
  if (migrado.categoria == null) migrado.categoria = 'mundano';
  /* v3: vantagens — ids normalizados, níveis estruturados e entradas corrompidas removidas. */
  const antes = (migrado.vantagens || []).length;
  migrado.vantagens = (migrado.vantagens || [])
    .map(entrada => normalizarEntradaDeVantagem(db, entrada))
    .filter(Boolean);
  const mudados = (migrado.vantagens || []).filter((v, i) => v.id !== (personagem.vantagens || [])[i]?.id).length;
  if (mudados || migrado.vantagens.length !== antes) {
    migrado.historico.push({
      quando: new Date().toISOString(), tipo: 'migracao',
      texto: `Vantagens atualizadas para a publicação oficial do canal #『📕』vantagens (v${VERSAO_FICHA}): `
        + `${mudados} id(s) normalizado(s), ${antes - migrado.vantagens.length} entrada(s) inválida(s) removida(s).`,
    });
  }
  /* v4: perícias — converte entradas do modelo legado (pontos investidos) para o modelo G.A.U. (nível).
     Só com o banco carregado: sem data/tables.json o NH legado não pode ser calculado, e a conversão
     fica adiada (a ficha continua válida — nivelDaEntrada aceita entradas antigas em tempo de jogo). */
  const dbPronto = !!db?.tables?.custoPericias;
  const periciasAntigas = dbPronto
    ? (migrado.pericias || []).filter(e => !Number.isFinite(e?.nivel) && Number.isFinite(e?.pontos))
    : [];
  if (periciasAntigas.length) {
    try {
      migrado.pericias = (migrado.pericias || []).map(entrada => {
        if (Number.isFinite(entrada?.nivel) || !Number.isFinite(entrada?.pontos)) return entrada;
        const nivel = nivelDaEntrada(db, migrado, entrada);
        if (nivel === null || nivel === undefined) return entrada;
        const nova = { ...entrada, nivel, pontosLegados: entrada.pontos };
        delete nova.pontos;
        return nova;
      });
      migrado.historico.push({
        quando: new Date().toISOString(), tipo: 'migracao',
        texto: `Perícias convertidas para o modelo G.A.U. (v${VERSAO_FICHA}): ${periciasAntigas.length} entrada(s) passaram de `
          + 'pontos investidos para nível comprado (o NH legado foi adotado como nível; os pontos antigos ficaram em `pontosLegados`).',
      });
    } catch (erro) {
      /* nunca perde a ficha: mantém as entradas como estavam e registra o motivo */
      migrado.historico.push({
        quando: new Date().toISOString(), tipo: 'migracao',
        texto: `Conversão de perícias adiada (${erro?.message || 'erro desconhecido'}) — as entradas antigas continuam na ficha e valem como nível pelo NH legado.`,
      });
    }
  } else if (!dbPronto && (migrado.pericias || []).some(e => Number.isFinite(e?.pontos))) {
    migrado.historico.push({
      quando: new Date().toISOString(), tipo: 'migracao',
      texto: 'Banco de regras não carregado nesta inicialização: a conversão das perícias ficou para a próxima abertura.',
    });
  }
  if (migrado.config && migrado.config.modeloPericias == null) {
    migrado.config.modeloPericias = db?.rules?.configuraveis?.modeloPericias?.default ?? 'gau';
  }

  // Aptidão Mágica: em v1 ela só existia como vantagem; em v2 também é campo da ficha.
  migrado.aptidaoMagica = Math.max(
    Number(migrado.aptidaoMagica) || 0,
    nivelDaVantagem(db, migrado, 'aptidao-magica'),
  );
  return migrado;
}

/** Aptidão Mágica efetiva (limitada a 3) — vantagem ou campo próprio da ficha. */
export function aptidaoMagicaDe(db, personagem) {
  const limite = Number(String(db?.magia?.aptidao?.limite || '').match(/(\d+)/)?.[1] ?? 3);
  const daVantagem = (personagem?.vantagens || []).find(v => v.id === 'aptidao-magica');
  const valor = personagem?.aptidaoMagica ?? (daVantagem ? (daVantagem.niveis ?? daVantagem.nivel ?? 1) : 0);
  return Math.max(0, Math.min(limite, Number(valor) || 0));
}

/** Contabilidade completa de pontos (criação: p. 1-112). */
export function contagemDePontos(db, personagem) {
  const partes = [];
  let gastos = 0;
  for (const [key, valor] of Object.entries(personagem.atributos)) {
    const c = custoAtributo(db, valor) ?? 0;
    gastos += c;
    partes.push({ tipo: 'atributo', nome: key, custo: c, detalhe: `${key} ${valor}` });
  }
  const ap = APARENCIA[personagem.aparenciaNivel] || APARENCIA.comum;
  if (ap.custo !== 0) { gastos += ap.custo; partes.push({ tipo: 'vantagem', nome: `Aparência: ${ap.nome}`, custo: ap.custo }); }
  if ((personagem.statusSocial || 0) !== 0) {
    let c = personagem.statusSocial * 5;
    if (personagem.riqueza?.multiplicador >= 5 && personagem.statusSocial > 0) c -= 5; // Riqueza≥Rico: -5 no Status (p. 17)
    gastos += c;
    partes.push({ tipo: 'vantagem', nome: `Status ${personagem.statusSocial}`, custo: c, detalhe: '5 pts/nível' + (c !== personagem.statusSocial * 5 ? ' (−5 por Riqueza ≥ Rico)' : '') });
  }
  for (const v of personagem.vantagens || []) {
    const def = definicaoDaVantagem(db, v.id);
    const { custo } = custoTrait(personagem, v, def);
    gastos += custo;
    partes.push({ tipo: 'vantagem', nome: def?.nome || v.nome || v.id, custo, detalhe: v.nivel || v.niveis ? `nível ${v.nivel ?? v.niveis}` : '' });
  }
  for (const d of personagem.desvantagens || []) {
    const def = db.disadvantages.find(a => a.id === d.id);
    const { custo } = custoTrait(personagem, d, def);
    gastos += Math.abs(custo) * -1;
    partes.push({ tipo: 'desvantagem', nome: def?.nome || d.nome || d.id, custo: -Math.abs(custo) });
  }
  const pq = pontosPeculiaridades(personagem);
  gastos += pq.pontos;
  partes.push({ tipo: 'peculiaridade', nome: `${pq.quantidade} peculiaridade(s)`, custo: pq.pontos, detalhe: `máx ${MAX_PECULIARIDADES}` });
  const modelo = modeloDePericias(db, personagem);
  const custosSkills = modelo === 'gau'
    ? custoPericiasGAU(db, personagem)
    : { total: totalPontosEmPericias(db, personagem), partes: [], semCustoPublicado: 0 };
  const ptsSkills = custosSkills.total;
  gastos += ptsSkills;
  partes.push({
    tipo: 'pericias', nome: 'Perícias', custo: ptsSkills,
    detalhe: modelo === 'gau'
      ? `${(personagem.pericias || []).length} perícias · custo publicado + 1 ponto por nível acima de 1`
        + (custosSkills.semCustoPublicado ? ` · ${custosSkills.semCustoPublicado} sem custo publicado` : '')
      : 'modelo legado: pontos investidos na tabela de dificuldade',
    modelo,
  });
  const ptsMagias = (personagem.magias || []).reduce((a, m) => a + (m.pontos || 0), 0);
  gastos += ptsMagias;
  partes.push({ tipo: 'magias', nome: 'Magias (legado 3d)', custo: ptsMagias });
  const ptsMagicas = (personagem.magicas || []).reduce((a, m) => a + (m.pontos || 0), 0);
  gastos += ptsMagicas;
  if (ptsMagicas) partes.push({ tipo: 'magicas', nome: 'Mágicas (G.A.U.)', custo: ptsMagicas, detalhe: 'Cada mágica é uma perícia; mínimo de 1 ponto por mágica aprendida.' });
  const total = personagem.pontos.total + (personagem.pontos.extrasGanhos || 0);

  /* Poderes modulares têm ORÇAMENTO PRÓPRIO (pontos de poder da saga) — não entram
   * na contagem de pontos do personagem. Fonte: data/poderes.json → orcamento. */
  const orcamento = personagem.pontosDePoder?.total ?? db?.poderes?.orcamento?.exemploPadrao ?? 150;
  const poderes = (personagem.poderes || []).map(poder => ({ poder, custo: custoDoPoder(db, poder) }));
  const gastoEmPoderes = poderes.reduce((soma, p) => soma + p.custo.total, 0);

  return {
    total, gastos, disponiveis: total - gastos,
    partes,
    pontosDePoder: {
      total: orcamento,
      gasto: gastoEmPoderes,
      disponiveis: orcamento - gastoEmPoderes,
      nivelSaga: personagem.pontosDePoder?.nivelSaga ?? personagem.categoria ?? 'mundano',
      poderes: poderes.map(p => ({ id: p.poder.id, nome: p.poder.nome, custo: p.custo.total, itens: p.custo.partes.length })),
      regra: db?.poderes?.orcamento?.regra || '',
    },
    validacoes: validar(db, personagem, { gastosSkills: ptsSkills, gastoEmPoderes, orcamento, modeloPericias: modelo }),
  };
}

function validar(db, personagem, { gastosSkills, gastoEmPoderes = 0, orcamento = null, modeloPericias = 'gau' }) {
  const avisos = [];
  if (orcamento != null && gastoEmPoderes > orcamento) {
    avisos.push(`Pontos de poder excedidos: ${gastoEmPoderes} gastos de um orçamento de ${orcamento} (o valor é baseado no nível de poder da saga).`);
  }
  for (const poder of personagem.poderes || []) {
    const maxCond = db?.poderes?.modulos?.condicoes?.maximo ?? 3;
    if ((poder.condicoes || []).length > maxCond) avisos.push(`Poder "${poder.nome}": mais de ${maxCond} Condições.`);
  }
  if ((personagem.atributos?.HT ?? 0) > 0 && personagem.combate?.pf != null && personagem.combate.pf > personagem.atributos.HT) {
    avisos.push('PF acima da reserva (PF = HT na ficha oficial).');
  }
  if (modeloPericias === 'gau') {
    /* Perícias: pré-requisitos publicados, limite de criação (2 × idade) e NT mínimo. */
    const validacaoPericias = validarPericiasGAU(db, personagem);
    avisos.push(...validacaoPericias.erros, ...validacaoPericias.avisos);
  } else if (personagem.config?.emCriacao && personagem.idade && gastosSkills > 2 * personagem.idade) {
    avisos.push(`Pontos em perícias (${gastosSkills}) excedem 2× idade (${2 * personagem.idade}) — limite de criação (p. 103).`);
  }
  if ((personagem.peculiaridades || []).length > MAX_PECULIARIDADES) {
    avisos.push(`Mais de ${MAX_PECULIARIDADES} peculiaridades (p. 88).`);
  }
  if (nivelDaVantagem(db, personagem, 'aptidao-magica') > 3) avisos.push('Aptidão Mágica máxima: 3 níveis (p. 301).');
  if (aptidaoMagicaDe(db, personagem) > 3) avisos.push('Aptidão Mágica máxima: 3 níveis (data/magia.json → aptidao.limite).');
  /* Vantagens: requisitos de atributo, incompatibilidades (Abascanto × Aptidão Mágica), unicidade e níveis máximos. */
  const validacaoVantagens = validarVantagens(db, personagem);
  avisos.push(...validacaoVantagens.erros, ...validacaoVantagens.avisos);
  for (const [k, v] of Object.entries(personagem.atributos)) {
    if (v < 1 || v > 20) avisos.push(`Atributo ${k} fora da faixa 1–20.`);
  }
  const lim = personagem.config?.limiteDesvantagens;
  if (lim !== null && lim !== undefined) {
    const ptsDis = (personagem.desvantagens || []).reduce((a, d) => {
      const def = db.disadvantages.find(x => x.id === d.id);
      return a + Math.abs(custoTrait(personagem, d, def).custo);
    }, 0);
    if (ptsDis > lim) avisos.push(`Desvantagens (${ptsDis} pts) excedem o limite da campanha (${lim}).`);
  }
  return avisos;
}
