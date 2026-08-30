/* GAU — Busca Global no Grimório */

import { el } from './ui.js';

export class SearchEngine {
  constructor(db) {
    this.db = db;
    this.index = db.searchIndex || [];
  }

  search(query, { limit = 20, tipos = [] } = {}) {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);

    const scored = this.index.map(item => {
      const texto = `${item.titulo} ${item.caminho} ${item.conteudo}`.toLowerCase();
      let score = 0;
      let matches = 0;
      for (const term of terms) {
        if (item.titulo.toLowerCase().includes(term)) { score += 10; matches++; }
        if (item.caminho.toLowerCase().includes(term)) { score += 5; matches++; }
        if (texto.includes(term)) { score += 1; matches++; }
      }
      // bonus tipo
      if (tipos.length && !tipos.includes(item.tipo)) score = 0;
      // só considera se todos os termos aparecem
      const allTerms = terms.every(t => texto.includes(t));
      if (!allTerms) score = 0;
      return { item, score, matches };
    }).filter(x => x.score > 0);

    scored.sort((a,b) => b.score - a.score || a.item.titulo.localeCompare(b.item.titulo));

    return scored.slice(0, limit).map(s => ({
      ...s.item,
      score: s.score,
      snippet: this._makeSnippet(s.item, q)
    }));
  }

  _makeSnippet(item, query) {
    const content = item.conteudo || '';
    const idx = content.toLowerCase().indexOf(query.split(' ')[0]);
    if (idx === -1) return content.slice(0, 120) + (content.length > 120 ? '…' : '');
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + 120);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < content.length) snippet = snippet + '…';
    return snippet;
  }

  renderResults(results, query, onSelect) {
    const wrap = el('div', { class: 'search-results' });
    if (results.length === 0) {
      wrap.append(el('div', { class: 'panel', style: 'text-align:center;padding:1.5rem;color:var(--ink-dim)' },
        el('div', { style: 'font-size:2rem;margin-bottom:.5rem' }, '🔍'),
        el('div', {}, query ? `Nenhum resultado para "${query}"` : 'Digite para buscar no grimório'),
        el('div', { style: 'font-size:.8rem;margin-top:.5rem' }, 'Tente: margem, empunhadura, saraivada, pânico, luminosidade')
      ));
      return wrap;
    }
    for (const r of results) {
      const div = el('div', { class: 'search-result', tabindex: '0', role: 'button' },
        el('div', { class: 'result-title' }, r.titulo),
        el('div', { class: 'result-path' }, `${r.caminho} • ${r.tipo}`),
        el('div', { class: 'result-snippet' }, r.snippet)
      );
      div.addEventListener('click', () => onSelect(r));
      div.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSelect(r); });
      wrap.append(div);
    }
    return wrap;
  }
}
