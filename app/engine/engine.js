/* GUA Rule Engine — Fachada (computeAll)
 * Toda informação calculada passa por aqui. A interface NÃO contém fórmulas.
 * Cada valor sai com "breakdown" (origem de cada número) para tooltips.
 */
import { custoAtributo, danoBasico, velocidadeBasica, limitesDeForca, penalidadeMaoInabil } from './attributes.js';
import { nivelEfetivo, niveisTreinados, attrPadrao } from './skills.js';
import { nivelMagia, iqMagico } from './spells.js';
import { pesoCarregado, nivelCarga, deslocamento, defesaPassiva, penalidadesEscudo } from './encumbrance.js';
import { contagemDePontos } from './character.js';
import { fadigaAtual, stEfetiva, estadoFadiga } from './fatigue.js';
import { esquiva } from './combat.js';

export function computeAll(db, personagem) {
  const niveis = niveisTreinados(db, personagem);
  const ctx = { niveisPericias: niveis };

  const vel = velocidadeBasica(personagem.atributos);
  const mov = deslocamento(db, personagem, ctx);
  const carga = nivelCarga(db, personagem);
  const peso = pesoCarregado(personagem);
  const pd = defesaPassiva(personagem);
  const esc = penalidadesEscudo(personagem);
  const dano = danoBasico(db, personagem.atributos.ST);

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

  return {
    _db: db,
    _pc: personagem,
    atributos: personagem.atributos,
    custoAtributos: Object.fromEntries(Object.entries(personagem.atributos).map(([k, v]) => [k, custoAtributo(db, v)])),
    velocidadeBasica: vel,
    deslocamento: mov,
    carga: { ...carga, peso },
    defesaPassiva: pd,
    escudo: esc,
    danoBasico: dano,
    limitesForca: limitesDeForca(personagem.atributos.ST),
    esquiva: esquiva(db, personagem, ctx).valor,
    pericias, magias, niveis,
    contagem,
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
