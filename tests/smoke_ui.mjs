/* Smoke test da UI: renderiza todas as 11 páginas com um DOM falso mínimo.
 * Valida que nenhum módulo quebra ao montar e que os helpers casam com o engine.
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
  ['equipamentos', '../app/ui/pages/equipamentos.js'],
  ['combate', '../app/ui/pages/combate.js'],
  ['magias', '../app/ui/pages/magias.js'],
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
console.log(falhas ? `\nFALHAS: ${falhas}` : '\nUI OK — todas as páginas renderizam.');
process.exit(falhas ? 1 : 0);
