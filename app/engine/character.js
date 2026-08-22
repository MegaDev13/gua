/* GUA Rule Engine — Modelo de Personagem e Contagem de Pontos
 * Estrutura modular: novos campos podem ser adicionados sem quebrar versões antigas.
 */
import { custoAtributo, APARENCIA } from './attributes.js';
import { custoTrait, pontosPeculiaridades, MAX_PECULIARIDADES } from './traits.js';
import { totalPontosEmPericias } from './skills.js';
import { registrarHistorico } from './economy.js';

export function novoPersonagem(nome = 'Novo Personagem', pontos = 100) {
  return {
    versao: 1,
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
    magias: [],
    inventario: [],
    combate: { ferimentos: 0, fadiga: 0, condicoes: [], manobra: null, rodada: 0 },
    config: { emCriacao: true, modoCombate: 'basico', limiteDesvantagens: null },
    historico: [{ quando: new Date().toISOString(), tipo: 'criacao', texto: 'Personagem criado.' }],
  };
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
    const def = db.advantages.find(a => a.id === v.id);
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
  const ptsSkills = totalPontosEmPericias(db, personagem);
  gastos += ptsSkills;
  partes.push({ tipo: 'pericias', nome: 'Perícias', custo: ptsSkills });
  const ptsMagias = (personagem.magias || []).reduce((a, m) => a + (m.pontos || 0), 0);
  gastos += ptsMagias;
  partes.push({ tipo: 'magias', nome: 'Magias', custo: ptsMagias });
  const total = personagem.pontos.total + (personagem.pontos.extrasGanhos || 0);
  return {
    total, gastos, disponiveis: total - gastos,
    partes,
    validacoes: validar(db, personagem, { gastosSkills: ptsSkills }),
  };
}

function validar(db, personagem, { gastosSkills }) {
  const avisos = [];
  if (personagem.config?.emCriacao && personagem.idade && gastosSkills > 2 * personagem.idade) {
    avisos.push(`Pontos em perícias (${gastosSkills}) excedem 2× idade (${2 * personagem.idade}) — limite de criação (p. 103).`);
  }
  if ((personagem.peculiaridades || []).length > MAX_PECULIARIDADES) {
    avisos.push(`Mais de ${MAX_PECULIARIDADES} peculiaridades (p. 88).`);
  }
  const am = (personagem.vantagens || []).find(v => v.id === 'aptidao-magica');
  if (am && (am.niveis || 1) > 3) avisos.push('Aptidão Mágica máxima: 3 níveis (p. 301).');
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
