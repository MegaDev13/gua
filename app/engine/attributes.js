/* GUA Rule Engine — Atributos e Derivados
 * Fonte: Atributos Básicos (p. 1-5), Velocidade (p. 3), Dano Básico (p. 190),
 * Carga/Deslocamento (p. 195-197). Tabelas vêm de db.tables (data/tables.json).
 */
export const ATRIBUTOS = [
  { key: 'ST', nome: 'Força', descricao: 'Força muscular; base de fadiga (pontos de fadiga = ST).' },
  { key: 'DX', nome: 'Destreza', descricao: 'Agilidade e coordenação.' },
  { key: 'IQ', nome: 'Inteligência', descricao: 'Capacidade mental, vivacidade e experiência geral.' },
  { key: 'HT', nome: 'Vitalidade', descricao: 'Energia e saúde; pontos de vida (PV = HT).' },
];

/** Custo em pontos de um valor de atributo (p. 1-2). */
export function custoAtributo(db, valor) {
  const t = db.tables.custoAtributos.tabela;
  return t[String(valor)] !== undefined ? t[String(valor)] : null; // >20: REGRA NÃO DEFINIDA
}

/** Dano básico por ST (p. 190). Fadiga NÃO altera o dano básico (p. 298). */
export function danoBasico(db, st) {
  const t = db.tables.danoBasico.tabela;
  if (t[String(st)]) return { gdp: t[String(st)].gdp, bal: t[String(st)].bal, extrapolado: false, fonte: 'tables.danoBasico (p. 190)' };
  // Progressão "óbvia" (p. 190) acima de 20 — marcada como estimativa
  const passos = st - 20;
  const gdp = seqDano(2, -1, passos, [[1, 0], [1, 1], [1, 2], [0, -1]]); // 21:2D 22:2D+1 23:2D+2 24:3D-1
  const bal = seqDano(3, 2, passos, [[1, -3], [0, 0], [0, 1], [0, 2]]);  // 21:4D-1 22:4D 23:4D+1 24:4D+2(→ +1D a cada 4)
  return { gdp, bal, extrapolado: true, fonte: 'progressão estimada além da tabela (p. 190: "progressão óbvia")' };
}
function seqDano(dadosBase, modBase, passos, seq) {
  const ciclos = Math.floor(passos / 4), resto = ((passos % 4) + 4) % 4;
  const [dIn, mIn] = seq[resto];
  const dados = dadosBase + ciclos * 1 + dIn;
  let mod = (resto === 0) ? mIn : mIn;
  // normaliza mod dentro de [-5, +5] como na tabela (mods vão de -5 a +2)
  while (mod > 2) { mod -= 6; }
  return `${dados}D${mod ? (mod > 0 ? '+' + mod : mod) : ''}`;
}

/** Velocidade Básica = (DX+HT)/4 — NÃO arredondar (p. 3). */
export function velocidadeBasica(at) {
  return (at.DX + at.HT) / 4;
}

/** Levantamento/carga máxima por ST (p. 210). */
export function limitesDeForca(st) {
  return {
    umaMao: 3 * st, duasMaos: 13 * st, costas: 15 * st,
    empurrar: 13 * st, empurrarComImpulso: 25 * st, deslocarLigeiramente: 50 * st,
  };
}

/** Aparência: modificador de reação (p. 6-7). */
export const APARENCIA = {
  'hediondo': { nome: 'Hediondo', custo: -20, mesmoSexo: -4, sexoOposto: -4 },
  'feio': { nome: 'Feio', custo: -10, mesmoSexo: -2, sexoOposto: -2 },
  'desagradavel': { nome: 'Desagradável', custo: -5, mesmoSexo: -1, sexoOposto: 0 },
  'comum': { nome: 'Aparência Comum', custo: 0, mesmoSexo: 0, sexoOposto: 0 },
  'elegante': { nome: 'Elegante (Bonito)', custo: 15, mesmoSexo: 2, sexoOposto: 4 },
  'muito-elegante': { nome: 'Muito Elegante (Bonito)', custo: 25, mesmoSexo: 2, sexoOposto: 6 },
};

/** Mão inábil: -4 em ações importantes com a mão ruim (p. 3). Ambidestria elimina. */
export function penalidadeMaoInabil(personagem) {
  if (personagem.vantagens?.some(v => v.id === 'ambidestria')) return 0;
  return personagem.mao === 'ambidestro' ? 0 : -4;
}
