/* GUA UI — Estado global: múltiplos personagens, persistência local, autosave.
 * Nada de dados de jogador no repositório: tudo fica no localStorage do dispositivo.
 */
import { novoPersonagem } from '../engine/character.js';
import { registrarHistorico } from '../engine/economy.js';

const KEY = 'gua.characters.v1';
const KEY_CUR = 'gua.current.v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const state = {
  personagens: loadAll(),
  atualId: localStorage.getItem(KEY_CUR) || null,
  listeners: [],
};

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state.personagens));
  localStorage.setItem(KEY_CUR, state.atualId || '');
}

export const store = {
  get personagens() { return state.personagens; },
  get atual() { return state.personagens.find(p => p.id === state.atualId) || null; },

  subscribe(fn) { state.listeners.push(fn); },
  emit(what) { state.listeners.forEach(fn => fn(what)); },

  salvar() { persist(); },

  criar(nome = 'Novo Personagem', pontos = 100) {
    const p = novoPersonagem(nome, pontos);
    state.personagens.push(p);
    state.atualId = p.id;
    persist(); this.emit('chars'); this.emit('char');
    return p;
  },

  duplicar(id) {
    const p = state.personagens.find(x => x.id === id);
    if (!p) return null;
    const copia = JSON.parse(JSON.stringify(p));
    copia.id = `pc-${Date.now().toString(36)}`;
    copia.nome = `${p.nome} (cópia)`;
    copia.criadoEm = new Date().toISOString();
    state.personagens.push(copia);
    persist(); this.emit('chars');
    return copia;
  },

  excluir(id) {
    const i = state.personagens.findIndex(x => x.id === id);
    if (i < 0) return;
    state.personagens.splice(i, 1);
    if (state.atualId === id) state.atualId = state.personagens[0]?.id || null;
    persist(); this.emit('chars'); this.emit('char');
  },

  selecionar(id) {
    state.atualId = id;
    persist(); this.emit('char');
  },

  /** Mutação com autosave + re-render. */
  update(fn) {
    const p = this.atual;
    if (!p) return;
    fn(p);
    p.modificadoEm = new Date().toISOString();
    persist(); this.emit('char');
  },

  historico(tipo, texto) {
    const p = this.atual;
    if (p) registrarHistorico(p, tipo, texto);
    persist(); this.emit('char');
  },

  importar(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data || !data.atributos || !data.nome) throw new Error('Arquivo não parece uma ficha GUA válida.');
    data.id = `pc-${Date.now().toString(36)}`;
    data.versao = data.versao || 1;
    state.personagens.push(data);
    state.atualId = data.id;
    persist(); this.emit('chars'); this.emit('char');
    return data;
  },

  exportarAtual() {
    return JSON.stringify(this.atual, null, 2);
  },
};

/* primeiro acesso: cria um personagem de exemplo */
if (!state.personagens.length) {
  store.criar('Aventureiro Iniciante', 100);
}
