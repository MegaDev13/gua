/* Exportação editorial do livro. PDF usa um documento de impressão dedicado;
 * PNG desenha uma página de leitura em alta resolução, sem capturar menus.
 */
import { el, modal, baixar, toast } from './ui.js';

export function abrirExportacaoLivro({ db, chapters, currentChapter, renderChapter }) {
  const scope = el('select', { 'aria-label': 'Conteúdo do PDF' },
    el('option', { value: 'current' }, 'Capítulo atual'),
    el('option', { value: 'complete' }, 'Livro completo'),
    el('option', { value: 'range' }, 'Intervalo de capítulos'),
    el('option', { value: 'selected' }, 'Capítulos selecionados'));
  const from = chapterSelect(chapters, currentChapter?.id);
  const to = chapterSelect(chapters, currentChapter?.id);
  const selected = el('div', { class: 'book-export-checks' }, chapters.map(chapter => {
    const input = el('input', { type: 'checkbox', value: chapter.id, checked: chapter.id === currentChapter?.id });
    return el('label', {}, input, `${chapter.numero} — ${chapter.titulo}`);
  }));
  const options = el('div', { class: 'book-export-options' });
  const drawOptions = () => {
    options.innerHTML = '';
    if (scope.value === 'range') options.append(
      el('label', { class: 'field' }, 'Do capítulo', from),
      el('label', { class: 'field' }, 'Até o capítulo', to));
    if (scope.value === 'selected') options.append(selected);
  };
  scope.onchange = drawOptions;
  drawOptions();

  const instance = modal('Exportar livro para PDF', el('div', {},
    el('p', {}, 'O arquivo é montado como um livro: sem menus ou botões, com margens, quebras, cabeçalhos, rodapés e tabelas preservadas.'),
    el('label', { class: 'field' }, 'Exportar', scope),
    options,
    el('p', { class: 'fonte' }, 'Na janela de impressão, escolha “Salvar como PDF”. O conteúdo nunca é enviado a um servidor.'),
  ), {
    acoes: [el('button', { class: 'btn primary', onclick: () => {
      let chosen = [];
      if (scope.value === 'complete') chosen = chapters;
      else if (scope.value === 'current') chosen = [currentChapter || chapters[0]];
      else if (scope.value === 'range') {
        const start = chapters.findIndex(chapter => chapter.id === from.value);
        const end = chapters.findIndex(chapter => chapter.id === to.value);
        chosen = chapters.slice(Math.min(start, end), Math.max(start, end) + 1);
      } else {
        const ids = [...selected.querySelectorAll('input:checked')].map(input => input.value);
        chosen = chapters.filter(chapter => ids.includes(chapter.id));
      }
      if (!chosen.length) { toast('Selecione ao menos um capítulo.', 'bad'); return; }
      instance.close();
      printBook(db, chosen, renderChapter);
    } }, 'Preparar PDF')],
  });
}

function chapterSelect(chapters, selected) {
  return el('select', {}, chapters.map(chapter => el('option', { value: chapter.id, selected: chapter.id === selected }, `${chapter.numero} — ${chapter.titulo}`)));
}

function printBook(db, chapters, renderChapter) {
  document.getElementById('book-print')?.remove();
  const root = el('div', { id: 'book-print' },
    el('section', { class: 'book-print-cover' },
      el('img', { src: db.book.capa || 'book/images/capa.svg', alt: '' }),
      el('p', { class: 'book-print-kicker' }, db.book.edicao || ''),
      el('h1', {}, db.book.titulo || 'GUA'),
      el('h2', {}, db.book.subtitulo || 'Livro de Regras Digital'),
      el('p', {}, db.book.descricao || ''),
      el('small', {}, `Versão ${db.book.versao || db.rules?.versao || '1'}`)),
  );
  for (const chapter of chapters) {
    const article = el('article', { class: 'book-print-chapter book-page' });
    renderChapter(article, chapter, db, { print: true });
    root.append(article);
  }
  document.body.append(root);
  document.body.classList.add('printing-book');
  requestAnimationFrame(() => {
    const cleanup = () => {
      root.remove();
      document.body.classList.remove('printing-book');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  });
}

/** Exporta a página/capítulo atual como folha A4 a 2× (aprox. 1654×2338 px). */
export async function exportarPaginaLivroPNG(chapter, article, book) {
  const width = 827, height = 1169, scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) { toast('Seu navegador não oferece exportação por canvas.', 'bad'); return; }
  ctx.scale(scale, scale);

  ctx.fillStyle = '#eee4cf';
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, 650);
  gradient.addColorStop(0, 'rgba(255,255,255,.23)');
  gradient.addColorStop(1, 'rgba(85,50,20,.10)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#8b6934'; ctx.lineWidth = 2; ctx.strokeRect(30, 30, width - 60, height - 60);
  ctx.strokeStyle = 'rgba(139,105,52,.35)'; ctx.lineWidth = 1; ctx.strokeRect(38, 38, width - 76, height - 76);

  const margin = 74;
  ctx.fillStyle = '#72531f'; ctx.textAlign = 'center'; ctx.font = '600 13px Georgia, serif';
  ctx.fillText(`${book.titulo || 'GUA'} · ${book.edicao || ''}`.toUpperCase(), width / 2, 58);
  ctx.fillStyle = '#3b2a1b'; ctx.font = '16px Georgia, serif';
  ctx.fillText(`CAPÍTULO ${chapter.numero}`, width / 2, 98);
  ctx.font = 'bold 38px Georgia, serif';
  const titleLines = wrapText(ctx, chapter.titulo.toUpperCase(), width - margin * 2);
  titleLines.forEach((line, index) => ctx.fillText(line, width / 2, 130 + index * 43));
  let y = 130 + titleLines.length * 43 + 18;
  ctx.fillStyle = '#8b6934'; ctx.fillRect(width / 2 - 54, y, 108, 2); y += 28;

  const blocks = extractReadableBlocks(article);
  ctx.textAlign = 'left';
  for (const block of blocks) {
    const heading = block.kind === 'heading';
    ctx.font = heading ? 'bold 20px Georgia, serif' : '15px Georgia, serif';
    ctx.fillStyle = heading ? '#6e241e' : '#30271d';
    const lines = wrapText(ctx, block.text, width - margin * 2);
    const lineHeight = heading ? 26 : 22;
    if (y + lines.length * lineHeight > height - 78) {
      ctx.fillStyle = '#72531f'; ctx.font = 'italic 13px Georgia, serif';
      ctx.fillText('Continua na edição digital…', margin, height - 88);
      break;
    }
    lines.forEach(line => { ctx.fillText(line, margin, y); y += lineHeight; });
    y += heading ? 8 : 11;
  }

  ctx.textAlign = 'center'; ctx.fillStyle = '#72531f'; ctx.font = '12px Georgia, serif';
  ctx.fillText(`Versão ${book.versao || '1'} · página digital exportada localmente`, width / 2, height - 54);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { toast('Não foi possível gerar a imagem.', 'bad'); return; }
  baixar(`gua-capitulo-${chapter.id}.png`, blob, 'image/png');
  toast('Página PNG exportada em alta resolução.', 'ok');
}

function extractReadableBlocks(article) {
  const nodes = article.querySelectorAll('h2, h3, h4, p, li');
  const blocks = [];
  for (const node of nodes) {
    if (node.closest?.('.book-reader-toolbar, .book-chapter-nav, .no-print')) continue;
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) continue;
    blocks.push({ kind: /^H[234]$/.test(node.tagName) ? 'heading' : 'text', text: text.slice(0, 900) });
    if (blocks.length >= 24) break;
  }
  return blocks;
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) { lines.push(line); line = word; }
    else line = attempt;
  }
  if (line) lines.push(line);
  return lines;
}
