/* GUA Rule Engine — Fachada (computeAll)
 * Toda informação calculada passa por aqui. A interface NÃO contém fórmulas.
 * Cada valor sai com "breakdown" (origem de cada número) para tooltips.
 */
import { custoAtributo, danoBasico, velocidadeBasica, limitesDeForca, penalidadeMaoInabil } from './attributes.js';
import { nivelEfetivo, niveisTreinados, attrPadrao } from './skills.js';
import { nivelMagia, iqMagico } from './spells.js';
import { pesoCarregado, nivelCarga, deslocamento, defesaPassiva, penalidadesEscudo } from './encumbrance.js';
import { contagemDePontos, aptidaoMagicaDe } from './character.js';
import { fadigaAtual, stEfetiva, estadoFadiga, pfMax, pfDisponiveis } from './fatigue.js';
import { esquiva } from './combat.js';
/* --- núcleo G.A.U. (d20) --- */
import { secundarios, parametros, deslocamentoGAU } from './derived.js';
import { margemDeSucesso, dadosDaCategoria, testesPreDefinidos } from './resolution.js';
import { orcamentoDePoder } from './powers.js';
import { nhDaMagica } from './magic.js';
import { resumoDasVantagens, atributosEfetivos } from './vantagens.js';

export function computeAll(db, personagem) {
  const niveis = niveisTreinados(db, personagem);
  const ctx = { niveisPericias: niveis };

  /* Vantagens: atributos efetivos (ex.: Sobrevivente do Inferno +2 ST/DX) e resumo de todos os bônus.
   * Os atributos da ficha nunca são reescritos — o ajuste fica registrado no breakdown. */
  const atributosComVantagens = atributosEfetivos(db, personagem);
  const ajustesDeAtributos = atributosComVantagens._breakdown || [];
  delete atributosComVantagens._breakdown;

  const vel = velocidadeBasica(atributosComVantagens);
  const mov = deslocamento(db, personagem, ctx);
  const carga = nivelCarga(db, personagem);
  const peso = pesoCarregado(personagem);
  const pd = defesaPassiva(personagem, db);
  const esc = penalidadesEscudo(personagem);
  const dano = danoBasico(db, atributosComVantagens.ST);
  const vantagens = resumoDasVantagens(db, personagem);

  // Perícias com níveis efetivos
  const pericias = (personagem.pericias || []).map(entry => {
    const ef = nivelEfetivo(db, personagem, entry, {
      ...ctx,
      elmo: temElmo(personagem),
      escudoGrande: esc.escudoGrande,
    });
    return {
      ...ef, entry,
      nome: ef.skill.nome + (entry.especialidade ? ` (${entry.especialidade})` : ''),
      treinada: ef.nivelTreinado !== null,
      porDefault: ef.default && (ef.nivelTreinado === null || ef.default.valor > ef.nivelTreinado),
    };
  });

  // Magias
  const magias = (personagem.magias || []).map(m => {
    const nm = nivelMagia(db, personagem, m);
    return { ...nm, entry: m, spell: db.spell(m.id) || m };
  });

  const contagem = contagemDePontos(db, personagem);
  const fadiga = fadigaAtual(personagem);
  const stAt = stEfetiva(personagem);
  const estadoF = estadoFadiga(personagem);
  const htAtual = personagem.atributos.HT - (personagem.combate?.ferimentos || 0);

  /* --- núcleo G.A.U. (d20): secundários oficiais, parâmetros e resolução --- */
  const sec = secundarios(db, personagem);
  const armaPrincipal = (personagem.inventario || []).find(i => i.equipado && i.categoria === 'arma') || null;
  const params = parametros(db, personagem, { ...ctx, arma: armaPrincipal });
  const movGAU = deslocamentoGAU(db, personagem, ctx);
  const escala = dadosDaCategoria(db, personagem.categoria || 'mundano');
  const magicas = (personagem.magicas || []).map(m => ({
    ...m,
    spell: db.magic?.(m.id) || db.spell?.(m.id) || null,
    nh: m.nh ?? nhDaMagica(db, personagem, m) ?? null,
  }));

  return {
    _db: db,
    _pc: personagem,
    atributos: personagem.atributos,
    atributosEfetivos: atributosComVantagens,
    ajustesDeAtributos,
    custoAtributos: Object.fromEntries(Object.entries(personagem.atributos).map(([k, v]) => [k, custoAtributo(db, v)])),
    velocidadeBasica: vel,
    deslocamento: mov,
    carga: { ...carga, peso },
    defesaPassiva: pd,
    escudo: esc,
    danoBasico: dano,
    limitesForca: limitesDeForca(atributosComVantagens.ST),
    esquiva: esquiva(db, personagem, ctx).valor,
    pericias, magias, niveis,
    vantagens,
    contagem,
    /* --- ficha oficial G.A.U. (data/ficha.json) --- */
    secundarios: sec,
    parametros: params,
    magicas,
    gau: {
      dadoBase: db.resolucao?.dadoBase || 'd20',
      categoria: escala,
      margens: Object.fromEntries(Object.entries(personagem.atributos).map(([k, v]) => [k, margemDeSucesso(db, v)])),
      deslocamento: movGAU,
      pontosDePoder: contagem.pontosDePoder,
      orcamentoDePoder: orcamentoDePoder(db, personagem, { total: personagem.pontosDePoder?.total ?? null }),
      aptidaoMagica: aptidaoMagicaDe(db, personagem),
      testesPreDefinidos: testesPreDefinidos(db),
      rd: sec.RD,
      defesasAtivas: vantagens.defesasAtivas,
      sentidos: vantagens.sentidos,
      pf: { max: pfMax(personagem), disponiveis: pfDisponiveis(personagem), fadiga },
      poderes: personagem.poderes || [],
      linguas: personagem.linguas || { escritas: [], faladas: [] },
      biografia: personagem.biografia || '',
    },
    combate: {
      ferimentos: personagem.combate?.ferimentos || 0,
      htAtual,
      fadiga, stEfetiva: stAt, estadoFadiga: estadoF,
      condicoes: personagem.combate?.condicoes || [],
      maos: { penalidadeMaoInabil: penalidadeMaoInabil(personagem), destro: personagem.mano },
      elmo: temElmo(personagem),
      desmaiado: htAtual <= -5 * personagem.atributos.HT,
      inconscienteRisco: htAtual <= 0,
    },
  };
}

function temElmo(personagem) {
  return (personagem.inventario || []).some(i => i.equipado && i.categoria === 'armadura' && /elmo/i.test(i.notas || ''));
}
