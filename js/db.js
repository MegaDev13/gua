/* GAU — Database loader (fonte única da verdade)
   Carrega todos os JSONs de data/ via fetch (GitHub Pages compatível)
   Robusto para subdiretório: tenta ./data/, data/, /gua/data/, etc.
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
    this._index = [];
    this._baseTried = [];
  }

  async load() {
    if (this._loaded) return this;
    
    // Detecta base path para GitHub Pages
    const bases = this._getBasePaths();
    console.log('GAU DB tentando bases:', bases);
    
    for (const name of FILES) {
      let loaded = false;
      let lastError = null;
      
      for (const base of bases) {
        try {
          const url = `${base}data/${name}.json`;
          // Evita tentar mesma URL duas vezes
          if (this._baseTried.includes(url)) continue;
          this._baseTried.push(url);
          
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
          const text = await res.text();
          // Verifica se não é HTML (erro 404 do Pages retorna HTML)
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error(`Recebido HTML em vez de JSON em ${url} — provavelmente 404 do GitHub Pages`);
          }
          this._data[name] = JSON.parse(text);
          loaded = true;
          // Se carregou com uma base, usa essa base para os próximos
          if (base !== bases[0]) {
            // Move base bem-sucedida para frente
            bases.unshift(base);
          }
          break;
        } catch (e) {
          lastError = e;
          // console.warn(`Tentativa falhou ${base}data/${name}.json:`, e.message);
        }
      }
      
      if (!loaded) {
        console.warn(`Falha ao carregar data/${name}.json após ${bases.length} tentativas. Último erro:`, lastError?.message);
        this._data[name] = {_erro: lastError?.message || 'Falha desconhecida', _tentativas: bases};
      }
    }
    
    this._buildSearchIndex();
    this._loaded = true;
    console.log('GAU DB carregado:', Object.keys(this._data), 'com', this._index.length, 'entradas de busca');
    return this;
  }

  _getBasePaths() {
    const bases = [];
    
    // 1. Relativo ao documento atual (funciona em subdiretório)
    bases.push('./');
    bases.push('');
    bases.push('./');
    
    // 2. Baseado no pathname atual (para GitHub Pages /gua/ ou /repo/)
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      // Se estamos em /gua/ ou /gua/index.html ou /gua/#/...
      // Tenta extrair base do repo
      const match = path.match(/^(\/[^\/]+\/)/);
      if (match) {
        bases.push(match[1]); // ex: /gua/
        bases.push(`${match[1]}`); 
      }
      // Base absoluta com origin
      bases.push(`${window.location.origin}${path.split('#')[0].replace(/\/[^\/]*$/, '/')}`);
      
      // Tenta também sem ./ mas com /
      bases.push('/');
      
      // Se temos <base> tag, usa
      const baseTag = document.querySelector('base');
      if (baseTag?.href) {
        bases.unshift(baseTag.href);
      }
    }
    
    // 3. Fallbacks comuns GitHub Pages
    bases.push('/gua/');
    bases.push('/GUA/');
    
    // Remove duplicatas mantendo ordem
    const unique = [];
    const seen = new Set();
    for (const b of bases) {
      if (!seen.has(b)) {
        seen.add(b);
        unique.push(b);
      }
    }
    return unique;
  }

  _buildSearchIndex() {
    const idx = [];
    const book = this._data.book;
    if (book?.capitulos) {
      for (const cap of book.capitulos) {
        if (cap.id === 'capa') continue;
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
        if (obj.nome && obj.id) {
          idx.push({
            id: `manobra/${obj.id}`,
            titulo: obj.nome,
            capitulo: prefix,
            caminho: `Combate > ${prefix} > ${obj.nome}`,
            conteudo: (obj.descricao || '').slice(0, 300),
            tipo: 'manobra',
            ref: `#/livro/sistema-combate#manobras`
          });
        }
        for (const k of ['estilos','caminhos','formas','tipos','acoes','derivacao']) {
          const v = obj[k];
          if (Array.isArray(v)) v.forEach(child => addManeuver(obj.nome || prefix, child));
          else if (v && typeof v === 'object' && v.nome) addManeuver(obj.nome || prefix, v);
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
        if (t?.tabela || t?.fonte) {
          idx.push({
            id: `tabela/${k}`,
            titulo: t.fonte || k,
            capitulo: 'Tabelas',
            caminho: `Tabelas > ${k}`,
            conteudo: typeof t.tabela === 'string' ? t.tabela.slice(0,300) : JSON.stringify(t.tabela||'').slice(0, 300),
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

  get book() { return this._data.book || { capitulos: [] }; }
  get margins() { return this._data.margins || { tabela: [] }; }
  get weapons() { return this._data.weapons || { categorias: [] }; }
  get maneuvers() { return this._data.maneuvers || {}; }
  get empunhaduras() { return this._data.empunhaduras || { empunhaduras: [] }; }
  get tables() { return this._data.tables || {}; }
  get attributes() { return this._data.attributes || { atributos: [] }; }
  get categories() { return this._data.categories || { categorias: [] }; }
  get rules() { return this._data.rules || {}; }
  get searchIndex() { return this._index; }

  getMarginForValue(val) {
    const t = this.margins.tabela || [];
    const entry = t.find(e => e.valor === val);
    if (entry) return entry;
    if (val > 20) {
      const extra = val - 20;
      const low = 15 + Math.floor(extra * 0.8);
      const high = 25 + extra * 2;
      return { valor: val, margem: [low, high], margemTexto: `${low}–${high}`, critico: val, descricao: `Extrapolado (+${extra})`, extrapolado: true };
    }
    if (val < 1) return t[0] || { valor: 1, margem: null, margemTexto: 'Nenhuma', critico: null };
    return t.find(e => e.valor === 10) || null;
  }

  getWeapon(name) {
    for (const cat of this.weapons.categorias || []) {
      const w = (cat.armas || []).find(a => a.nome.toLowerCase() === name.toLowerCase());
      if (w) return {...w, categoria: cat.nome, categoriaId: cat.id};
    }
    return null;
  }

  getAllWeapons() {
    const out = [];
    for (const cat of this.weapons.categorias || []) {
      for (const arma of cat.armas || []) out.push({...arma, categoria: cat.nome, categoriaId: cat.id});
    }
    return out;
  }
}

export const DB = new Database();
export default DB;
