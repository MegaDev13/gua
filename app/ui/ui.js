/* GUA UI — utilitários de renderização (helpers puros, sem fórmulas de regras). */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function fmtMoney(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return '$' + Number(v).toLocaleString('pt-BR');
}

export function fmtKg(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${(Math.round(n * 10) / 10).toLocaleString('pt-BR')} kg`;
}

/** Valor calculado com tooltip de breakdown (Regra nº 51 do prompt mestre). */
export function valorCalculado(valor, breakdown, titulo = 'Como este valor foi calculado') {
  const box = el('span', { class: 'value clickable', tabindex: '0', role: 'button', title: 'Clique para ver o cálculo' }, String(valor));
  const show = () => modalBreakdown(titulo, breakdown, valor);
  box.addEventListener('click', show);
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
  return box;
}

export function modalBreakdown(titulo, breakdown, final) {
  const lines = (breakdown || []).map(b => el('div', { class: 'line' },
    el('span', {}, typeof b === 'string' ? b : b.fonte),
    el('b', {}, typeof b === 'string' ? '' : formatarValor(b.valor)),
  ));
  const corpo = el('div', { class: 'breakdown' },
    ...lines,
    final !== undefined ? el('div', { class: 'line' }, el('b', {}, 'RESULTADO'), el('b', {}, String(final))) : '',
  );
  modal(titulo, corpo);
}

export function formatarValor(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return String(v);
}

export function modal(titulo, conteudo, opts = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const m = el('div', { class: 'modal-back', onclick: e => { if (e.target === m) close(); } },
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      el('button', { class: 'btn small ghost close', 'aria-label': 'Fechar', onclick: close }, '✕'),
      el('h3', {}, titulo),
      conteudo,
      opts.acoes ? el('div', { class: 'btn-row' }, ...opts.acoes) : '',
    ));
  root.append(m);
  document.addEventListener('keydown', esc);
  return { close, modal: m };
}

export function toast(msg, tipo = '') {
  const root = document.getElementById('toast-root');
  const t = el('div', { class: `toast ${tipo}` }, msg);
  root.append(t);
  setTimeout(() => t.remove(), 4200);
}

export function confirmar(titulo, texto, aoConfirmar) {
  modal(titulo, el('p', {}, texto), {
    acoes: [
      el('button', { class: 'btn danger', onclick: () => { document.querySelector('.modal-back').remove(); aoConfirmar(); } }, 'Confirmar'),
      el('button', { class: 'btn ghost', onclick: () => document.querySelector('.modal-back').remove() }, 'Cancelar'),
    ],
  });
}

/** Baixa arquivo (JSON, PNG...). */
export function baixar(nome, conteudo, mime = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime });
  const a = el('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Renderiza dados 3d visualmente. */
export function dadosVisual(rolls, { crit = false, fail = false } = {}) {
  return el('span', { class: 'dice-visual' },
    rolls.map(r => el('span', { class: `die${crit ? ' crit' : ''}${fail ? ' fail' : ''}` }, String(r))));
}

export function requisitoBadge(ok, motivo) {
  return el('span', {
    class: `pill ${ok ? 'ok' : 'bad'}`,
    title: motivo || '',
  }, ok ? '✓ ' + (motivo || 'atendido') : '✗ ' + (motivo || 'não atendido'));
}

export function vazio(msg) {
  return el('div', { class: 'row', style: 'justify-content:center;color:var(--ink-dim)' }, msg);
}
