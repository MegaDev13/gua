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

/* ---------- COMPRAS FUNCIONAM: cliques reais em cada aba que gasta pontos
 * Uma compra só falha de verdade quando o handler roda — um import esquecido, por exemplo,
 * renderiza a página inteira sem erro e só quebra no clique. Por isso estes testes clicam. */
{
  const problemas = [];
  const botaoPorTexto = (raiz, texto) => coletarNos(raiz, n => n.tagName === 'button' && n.text().trim() === texto)[0];
  const secao = (raiz, inicio) => coletarNos(raiz, n => n.tagName === 'section' && n.text().trim().startsWith(inicio))[0];

  store.criar('Compras', 400);
  store.update(p => {
    p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 };
    p.vantagens = []; p.desvantagens = []; p.peculiaridades = []; p.pericias = []; p.magias = []; p.poderes = [];
    p.aparenciaNivel = 'comum'; p.statusSocial = 0;
    p.config.emCriacao = false; p.config.modeloPericias = 'gau'; p.config.permitirEstourarPontos = false;
  });

  /* ---- vantagens: adquirir, subir nível, remover; desvantagem devolve pontos */
  const van = await import('../app/ui/pages/vantagens.js');
  const desenharVantagens = () => { const no = new FakeNode('main'); van.renderVantagens(no, { db: DB, params: [], ir() {} }); return no; };
  let pagina = desenharVantagens();
  const adquirir = botaoPorTexto(pagina, 'Adquirir');
  try { disparar(adquirir, 'click'); } catch (e) { problemas.push(`vantagens/adquirir lançou "${e.message}"`); }
  if (!store.atual.vantagens.length) problemas.push('vantagens: "Adquirir" não comprou nada');
  const gastoComVantagem = store.atual.vantagens.length ? 400 - store.atual.pontos.total : null;

  /* subir nível (botão "nível N +") e remover */
  pagina = desenharVantagens();
  const subir = coletarNos(pagina, n => n.tagName === 'button' && /^nível \d+ \+$/.test(n.text().trim()))[0]
    || coletarNos(pagina, n => n.tagName === 'button' && n.text().trim() === '▶')[0];
  if (subir) {
    const antes = JSON.stringify(store.atual.vantagens);
    try { disparar(subir, 'click'); } catch (e) { problemas.push(`vantagens/nível lançou "${e.message}"`); }
    if (JSON.stringify(store.atual.vantagens) === antes) problemas.push('vantagens: o botão de nível não alterou a ficha');
  } else problemas.push('vantagens: nenhum botão de nível apareceu para uma vantagem escalonável');

  pagina = desenharVantagens();
  const remover = botaoPorTexto(pagina, 'Remover');
  const quantidadeAntes = store.atual.vantagens.length;
  try { disparar(remover, 'click'); } catch (e) { problemas.push(`vantagens/remover lançou "${e.message}"`); }
  if (store.atual.vantagens.length !== quantidadeAntes - 1) problemas.push('vantagens: "Remover" não devolveu a vantagem');

  /* desvantagem: adicionar devolve pontos ao mesmo orçamento */
  pagina = desenharVantagens();
  const colunaDesvantagens = secao(pagina, 'Desvantagens');
  const adquirirDesvantagem = colunaDesvantagens ? botaoPorTexto(colunaDesvantagens, 'Adquirir') : null;
  if (!adquirirDesvantagem) problemas.push('vantagens: a coluna de desvantagens não ofereceu "Adquirir"');
  else {
    const livresAntes = (await import('../app/engine/points.js')).orcamentoDePontos(DB, store.atual).disponiveis;
    try { disparar(adquirirDesvantagem, 'click'); } catch (e) { problemas.push(`desvantagens/adquirir lançou "${e.message}"`); }
    const orcamento = (await import('../app/engine/points.js')).orcamentoDePontos(DB, store.atual);
    if (!store.atual.desvantagens.length) problemas.push('desvantagens: "Adquirir" não adicionou nada');
    else if (orcamento.disponiveis <= livresAntes) problemas.push(`desvantagens: não devolveu pontos (${livresAntes} → ${orcamento.disponiveis})`);
  }

  /* peculiaridade pelo catálogo */
  pagina = desenharVantagens();
  const peculiaridade = DB.peculiaridades.peculiaridades[0];
  const botaoPeculiaridade = coletarNos(pagina, n => n.tagName === 'button' && n.text().trim() === peculiaridade.nome)[0];
  if (!botaoPeculiaridade) problemas.push(`peculiaridades: "${peculiaridade.nome}" não apareceu no catálogo`);
  else {
    try { disparar(botaoPeculiaridade, 'click'); } catch (e) { problemas.push(`peculiaridades/catálogo lançou "${e.message}"`); }
    if (!store.atual.peculiaridades.includes(peculiaridade.nome)) problemas.push('peculiaridades: o clique no catálogo não gravou nada');
  }

  /* detalhe da vantagem (👁) e peculiaridades: texto livre + remoção */
  pagina = desenharVantagens();
  try {
    disparar(coletarNos(pagina, n => n.tagName === 'button' && n.text().trim() === '👁')[0], 'click');
    if (!document.getElementById('modal-root').children.length) problemas.push('vantagens: o 👁 não abriu o detalhe');
    document.getElementById('modal-root').innerHTML = '';
  } catch (e) { problemas.push(`vantagens/detalhe lançou "${e.message}"`); }

  pagina = desenharVantagens();
  const campoLivre = coletarNos(pagina, n => n.tagName === 'input' && /Detesta dizer/.test(String(n.attrs?.placeholder || '')))[0];
  if (!campoLivre) problemas.push('peculiaridades: o campo de texto livre não apareceu');
  else {
    const quantidade = store.atual.peculiaridades.length;
    campoLivre.value = 'Mania de conferir o mapa duas vezes';
    try {
      disparar(campoLivre, 'keydown');
      disparar(botaoPorTexto(pagina, '＋ Adicionar'), 'click');
    } catch (e) { problemas.push(`peculiaridades/texto livre lançou "${e.message}"`); }
    if (store.atual.peculiaridades.length !== quantidade + 1) problemas.push('peculiaridades: o texto livre não foi gravado');
    pagina = desenharVantagens();
    try { disparar(coletarNos(pagina, n => n.tagName === 'button' && n.text().trim() === '✕')[0], 'click'); }
    catch (e) { problemas.push(`peculiaridades/remover lançou "${e.message}"`); }
    if (store.atual.peculiaridades.length !== quantidade) problemas.push('peculiaridades: o ✕ não removeu');
  }

  /* ---- atributos: comprar e ser bloqueado quando não cabe */
  const atr = await import('../app/ui/pages/atributos.js');
  const desenharAtributos = () => { const no = new FakeNode('main'); atr.renderAtributos(no, { db: DB, params: [], ir() {} }); return no; };
  const campoST = coletarNos(desenharAtributos(), n => n.attrs?.['aria-label'] === 'Valor de Força')[0];
  if (!campoST) problemas.push('atributos: o campo de ST não apareceu');
  else {
    campoST.value = '12';
    try { disparar(campoST, 'change'); } catch (e) { problemas.push(`atributos/ST lançou "${e.message}"`); }
    if (store.atual.atributos.ST !== 12) problemas.push(`atributos: ST ficou ${store.atual.atributos.ST}, esperava 12`);
  }

  /* personagem sem pontos: a compra é barrada e o campo volta ao valor anterior */
  store.criar('Sem pontos', 25);
  store.update(p => { p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 }; p.config.permitirEstourarPontos = false; });
  const campoApertado = coletarNos(desenharAtributos(), n => n.attrs?.['aria-label'] === 'Valor de Força')[0];
  campoApertado.value = '18';
  try { disparar(campoApertado, 'change'); } catch (e) { problemas.push(`atributos/bloqueio lançou "${e.message}"`); }
  if (store.atual.atributos.ST !== 10) problemas.push(`atributos: o bloqueio não impediu a compra (ST ${store.atual.atributos.ST})`);
  if (String(campoApertado.value) !== '10') problemas.push(`atributos: o campo não voltou ao valor anterior (ficou "${campoApertado.value}")`);

  /* ---- magias: investir +1 ponto */
  store.criar('Mago', 400);
  const spell = DB.spells[0];
  store.update(p => { p.atributos = { ST: 10, DX: 10, IQ: 14, HT: 10 }; p.magias = [{ id: spell.id, pontos: 1 }]; });
  const mag = await import('../app/ui/pages/magias.js');
  const paginaMagias = new FakeNode('main');
  mag.renderMagias(paginaMagias, { db: DB, params: [], ir() {} });
  const investir = coletarNos(paginaMagias, n => n.tagName === 'button' && n.text().trim() === '+1 pt')[0];
  if (!investir) problemas.push('magias: o botão "+1 pt" não apareceu');
  else {
    try { disparar(investir, 'click'); } catch (e) { problemas.push(`magias/+1pt lançou "${e.message}"`); }
    if (store.atual.magias.find(m => m.id === spell.id)?.pontos !== 2) problemas.push('magias: "+1 pt" não investiu o ponto');
  }

  /* ---- perícias: o +1 da linha (o lote já tem teste próprio) */
  store.criar('Perito', 400);
  store.update(p => { p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 }; p.pericias = []; p.config.emCriacao = false; });
  const paginaPericias2 = new FakeNode('main');
  paginaPericias.renderPericias(paginaPericias2, { db: DB, params: [], ir() {} });
  const maisUm = coletarNos(paginaPericias2, n => n.tagName === 'button' && n.text().trim() === '＋')[0];
  if (!maisUm) problemas.push('pericias: o botão "＋" da linha não apareceu');
  else {
    try { disparar(maisUm, 'click'); } catch (e) { problemas.push(`pericias/＋ lançou "${e.message}"`); }
    if (store.atual.pericias.length !== 1) problemas.push(`pericias: "＋" não comprou a perícia (${store.atual.pericias.length} na ficha)`);
  }

  /* ---- poderes: editar e salvar passa pelo travamento do orçamento único */
  const { novoPoder } = await import('../app/engine/powers.js');
  store.criar('Herói', 400);
  const poder = novoPoder('Lança de Fogo');
  poder.efeito = { grupo: 'manipulacao', id: 'criar' };
  poder.extensao = { alcance: '10m', area: null, alvos: '1-alvo', duracao: '1-segundo' };
  poder.potencia = { intensidade: 'forte', dano: 'dano-alto', forca: [], velocidade: [] };
  poder.condicoes = ['requer-contato'];
  poder.pv = 'pv-10';
  poder.rd = 'rd-2';
  store.update(p => { p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 }; p.poderes = [poder]; });
  const pod = await import('../app/ui/pages/poderes.js');
  const mainPoderes = document.getElementById('main');   // rerender() procura este nó
  mainPoderes.innerHTML = '';
  pod.renderPoderes(mainPoderes, { db: DB, params: [], ir() {} });
  const editar = botaoPorTexto(mainPoderes, 'Editar');
  try {
    disparar(editar, 'click');
    const salvar = botaoPorTexto(document.getElementById('main'), 'Salvar poder');
    if (!salvar) problemas.push('poderes: o editor não ofereceu "Salvar poder"');
    else {
      disparar(salvar, 'click');
      if ((store.atual.poderes || []).length !== 1) problemas.push(`poderes: salvar perdeu o poder (${(store.atual.poderes || []).length})`);
      else if (!store.atual.historico.some(h => /orçamento único/.test(h.texto || ''))) problemas.push('poderes: o histórico não registrou o orçamento único');
    }
  } catch (e) { problemas.push(`poderes/editar+salvar lançou "${e.message}"`); }

  /* ---- pontos: presets e ±10/±50 nas abas Personagem e Configurações */
  store.criar('Ajustável', 100);
  store.update(p => { p.atributos = { ST: 10, DX: 10, IQ: 10, HT: 10 }; p.vantagens = []; p.desvantagens = []; p.pericias = []; p.magias = []; p.poderes = []; });
  for (const [rotulo, caminho, render, chip] of [
    ['personagem', '../app/ui/pages/personagem.js', 'renderPersonagem', 'Divino · 1000'],
    ['config', '../app/ui/pages/config.js', 'renderConfig', 'Divino — 1000'],
  ]) {
    const modulo = await import(caminho);
    const no = new FakeNode('main');
    store.update(p => { p.pontos.total = 100; });   // mesmo ponto de partida nas duas abas
    try { modulo[render](no, { db: DB, params: [], ir() {} }); } catch (e) { problemas.push(`${rotulo}: render lançou "${e.message}"`); continue; }
    const preset = coletarNos(no, n => n.tagName === 'button' && n.text().trim() === chip)[0];
    if (!preset) { problemas.push(`${rotulo}: o preset "${chip}" não apareceu`); continue; }
    try { disparar(preset, 'click'); } catch (e) { problemas.push(`${rotulo}/preset lançou "${e.message}"`); }
    if (store.atual.pontos.total !== 1000) problemas.push(`${rotulo}: o preset não definiu o total (ficou ${store.atual.pontos.total})`);
    const menos = coletarNos(no, n => n.tagName === 'button' && n.text().trim() === '−50')[0];
    try { disparar(menos, 'click'); } catch (e) { problemas.push(`${rotulo}/−50 lançou "${e.message}"`); }
    if (store.atual.pontos.total !== 950) problemas.push(`${rotulo}: o −50 não ajustou o total (ficou ${store.atual.pontos.total})`);
  }
  /* modo do orçamento separado (select) na aba Configurações */
  {
    const modulo = await import('../app/ui/pages/config.js');
    const no = new FakeNode('main');
    modulo.renderConfig(no, { db: DB, params: [], ir() {} });
    const selecaoOrcamento = coletarNos(no, n => n.tagName === 'select' && /Como os pontos são distribuídos/.test(String(n.attrs?.title || '')))[0];
    if (!selecaoOrcamento) problemas.push('config: o seletor do modo de orçamento não apareceu');
    else {
      selecaoOrcamento.value = 'separado';
      try { disparar(selecaoOrcamento, 'change'); } catch (e) { problemas.push(`config/orçamento lançou "${e.message}"`); }
      if (store.atual.config.orcamentoPontos !== 'separado') problemas.push('config: o modo separado não foi gravado');
      store.update(p => { p.config.orcamentoPontos = 'unificado'; });
    }
  }

  if (problemas.length) { falhas += problemas.length; for (const problema of problemas) console.error(`✗ compras: ${problema}`); }
  else console.log('✓ compras           cliques reais: vantagem (adquirir/nível/remover), desvantagem devolve pontos, peculiaridade, atributo (compra e bloqueio), magia +1, perícia ＋, poder editar+salvar');
}

/* ---------- todas as páginas com um personagem COMPLETO (ramos que só existem com dados)
 * A aba Vantagens já quebrou por ler um campo que só aparece quando há vantagens com efeitos
 * ativos. Renderizar tudo com a ficha cheia impede que um ramo condicional passe sem teste. */
{
  const { novoPoder } = await import('../app/engine/powers.js');
  const poderCheio = novoPoder('Lança de Fogo');
  poderCheio.efeito = { grupo: 'manipulacao', id: 'criar' };
  poderCheio.extensao = { alcance: '10m', area: null, alvos: '1-alvo', duracao: '1-segundo' };
  poderCheio.potencia = { intensidade: 'forte', dano: 'dano-alto', forca: [], velocidade: [] };
  poderCheio.condicoes = ['requer-contato'];
  poderCheio.pv = 'pv-10';
  poderCheio.rd = 'rd-2';
  const escalonavel = DB.advantages.find(item => (item.niveis || []).length >= 2);
  const comCustoVariavel = DB.advantages.find(item => item.niveis?.some(n => n.custo === 0));

  store.criar('Completo', 400);
  store.update(p => {
    p.atributos = { ST: 12, DX: 13, IQ: 14, HT: 12 };
    p.idade = 30; p.nt = 8; p.aparenciaNivel = 'atraente'; p.statusSocial = 2; p.mano = 'canhoto';
    p.vantagens = [
      { id: 'visao-noturna', nome: 'Visão Noturna' },
      escalonavel ? { id: escalonavel.id, nome: escalonavel.nome, nivel: escalonavel.niveis.at(-1).nome } : null,
      comCustoVariavel ? { id: comCustoVariavel.id, nome: comCustoVariavel.nome, nivel: comCustoVariavel.niveis.find(n => n.custo === 0)?.nome } : null,
      { id: 'memoria-eidetica', nome: 'Memória Eidética', nivel: '1º nível' },
    ].filter(Boolean);
    p.desvantagens = [{ id: 'curiosidade', nome: 'Curiosidade', niveis: 2 }, { id: 'miopia', nome: 'Miopia' }];
    p.peculiaridades = ['Supersticioso', 'Fala Sozinho'];
    p.pericias = [{ id: 'espadas-curtas', nivel: 4 }, { id: 'medicina', nivel: 2, familiarizado: false }, { id: 'caligrafia', nivel: 1 }];
    p.magias = [{ id: DB.spells[0].id, pontos: 2 }];
    p.poderes = [poderCheio];
    p.inventario = [{ id: 'arma-espada', nome: 'Espada curta', categoria: 'arma', dano: 'Bal+1', tipoDano: 'corte', stMin: 8, custo: 400, peso: 1.5, periciaId: 'espadas-curtas', qtd: 1, equipado: true }];
    p.riqueza = { nivel: 'Rico', multiplicador: 5, recursosBase: 1000, dinheiro: 5000 };
    p.combate ||= {};
    p.pontosDePoder = { total: 150 };
  });

  let quebras = 0;
  for (const modelo of ['gau', 'legado']) {
    store.update(p => { p.config.modeloPericias = modelo; p.config.modoCombate = modelo; p.config.emCriacao = modelo === 'gau'; });
    for (const [nome, caminho] of paginas) {
      const modulo = await import(caminho);
      const no = new FakeNode('main');
      try {
        Object.values(modulo)[0](no, { db: DB, params: nome === 'livro' ? ['vantagens'] : [], ir() {} });
        if (no.count() < 10) throw new Error(`só ${no.count()} nós`);
      } catch (e) {
        quebras++; falhas++;
        console.error(`✗ ficha cheia/${modelo}/${nome}: ${e.message}`);
      }
    }
  }
  if (!quebras) console.log(`✓ ficha cheia       ${paginas.length} páginas × 2 modelos com a ficha completa (vantagens, desvantagens, peculiaridades, perícias, magias, poder, equipamento)`);
  store.update(p => { p.config.modeloPericias = 'gau'; p.config.modoCombate = 'gau'; p.config.emCriacao = false; });
}

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
