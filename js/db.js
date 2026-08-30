/* GAU — Database loader (fonte única da verdade)
   Carrega todos os JSONs de data/ via fetch (GitHub Pages compatível)
*/
const FILES = [
  'book',
  'margins',
  'weapons',
  'maneuvers',
  'empunhaduras',
  'tables',
  'attributes',
  'categories',
  'rules'
];

class Database {
  constructor() {
    this._data = {};
    this._loaded = false;
    this._index = []; // para busca
  }

  async load() {
    if (this._loaded) return this;
    const base = this._basePath();
    for (const name of FILES) {
      try {
        const res = await fetch(`${base}data/${name}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this._data[name] = await res.json();
      } catch (e) {
        console.warn(`Falha ao carregar data/${name}.json:`, e);
        this._data[name] = {_erro: e.message};
      }
    }
    this._buildSearchIndex();
    this._loaded = true;
    return this;
  }

  _basePath() {
    // Garante funcionamento em subdiretório (GitHub Pages)
    // Se estiver em /gua/ ou /repo/, usa ./ ; se em root, usa ./
    // Todos os caminhos no projeto são relativos, então base vazia funciona
    // Mas para garantir, detecta se estamos em file://
    const loc = typeof window !== 'undefined' ? window.location.pathname : '';
    // Se index.html está em subpasta, o fetch relativo já resolve
    return '';
  }

  _buildSearchIndex() {
    const idx = [];
    const book = this._data.book;
    if (book?.capitulos) {
      for (const cap of book.capitulos) {
        if (cap.secoes) {
          for (const sec of cap.secoes) {
            idx.push({
              id: `livro/${cap.id}/${sec.id}`,
              titulo: sec.titulo,
              capitulo: cap.titulo,
              caminho: `${cap.titulo} > ${sec.titulo}`,
              conteudo: (sec.conteudo || '').slice(0, 400),
              tipo: 'regra',
              ref: `#/livro/${cap.id}#${sec.id}`
            });
            if (sec.subsecoes) {
              for (const sub of sec.subsecoes) {
                idx.push({
                  id: `livro/${cap.id}/${sec.id}/${sub.titulo}`,
                  titulo: sub.titulo,
                  capitulo: cap.titulo,
                  caminho: `${cap.titulo} > ${sec.titulo} > ${sub.titulo}`,
                  conteudo: (sub.conteudo || '').slice(0, 300),
                  tipo: 'regra',
                  ref: `#/livro/${cap.id}#${sec.id}`
                });
              }
            }
          }
        }
      }
    }
    // Armas
    const weapons = this._data.weapons;
    if (weapons?.categorias) {
      for (const cat of weapons.categorias) {
        for (const arma of cat.armas || []) {
          idx.push({
            id: `arma/${arma.nome}`,
            titulo: arma.nome,
            capitulo: cat.nome,
            caminho: `Equipamentos > ${cat.nome} > ${arma.nome}`,
            conteudo: `${arma.dano} — ${arma.caracteristica} — ${arma.tipo}`,
            tipo: 'arma',
            ref: `#/livro/sistema-combate#tabelas-dano`
          });
        }
      }
    }
    // Manobras
    const man = this._data.maneuvers;
    if (man) {
      const addManeuver = (prefix, obj) => {
        if (!obj) return;
        if (obj.nome) {
          idx.push({
            id: `manobra/${obj.nome}`,
            titulo: obj.nome,
            capitulo: prefix,
            caminho: `Combate > ${prefix} > ${obj.nome}`,
            conteudo: (obj.descricao || '').slice(0, 300),
            tipo: 'manobra',
            ref: `#/livro/sistema-combate#manobras`
          });
        }
        // recursivo
        for (const k of ['estilos','caminhos','formas','tipos','acoes','derivacao']) {
          const v = obj[k];
          if (Array.isArray(v)) v.forEach(child => addManeuver(obj.nome || prefix, child));
          else if (v && typeof v === 'object') addManeuver(obj.nome || prefix, v);
        }
      };
      Object.values(man).forEach(root => addManeuver('Manobras', root));
    }
    // Empunhaduras
    const emp = this._data.empunhaduras;
    if (emp?.empunhaduras) {
      for (const e of emp.empunhaduras) {
        idx.push({
          id: `empunhadura/${e.id}`,
          titulo: e.nome,
          capitulo: 'Empunhaduras',
          caminho: `Preparar > Empunhaduras > ${e.nome}`,
          conteudo: `${e.especialidade} — ${e.vantagem} — ${e.descricao}`,
          tipo: 'empunhadura',
          ref: `#/livro/sistema-combate#manobras`
        });
      }
    }
    // Tabelas
    const tables = this._data.tables;
    if (tables) {
      for (const [k, t] of Object.entries(tables)) {
        if (t?.tabela) {
          idx.push({
            id: `tabela/${k}`,
            titulo: t.fonte || k,
            capitulo: 'Tabelas',
            caminho: `Tabelas > ${k}`,
            conteudo: JSON.stringify(t.tabela).slice(0, 300),
            tipo: 'tabela',
            ref: `#/livro/sistema-combate#${k}`
          });
        }
      }
    }
    // Margens
    const margins = this._data.margins;
    if (margins?.tabela) {
      idx.push({
        id: 'tabela/margens',
        titulo: 'Tabela de Margens de Sucesso',
        capitulo: 'Testes',
        caminho: 'Testes > Margem de Sucesso',
        conteudo: 'Margem de sucesso e crítico por valor de atributo 1-20. Valor 10 = referência humana 8-12 crítico 10.',
        tipo: 'tabela',
        ref: '#/livro/testes#margem-sucesso'
      });
    }

    this._index = idx;
  }

  get book() { return this._data.book || {}; }
  get margins() { return this._data.margins || {}; }
  get weapons() { return this._data.weapons || {}; }
  get maneuvers() { return this._data.maneuvers || {}; }
  get empunhaduras() { return this._data.empunhaduras || {}; }
  get tables() { return this._data.tables || {}; }
  get attributes() { return this._data.attributes || {}; }
  get categories() { return this._data.categories || {}; }
  get rules() { return this._data.rules || {}; }
  get searchIndex() { return this._index; }

  // helpers
  getMarginForValue(val) {
    const t = this.margins.tabela || [];
    const entry = t.find(e => e.valor === val);
    if (entry) return entry;
    // extrapolação acima de 20
    if (val > 20) {
      const base = t.find(e => e.valor === 20);
      const extra = val - 20;
      const low = 15 + Math.floor(extra * 0.8);
      const high = 25 + extra * 2;
      return { valor: val, margem: [low, high], margemTexto: `${low}–${high}`, critico: val, descricao: `Extrapolado (+${extra})`, extrapolado: true };
    }
    if (val < 1) return t[0];
    return null;
  }

  getWeapon(name) {
    for (const cat of this.weapons.categorias || []) {
      const w = cat.armas.find(a => a.nome.toLowerCase() === name.toLowerCase());
      if (w) return {...w, categoria: cat.nome, categoriaId: cat.id};
    }
    return null;
  }

  getAllWeapons() {
    const out = [];
    for (const cat of this.weapons.categorias || []) {
      for (const arma of cat.armas) out.push({...arma, categoria: cat.nome, categoriaId: cat.id});
    }
    return out;
  }
}

export const DB = new Database();
export default DB;
