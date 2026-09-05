/* GUA Rule Engine — Dados e Testes
 * Fonte: Testes de Habilidade (p. 198-205), Falha/Sucesso Críticos (p. 200-202, 243-244).
 * 3 dados de seis faces (3d) para testes; d6 para dano. 17/18 = falha automática.
 */
export class Dice {
  constructor(rng = Math.random) { this.rng = rng; this.history = []; }
  d(n) { return 1 + Math.floor(this.rng() * n); }
  d6() { return this.d(6); }
  /** Dado do núcleo G.A.U: 1d20 (data/resolucao.json). */
  d20() { return this.d(20); }
  /** Rola `quantidade` dados de `faces` faces. */
  roll(quantidade, faces = 20) { return Array.from({ length: Math.max(1, quantidade | 0) }, () => this.d(faces)); }
  roll3d() { return [this.d6(), this.d6(), this.d6()]; }
  static sum(rolls) { return rolls.reduce((a, b) => a + b, 0); }

  /** Teste de habilidade completo (3d). Retorna resultado estruturado. */
  check(nhEfetivo, { label = '', modifiers = [] } = {}) {
    const rolls = this.roll3d();
    const total = Dice.sum(rolls);
    const res = {
      label, rolls, total, nhEfetivo, modifiers,
      margem: nhEfetivo - total,
      sucesso: false, critico: false, tipo: 'falha', descricao: '',
    };
    if (total <= nhEfetivo) {
      res.sucesso = true;
      // Sucesso decisivo: 3-4 sempre; 5 se NH>=15; 6 se NH>=16 (p. 200-201, 243)
      if (total <= 4 || (total === 5 && nhEfetivo >= 15) || (total === 6 && nhEfetivo >= 16)) {
        res.critico = true; res.tipo = 'sucesso-decisivo';
        res.descricao = 'Sucesso decisivo';
      } else { res.tipo = 'sucesso'; res.descricao = 'Sucesso'; }
    } else {
      // Falha crítica: 18 sempre; 17 se NH<16; margem >= 10 (p. 201, 243-244)
      if (total === 18 || (total === 17 && nhEfetivo < 16) || (total - nhEfetivo >= 10)) {
        res.critico = true; res.tipo = 'falha-critica';
        res.descricao = total >= 17 ? 'Erro crítico (ataque) / Falha crítica' : 'Falha crítica (margem ≥ 10)';
      } else {
        res.tipo = 'falha';
        // 17 com NH>=16 é falha comum; 18 sempre falha
        res.descricao = (total === 17 || total === 18) ? 'Falha automática (17/18)' : 'Falha';
      }
    }
    this.history.unshift({ quando: new Date().toISOString(), ...res });
    if (this.history.length > 200) this.history.pop();
    return res;
  }

  /** Avaliação de dano: "3D+2", "1D-4", "2D" etc. Min 0 (contusão) ou 1 (corte/perfuração) aplicado fora. */
  damage(expr, { min = 0 } = {}) {
    const m = String(expr).trim().match(/^(\d+)\s*[dD]\s*([+-]\s*\d+)?$/);
    if (!m) return { erro: `Expressão de dano inválida: ${expr}`, total: 0, rolls: [] };
    const n = parseInt(m[1], 10);
    const mod = m[2] ? parseInt(m[2].replace(/\s+/g, ''), 10) : 0;
    const rolls = [];
    for (let i = 0; i < n; i++) rolls.push(this.d6());
    let total = Dice.sum(rolls) + mod;
    if (total < min) total = min;
    const res = { expr: `${n}D${mod ? (mod > 0 ? '+' + mod : mod) : ''}`, rolls, mod, total };
    this.history.unshift({ quando: new Date().toISOString(), tipo: 'dano', ...res });
    return res;
  }
}

/** Rolagem de dano genérica com qualquer número de faces — tabelas G.A.U usam d4, d6, d8, d10 e d12.
 *  Aceita "3d12", "1d10+2", "2D-3", "5D+" (mínimo 0). Fonte: data/armas.json, data/estruturas.json. */
export function rolarDanoGenerico(expr, dice = DICE) {
  const texto = String(expr ?? '').trim();
  const m = texto.match(/^(\d+)\s*[dD]\s*(\d+)?\s*([+-]\s*\d+)?$/);
  if (!m) return { erro: `Expressão de dano não reconhecida: ${expr}`, expr: texto, rolls: [], total: 0 };
  const quantidade = parseInt(m[1], 10);
  const faces = m[2] ? parseInt(m[2], 10) : 6;
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  const rolls = dice.roll(quantidade, faces);
  const total = Math.max(0, Dice.sum(rolls) + mod);
  const resultado = { expr: `${quantidade}d${faces}${mod ? (mod > 0 ? '+' + mod : mod) : ''}`, rolls, faces, mod, total };
  dice.history.unshift({ quando: new Date().toISOString(), tipo: 'dano-generico', ...resultado });
  return resultado;
}

/** Média estatística de uma expressão de dano (conferência das colunas "Média" de data/armas.json). */
export function mediaDeDano(expr) {
  const m = String(expr ?? '').trim().match(/^(\d+)\s*[dD]\s*(\d+)?\s*([+-]\s*\d+)?$/);
  if (!m) return null;
  const quantidade = parseInt(m[1], 10);
  const faces = m[2] ? parseInt(m[2], 10) : 6;
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  return quantidade * (faces + 1) / 2 + mod;
}

/** Probabilidade de sucesso 3d (tabela p. 110). */
export function chance3d(nh) {
  if (nh <= 3) return 0.005;
  if (nh >= 16) return 0.981;
  const t = { 3: 0.005, 4: 0.019, 5: 0.046, 6: 0.093, 7: 0.162, 8: 0.259, 9: 0.375, 10: 0.5, 11: 0.625, 12: 0.741, 13: 0.838, 14: 0.907, 15: 0.954 };
  return t[nh];
}

/** Classifica um teste já feito (usado p/ exibição). */
export function classify(nhEfetivo, total) {
  return null; // classificação ocorre em Dice.check
}

/* -------------------------------------------------------------- singleton
 * Um único gerador para toda a aplicação (e para os testes, que podem trocar o RNG).
 * Reexportado por combat.js e usado por resolution.js, damage.js e maneuvers.js. */
export const DICE = new Dice();
export function setRNG(rng) { DICE.rng = rng; }
export const dice = DICE;

