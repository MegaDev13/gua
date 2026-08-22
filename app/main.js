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
  { id: 'personagem', nome: 'Personagem', icon: '🧑', render: renderPersonagem },
  { id: 'atributos', nome: 'Atributos', icon: '🎲', render: renderAtributos },
  { id: 'pericias', nome: 'Perícias', icon: '📜', render: renderPericias },
  { id: 'vantagens', nome: 'Vantagens/Desv.', icon: '⚖️', render: renderVantagens },
  { id: 'equipamentos', nome: 'Equipamentos', icon: '⚔️', render: renderEquipamentos },
  { id: 'combate', nome: 'Combate', icon: '🗡️', render: renderCombate },
  { id: 'magias', nome: 'Poderes', icon: '✨', render: renderMagias },
  { id: 'livro', nome: 'Livro', icon: '📖', render: renderLivro },
  { id: 'dados', nome: 'Dados', icon: '🎲', render: renderDados },
  { id: 'historico', nome: 'Histórico', icon: '🗂️', render: renderHistorico },
  { id: 'config', nome: 'Config.', icon: '⚙️', render: renderConfig },
];

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'personagem';
  const [pageId, ...resto] = hash.split('/');
  const page = PAGES.find(p => p.id === pageId) || PAGES[0];
  const main = document.getElementById('main');
  document.querySelectorAll('.tab').forEach(t => t.toggleAttribute('aria-current', t.dataset.page === page.id));
  main.innerHTML = '';
  try {
    page.render(main, { db: DB, params: resto, ir: (h) => { location.hash = h; } });
  } catch (e) {
    main.append(el('div', { class: 'panel' }, `Erro ao renderizar ${page.nome}: ${e.message}`));
    console.error(e);
  }
  if (!pageId.startsWith('livro')) main.scrollTop = 0, window.scrollTo(0, 0);
}

function montarNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const p of PAGES) {
    nav.append(el('button', { class: 'tab', dataset: { page: p.id }, onclick: () => { location.hash = p.id; } },
      `${p.icon} ${p.nome}`));
  }
}

function montarSeletor() {
  const sel = document.getElementById('charSelect');
  sel.innerHTML = '';
  for (const p of store.personagens) {
    sel.append(el('option', { value: p.id, selected: p.id === store.atualId }, p.nome || 'Sem nome'));
  }
  sel.onchange = () => store.selecionar(sel.value);
  document.getElementById('btnSave').onclick = () => { store.salvar(); toast('Personagem salvo neste dispositivo.', 'ok'); };
}

document.getElementById('btnMenu').onclick = () => {
  const nav = document.getElementById('nav');
  nav.style.display = nav.style.display === 'none' || !nav.style.display ? 'flex' : 'none';
};

(async () => {
  await DB.load();
  montarNav();
  montarSeletor();
  store.subscribe(evt => {
    if (evt === 'chars') montarSeletor();
    route();
  });
  window.addEventListener('hashchange', route);
  route();
})();
