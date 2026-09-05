/* Smoke test da UI: renderiza todas as páginas da ficha e TODOS os capítulos do livro
 * com um DOM falso mínimo. Valida que nenhum módulo quebra ao montar e que os helpers
 * casam com o engine (incluindo os capítulos G.A.U. d20: testes, proezas, combate,
 * arsenal, poderes, magia, criação).
 * Uso: node tests/smoke_ui.mjs
 */
/* ---------- DOM falso ---------- */
class FakeNode {
  constructor(tag) { this.tagName = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.dataset = {}; this.style = {}; this.className = ''; this.listeners = {}; this._innerHTML = ''; this.checked = false; this.value = ''; this.textContent = ''; }
  append(...cs) { for (const c of cs.flat(Infinity)) { if (c === null || c === undefined || c === false) continue; this.children.push(c); } }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener() {}
  querySelector() { return new FakeNode('input'); }
  querySelectorAll() { return []; }
  remove() {}
  prepend(...cs) { this.children.unshift(...cs.flat(Infinity)); }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; this.children = []; }
  toggleAttribute() {}
  count() { let n = 1; for (const c of this.children) n += c.nodeType ? c.count ? c.count() : 1 : 0; return n; }
}
globalThis.document = {
  createElement: t => new FakeNode(t),
  createTextNode: t => ({ nodeType: 3, text: String(t) }),
  getElementById: () => new FakeNode('div'),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: new FakeNode('body'),
};
globalThis.window = undefined;
const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};
globalThis.location = { hash: '' };

/* ---------- execução ---------- */
const DB = (await import('../app/engine/db.js')).default;
await DB.load();

const store = (await import('../app/ui/store.js')).store;
store.criar('Teste', 100);
store.update(p => {
  p.atributos = { ST: 11, DX: 12, IQ: 13, HT: 12 };
  p.pericias.push({ id: 'espadas-curtas', pontos: 2 }, { id: 'escudo', pontos: 1 });
  p.vantagens.push({ id: 'riqueza', nivel: 'Rico' });
  p.magias.push({ id: 'acalmar-animais', pontos: 1 });
  p.inventario.push({ id: 'cota-de-malha', nome: 'Cota de malha', categoria: 'armadura', dp: 2, rd: 4, custo: 550, peso: 25, qtd: 1, equipado: true });
  p.inventario.push({ id: 'arma-espada', nome: 'Espada curta', categoria: 'arma', dano: 'Bal+1', tipoDano: 'corte', stMin: 8, custo: 400, peso: 1.5, periciaId: 'espadas-curtas', qtd: 1, equipado: true });
  p.riqueza = { nivel: 'Rico', multiplicador: 5, recursosBase: 1000, dinheiro: 5000 };
});

const paginas = [
  ['personagem', '../app/ui/pages/personagem.js'],
  ['atributos', '../app/ui/pages/atributos.js'],
  ['pericias', '../app/ui/pages/pericias.js'],
  ['vantagens', '../app/ui/pages/vantagens.js'],
  ['poderes', '../app/ui/pages/poderes.js'],
  ['magias', '../app/ui/pages/magias.js'],
  ['proezas', '../app/ui/pages/proezas.js'],
  ['equipamentos', '../app/ui/pages/equipamentos.js'],
  ['combate', '../app/ui/pages/combate.js'],
  ['livro', '../app/ui/pages/livro.js'],
  ['dados', '../app/ui/pages/dados.js'],
  ['historico', '../app/ui/pages/historico.js'],
  ['config', '../app/ui/pages/config.js'],
];

let falhas = 0;
for (const [nome, caminho] of paginas) {
  const mod = await import(caminho);
  const render = Object.values(mod)[0];
  const main = new FakeNode('main');
  try {
    render(main, { db: DB, params: nome === 'livro' ? ['magia'] : [], ir() {} });
    const n = main.count();
    console.log(`✓ ${nome.padEnd(14)} renderizou (${n} nós)`);
  } catch (e) {
    falhas++;
    console.error(`✗ ${nome}: ${e.message}\n  ${e.stack.split('\n').slice(1, 4).join('\n  ')}`);
  }
}

/* Combate nos dois modos (G.A.U. d20 e legado 3d) */
const combate = (await import('../app/ui/pages/combate.js'));
for (const modo of ['gau', 'legado']) {
  store.update(p => { p.config.modoCombate = modo; });
  const main = new FakeNode('main');
  try {
    combate.renderCombate(main, { db: DB, params: [], ir() {} });
    console.log(`✓ combate/${modo.padEnd(9)} renderizou (${main.count()} nós)`);
  } catch (e) {
    falhas++;
    console.error(`✗ combate/${modo}: ${e.message}\n  ${e.stack.split('\n').slice(1, 4).join('\n  ')}`);
  }
}

/* Todos os capítulos do livro, no modo leitura e no modo resumo/pesquisa */
const livro = await import('../app/ui/pages/livro.js');
for (const capitulo of DB.book?.capitulos || []) {
  for (const rota of [['ler', capitulo.id], [], ['resumo'], ['buscar', 'd20']]) {
    const main = new FakeNode('main');
    try {
      livro.renderLivro(main, { db: DB, params: rota, ir() {} });
      if (main.count() < 5) throw new Error(`capítulo "${capitulo.id}" renderizou vazio (rota /${rota.join('/')})`);
    } catch (e) {
      falhas++;
      console.error(`✗ livro/${rota.join('/') || 'capa'}: ${e.message}`);
    }
  }
}
console.log(`✓ livro             ${(DB.book?.capitulos || []).length} capítulos × 4 rotas`);

/* Interações da aba DADOS: dispara os handlers de clique/change/input dos painéis
 * G.A.U. (d20, disputa, pânico) e do legado (3d) para garantir que rolar não quebra. */
const coletarHandlers = (no, lista) => {
  if (!no || typeof no !== 'object') return lista;
  for (const [tipo, fns] of Object.entries(no.listeners || {})) for (const fn of fns) lista.push([tipo, fn, no]);
  for (const filho of no.children || []) coletarHandlers(filho, lista);
  return lista;
};
{
  const dados = await import('../app/ui/pages/dados.js');
  const main = new FakeNode('main');
  dados.renderDados(main, { db: DB, params: [], ir() {} });
  const handlers = coletarHandlers(main, []);
  let disparados = 0;
  for (const [tipo, fn, no] of handlers) {
    try {
      fn({ type: tipo, target: no, preventDefault() {}, stopPropagation() {} });
      disparados++;
    } catch (e) {
      falhas++;
      console.error(`✗ dados/${tipo}: ${e.message}`);
    }
  }
  if (!disparados) { falhas++; console.error('✗ dados: nenhum handler encontrado (página sem interações?)'); }
  else console.log(`✓ dados            ${disparados} interações disparadas (d20, disputa, pânico, 3d, rolagem livre)`);
}

/* Integridade do índice de busca: cada resultado precisa apontar para uma seção real
 * do capítulo ou para uma âncora (.book-anchor) que o capítulo de fato renderiza. */
const { buildBookIndex } = await import('../app/engine/book-index.js');
const coletarIds = (no, set) => {
  if (!no || typeof no !== 'object') return set;
  if (no.attrs?.id) set.add(no.attrs.id);
  for (const filho of no.children || []) coletarIds(filho, set);
  return set;
};
const ancorasPorCapitulo = {};
for (const capitulo of DB.book?.capitulos || []) {
  const main = new FakeNode('main');
  livro.renderLivro(main, { db: DB, params: ['ler', capitulo.id], ir() {} });
  ancorasPorCapitulo[capitulo.id] = coletarIds(main, new Set());
}
const secoesPorCapitulo = Object.fromEntries((DB.book?.capitulos || []).map(c => [c.id, new Set((c.secoes || []).map(s => s.id))]));
const docs = buildBookIndex(DB);
const rotasQuebradas = docs.filter(doc => {
  const secoes = secoesPorCapitulo[doc.chapterId];
  if (!secoes) return true;
  if (!doc.sectionId) return false;
  return !secoes.has(doc.sectionId) && !ancorasPorCapitulo[doc.chapterId]?.has(doc.sectionId);
});
if (rotasQuebradas.length) {
  falhas += rotasQuebradas.length;
  console.error(`✗ índice: ${rotasQuebradas.length} rotas quebradas —`, [...new Set(rotasQuebradas.map(d => d.route))].slice(0, 8).join(', '));
} else {
  console.log(`✓ índice            ${docs.length} documentos pesquisáveis, todas as rotas válidas`);
}
const semTexto = docs.filter(doc => !doc.title || !doc.excerpt);
if (semTexto.length) { falhas += semTexto.length; console.error(`✗ índice: ${semTexto.length} documentos sem título/resumo`); }

console.log(falhas ? `\nFALHAS: ${falhas}` : '\nUI OK — todas as páginas e capítulos renderizam.');
process.exit(falhas ? 1 : 0);
