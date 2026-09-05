/* Smoke test de boot com dados faltando: simula o navegador quando um ou mais data/*.json
 * não carregam (servidor fora do ar, file://, proxy com erro). O app NÃO pode quebrar dentro
 * de uma fórmula: deve avisar quais arquivos falharam e renderizar com "—".
 * Uso: node tests/smoke_dados_faltando.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const FALTANDO = ['tables', 'skills'];        // estes "não carregam"

/* ---------- DOM falso mínimo (mesmo formato do smoke_ui.mjs) ---------- */
class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.dataset = {};
    this.style = {}; this.className = ''; this.listeners = {}; this._innerHTML = ''; this.checked = false;
    this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false;
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  append(...cs) { for (const c of cs.flat(Infinity)) { if (c === null || c === undefined || c === false) continue; this.children.push(c); } }
  prepend(...cs) { this.children.unshift(...cs.flat(Infinity)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  toggleAttribute() {}
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener() {}
  querySelector() { return new FakeNode('input'); }
  querySelectorAll() { return []; }
  remove() {}
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; this.children = []; }
  count() { let n = 1; for (const c of this.children) n += c.nodeType ? (c.count ? c.count() : 1) : 0; return n; }
  text() {
    let out = this.textContent || '';
    for (const c of this.children) out += c.nodeType === 3 ? (c.text || '') : (c.text ? c.text() : '');
    return out;
  }
}
const nosPorId = new Map();
globalThis.document = {
  createElement: t => new FakeNode(t),
  createTextNode: t => ({ nodeType: 3, text: String(t) }),
  getElementById: id => { if (!nosPorId.has(id)) nosPorId.set(id, new FakeNode('div')); return nosPorId.get(id); },
  querySelector: () => null,               // sem header.topbar → o aviso cai no #main
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: new FakeNode('body'),
  title: '',
};
globalThis.window = {
  addEventListener() {}, scrollTo() {}, scrollY: 0,
  fetch: async url => {
    const nome = String(url).split('/').pop().replace('.json', '');
    if (FALTANDO.includes(nome)) return { ok: false, status: 503, text: async () => '' };
    return { ok: true, status: 200, text: async () => readFileSync(path.join(RAIZ, 'data', `${nome}.json`), 'utf-8') };
  },
};
globalThis.location = { hash: '#/personagem', reload() {} };
globalThis.requestAnimationFrame = fn => fn();
const mem = {};
globalThis.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};
/* uma ficha salva no modelo antigo, para exercitar a migração com banco incompleto */
mem['gua.characters.v1'] = JSON.stringify([{
  versao: 3, id: 'pc-antigo', nome: 'Veterana', criadoEm: new Date().toISOString(),
  atributos: { ST: 10, DX: 12, IQ: 11, HT: 10 }, pontos: { total: 100, extrasGanhos: 0 },
  vantagens: [{ id: 'sorte', nome: 'Sorte' }], desvantagens: [], peculiaridades: [],
  pericias: [{ id: 'espadas-curtas', pontos: 4 }], magias: [], magicas: [], inventario: [],
  poderes: [], linguas: { escritas: [], faladas: [] }, combate: {}, config: { emCriacao: true },
  historico: [],
}]);
mem['gua.current.v1'] = 'pc-antigo';

process.on('unhandledRejection', e => { console.error('REJEICAO NAO TRATADA:', e?.message, '\n', (e?.stack || '').split('\n').slice(1, 5).join('\n')); });
let falhas = 0;
const esperar = ms => new Promise(r => setTimeout(r, ms));

const DB = (await import('../app/engine/db.js')).default;
await import('../app/main.js');          // dispara o bootstrap (DB.load → store.inicializar → route)
/* o boot inclui novas tentativas de fetch (120 ms × falha) — espera o #main ser renderizado */
const main = document.getElementById('main');
for (let i = 0; i < 60 && (!DB.carregado || main.count() < 2); i++) await esperar(100);
await esperar(50);

const texto = `${document.body.text()} ${main.text()}`;

/* 1. o banco registrou exatamente os arquivos que falharam */
const erros = Object.keys(DB.erros).sort();
if (erros.join(',') !== [...FALTANDO].sort().join(',')) {
  falhas++; console.error(`✗ DB.erros: esperava [${FALTANDO.sort()}], veio [${erros}]`);
} else console.log(`✓ DB.erros          ${erros.map(a => `data/${a}.json`).join(' e ')} marcados como falha`);

/* 2. a página avisou quais arquivos não carregaram, em vez de estourar numa fórmula */
if (!/Banco de regras incompleto/.test(texto)) { falhas++; console.error('✗ aviso de banco incompleto não apareceu'); }
else console.log('✓ aviso             banner "Banco de regras incompleto" renderizado');
if (/Erro ao renderizar/.test(texto)) { falhas++; console.error(`✗ página quebrou: ${texto.slice(0, 140)}`); }
else if (main.count() < 10) { falhas++; console.error(`✗ página: #/personagem renderizou só ${main.count()} nós`); }
else console.log(`✓ página            #/personagem renderizou sem erro (${main.count()} nós)`);

/* 3. a ficha antiga sobreviveu: nada de dados perdidos na migração com banco incompleto */
const store = (await import('../app/ui/store.js')).store;
const ficha = store.personagens.find(p => p.id === 'pc-antigo');
if (!ficha) { falhas++; console.error('✗ store: a ficha salva desapareceu'); }
else if (!ficha.pericias.some(p => p.id === 'espadas-curtas' && p.pontos === 4)) {
  falhas++; console.error(`✗ store: perícias da ficha antiga alteradas — ${JSON.stringify(ficha.pericias)}`);
} else console.log('✓ migração          ficha antiga preservada (perícias intactas, conversão adiada)');

/* 4. recarregar() só busca o que faltou e continua tolerante */
let pedidos = 0;
const fetchConta = window.fetch;
window.fetch = async url => { pedidos++; return fetchConta(url); };
await DB.recarregar();
if (!pedidos) { falhas++; console.error('✗ recarregar(): nenhum arquivo foi rebuscado'); }
else console.log(`✓ recarregar()      ${pedidos} arquivos rebuscados (falhas continuam registradas: ${Object.keys(DB.erros).length})`);

console.log(falhas ? `\nFALHAS: ${falhas}` : '\nBoot tolerante OK — dados faltando viram aviso, não exceção.');
process.exit(falhas ? 1 : 0);
