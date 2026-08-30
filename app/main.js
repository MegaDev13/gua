/* GUA — bootstrap e roteador (hash). Sem frameworks; ES modules nativos. */
import DB from './engine/db.js';
import { store } from './ui/store.js';
import { el, toast } from './ui/ui.js';
import { renderPersonagem } from './ui/pages/personagem.js';
import { renderAtributos } from './ui/pages/atributos.js';
import { renderPericias } from './ui/pages/pericias.js';
import { renderVantagens } from './ui/pages/vantagens.js';
import { renderEquipamentos } from './ui/pages/equipamentos.js';
import { renderCombate } from './ui/pages/combate.js';
import { renderMagias } from './ui/pages/magias.js';
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
  { id: 'magias', nome: 'Poderes', icon: '✨', render: renderMagias, area: 'ficha' },
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

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'personagem';
  const [pageId, ...resto] = hash.split('/');
  const page = PAGES.find(candidate => candidate.id === pageId) || PAGES[0];
  const main = document.getElementById('main');
  const activeSystem = page.area;

  document.querySelectorAll('.tab').forEach(tab => tab.toggleAttribute('aria-current', tab.dataset.page === page.id));
  document.querySelectorAll('.system-link').forEach(link => link.toggleAttribute('aria-current', link.dataset.system === activeSystem));
  document.body.classList.toggle('is-book', page.area === 'livro');
  document.body.classList.toggle('is-combat', page.area === 'combate');
  if (page.area !== 'livro') {
    document.body.classList.remove('book-experience', 'book-reading-mode');
  }
  document.getElementById('nav').hidden = page.area !== 'ficha';
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
  if (page.area !== 'livro') window.scrollTo(0, 0);
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

(async () => {
  await DB.load();
  montarNav();
  montarSeletor();
  store.subscribe(event => {
    if (event === 'chars') montarSeletor();
    route();
  });
  window.addEventListener('hashchange', route);
  route();
})();
