/* GAU — Exportação PDF da ficha */

import { el } from './ui.js';

export async function exportarPDFFicha(computed, db) {
  // Tenta usar jsPDF se disponível, senão fallback para print
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    // fallback: abre janela de impressão com ficha
    const printEl = document.getElementById('ficha-print');
    if (!printEl) { alert('jsPDF não carregado'); return; }
    printEl.innerHTML = '';
    printEl.append(renderFichaPrint(computed, db));
    window.print();
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  // Helpers
  const addTitle = (text, size = 16) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(40, 33, 19);
    doc.text(text, margin, y);
    y += size * 0.5;
  };
  const addText = (text, size = 10, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(opts.color || 60);
    const lines = doc.splitTextToSize(text, pageW - margin*2);
    if (y + lines.length * size * 0.5 > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(lines, margin, y);
    y += lines.length * size * 0.5 + 2;
  };
  const addLine = () => {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setDrawColor(180, 160, 120);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  // Cabeçalho
  doc.setFillColor(30, 27, 20);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(232, 205, 143);
  doc.text(`GAU — ${computed.identidade.nome}`, margin, 14);
  doc.setFontSize(10);
  doc.setTextColor(183, 168, 136);
  doc.text(`${computed.identidade.conceito || ''} • ${computed.identidade.categoria.nome} • ${computed.identidade.categoria.dados}`, margin, 20);

  y = 36;

  addTitle('Atributos', 13);
  for (const [k, v] of Object.entries(computed.atributos.margens)) {
    if (!v) continue;
    addText(`${k} ${v.valor} — Margem ${v.margemTexto} — Crítico ${v.critico} — ${v.descricao}`, 9);
  }
  addLine();

  addTitle('Derivados', 13);
  addText(`Deslocamento: base ${computed.derivados.deslocamento.base} • atual ${computed.derivados.deslocamento.atual} • Carga ${computed.derivados.deslocamento.carga.nome} (${computed.derivados.deslocamento.carga.peso}kg)`, 9);
  addText(`PF: ${computed.derivados.pf.atual}/${computed.derivados.pf.max} • PV: ${computed.derivados.pv.atual}/${computed.derivados.pv.max}`, 9);
  addText(`Levantamento: 1 mão ${computed.derivados.levantamento.umaMao}kg • 2 mãos ${computed.derivados.levantamento.duasMaos}kg • Costas ${computed.derivados.levantamento.costas}kg`, 9);
  addLine();

  if (computed.pericias.length) {
    addTitle('Perícias', 13);
    for (const p of computed.pericias) {
      addText(`${p.nome} (${p.atributoBase || '—'}) ${p.valor} — Margem ${p.margemTexto} — ${p.descricao || ''}`, 9);
    }
    addLine();
  }

  if (computed.manobras.length) {
    addTitle('Manobras', 13);
    addText(computed.manobras.join(', '), 9);
    addLine();
  }

  if (computed.empunhadura) {
    addTitle('Empunhadura', 13);
    addText(`${computed.empunhadura.nome} — ${computed.empunhadura.especialidade} — ${computed.empunhadura.vantagem}`, 9, {bold:true});
    addText(computed.empunhadura.descricao, 9);
    addLine();
  }

  if (computed.equipamentos.length) {
    addTitle('Equipamentos', 13);
    for (const e of computed.equipamentos) {
      addText(`${e.nome} — ${e.dano || ''} — ${e.caracteristica || ''} — ${e.categoria || ''} ${e.peso ? `• ${e.peso}kg` : ''}`, 9);
    }
    addLine();
  }

  if (computed.identidade.historia) {
    addTitle('História', 13);
    addText(computed.identidade.historia, 9);
  }

  // Rodapé
  const footerY = pageH - 8;
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`GAU v2.0 — Grimório Digital — Gerado em ${new Date().toLocaleString('pt-BR')} — Margem 10 = referência humana`, margin, footerY);

  doc.save(`GAU_${computed.identidade.nome.replace(/\s+/g,'_')}_ficha.pdf`);
}

function renderFichaPrint(computed, db) {
  const wrap = el('div', {},
    el('h1', {}, computed.identidade.nome),
    el('div', { class: 'sub' }, `${computed.identidade.conceito} • ${computed.identidade.categoria.nome} • ${computed.identidade.categoria.dados}`),
    el('div', { class: 'print-sec' },
      el('h2', {}, 'Atributos'),
      ...Object.entries(computed.atributos.margens).map(([k,v]) => v ? el('div', { class: 'print-line' }, `${k} ${v.valor} — Margem ${v.margemTexto} — Crítico ${v.critico}`) : '')
    ),
    el('div', { class: 'print-sec' },
      el('h2', {}, 'Derivados'),
      el('div', { class: 'print-line' }, `Desloc ${computed.derivados.deslocamento.atual} (base ${computed.derivados.deslocamento.base}) • Carga ${computed.derivados.deslocamento.carga.nome} • PF ${computed.derivados.pf.atual}/${computed.derivados.pf.max} • PV ${computed.derivados.pv.atual}/${computed.derivados.pv.max}`)
    )
  );
  return wrap;
}
