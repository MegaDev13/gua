/* GAU — Helpers de UI */

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(e.dataset, v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    if (typeof c === 'string' || typeof c === 'number') e.append(document.createTextNode(String(c)));
    else e.append(c);
  }
  return e;
}

export function toast(msg, tipo = '') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = el('div', { class: `toast ${tipo}` }, msg);
  root.append(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 200);
  }, 3500);
}

export function modal(content, { closable = true } = {}) {
  const back = el('div', { class: 'modal-back' });
  const box = el('div', { class: 'modal' }, content);
  if (closable) {
    const close = () => back.remove();
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    box.prepend(el('button', { class: 'btn icon small close', onclick: close }, '✕'));
  }
  back.append(box);
  document.body.append(back);
  return back;
}

export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(text, filename, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function highlight(text, query) {
  if (!query) return text;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${esc})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}
