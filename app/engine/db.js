/* GUA Rule Engine — Carregador do banco de dados (data/*.json).
 * Funciona no navegador (fetch, caminhos relativos) e no Node (fs) — usado pelos testes.
 * O banco é a FONTE ÚNICA DA VERDADE: nada de valores duplicados no código.
 */
/* Arquivos de dados. Os sete últimos são o material G.A.U. (d20) adicionado em 2026:
 * resolucao (testes), proezas (físicas/sentidos/vontade), armas (arsenal por era),
 * estruturas (dano em objetos/NT), poderes (construtor modular), magia (sistema mágico),
 * ficha (modelo da planilha oficial) e vantagens (regras do capítulo de Vantagens:
 * introdução, custos, Aliado, Patrono, novas vantagens, exemplo de seleção e migração de ids). */
const FILES = [
  'rules', 'tables', 'skills', 'advantages', 'disadvantages', 'quirks', 'equipment', 'spells',
  'maneuvers', 'book',
  'resolucao', 'proezas', 'armas', 'estruturas', 'poderes', 'magia', 'ficha', 'vantagens',
];

class Database {
  constructor() { this._data = {}; this._loaded = false; }

  async load(fetchImpl) {
    if (this._loaded) return this;
    for (const name of FILES) {
      try {
        let text;
        if (typeof window !== 'undefined' || fetchImpl) {
          const f = fetchImpl || window.fetch;
          const r = await f(this._path(name));
          if (!r.ok) throw new Error(`${r.status}`);
          text = await r.text();
        } else {
          const fs = await import('fs');
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const here = path.dirname(fileURLToPath(import.meta.url));
          text = fs.readFileSync(path.join(here, '..', '..', 'data', `${name}.json`), 'utf-8');
        }
        this._data[name] = JSON.parse(text);
      } catch (e) {
        this._data[name] = { _erro: `Falha ao carregar data/${name}.json: ${e.message}` };
      }
    }
    this._loaded = true;
    return this;
  }

  _path(name) {
    // relativo à raiz do app (index.html) — GitHub Pages em subdiretório funciona
    const base = (typeof document !== 'undefined' && document.currentScript?.src) ? '' : '';
    return `data/${name}.json`;
  }

  get tables() { return this._data.tables || {}; }
  get skills() { return this._data.skills || []; }
  get advantages() { return this._data.advantages || []; }
  get disadvantages() { return this._data.disadvantages || []; }
  get quirks() { return this._data.quirks || {}; }
  get equipment() { return this._data.equipment || {}; }
  get spells() { return this._data.spells || []; }
  get maneuvers() { return this._data.maneuvers || {}; }
  get rules() { return this._data.rules || {}; }
  get book() { return this._data.book || {}; }
  /* --- material G.A.U. (d20) --- */
  get resolucao() { return this._data.resolucao || {}; }
  get proezas() { return this._data.proezas || {}; }
  get armas() { return this._data.armas || {}; }
  get estruturas() { return this._data.estruturas || {}; }
  get poderes() { return this._data.poderes || {}; }
  get magia() { return this._data.magia || {}; }
  get ficha() { return this._data.ficha || {}; }
  get vantagens() { return this._data.vantagens || {}; }

  skill(id) { return this.skills.find(s => s.id === id); }
  spell(id) { return this.spells.find(s => s.id === id); }
  advantage(id) { return this.advantages.find(a => a.id === id); }
  /** Vantagem pelo id normalizado ou por qualquer id antigo (migração de fichas salvas). */
  advantageCompat(id) {
    const direto = this.advantages.find(a => a.id === id);
    if (direto) return direto;
    const novo = this.vantagens?.migracaoDeIds?.mapa?.[id];
    return novo ? this.advantages.find(a => a.id === novo) || null : null;
  }
  disadvantage(id) { return this.disadvantages.find(a => a.id === id); }
  armor(id) { return (this.equipment.armaduras || []).find(a => a.id === id); }
  shield(id) { return (this.equipment.escudos || []).find(a => a.id === id); }
  /** Arma do arsenal G.A.U. pelas três eras (medieval, moderna, futurista). */
  weapon(id) {
    return (this.armas.eras || []).flatMap(e => e.armas || []).find(a => a.id === id) || null;
  }
  /** Mágica da Lista de Mágicas. */
  magic(id) { return this.spells.find(s => s.id === id) || null; }
  /** Nó da árvore de manobras G.A.U. */
  maneuver(id) { return this.maneuvers?.manobras?.find(m => m.id === id) || null; }
  /** Erros de carregamento (para diagnóstico em testes). */
  get erros() { return Object.fromEntries(Object.entries(this._data).filter(([, v]) => v && v._erro)); }
}

export const DB = new Database();
export default DB;
