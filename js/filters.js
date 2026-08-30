/* GAU — Sistema de Filtros Inteligente */

export const FILTER_CATEGORIES = [
  { id: 'regra', label: 'Regras', icon: '📜' },
  { id: 'manobra', label: 'Manobras', icon: '⚔️' },
  { id: 'arma', label: 'Armas', icon: '🗡️' },
  { id: 'tabela', label: 'Tabelas', icon: '📊' },
  { id: 'empunhadura', label: 'Empunhaduras', icon: '🤲' },
  { id: 'poder', label: 'Poderes', icon: '🧠' },
  { id: 'magia', label: 'Magias', icon: '🔮' },
  { id: 'vantagem', label: 'Vantagens', icon: '✨' },
  { id: 'desvantagem', label: 'Desvantagens', icon: '💀' },
  { id: 'pericia', label: 'Perícias', icon: '📜' },
  { id: 'peculiaridade', label: 'Peculiaridades', icon: '🌀' },
  { id: 'escala', label: 'Escalas', icon: '📈' }
];

export const WEAPON_FILTERS = [
  { id: 'mundano', label: 'Medieval', icon: '🏰' },
  { id: 'moderno', label: 'Moderno', icon: '🔫' },
  { id: 'futurista', label: 'Futurista', icon: '🚀' },
  { id: 'corpo-a-corpo', label: 'Corpo-a-corpo', icon: '👊' },
  { id: 'distancia', label: 'Distância', icon: '🎯' },
  { id: 'area', label: 'Área', icon: '💥' }
];

export class FilterSystem {
  constructor() {
    this.active = new Set();
    this.weaponActive = new Set();
    this.callbacks = [];
  }

  toggle(id) {
    if (this.active.has(id)) this.active.delete(id);
    else this.active.add(id);
    this._notify();
  }

  toggleWeapon(id) {
    if (this.weaponActive.has(id)) this.weaponActive.delete(id);
    else this.weaponActive.add(id);
    this._notify();
  }

  clear() {
    this.active.clear();
    this.weaponActive.clear();
    this._notify();
  }

  isActive(id) { return this.active.has(id); }
  isWeaponActive(id) { return this.weaponActive.has(id); }

  hasFilters() { return this.active.size > 0 || this.weaponActive.size > 0; }

  filterItems(items) {
    // items = [{tipo, categoriaId, tipoArma, ...}]
    if (!this.hasFilters()) return items;
    return items.filter(item => {
      if (this.active.size > 0) {
        // se tem filtro de tipo, item deve bater em pelo menos um
        if (item.tipo && !this.active.has(item.tipo)) return false;
      }
      if (this.weaponActive.size > 0) {
        // para armas, verifica categoria e tipo
        const catMatch = item.categoriaId ? this.weaponActive.has(item.categoriaId) : false;
        const tipoMatch = item.tipoArma ? this.weaponActive.has(item.tipoArma) : false;
        // se filtro inclui tanto categoria quanto tipo, precisa bater em pelo menos um?
        // Lógica: se filtro contém categorias, verifica categoria; se contém tipos, verifica tipo; se ambos, OR
        const hasCatFilter = [...this.weaponActive].some(id => ['mundano','moderno','futurista'].includes(id));
        const hasTipoFilter = [...this.weaponActive].some(id => ['corpo-a-corpo','distancia','area'].includes(id));
        if (hasCatFilter && hasTipoFilter) {
          if (!catMatch && !tipoMatch) return false;
        } else if (hasCatFilter) {
          if (!catMatch) return false;
        } else if (hasTipoFilter) {
          if (!tipoMatch) return false;
        }
      }
      return true;
    });
  }

  onChange(cb) { this.callbacks.push(cb); }

  _notify() {
    this.callbacks.forEach(cb => cb(this));
  }

  getActiveLabels() {
    const labels = [];
    for (const id of this.active) {
      const cat = FILTER_CATEGORIES.find(c => c.id === id);
      if (cat) labels.push(cat.label);
    }
    for (const id of this.weaponActive) {
      const cat = WEAPON_FILTERS.find(c => c.id === id);
      if (cat) labels.push(cat.label);
    }
    return labels;
  }
}
