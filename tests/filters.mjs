#!/usr/bin/env node
/* Testes do FilterEngine universal — node tests/filters.mjs */
import assert from 'node:assert/strict';
import {
  FilterEngine, emptyFilterState, filterCollection, deriveFacetOptions,
  matchesExpression, saveFilterPreset, loadFilterPresets, removeFilterPreset,
} from '../app/engine/filters.js';

const items = [
  { id: 'espada', nome: 'Espada Longa', categoria: 'Arma', tipo: ['Corpo a corpo'], maos: 'Uma mão', tags: ['leve', 'corte'], preco: 300, peso: 3, disponivel: true, podeUsar: true },
  { id: 'machado', nome: 'Machado Pesado', categoria: 'Arma', tipo: ['Corpo a corpo'], maos: 'Duas mãos', tags: ['pesado', 'corte'], preco: 700, peso: 8, disponivel: true, podeUsar: false },
  { id: 'arco', nome: 'Arco Curto', categoria: 'Arma', tipo: ['À distância'], maos: 'Duas mãos', tags: ['leve', 'perfuração'], preco: 450, peso: 2, disponivel: false, podeUsar: true },
  { id: 'couro', nome: 'Armadura de Couro', categoria: 'Armadura', tipo: ['Proteção'], maos: null, tags: ['leve'], preco: 500, peso: 10, disponivel: true, podeUsar: true },
];
const schema = [
  { key: 'categoria', type: 'multi' },
  { key: 'tipo', type: 'multi' },
  { key: 'maos', type: 'multi' },
  { key: 'tags', type: 'multi' },
  { key: 'preco', type: 'range' },
  { key: 'peso', type: 'range' },
  { key: 'podeUsar', type: 'relation' },
];
const opts = { searchFields: ['nome', 'categoria', 'tags'] };
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}\n  ${error.message}`); process.exitCode = 1; }
}
const state = () => emptyFilterState(schema);

test('filtro único', () => {
  const s = state(); s.groups.categoria.include = ['Arma'];
  assert.equal(filterCollection(items, s, schema, opts).length, 3);
});

test('OR dentro da categoria', () => {
  const s = state(); s.groups.categoria.include = ['Arma', 'Armadura'];
  assert.equal(filterCollection(items, s, schema, opts).length, 4);
});

test('(A OR B) AND C', () => {
  const s = state();
  s.groups.tipo.include = ['Corpo a corpo', 'À distância'];
  s.groups.maos.include = ['Uma mão'];
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['espada']);
});

test('NOT exclui opção', () => {
  const s = state(); s.groups.categoria.include = ['Arma']; s.groups.maos.exclude = ['Duas mãos'];
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['espada']);
});

test('intervalo numérico mínimo e máximo', () => {
  const s = state(); s.groups.preco.min = 400; s.groups.preco.max = 600;
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['arco', 'couro']);
});

test('intervalo ativo não trata valor ausente como zero', () => {
  const data = [...items, { id: 'sem-preco', nome: 'Sem preço', preco: null }];
  const s = state(); s.groups.preco.min = 0;
  assert.equal(filterCollection(data, s, schema, opts).some(item => item.id === 'sem-preco'), false);
});

test('pesquisa textual ignora acentos e combina palavras', () => {
  const s = state(); s.text = 'armadura couro';
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['couro']);
});

test('tags multiselect usam OR', () => {
  const s = state(); s.groups.tags.include = ['pesado', 'perfuração'];
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['machado', 'arco']);
});

test('filtro contextual pode usar', () => {
  const s = state(); s.groups.podeUsar = true;
  assert.deepEqual(filterCollection(items, s, schema, opts).map(x => x.id), ['espada', 'arco', 'couro']);
});

test('filtros vazios retornam todos', () => assert.equal(filterCollection(items, state(), schema, opts).length, 4));

test('nenhuma correspondência', () => {
  const s = state(); s.text = 'inexistente';
  assert.equal(filterCollection(items, s, schema, opts).length, 0);
});

test('expressão composta avançada', () => {
  const expression = {
    operator: 'and', children: [
      { operator: 'or', children: [{ field: 'id', operator: 'eq', value: 'espada' }, { field: 'id', operator: 'eq', value: 'machado' }] },
      { field: 'preco', operator: 'lte', value: 500 },
    ],
  };
  assert.deepEqual(items.filter(x => matchesExpression(x, expression)).map(x => x.id), ['espada']);
});

test('expressão NOT', () => assert.equal(matchesExpression(items[0], { operator: 'not', children: [{ field: 'categoria', operator: 'eq', value: 'Magia' }] }), true));

test('facetas dinâmicas e contagem', () => {
  const values = deriveFacetOptions(items, schema[0]);
  assert.deepEqual(values.map(x => [x.value, x.count]), [['Arma', 3], ['Armadura', 1]]);
});

test('memoização devolve a mesma referência', () => {
  const engine = new FilterEngine(items, schema, opts); const s = state();
  assert.equal(engine.filter(s), engine.filter(s));
});

test('muitos resultados', () => {
  const many = Array.from({ length: 5000 }, (_, i) => ({ nome: `Item ${i}`, categoria: i % 2 ? 'A' : 'B' }));
  const result = filterCollection(many, { text: 'item', groups: { categoria: { include: ['A'], exclude: [] } } }, [{ key: 'categoria', type: 'multi' }], { searchFields: ['nome'] });
  assert.equal(result.length, 2500);
});

test('salvar, restaurar e remover preset', () => {
  const memory = new Map();
  const fakeStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const s = state(); s.groups.categoria.include = ['Arma'];
  saveFilterPreset(fakeStorage, 'teste', 'Minhas armas', s);
  assert.deepEqual(loadFilterPresets(fakeStorage, 'teste')[0].state.groups.categoria.include, ['Arma']);
  removeFilterPreset(fakeStorage, 'teste', 'Minhas armas');
  assert.equal(loadFilterPresets(fakeStorage, 'teste').length, 0);
});

if (!process.exitCode) console.log(`\nFilterEngine OK — ${passed} testes passaram.`);
