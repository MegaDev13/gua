/* Smoke test da UI: renderiza todas as páginas da ficha e TODOS os capítulos do livro
 * com um DOM falso mínimo. Valida que nenhum módulo quebra ao montar e que os helpers
 * casam com o engine (incluindo os capítulos G.A.U. d20: testes, proezas, combate,
 * arsenal, poderes, magia, criação).
 * Uso: node tests/smoke_ui.mjs
 */
/* ---------- DOM falso ---------- */
class FakeNode {
  constructor(tag) { this.tagName = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.dataset = {}; this.style = {}; this.className = ''; this.listeners = {}; this._innerHTML = ''; this.checked = false; this.value = ''; this.textContent = ''; this.disabled = false;
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }; }
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
  /* nós estáveis: o bootstrap (app/main.js) escreve e depois lê o mesmo #main */
  getElementById: id => { if (!nosPorId.has(id)) nosPorId.set(id, new FakeNode('div')); return nosPorId.get(id); },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: new FakeNode('body'),
  title: '',
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
const textoDasPaginas = new Map();
for (const [nome, caminho] of paginas) {
  const mod = await import(caminho);
  const render = Object.values(mod)[0];
  const main = new FakeNode('main');
  try {
    render(main, { db: DB, params: nome === 'livro' ? ['magia'] : [], ir() {} });
    const n = main.count();
    textoDasPaginas.set(nome, main.text());
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

/* ---------- Perícias no modelo G.A.U.: painel de compra, limite de criação e familiaridade */
store.update(p => {
  p.idade = 18;
  p.config.modeloPericias = 'gau';
  p.pericias = [{ id: 'espadas-curtas', nivel: 6 }, { id: 'conducao', nivel: 5, familiarizado: false }];
});
const paginaPericias = await import('../app/ui/pages/pericias.js');
const mainGau = new FakeNode('main');
paginaPericias.renderPericias(mainGau, { db: DB, params: [], ir() {} });
const textoGau = mainGau.text();
const esperadosPericias = ['Compra de perícias (G.A.U.)', 'Limite de criação', 'Familiaridade', 'Divergências da publicação', 'Espadas Curtas', 'Condução'];
const faltandoPericias = esperadosPericias.filter(trecho => !textoGau.includes(trecho));
if (faltandoPericias.length) { falhas += faltandoPericias.length; console.error(`✗ pericias/G.A.U.: conteúdo ausente — ${faltandoPericias.join(', ')}`); }
else console.log(`✓ pericias/G.A.U.   painel de compra, limite de criação e familiaridade (${mainGau.count()} nós)`);

/* ---------- Perícias: descrição inteira na linha + compra em lote ---------- */
const coletarNos = (no, pred, lista = []) => {
  if (!no || typeof no !== 'object') return lista;
  if (pred(no)) lista.push(no);
  for (const filho of no.children || []) coletarNos(filho, pred, lista);
  return lista;
};
const disparar = (no, tipo) => { for (const fn of no?.listeners?.[tipo] || []) fn({ type: tipo, target: no, currentTarget: no, preventDefault() {}, stopPropagation() {} }); };
{
  store.update(p => {
    p.pontos = { total: 150, extrasGanhos: 0 };
    p.pericias = [];
    p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 };
    p.vantagens = []; p.desvantagens = []; p.peculiaridades = []; p.poderes = []; p.magias = [];
    p.aparenciaNivel = 'comum'; p.statusSocial = 0;
    p.config.emCriacao = false; p.config.modeloPericias = 'gau'; p.config.permitirEstourarPontos = false;
  });
  const mainLote = new FakeNode('main');
  paginaPericias.renderPericias(mainLote, { db: DB, params: [], ir() {} });

  /* 1) o texto publicado aparece inteiro na linha (sem corte em 110 caracteres) */
  const descricoes = coletarNos(mainLote, no => String(no.className || '').includes('descricao-pericia'));
  const longa = DB.skills.find(skill => (skill.descricao || '').length > 110);
  const inteira = descricoes.some(no => no.text() === longa.descricao);
  if (!descricoes.length) { falhas++; console.error('✗ pericias/texto: nenhuma descrição renderizada'); }
  else if (!inteira) { falhas++; console.error(`✗ pericias/texto: a descrição de "${longa.nome}" (${longa.descricao.length} chars) não aparece inteira`); }
  else console.log(`✓ pericias/texto     descrição inteira na linha (${longa.descricao.length} chars em "${longa.nome}")`);

  /* 2) marcar 5 perícias faz aparecer a barra com custo e o botão de compra */
  const caixas = coletarNos(mainLote, no => no.attrs?.type === 'checkbox'
    && String(no.attrs['aria-label'] || '').startsWith('Marcar ') && !/todas/i.test(no.attrs['aria-label']));
  for (const caixa of caixas.slice(0, 5)) { caixa.checked = true; disparar(caixa, 'change'); }
  const barra = coletarNos(mainLote, no => String(no.className || '').includes('barra-lote'))[0];
  const botaoComprar = coletarNos(barra, no => no.tagName === 'button' && /^Comprar \d+$/.test(no.text()))[0];
  if (caixas.length < 5) { falhas++; console.error(`✗ pericias/lote: só ${caixas.length} caixas de seleção na tabela`); }
  else if (!barra || barra.hidden) { falhas++; console.error('✗ pericias/lote: a barra de compra em lote não apareceu'); }
  else if (!botaoComprar) { falhas++; console.error(`✗ pericias/lote: sem botão de compra (${barra.text().slice(0, 90)})`); }
  else if (!/pts/.test(barra.text()) || !/restam/.test(barra.text())) {
    falhas++; console.error(`✗ pericias/lote: a barra não mostra custo/restam (${barra.text().slice(0, 90)})`);
  } else {
    /* 3) confirmar no modal grava as 5 de uma vez */
    disparar(botaoComprar, 'click');
    const confirmar = coletarNos(document.getElementById('modal-root'), no => no.tagName === 'button' && /^Comprar \d+ \(/.test(no.text()))[0];
    if (!confirmar) { falhas++; console.error('✗ pericias/lote: a confirmação do lote não apareceu'); }
    else {
      disparar(confirmar, 'click');
      const pc = store.atual;
      const problemas = [];
      if (pc.pericias.length !== 5) problemas.push(`${pc.pericias.length} perícias na ficha, esperava 5`);
      if (!pc.pericias.every(entrada => entrada.nivel === 1)) problemas.push('nem todas entraram no nível 1');
      if (pc.pontos.total !== 150) problemas.push(`o total de pontos mudou (${pc.pontos.total})`);
      if (!barra.hidden) problemas.push('a barra continuou visível depois da compra');
      if (!pc.historico.some(h => /Compra em lote/.test(h.texto || ''))) problemas.push('o histórico não registrou o lote');
      if (problemas.length) { falhas++; console.error(`✗ pericias/lote: ${problemas.join('; ')}`); }
      else console.log(`✓ pericias/lote      5 perícias compradas de uma vez (${barra.text ? 'barra limpa' : ''} + histórico)`);
    }
  }
}

/* ---------- a pesquisa/filtro sobrevive à re-renderização (comprar não apaga nada) ---------- */
{
  const contador = no => coletarNos(no, n => String(n.className || '').includes('filter-count')).map(n => n.textContent).join(' ');
  const mainA = new FakeNode('main');
  paginaPericias.renderPericias(mainA, { db: DB, params: [], ir() {} });
  const pesquisaA = coletarNos(mainA, no => no.attrs?.type === 'search')[0];
  /* o painel liga a pesquisa por propriedade (oninput), não por addEventListener */
  pesquisaA.value = 'espada';
  if (typeof pesquisaA.oninput === 'function') pesquisaA.oninput({ target: pesquisaA, currentTarget: pesquisaA });
  for (const fn of pesquisaA.listeners.input || []) fn({ target: pesquisaA, currentTarget: pesquisaA });
  const resultadosA = contador(mainA);

  /* re-renderiza a aba inteira, como acontece depois de cada compra */
  const mainB = new FakeNode('main');
  paginaPericias.renderPericias(mainB, { db: DB, params: [], ir() {} });
  const pesquisaB = coletarNos(mainB, no => no.attrs?.type === 'search')[0];
  const problemas = [];
  if (pesquisaB?.value !== 'espada') problemas.push(`a pesquisa voltou como "${pesquisaB?.value}"`);
  if (contador(mainB) !== resultadosA) problemas.push(`a contagem mudou de "${resultadosA}" para "${contador(mainB)}"`);
  if (!/\d+ resultados?/.test(resultadosA) || resultadosA.startsWith(`${DB.skills.length} `)) problemas.push(`a pesquisa não filtrou (${resultadosA})`);
  if (problemas.length) { falhas++; console.error(`✗ pericias/filtro: ${problemas.join('; ')}`); }
  else console.log(`✓ pericias/filtro    pesquisa preservada após re-renderizar (${resultadosA})`);

  const resetar = coletarNos(mainB, no => no.tagName === 'button' && /Resetar filtros/.test(no.text()))[0];
  disparar(resetar, 'click');

  /* o modelo legado continua renderizando (texto inteiro, sem a coluna de lote) */
  store.update(p => { p.config.modeloPericias = 'legado'; });
  const mainLegado = new FakeNode('main');
  paginaPericias.renderPericias(mainLegado, { db: DB, params: [], ir() {} });
  store.update(p => { p.config.modeloPericias = 'gau'; });
  if (mainLegado.count() < 200) { falhas++; console.error(`✗ pericias/legado: só ${mainLegado.count()} nós`); }
  else if (coletarNos(mainLegado, no => String(no.className || '').includes('barra-lote')).length &&
           coletarNos(mainLegado, no => no.attrs?.type === 'checkbox' && /comprar em lote/i.test(String(no.attrs['aria-label'] || ''))).length) {
    falhas++; console.error('✗ pericias/legado: a compra em lote apareceu no modelo legado');
  } else console.log(`✓ pericias/legado    modelo 3d6 renderiza inteiro (${mainLegado.count()} nós, sem lote)`);
}

/* ---------- Capítulo Perícias do livro (seções G.A.U.) */
const mainLivroPericias = new FakeNode('main');
livro.renderLivro(mainLivroPericias, { db: DB, params: ['ler', 'pericias'], ir() {} });
const textoLivroPericias = mainLivroPericias.text();
const secoesEsperadas = ['COMPRANDO PERÍCIAS', 'Familiaridade', 'Os grupos de perícias', 'Línguas e comunicação', 'Divergências da publicação', 'Do modelo legado para o G.A.U.'];
const semSecao = secoesEsperadas.filter(trecho => !textoLivroPericias.includes(trecho));
if (semSecao.length) { falhas++; console.error(`✗ livro/pericias: seções ausentes — ${semSecao.join(', ')}`); }
else console.log(`✓ livro/pericias    ${secoesEsperadas.length} seções G.A.U. renderizadas`);

/* ---------- Capítulo Criação do livro: pontos de personagem + orçamento único */
const mainLivroCriacao = new FakeNode('main');
livro.renderLivro(mainLivroCriacao, { db: DB, params: ['ler', 'criacao'], ir() {} });
const textoLivroCriacao = mainLivroCriacao.text();
const secoesPontos = ['Pontos de personagem', 'FAIXAS DE CAMPANHA', 'Herói Padrão', '500 a 1.000+',
  'Orçamento único: os mesmos pontos para tudo', 'TRAVAMENTO DE GASTO', 'MODO SEPARADO', 'GRÁTIS'];
const semPontos = secoesPontos.filter(trecho => !textoLivroCriacao.includes(trecho));
if (semPontos.length) { falhas++; console.error(`✗ livro/criacao: pontos ausentes — ${semPontos.join(', ')}`); }
else console.log(`✓ livro/criacao     ${secoesPontos.length} trechos do sistema de pontos renderizados`);

/* ---------- orçamento único na UI (widget, painel de pontos, catálogo de peculiaridades) */
const esperadoNaUI = [
  ['personagem', ['Pontos de Personagem', 'Faixa de campanha', 'Divino · 1000', 'Extras ganhos', 'orçamento único', 'Aplicar']],
  ['config', ['orçamento único', 'Pontos livres', 'Divino', 'Permitir estourar o total', 'Unificado (poderes saem do mesmo total)', 'Extras ganhos']],
  ['vantagens', ['Catálogo de peculiaridades', 'Máximo de 5 peculiaridades', 'Listadas no material-base']],
];
for (const [pagina, trechos] of esperadoNaUI) {
  const texto = textoDasPaginas.get(pagina) || '';
  const ausentes = trechos.filter(trecho => !texto.includes(trecho));
  if (ausentes.length) { falhas++; console.error(`✗ ${pagina}: orçamento único ausente — ${ausentes.join(', ')}`); }
  else console.log(`✓ ${pagina.padEnd(14)} painel de pontos/peculiaridades com ${trechos.length} trechos esperados`);
}

/* ---------- bootstrap (app/main.js): DB.load → store.inicializar → nav → primeira rota */
globalThis.window = { addEventListener() {}, scrollTo() {}, scrollY: 0 };
globalThis.location = { hash: '#/pericias', reload() {} };
globalThis.requestAnimationFrame = fn => fn();
try {
  await import('../app/main.js');
  await new Promise(resolver => setTimeout(resolver, 60));
  const noMain = document.getElementById('main');
  const textoMain = noMain.text();
  if (/Erro ao renderizar/.test(textoMain)) throw new Error(textoMain.slice(0, 160));
  if (noMain.count() < 10) throw new Error(`a rota inicial renderizou apenas ${noMain.count()} nós`);
  if (Object.keys(DB.erros).length) throw new Error(`bancos com erro: ${JSON.stringify(DB.erros)}`);
  const widget = document.getElementById('pontosWidget');
  const textoWidget = widget.text();
  if (widget.hidden) throw new Error('widget de pontos ficou oculto numa rota de ficha');
  if (widget.count() < 8) throw new Error(`widget de pontos renderizou só ${widget.count()} nós`);
  for (const trecho of ['livres', 'gastos', 'Presets', 'Fraco', 'Divino', '+10', '+50']) {
    if (!textoWidget.includes(trecho)) throw new Error(`widget de pontos sem "${trecho}"`);
  }
  console.log(`✓ widget de pontos  ${widget.count()} nós · "${textoWidget.replace(/\s+/g, ' ').slice(0, 90)}…"`);
  console.log(`✓ bootstrap        main.js: DB.load + store.inicializar + rota #/pericias (${noMain.count()} nós)`);
} catch (e) {
  falhas++;
  console.error(`✗ bootstrap: ${e.message}`);
}

console.log(falhas ? `\nFALHAS: ${falhas}` : '\nUI OK — todas as páginas e capítulos renderizam.');
process.exit(falhas ? 1 : 0);
