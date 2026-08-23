/* GUA — FilterEngine universal.
 *
 * Uma única implementação para livro, equipamentos, perícias, magias e catálogos
 * futuros. Regras de composição:
 *   - opções dentro do mesmo campo: OR;
 *   - campos diferentes: AND;
 *   - exclusões: NOT;
 *   - expressões avançadas: árvore AND/OR/NOT.
 *
 * Filtros organizam dados; nunca alteram uma regra do RPG.
 */

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readPath(object, path) {
  if (typeof path === 'function') return path(object);
  if (!path) return object;
  return String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], object);
}

function asArray(value) {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value.flatMap(asArray) : [value];
}

function comparable(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return normalizeSearch(value);
}

function hasIntersection(actual, selected) {
  const values = asArray(actual).map(comparable);
  const wanted = asArray(selected).map(comparable);
  return wanted.some(option => values.some(value => value === option));
}

export function emptyFilterState(schema = []) {
  return {
    text: '',
    groups: Object.fromEntries(schema.map(group => [group.key, group.type === 'range'
      ? { min: null, max: null }
      : (group.type === 'boolean' || group.type === 'relation')
        ? null
        : { include: [], exclude: [] }])),
    expression: null,
  };
}

function searchableText(item, fields) {
  const values = fields?.length ? fields.map(path => readPath(item, path)) : Object.values(item || {});
  return normalizeSearch(values.flatMap(asArray).join(' '));
}

function matchesGroup(item, group, selected, context) {
  if (!group || selected == null) return true;
  const actual = group.accessor ? group.accessor(item, context) : readPath(item, group.path || group.key);

  if (group.type === 'range') {
    const hasMin = selected.min != null && selected.min !== '';
    const hasMax = selected.max != null && selected.max !== '';
    if (!hasMin && !hasMax) return true;
    if (actual == null || actual === '') return false;
    const numeric = Number(actual);
    if (!Number.isFinite(numeric)) return false;
    if (hasMin && numeric < Number(selected.min)) return false;
    if (hasMax && numeric > Number(selected.max)) return false;
    return true;
  }

  if (group.type === 'boolean' || group.type === 'relation') {
    if (selected === null || selected === undefined || selected === '') return true;
    return Boolean(actual) === Boolean(selected);
  }

  if (group.type === 'custom') return group.predicate ? group.predicate(item, selected, context) : true;

  const include = selected.include || (Array.isArray(selected) ? selected : []);
  const exclude = selected.exclude || [];
  if (include.length && !hasIntersection(actual, include)) return false; // OR dentro do grupo
  if (exclude.length && hasIntersection(actual, exclude)) return false; // NOT
  return true;
}

/** Avalia árvores de consulta avançada sem usar eval.
 * Nó-folha: { field, operator: 'eq|in|not-in|gte|lte|contains|truthy', value }
 * Grupo:     { operator: 'and|or|not', children: [...] }
 */
export function matchesExpression(item, node, context = {}) {
  if (!node) return true;
  const operator = String(node.operator || 'and').toLowerCase();
  if (Array.isArray(node.children)) {
    if (operator === 'or') return node.children.some(child => matchesExpression(item, child, context));
    if (operator === 'not') return !node.children.some(child => matchesExpression(item, child, context));
    return node.children.every(child => matchesExpression(item, child, context));
  }

  const actual = readPath(item, node.field);
  const expected = node.value;
  switch (operator) {
    case 'eq': return comparable(actual) === comparable(expected);
    case 'neq': return comparable(actual) !== comparable(expected);
    case 'in': return hasIntersection(actual, asArray(expected));
    case 'not-in': return !hasIntersection(actual, asArray(expected));
    case 'gte': return Number(actual) >= Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'between': return Number(actual) >= Number(expected?.[0]) && Number(actual) <= Number(expected?.[1]);
    case 'contains': return normalizeSearch(asArray(actual).join(' ')).includes(normalizeSearch(expected));
    case 'truthy': return Boolean(actual) === (expected === undefined ? true : Boolean(expected));
    default: return true;
  }
}

export function filterCollection(items, state = {}, schema = [], options = {}) {
  const words = normalizeSearch(state.text).split(' ').filter(Boolean);
  const fields = options.searchFields || ['nome', 'titulo', 'descricao', 'tags'];
  const context = options.context || {};
  return (items || []).filter(item => {
    if (words.length) {
      const haystack = searchableText(item, fields);
      if (!words.every(word => haystack.includes(word))) return false;
    }
    for (const group of schema) {
      if (!matchesGroup(item, group, state.groups?.[group.key], context)) return false;
    }
    return matchesExpression(item, state.expression, context);
  });
}

/** Opções são derivadas dos dados reais; nenhuma categoria fantasma é criada. */
export function deriveFacetOptions(items, group, context = {}) {
  const found = new Map();
  for (const item of items || []) {
    const raw = group.accessor ? group.accessor(item, context) : readPath(item, group.path || group.key);
    for (const value of asArray(raw)) {
      if (value == null || value === '') continue;
      const key = String(comparable(value));
      const entry = found.get(key) || { value, label: String(value), count: 0 };
      entry.count += 1;
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true }));
}

function stableState(state) {
  const sort = value => {
    if (Array.isArray(value)) return value.map(sort).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
    return value;
  };
  return JSON.stringify(sort(state));
}

/** Índice reutilizável com memoização da última consulta. */
export class FilterEngine {
  constructor(items = [], schema = [], options = {}) {
    this.schema = schema;
    this.options = options;
    this.setItems(items);
  }

  setItems(items) {
    this.items = items || [];
    this._lastKey = null;
    this._lastResult = null;
    return this;
  }

  filter(state, context = this.options.context || {}) {
    const key = stableState(state) + `::${this.items.length}`;
    if (key === this._lastKey) return this._lastResult;
    this._lastKey = key;
    this._lastResult = filterCollection(this.items, state, this.schema, { ...this.options, context });
    return this._lastResult;
  }

  facets(key, context = this.options.context || {}) {
    const group = this.schema.find(candidate => candidate.key === key);
    return group ? deriveFacetOptions(this.items, group, context) : [];
  }
}

export function serializeFilterPreset(state) {
  return JSON.parse(JSON.stringify(state));
}

export function saveFilterPreset(storage, namespace, name, state) {
  if (!storage || !name?.trim()) return [];
  const key = `gua.filters.${namespace}.v1`;
  const presets = loadFilterPresets(storage, namespace).filter(preset => preset.name !== name.trim());
  presets.push({ name: name.trim(), state: serializeFilterPreset(state), savedAt: new Date().toISOString() });
  storage.setItem(key, JSON.stringify(presets));
  return presets;
}

export function loadFilterPresets(storage, namespace) {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(`gua.filters.${namespace}.v1`) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function removeFilterPreset(storage, namespace, name) {
  const key = `gua.filters.${namespace}.v1`;
  const presets = loadFilterPresets(storage, namespace).filter(preset => preset.name !== name);
  storage?.setItem(key, JSON.stringify(presets));
  return presets;
}
