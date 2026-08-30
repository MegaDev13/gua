/* Componentes visuais do sistema universal de filtros.
 * A lógica vive em engine/filters.js; esta camada apenas edita estado e desenha.
 */
import { el } from './ui.js';
import {
  FilterEngine, emptyFilterState, deriveFacetOptions,
  saveFilterPreset, loadFilterPresets, removeFilterPreset,
} from '../engine/filters.js';

const clone = value => JSON.parse(JSON.stringify(value));
const storage = () => typeof localStorage !== 'undefined' ? localStorage : null;

export function createFavoriteStore(namespace) {
  const key = `gua.favorites.${namespace}.v1`;
  const load = () => {
    try { return new Set(JSON.parse(storage()?.getItem(key) || '[]')); }
    catch { return new Set(); }
  };
  let ids = load();
  return {
    has(id) { return ids.has(String(id)); },
    toggle(id) {
      id = String(id);
      ids.has(id) ? ids.delete(id) : ids.add(id);
      storage()?.setItem(key, JSON.stringify([...ids]));
      return ids.has(id);
    },
    values() { return [...ids]; },
  };
}

/**
 * @param {{id:string, items:Array, schema:Array, searchFields:Array,
 * title?:string, context?:object, quickFilters?:Array,
 * onChange:(result:Array,state:object,controller:object)=>void}} config
 */
export function createFilterPanel(config) {
  const schema = config.schema || [];
  const engine = new FilterEngine(config.items || [], schema, {
    searchFields: config.searchFields,
    context: config.context,
  });
  let state = emptyFilterState(schema);
  let current = engine.items;

  const root = el('section', { class: 'filter-system no-print', 'aria-label': config.title || 'Filtros' });
  const search = el('input', {
    type: 'search', class: 'filter-search',
    placeholder: config.searchPlaceholder || 'Pesquisar por nome, descrição ou característica…',
    'aria-label': 'Pesquisar',
  });
  const count = el('strong', { class: 'filter-count', 'aria-live': 'polite' }, `${engine.items.length} resultados`);
  const active = el('div', { class: 'filter-active', 'aria-label': 'Filtros ativos' });
  const groupsNode = el('div', { class: 'filter-groups' });
  const presetsNode = el('div', { class: 'filter-presets' });

  const apply = () => {
    state.text = search.value || '';
    current = engine.filter(state, config.context);
    count.textContent = `${current.length} ${current.length === 1 ? 'resultado' : 'resultados'}`;
    drawActive();
    config.onChange?.(current, clone(state), controller);
    return current;
  };

  const reset = () => {
    state = emptyFilterState(schema);
    search.value = '';
    drawGroups();
    apply();
  };

  function toggleOption(key, kind, value, checked) {
    const selected = state.groups[key] || (state.groups[key] = { include: [], exclude: [] });
    const list = selected[kind];
    const index = list.map(String).indexOf(String(value));
    if (checked && index < 0) list.push(value);
    if (!checked && index >= 0) list.splice(index, 1);
    apply();
  }

  function drawGroups() {
    groupsNode.innerHTML = '';
    for (const group of schema) {
      if (group.hidden) continue;
      const selected = state.groups[group.key];
      if (group.type === 'range') {
        const min = el('input', { type: 'number', placeholder: 'mín.', value: selected?.min ?? '', step: group.step || 'any', 'aria-label': `${group.label} mínimo` });
        const max = el('input', { type: 'number', placeholder: 'máx.', value: selected?.max ?? '', step: group.step || 'any', 'aria-label': `${group.label} máximo` });
        min.onchange = () => { state.groups[group.key].min = min.value === '' ? null : Number(min.value); apply(); };
        max.onchange = () => { state.groups[group.key].max = max.value === '' ? null : Number(max.value); apply(); };
        groupsNode.append(el('details', { class: 'filter-group' },
          el('summary', {}, group.label),
          el('div', { class: 'filter-range' }, min, el('span', {}, 'até'), max)));
        continue;
      }

      if (group.type === 'boolean' || group.type === 'relation') {
        const input = el('input', { type: 'checkbox', checked: selected === true });
        input.onchange = () => { state.groups[group.key] = input.checked ? true : null; apply(); };
        groupsNode.append(el('label', { class: 'filter-toggle' }, input, el('span', {}, group.label)));
        continue;
      }

      const options = group.options || deriveFacetOptions(engine.items, group, config.context);
      if (!options.length) continue;
      const list = el('div', { class: 'filter-options' });
      for (const raw of options) {
        const option = typeof raw === 'object' ? raw : { value: raw, label: String(raw) };
        const checked = (selected?.include || []).map(String).includes(String(option.value));
        const excluded = (selected?.exclude || []).map(String).includes(String(option.value));
        const include = el('input', { type: 'checkbox', checked, 'aria-label': `Incluir ${option.label}` });
        include.onchange = () => toggleOption(group.key, 'include', option.value, include.checked);
        const not = el('button', {
          class: `filter-not ${excluded ? 'active' : ''}`,
          type: 'button', title: excluded ? 'Remover exclusão' : 'Excluir esta opção',
          'aria-pressed': excluded ? 'true' : 'false',
          onclick: () => {
            const activeNow = (state.groups[group.key]?.exclude || []).map(String).includes(String(option.value));
            toggleOption(group.key, 'exclude', option.value, !activeNow);
            drawGroups();
          },
        }, '−');
        list.append(el('div', { class: 'filter-option' },
          el('label', {}, include, el('span', {}, option.label), option.count != null ? el('small', {}, String(option.count)) : ''),
          group.exclude !== false ? not : ''));
      }
      groupsNode.append(el('details', { class: 'filter-group' },
        el('summary', {}, group.label), list));
    }
  }

  function activeEntries() {
    const entries = [];
    if (state.text) entries.push({ label: `“${state.text}”`, clear: () => { search.value = ''; state.text = ''; apply(); } });
    for (const group of schema) {
      const value = state.groups[group.key];
      if (group.type === 'range') {
        if (value?.min != null) entries.push({ label: `${group.label} ≥ ${value.min}`, clear: () => { value.min = null; drawGroups(); apply(); } });
        if (value?.max != null) entries.push({ label: `${group.label} ≤ ${value.max}`, clear: () => { value.max = null; drawGroups(); apply(); } });
      } else if (group.type === 'boolean' || group.type === 'relation') {
        if (value === true) entries.push({ label: group.label, clear: () => { state.groups[group.key] = null; drawGroups(); apply(); } });
      } else {
        for (const option of value?.include || []) entries.push({ label: String(option), clear: () => { toggleOption(group.key, 'include', option, false); drawGroups(); } });
        for (const option of value?.exclude || []) entries.push({ label: `não: ${option}`, clear: () => { toggleOption(group.key, 'exclude', option, false); drawGroups(); } });
      }
    }
    return entries;
  }

  function drawActive() {
    active.innerHTML = '';
    const entries = activeEntries();
    if (!entries.length) return;
    active.append(el('span', { class: 'filter-active-label' }, 'Ativos:'));
    for (const entry of entries) active.append(el('button', { class: 'filter-chip', onclick: entry.clear }, entry.label, ' ×'));
  }

  function drawPresets() {
    presetsNode.innerHTML = '';
    const presets = loadFilterPresets(storage(), config.id);
    const name = el('input', { type: 'text', placeholder: 'Nome da combinação', 'aria-label': 'Nome do filtro salvo' });
    const save = el('button', { class: 'btn small', onclick: () => {
      if (!name.value.trim()) return;
      state.text = search.value || '';
      saveFilterPreset(storage(), config.id, name.value, state);
      name.value = '';
      drawPresets();
    } }, 'Salvar filtros');
    const saved = el('div', { class: 'filter-saved-list' });
    for (const preset of presets) saved.append(el('span', { class: 'filter-saved' },
      el('button', { class: 'btn small ghost', onclick: () => {
        state = clone(preset.state);
        search.value = state.text || '';
        drawGroups(); apply();
      } }, preset.name),
      el('button', { class: 'filter-delete', 'aria-label': `Excluir ${preset.name}`, onclick: () => { removeFilterPreset(storage(), config.id, preset.name); drawPresets(); } }, '×')));
    presetsNode.append(el('div', { class: 'filter-save-row' }, name, save), saved);
  }

  search.oninput = apply;
  const quick = el('div', { class: 'filter-quick' },
    ...(config.quickFilters || []).map(preset => el('button', { class: 'btn small ghost', onclick: () => {
      state = emptyFilterState(schema);
      preset.apply(state, config.context);
      search.value = state.text || '';
      drawGroups(); apply();
    } }, preset.label)));

  const drawer = el('details', { class: 'filter-drawer' },
    el('summary', {}, el('span', {}, '☷ Filtros avançados'), count),
    groupsNode,
    el('details', { class: 'filter-preset-drawer' }, el('summary', {}, 'Filtros salvos'), presetsNode),
    el('button', { class: 'btn small ghost filter-reset', onclick: reset }, '↺ Resetar filtros'));

  root.append(
    el('div', { class: 'filter-toolbar' }, search, quick, el('button', { class: 'btn small ghost filter-reset-desktop', onclick: reset }, 'Resetar'), count),
    active,
    drawer,
  );

  const controller = {
    node: root,
    get state() { return clone(state); },
    get results() { return current; },
    apply,
    reset,
    setItems(items) { engine.setItems(items); drawGroups(); return apply(); },
    setState(next) { state = { ...emptyFilterState(schema), ...clone(next) }; search.value = state.text || ''; drawGroups(); return apply(); },
    refresh() { engine._lastKey = null; return apply(); },
  };

  drawGroups();
  drawPresets();
  // O chamador normalmente insere node antes de chamar apply, mas o callback já pode
  // preparar a primeira lista sem depender de layout.
  apply();
  return controller;
}
