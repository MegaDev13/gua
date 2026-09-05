/* GUA Rule Engine — Categorias de Poder, Dimensionalidade e Hax
 * Fontes:
 *  · CATEGORIAS DE PODER — data/resolucao.json → categorias ("A quantidade de dados representa a
 *    escala na qual o personagem existe"; Mundano = 1 d20; categorias acima = REGRA NÃO DEFINIDA)
 *  · TESTES DETERMINADOS POR CATEGORIA — o mestre indica um valor chave (categoria necessária)
 *  · DIMENSIONALIDADE — data/poderes.json → dimensionalidade (superioridade geométrica/euclidiana)
 *  · HAX — data/poderes.json → hax (potência menor, chance maior de vencer; Hax é relativo)
 */
import { dadosDaCategoria, testePorCategoria } from './resolution.js';

/* ------------------------------------------------------------------ categorias de poder */

/** Lista publicada de categorias de poder (escala). */
export function categorias(db) { return db.resolucao?.categorias?.lista || []; }

export function regraDasCategorias(db) { return db.resolucao?.categorias?.regra || ''; }

export function categoriaPorId(db, id) { return categorias(db).find(c => c.id === id) || null; }

export function categoriaPorNome(db, nome) {
  const alvo = String(nome || '').trim().toLowerCase();
  return categorias(db).find(c => c.nome.toLowerCase() === alvo)
    || categorias(db).find(c => c.nome.toLowerCase().includes(alvo)) || null;
}

export function categoriaDoPersonagem(db, personagem) {
  return categoriaPorId(db, personagem?.categoria || 'mundano') || categoriaPorId(db, 'mundano');
}

/** Nível ordinal da categoria na lista publicada (0 = Mundano). */
export function nivelDaCategoria(db, categoriaId) {
  const idx = categorias(db).findIndex(c => c.id === categoriaId);
  return idx >= 0 ? idx : 0;
}

/** Quantidade de d20 da escala do personagem + alerta de regra não definida. */
export function escalaDoPersonagem(db, personagem) {
  return dadosDaCategoria(db, personagem?.categoria || 'mundano');
}

/** Teste determinado por categoria: só pode ser executado por quem for daquela categoria
 *  (ou possuir um recurso específico que possibilite a jogada). */
export function podeRealizarTeste(db, personagem, categoriaExigida) {
  return testePorCategoria(db, personagem, categoriaExigida);
}

/** Confere a categoria exigida por um teste/poder e devolve o bloqueio, se houver. */
export function requisitoDeCategoria(db, personagem, categoriaExigida) {
  if (!categoriaExigida) return { ok: true, permitido: true };
  const resultado = testePorCategoria(db, personagem, categoriaExigida);
  return { ok: resultado.ok, permitido: resultado.ok, motivo: resultado.motivo, categoria: resultado.categoria, exigida: resultado.exigida };
}

/** Como vários d20 de uma categoria superior são combinados — REGRA NÃO DEFINIDA. */
export function modosDeAgregacao(db) {
  const cfg = db.resolucao?.categorias?.agregacaoDeDados || {};
  return {
    aviso: cfg._aviso || 'REGRA NÃO DEFINIDA',
    problema: cfg.problema || '',
    modos: cfg.modosSuportados || {},
    configuravel: cfg.configuravel || 'config.modoEscala',
  };
}

/* ------------------------------------------------------------------ dimensionalidade */

export function dimensionalidade(db) { return db.poderes?.dimensionalidade || null; }

/** Aceita número (3, 4), string ("3D", "4-dimensional") ou objeto { dimensao }. */
function numeroDeDimensoes(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'object') return numeroDeDimensoes(valor.dimensao ?? valor.d ?? valor.id);
  const m = String(valor).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Superioridade geométrica/euclidiana: a entidade de dimensão maior não se submete às regras da menor. */
export function comparaDimensionalidade(db, { dimensoesA = 3, dimensoesB = 3, reinoA = null, reinoB = null } = {}) {
  const cfg = dimensionalidade(db) || {};
  const a = numeroDeDimensoes(dimensoesA);
  const b = numeroDeDimensoes(dimensoesB);
  if (a == null || b == null) return { erro: `Dimensão não reconhecida: ${a == null ? dimensoesA : dimensoesB}` };
  const superior = a > b ? 'A' : b > a ? 'B' : null;
  const inferior = superior === 'A' ? 'B' : superior === 'B' ? 'A' : null;
  const dimensaoSuperior = superior ? Math.max(a, b) : a;
  return {
    a: { dimensao: a, reino: reinoA }, b: { dimensao: b, reino: reinoB },
    superior, inferior,
    veredito: superior
      ? `Entidade ${superior} (${dimensaoSuperior}D) > Entidade ${inferior} (${Math.min(a, b)}D): reside em uma existência dimensional muito maior.`
      : 'Mesma dimensão: sem superioridade dimensional.',
    operacao: cfg.operacao || null,
    exemplo: cfg.exemplo || null,
    implicacoes: cfg.implicacoes || null,
    exemploDeImunidade: cfg.exemploDeImunidade || null,
    ressalva: cfg.ressalva || null,
    dimensoesInferiores: cfg.dimensoesInferiores || null,
    imuneAsRegrasInferiores: !!superior,
    naoTotalmenteImune: superior ? 'Entidades com dimensionalidade superior são livres, mas não totalmente imunes.' : null,
    definicao: cfg.definicao || '',
  };
}

/* ------------------------------------------------------------------ hax */

export function hax(db) { return db.poderes?.hax || null; }

/** Registro de Hax na estatística do personagem (descrição, nível de escala e categoria). */
export function notaDeHax(db, { descricao = '', nivelDeEscala = null, categoria = 'mundano', oponente = null } = {}) {
  const cfg = hax(db) || {};
  const cat = categoriaPorId(db, categoria);
  const dim = oponente ? comparaDimensionalidade(db, { dimensoesA: nivelDeEscala ?? 3, dimensoesB: oponente }) : null;
  return {
    descricao, nivelDeEscala, categoria, categoriaNome: cat?.nome || categoria,
    definicao: cfg.definicao || '',
    relatividade: cfg.relatividade || '',
    limite: cfg.limite || '',
    aviso: 'O Hax é relativo: habilidades fortes em nível parede podem não ser úteis em categorias mais elevadas.',
    vantagemDimensional: dim?.superior === 'A' ? 'A dimensionalidade superior anula a maioria dos hax do oponente (ver exemploDeImunidade).' : null,
  };
}

/** O nível de escala de um personagem pode exceder sua categoria de poder. */
export function nivelDeEscalaAcimaDaCategoria(db, { categoria = 'mundano', nivelDeEscala = 1 } = {}) {
  const cat = categoriaPorId(db, categoria);
  return {
    permitido: true,
    motivo: `${cat?.nome || categoria}: ${cat?.nota || 'sem limite publicado'}. O material de poderes permite nível de escala acima da categoria do personagem.`,
    categoriasPublicadas: categorias(db).map(c => c.nome),
    nivelDeEscala,
  };
}

export { dadosDaCategoria, testePorCategoria };
