/* GAU — Armazenamento Local (localStorage)
   Meus Personagens, tema, preferências
*/

const KEY_CHARS = 'gau_personagens_v2';
const KEY_ATUAL = 'gau_atual_v2';
const KEY_TEMA = 'gau_tema';
const KEY_BOOK_MODE = 'gau_book_mode';
const KEY_FILTROS = 'gau_filtros';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export const storage = {
  // Personagens
  getPersonagens() {
    return loadJSON(KEY_CHARS, []);
  },
  setPersonagens(lista) {
    saveJSON(KEY_CHARS, lista);
  },
  getAtualId() {
    return localStorage.getItem(KEY_ATUAL) || null;
  },
  setAtualId(id) {
    if (id) localStorage.setItem(KEY_ATUAL, id);
    else localStorage.removeItem(KEY_ATUAL);
  },
  salvarPersonagem(char) {
    // char deve ter id
    if (!char.id) char.id = 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    char.atualizadoEm = new Date().toISOString();
    if (!char.criadoEm) char.criadoEm = char.atualizadoEm;
    const lista = this.getPersonagens();
    const idx = lista.findIndex(c => c.id === char.id);
    if (idx >= 0) lista[idx] = char;
    else lista.push(char);
    this.setPersonagens(lista);
    this.setAtualId(char.id);
    return char;
  },
  getPersonagem(id) {
    return this.getPersonagens().find(c => c.id === id) || null;
  },
  getAtual() {
    const id = this.getAtualId();
    if (!id) return this.getPersonagens()[0] || null;
    return this.getPersonagem(id) || this.getPersonagens()[0] || null;
  },
  duplicar(id) {
    const orig = this.getPersonagem(id);
    if (!orig) return null;
    const copia = JSON.parse(JSON.stringify(orig));
    copia.id = 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    copia.nome = (copia.nome || 'Personagem') + ' (cópia)';
    copia.criadoEm = new Date().toISOString();
    copia.atualizadoEm = copia.criadoEm;
    const lista = this.getPersonagens();
    lista.push(copia);
    this.setPersonagens(lista);
    return copia;
  },
  excluir(id) {
    const lista = this.getPersonagens().filter(c => c.id !== id);
    this.setPersonagens(lista);
    if (this.getAtualId() === id) {
      this.setAtualId(lista[0]?.id || null);
    }
  },
  // Tema
  getTema() {
    return localStorage.getItem(KEY_TEMA) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  },
  setTema(t) {
    localStorage.setItem(KEY_TEMA, t);
    document.documentElement.setAttribute('data-theme', t);
  },
  // Book mode
  getBookMode() {
    return loadJSON(KEY_BOOK_MODE, false);
  },
  setBookMode(v) {
    saveJSON(KEY_BOOK_MODE, v);
  },
  // Filtros
  getFiltros() {
    return loadJSON(KEY_FILTROS, []);
  },
  setFiltros(f) {
    saveJSON(KEY_FILTROS, f);
  },
  // Backup completo
  exportarBackup() {
    return {
      versao: 2,
      data: new Date().toISOString(),
      personagens: this.getPersonagens(),
      tema: this.getTema(),
      filtros: this.getFiltros()
    };
  },
  importarBackup(obj) {
    if (!obj || !obj.personagens) throw new Error('Backup inválido');
    this.setPersonagens(obj.personagens);
    if (obj.tema) this.setTema(obj.tema);
    if (obj.filtros) this.setFiltros(obj.filtros);
  }
};

export function novoPersonagemBase() {
  return {
    id: 'char_' + Date.now(),
    nome: '',
    conceito: '',
    jogador: '',
    categoria: 'mundano',
    pontosTotais: 150,
    atributos: { ST: 10, DX: 10, IQ: 10, HT: 10 },
    pericias: [
      { nome: 'Arrombamento', atributoBase: 'IQ', valor: 6, redutor: 5, descricao: 'Base IQ-5' },
      { nome: 'Cavalgar', atributoBase: 'DX', valor: 10, descricao: 'Base DX' },
      { nome: 'Natação', atributoBase: 'ST', valor: 5, redutor: 5, descricao: 'ST-5 ou DX-5' },
      { nome: 'Escalada', atributoBase: 'DX', valor: 5, redutor: 5, descricao: 'DX-5 ou ST-5' }
    ],
    manobras: ['ataque-simples', 'mover-atacar'],
    empunhadura: 'uma-mao',
    poderes: {}, // { telepatia: { potencia: 10, pericias: [{id, nome, nivel}] } }
    magias: {}, // { fogo: { nivel: 5, magias: [{id,nome,nivel}] } }
    equipamentos: [],
    historia: '',
    fadiga: 0,
    ferimentos: 0,
    bonusVontade: 0,
    bonusPercepcao: 0,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
}
