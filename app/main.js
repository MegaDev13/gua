/* GUA — bootstrap e roteador (hash). Sem frameworks; ES modules nativos. */
import DB from './engine/db.js';
import { store } from './ui/store.js';
import { VERSAO_FICHA } from './engine/character.js';
import { resumoDePontos, ajustarTotalDePontos, presetsDePontos, limitesDePontos } from './engine/points.js';
import { el, toast } from './ui/ui.js';
import { renderPersonagem } from './ui/pages/personagem.js';
import { renderAtributos } from './ui/pages/atributos.js';
import { renderPericias } from './ui/pages/pericias.js';
import { renderVantagens } from './ui/pages/vantagens.js';
import { renderEquipamentos } from './ui/pages/equipamentos.js';
import { renderCombate } from './ui/pages/combate.js';
import { renderMagias } from './ui/pages/magias.js';
import { renderPoderes } from './ui/pages/poderes.js';
import { renderProezas } from './ui/pages/proezas.js';
import { renderDados } from './ui/pages/dados.js';
import { renderHistorico } from './ui/pages/historico.js';
import { renderConfig } from './ui/pages/config.js';
import { renderLivro } from './ui/pages/livro.js';

const PAGES = [
  { id: 'personagem', nome: 'Personagem', icon: '🧑', render: renderPersonagem, area: 'ficha' },
  { id: 'atributos', nome: 'Atributos', icon: '🎲', render: renderAtributos, area: 'ficha' },
  { id: 'pericias', nome: 'Perícias', icon: '📜', render: renderPericias, area: 'ficha' },
  { id: 'vantagens', nome: 'Vantagens/Desv.', icon: '⚖️', render: renderVantagens, area: 'ficha' },
  { id: 'equipamentos', nome: 'Equipamentos', icon: '⚔️', render: renderEquipamentos, area: 'ficha' },
  { id: 'poderes', nome: 'Poderes', icon: '🌀', render: renderPoderes, area: 'ficha' },
  { id: 'magias', nome: 'Magias', icon: '✨', render: renderMagias, area: 'ficha' },
  { id: 'proezas', nome: 'Proezas', icon: '🏃', render: renderProezas, area: 'ficha' },
  { id: 'dados', nome: 'Dados', icon: '🎲', render: renderDados, area: 'ficha' },
  { id: 'historico', nome: 'Histórico', icon: '🗂️', render: renderHistorico, area: 'ficha' },
  { id: 'config', nome: 'Config.', icon: '⚙️', render: renderConfig, area: 'ficha' },
  { id: 'combate', nome: 'Combate', icon: '⚔️', render: renderCombate, area: 'combate' },
  { id: 'livro', nome: 'Livro', icon: '📖', render: renderLivro, area: 'livro' },
];

const SYSTEMS = [
  { id: 'livro', nome: 'Livro', icon: '📖', href: 'livro' },
  { id: 'ficha', nome: 'Ficha', icon: '🧙', href: 'personagem' },
  { id: 'combate', nome: 'Combate', icon: '⚔', href: 'combate' },
];

function route(opts = {}) {
  const hash = location.hash.replace(/^#\/?/, '') || 'personagem';
  const [pageId, ...resto] = hash.split('/');
  const page = PAGES.find(candidate => candidate.id === pageId) || PAGES[0];
  const main = document.getElementById('main');
  const activeSystem = page.area;

  /* Re-render por edição (store.update → 'char'): preserva foco e rolagem para o site
     NÃO "pular a tela" enquanto o usuário digita ou mexe num campo. Navegação real
     (mudar de página) continua rolando para o topo. */
  const preserve = !!opts.preserve;
  const activeEl = document.activeElement || null;
  const activePath = activeEl && activeEl.dataset ? activeEl.dataset.path : null;
  const caretStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
  const caretEnd = activeEl && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;
  const activeRange = caretStart != null ? [caretStart, caretEnd != null ? caretEnd : caretStart] : null;
  const prevScrollY = preserve ? window.scrollY : 0;

  document.querySelectorAll('.tab').forEach(tab => tab.toggleAttribute('aria-current', tab.dataset.page === page.id));
  document.querySelectorAll('.system-link').forEach(link => link.toggleAttribute('aria-current', link.dataset.system === activeSystem));
  document.body.classList.toggle('is-book', page.area === 'livro');
  document.body.classList.toggle('is-combat', page.area === 'combate');
  if (page.area !== 'livro') {
    document.body.classList.remove('book-experience', 'book-reading-mode');
  }
  document.getElementById('nav').hidden = page.area !== 'ficha';
  const widgetPontos = document.getElementById('pontosWidget');
  if (widgetPontos) widgetPontos.hidden = page.area === 'livro';
  document.getElementById('topbarActions').classList.toggle('book-actions', page.area === 'livro');
  document.title = page.area === 'livro'
    ? `${DB.book?.titulo || 'GUA'} — Livro Digital`
    : `${page.nome} — GUA`;

  main.innerHTML = '';
  main.className = `main area-${page.area}`;
  try {
    page.render(main, { db: DB, params: resto, ir: hashTo => { location.hash = hashTo; } });
  } catch (error) {
    main.append(el('div', { class: 'panel' }, `Erro ao renderizar ${page.nome}: ${error.message}`));
    console.error(error);
  }
  if (page.area !== 'livro') {
    if (preserve) {
      /* Refoca o mesmo campo recriado (mesmo data-path) e devolve o caret; a rolagem
         é restaurada por último, para focus() não deslocar a página. */
      if (activePath) {
        const alvo = main.querySelector(`[data-path="${activePath}"]`);
        if (alvo) {
          alvo.focus();
          if (activeRange && typeof alvo.setSelectionRange === 'function') {
            try { alvo.setSelectionRange(activeRange[0], activeRange[1]); } catch (_) {}
          }
        }
      }
      window.scrollTo(0, prevScrollY);
    } else {
      window.scrollTo(0, 0);
    }
  }
}

function montarNav() {
  const systems = document.getElementById('systemNav');
  systems.innerHTML = '';
  for (const system of SYSTEMS) systems.append(el('button', {
    class: 'system-link', dataset: { system: system.id },
    onclick: () => { location.hash = system.href; },
  }, el('span', { 'aria-hidden': 'true' }, system.icon), system.nome));

  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const page of PAGES.filter(candidate => candidate.area === 'ficha')) {
    nav.append(el('button', { class: 'tab', dataset: { page: page.id }, onclick: () => { location.hash = page.id; } },
      `${page.icon} ${page.nome}`));
  }
}

/* ---------------------------------------------------------- widget de pontos (topbar)
 * Orçamento único: o mesmo total alimenta atributos, perícias, vantagens, poderes e mágicas.
 * Presets de campanha (25 → 1.000+), incrementos rápidos e barra do que já foi gasto. */
function montarWidgetPontos() {
  const host = document.getElementById('pontosWidget');
  if (!host) return;
  const pc = store.atual;
  host.innerHTML = '';
  if (!pc) { host.hidden = true; return; }
  const resumo = resumoDePontos(DB, pc);
  const { incrementos } = limitesDePontos(DB);
  const mudar = delta => store.update(p => { ajustarTotalDePontos(DB, p, delta); });
  const aplicarPreset = preset => store.update(p => { ajustarTotalDePontos(DB, p, 0, { preset }); });
  host.append(
    el('div', { class: 'pw-numeros', title: `Total ${resumo.total} · gastos ${resumo.gastos} · livres ${resumo.livres}` },
      el('span', { class: 'pw-total' }, String(resumo.total)),
      el('span', { class: 'fonte' }, `gastos ${resumo.gastos}`),
      el('span', { class: `pw-livres${resumo.livres < 0 ? ' negativo' : ''}` }, `livres ${resumo.livres}`)),
    el('div', { class: 'pw-barra', title: `${resumo.porcentagemUsada}% do orçamento usado${resumo.estourado ? ` — estourado em ${resumo.faltam}` : ''}` },
      el('i', { class: resumo.estourado ? 'over' : '', style: `width:${Math.max(2, Math.min(100, resumo.porcentagemUsada))}%` })),
    el('span', { class: 'pw-escala', title: resumo.escala?.descricao || '' }, `${resumo.escala?.nivel || '—'} · ${resumo.escala?.pontos || ''}`),
    el('select', {
      'aria-label': 'Total de pontos (presets de campanha)',
      onchange: evento => {
        const preset = presetsDePontos(DB).find(item => String(item.pontos) === evento.target.value);
        if (preset) aplicarPreset(preset);
      },
    },
      el('option', { value: '' }, 'Presets…'),
      ...presetsDePontos(DB).map(preset => el('option', {
        value: String(preset.pontos), selected: resumo.total === preset.pontos,
      }, `${preset.nome} — ${preset.pontos}`))),
    el('div', { class: 'pw-acoes' },
      ...incrementos.flatMap(inc => [
        el('button', { class: 'btn ghost', title: `Reduzir o total em ${inc} pontos`, onclick: () => mudar(-inc) }, `−${inc}`),
        el('button', { class: 'btn ghost', title: `Aumentar o total em ${inc} pontos`, onclick: () => mudar(inc) }, `+${inc}`),
      ])),
  );
}

function montarSeletor() {
  const select = document.getElementById('charSelect');
  select.innerHTML = '';
  for (const person of store.personagens) {
    select.append(el('option', { value: person.id, selected: person.id === store.atualId }, person.nome || 'Sem nome'));
  }
  select.onchange = () => store.selecionar(select.value);
  document.getElementById('btnSave').onclick = () => { store.salvar(); toast('Personagem salvo neste dispositivo.', 'ok'); };
}

document.getElementById('btnMenu').onclick = () => {
  const nav = document.getElementById('nav');
  nav.hidden = !nav.hidden;
};

/* Banco de regras incompleto: avisa em vez de quebrar dentro de uma fórmula.
 * DB.load() não derruba a página se um data/*.json falhar — os valores dependentes
 * ficam "—" e o usuário vê exatamente qual arquivo não carregou. */
function avisarFalhaDeDados(falhas) {
  const nomes = falhas.map(([arquivo]) => `data/${arquivo}.json`);
  toast(`Falha ao carregar ${nomes.length} arquivo(s) de regras: ${nomes.join(', ')}.`, 'bad');
  const banner = el('div', { class: 'panel', role: 'alert', style: 'margin:.75rem 1rem;border:1px solid var(--bad)' },
    el('strong', {}, '⚠ Banco de regras incompleto'),
    el('p', { class: 'fonte', style: 'margin:.3rem 0' },
      `Estes arquivos não carregaram: ${nomes.join(', ')}. Os valores que dependem deles aparecem como "—" — nada é inventado. `
      + 'Recarregue a página; se o erro continuar, o servidor que entrega a pasta data/ está fora do ar.'),
    el('ul', { class: 'fonte' }, ...falhas.map(([arquivo, info]) => el('li', {}, `data/${arquivo}.json — ${info?._erro || 'erro desconhecido'}`))),
    el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn',
        onclick: async evento => {
          evento.target.disabled = true;
          evento.target.textContent = '↻ Recarregando regras…';
          await DB.recarregar();
          location.reload();
        },
      }, '↻ Tentar novamente')));
  /* fora do #main: route() limpa o #main a cada navegação e o aviso precisa persistir */
  const main = document.getElementById('main');
  if (main?.before) main.before(banner);
  else if (document.querySelector('header.topbar')?.after) document.querySelector('header.topbar').after(banner);
  else document.body.prepend(banner);
}

(async () => {
  await DB.load();
  const falhas = Object.entries(DB.erros || {});
  if (falhas.length) avisarFalhaDeDados(falhas);
  /* migração das fichas salvas — só agora, com data/*.json carregado */
  const migradas = store.inicializar();
  if (migradas && !falhas.length) toast(`${migradas} ficha(s) migrada(s) para o modelo atual (v${VERSAO_FICHA}).`, 'ok');
  montarNav();
  montarSeletor();
  montarWidgetPontos();
  store.subscribe(event => {
    if (event === 'chars') montarSeletor();
    montarWidgetPontos();
    /* 'char' = edição de ficha (ex.: digitar). Preserva foco/rolagem para não pular a tela. */
    route({ preserve: event === 'char' });
  });
  window.addEventListener('hashchange', () => route());
  route();
})();
