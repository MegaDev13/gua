/* GUA Rule Engine — Carga, Movimento e Defesas passivas
 * Fonte: Carga (p. 195-197), Deslocamento (p. 197), Armaduras (p. 181-186), Escudos (p. 194-195).
 */
import { velocidadeBasica } from './attributes.js';

/** Peso total carregado (kg): itens carregados (equipados + carregados). Armazenado não conta (p. 181). */
export function pesoCarregado(personagem) {
  let kg = 0;
  const detalhes = [];
  for (const item of personagem.inventario || []) {
    if (item.armazenado) continue;
    const w = (item.peso || 0) * (item.qtd || 1);
    if (w > 0) { kg += w; detalhes.push({ nome: item.nome, peso: w, qtd: item.qtd || 1 }); }
  }
  return { kg, detalhes };
}

/** Nível de Carga 0-4 (p. 195-197). ST base (fadiga não altera os limites de carga). */
export function nivelCarga(db, personagem) {
  const st = personagem.atributos.ST;
  const { kg } = pesoCarregado(personagem);
  const limites = [st, st * 2, st * 3, st * 6, st * 10];
  const nomes = ['Nenhuma', 'Leve', 'Média', 'Pesada', 'Muito Pesada'];
  const penalidades = [0, 1, 2, 3, 4];
  if (kg > limites[4]) {
    return { nivel: 5, nome: 'ACIMA DO MÁXIMO', kg, penalidade: null,
      nota: 'Acima de 10×ST: só 1–2 m por vez. 15×ST é o máximo absoluto (p. 195-196).', limite: '10×ST' };
  }
  let idx = 4;
  for (let i = 0; i <= 4; i++) { if (kg <= limites[i]) { idx = i; break; } }
  return { nivel: idx, nome: nomes[idx], kg, penalidade: penalidades[idx], limite: `${['ST', '2×ST', '3×ST', '6×ST', '10×ST'][idx]}`, nota: null };
}

/** Deslocamento (p. 197): (Velocidade + Corrida/8) − penalidade de Carga, arredondado p/ baixo.
 *  HT ≤ 3 (ferimentos, p. 232) ou ST ≤ 3 (fadiga, p. 299): metade (arred. p/ baixo). Nunca 0 (p. 197). */
export function deslocamento(db, personagem, ctx = {}) {
  const at = personagem.atributos;
  const vb = velocidadeBasica(at);
  const breakdown = [{ fonte: 'Velocidade Básica = (DX+HT)/4', valor: vb }];
  let base = vb;
  const nhCorrida = ctx.niveisPericias?.['Corrida'];
  if (nhCorrida) {
    const bonus = Math.floor(nhCorrida / 8);
    if (bonus > 0) { base += bonus; breakdown.push({ fonte: `Corrida NH ${nhCorrida} → +1/8 NH`, valor: bonus }); }
  }
  const carga = nivelCarga(db, personagem);
  if (carga.penalidade) breakdown.push({ fonte: `Carga ${carga.nome}`, valor: -carga.penalidade });
  let mov = base - (carga.penalidade || 0);
  const htAtual = at.HT - (personagem.combate?.ferimentos || 0);
  if (htAtual <= 3) { mov = Math.floor(mov / 2); breakdown.push({ fonte: 'HT ≤ 3 (ferimentos graves)', valor: '× ½' }); }
  const stAtual = at.ST - (personagem.combate?.fadiga || 0);
  if (stAtual <= 3) { mov = Math.floor(mov / 2); breakdown.push({ fonte: 'ST ≤ 3 (fadiga)', valor: '× ½' }); }
  mov = Math.max(1, Math.floor(mov));
  return { valor: mov, breakdown, velocidadeBasica: vb, carga };
}

/** Defesa Passiva total: armadura + escudo equipados + Rijeza (p. 186, 195, 228, 29). */
export function defesaPassiva(personagem) {
  const parts = [];
  let dp = 0, rd = 0;
  for (const item of personagem.inventario || []) {
    if (!item.equipado) continue;
    if (item.categoria === 'armadura') {
      dp += item.dp || 0; rd += item.rd || 0;
      parts.push({ fonte: item.nome, dp: item.dp || 0, rd: item.rd || 0, notas: item.notas || '' });
    }
    if (item.categoria === 'escudo') {
      dp += item.dp || 0;
      parts.push({ fonte: `${item.nome} (escudo)`, dp: item.dp || 0, rd: 0, notas: 'Não protege ataques pelas costas' });
    }
  }
  const rijeza = (personagem.vantagens || []).find(v => v.id === 'rijeza');
  if (rijeza) {
    const rdNat = rijeza.niveis >= 2 ? 2 : 1;
    rd += rdNat;
    parts.push({ fonte: `Rijeza (nível ${rijeza.niveis})`, dp: 0, rd: rdNat, notas: '' });
  }
  return { dp, rd, parts };
}

/** Penalidades do escudo (p. 194-195). */
export function penalidadesEscudo(personagem) {
  const esc = (personagem.inventario || []).find(i => i.equipado && i.categoria === 'escudo');
  if (!esc) return { escudo: null, escudoGrande: false, dp: 0 };
  return { escudo: esc, escudoGrande: (esc.dp || 0) >= 4, dp: esc.dp || 0 };
}
