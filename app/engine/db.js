/* GUA Rule Engine — Carregador do banco de dados (data/*.json).
 * Funciona no navegador (fetch, caminhos relativos) e no Node (fs) — usado pelos testes.
 * O banco é a FONTE ÚNICA DA VERDADE: nada de valores duplicados no código.
 */
const FILES = ['rules', 'tables', 'skills', 'advantages', 'disadvantages', 'quirks', 'equipment', 'spells', 'maneuvers', 'book'];

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

  skill(id) { return this.skills.find(s => s.id === id); }
  spell(id) { return this.spells.find(s => s.id === id); }
  advantage(id) { return this.advantages.find(a => a.id === id); }
  disadvantage(id) { return this.disadvantages.find(a => a.id === id); }
  armor(id) { return (this.equipment.armaduras || []).find(a => a.id === id); }
  shield(id) { return (this.equipment.escudos || []).find(a => a.id === id); }
}

export const DB = new Database();
export default DB;
