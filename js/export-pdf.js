/* GAU — Exportação PDF da ficha com design bonito
   Visual: grimório dourado + pergaminho, tipografia elegante
*/

import { el } from './ui.js';

export async function exportarPDFFicha(computed, db) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    // fallback print bonito
    const printEl = document.getElementById('ficha-print');
    if (!printEl) { alert('jsPDF não carregado — verifique conexão'); return; }
    printEl.innerHTML = '';
    printEl.append(renderFichaPrintBonita(computed, db));
    window.print();
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Cores tema GAU
  const colors = {
    bgDark: [30, 27, 20],
    bg2: [42, 36, 24],
    gold: [201, 165, 92],
    gold2: [232, 205, 143],
    gold3: [244, 230, 194],
    ink: [239, 230, 210],
    inkDim: [183, 168, 136],
    accent: [156, 43, 35],
    border: [61, 53, 36],
    panel: [45, 38, 28],
    white: [255, 255, 255],
    black: [20, 15, 10]
  };

  // Helpers
  const checkPage = (needed = 20) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = margin;
      // linha topo nova página
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
      return true;
    }
    return false;
  };

  const addOrnament = (yPos, text = '◈ ───────────────────────── ◈') => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...colors.gold);
    doc.text(text, pageW / 2, yPos, { align: 'center' });
  };

  const addSectionTitle = (icon, title, subtitle = '') => {
    checkPage(18);
    // fundo dourado suave
    doc.setFillColor(...colors.bg2);
    doc.setDrawColor(...colors.gold);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.gold2);
    doc.text(`${icon}  ${title.toUpperCase()}`, margin + 3, y + 6.5);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colors.inkDim);
      doc.text(subtitle, pageW - margin - 3, y + 6.5, { align: 'right' });
    }
    y += 14;
  };

  const addText = (text, size = 9, opts = {}) => {
    const { bold = false, color = colors.black, indent = 0, spacing = 1.4 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW - indent);
    const lineH = size * 0.48 * spacing;
    for (let i = 0; i < lines.length; i++) {
      if (checkPage(lineH + 2)) {
        // se quebrou página, reposiciona
      }
      doc.text(lines[i], margin + indent, y);
      y += lineH;
    }
    y += 1;
  };

  const addKeyValue = (key, value, size = 9) => {
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(...colors.bgDark);
    const keyW = doc.getTextWidth(key + ' ');
    doc.text(key + ' ', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.black);
    const valLines = doc.splitTextToSize(value, contentW - keyW - 2);
    doc.text(valLines[0], margin + keyW, y);
    y += 5;
    for (let i = 1; i < valLines.length; i++) {
      checkPage(5);
      doc.text(valLines[i], margin, y);
      y += 5;
    }
  };

  const addStatGrid = (stats) => {
    // stats = [{label, value, hint}]
    const cols = 3;
    const colW = contentW / cols;
    const rowH = 18;
    checkPage(rowH + 4);
    const startY = y;
    for (let i = 0; i < stats.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * colW;
      const yy = startY + row * rowH;
      if (yy + rowH > pageH - 18) continue; // checkPage já tratou

      // caixa
      doc.setFillColor(252, 248, 236);
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(x + 1, yy, colW - 2, rowH - 2, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.inkDim);
      doc.text(stats[i].label.toUpperCase(), x + 3, yy + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.bgDark);
      doc.text(String(stats[i].value), x + 3, yy + 11);

      if (stats[i].hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 110, 90);
        doc.text(String(stats[i].hint).slice(0, 35), x + 3, yy + 14.5);
      }
    }
    y = startY + Math.ceil(stats.length / cols) * rowH + 4;
  };

  const addTable = (headers, rows) => {
    const colCount = headers.length;
    const colW = contentW / colCount;
    const rowH = 7;

    // header
    checkPage(rowH + 2);
    doc.setFillColor(...colors.bgDark);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...colors.gold2);
    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), margin + i * colW + 2, y + 4.5);
    });
    y += rowH;

    // rows
    rows.forEach((row, idx) => {
      checkPage(rowH);
      if (idx % 2 === 0) {
        doc.setFillColor(252, 248, 236);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colors.black);
      row.forEach((cell, i) => {
        const txt = String(cell || '').slice(0, 40);
        doc.text(txt, margin + i * colW + 2, y + 4.5);
      });
      y += rowH;
    });
    y += 3;
  };

  // ================= CAPA / HEADER =================
  // Fundo header escuro com borda dourada
  doc.setFillColor(...colors.bgDark);
  doc.rect(0, 0, pageW, 38, 'F');
  // linha dourada inferior
  doc.setFillColor(...colors.gold);
  doc.rect(0, 38, pageW, 1.2, 'F');
  // linha fina dourada superior
  doc.setFillColor(...colors.gold2);
  doc.rect(0, 0, pageW, 0.8, 'F');

  // Ornamento canto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(...colors.gold);
  doc.text('❧', margin, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...colors.gold2);
  doc.text('GAU', margin + 8, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...colors.gold);
  doc.text('GRIMÓRIO • SISTEMA UNIVERSAL', margin + 8, 16);

  // Nome personagem grande
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...colors.ink);
  const nomeLines = doc.splitTextToSize(computed.identidade.nome || 'Sem Nome', contentW - 30);
  doc.text(nomeLines[0], margin, 26);
  if (nomeLines.length > 1) {
    doc.setFontSize(12);
    doc.text(nomeLines.slice(1).join(' ').slice(0, 60), margin, 31);
  }

  // Conceito e categoria à direita
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...colors.inkDim);
  const rightX = pageW - margin;
  doc.text(computed.identidade.conceito || 'Sem conceito', rightX, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...colors.gold2);
  doc.text(`${computed.identidade.categoria.nome} • ${computed.identidade.categoria.dados}`, rightX, 19, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...colors.inkDim);
  doc.text(`Jogador: ${computed.identidade.jogador || '—'} • ${new Date().toLocaleDateString('pt-BR')}`, rightX, 23, { align: 'right' });

  y = 46;

  // Barra de destaque com ST DX IQ HT
  doc.setFillColor(...colors.panel);
  doc.setDrawColor(...colors.gold);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...colors.gold2);
  const attrsText = Object.entries(computed.atributos.margens).filter(([k,v])=>v).map(([k,v])=>`${k} ${v.valor}`).join('   •   ');
  doc.text(attrsText, pageW/2, y+6.5, { align: 'center' });
  y += 14;

  // ================= ATRIBUTOS =================
  addSectionTitle('💪', 'Atributos & Margens', 'Margem 10 = humano comum (8–12, crítico 10)');
  const attrStats = Object.entries(computed.atributos.margens).filter(([k,v])=>v).map(([k,v]) => ({
    label: k,
    value: `${v.valor} [${v.margemTexto}]`,
    hint: `Crítico ${v.critico} • ${v.descricao}`
  }));
  // Adiciona Vontade e Percepção se existirem
  if (computed.atributos.vontade) attrStats.push({ label: 'Vontade', value: computed.atributos.vontade.valor, hint: `Margem ${computed.atributos.vontade.margem?.margemTexto || '—'}` });
  if (computed.atributos.percepcao) attrStats.push({ label: 'Percepção', value: computed.atributos.percepcao.valor, hint: `Margem ${computed.atributos.percepcao.margem?.margemTexto || '—'}` });
  addStatGrid(attrStats);

  // ================= DERIVADOS =================
  addSectionTitle('📊', 'Derivados & Carga');
  const der = computed.derivados;
  addStatGrid([
    { label: 'Deslocamento Base', value: `${der.deslocamento.base} m/s`, hint: 'Sem carga' },
    { label: 'Deslocamento Atual', value: `${der.deslocamento.atual} m/s`, hint: `${der.deslocamento.carga.nome}` },
    { label: 'Carga Atual', value: der.deslocamento.carga.nome, hint: `${der.pesoEquip.toFixed(1)}kg / ${der.deslocamento.carga.limites?.max || '?'}kg` },
    { label: 'PF (Fadiga)', value: `${der.pf.atual}/${der.pf.max}`, hint: `Base ${der.pf.max}` },
    { label: 'PV (Vida)', value: `${der.pv.atual}/${der.pv.max}`, hint: `Base ${der.pv.max}` },
    { label: 'Levantamento', value: `${der.levantamento.umaMao}/${der.levantamento.duasMaos}/${der.levantamento.costas}kg`, hint: '1 mão / 2 mãos / Costas' },
  ]);

  // ================= PERÍCIAS =================
  if (computed.pericias.length) {
    addSectionTitle('📜', `Perícias (${computed.pericias.length})`);
    const rows = computed.pericias.map(p => [p.nome, p.atributoBase || '—', String(p.valor), p.margemTexto || '—', (p.descricao || '').slice(0,30)]);
    addTable(['Nome', 'Base', 'Valor', 'Margem', 'Descrição'], rows);
  }

  // ================= PODERES =================
  if (computed.poderes && computed.poderes.length) {
    addSectionTitle('🧠', `Poderes Psíquicos (${computed.poderes.length})`, `${computed.custoPoderes || 0} pts em poderes`);
    for (const p of computed.poderes) {
      checkPage(14);
      doc.setFillColor(...colors.bg2);
      doc.setDrawColor(...colors.gold);
      doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...colors.gold2);
      doc.text(`${p.nome} (${p.sigla}) — Pot ${p.potencia} — ${p.custoPot} pts — Alc ${p.alcance}`, margin + 2, y + 5.5);
      y += 12;
      const rows = p.pericias.map(per => [per.nome, String(per.nivel), per.margemTexto || '—', (per.descricao || '').slice(0,35)]);
      addTable(['Perícia', 'Nível', 'Margem', 'Descrição'], rows);
    }
  }

  // ================= MANOBRAS =================
  if (computed.manobras.length) {
    addSectionTitle('⚔️', `Manobras (${computed.manobras.length})`, 'Estilo de combate');
    checkPage(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.black);
    // Chips como texto com bullets dourados
    const manobrasText = computed.manobras.join('  •  ');
    const lines = doc.splitTextToSize(manobrasText, contentW);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;
  }

  // ================= EMPUNHADURA =================
  if (computed.empunhadura) {
    addSectionTitle('🤲', 'Empunhadura');
    doc.setFillColor(252, 248, 236);
    doc.setDrawColor(...colors.gold);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.bgDark);
    doc.text(computed.empunhadura.nome, margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.gold);
    doc.text(`${computed.empunhadura.especialidade} • ${computed.empunhadura.vantagem}`, margin + 3, y + 9);
    doc.setFontSize(7.5);
    doc.setTextColor(80, 70, 60);
    const descLines = doc.splitTextToSize(computed.empunhadura.descricao || '', contentW - 6);
    doc.text(descLines[0] || '', margin + 3, y + 13);
    y += 22;
  }

  // ================= EQUIPAMENTOS =================
  if (computed.equipamentos.length) {
    addSectionTitle('🛡️', `Equipamentos (${computed.equipamentos.length})`, `Peso total ${der.pesoEquip.toFixed(1)}kg`);
    const rows = computed.equipamentos.map(eq => [
      eq.nome,
      eq.dano || '—',
      eq.media ? String(eq.media) : '—',
      eq.categoria || '—',
      eq.peso ? `${eq.peso}kg` : '—',
      (eq.caracteristica || '').slice(0,20)
    ]);
    addTable(['Nome', 'Dano', 'Média', 'Cat', 'Peso', 'Característica'], rows);
  }

  // ================= HISTÓRIA =================
  if (computed.identidade.historia) {
    addSectionTitle('📖', 'História & Anotações');
    doc.setFillColor(253, 250, 240);
    doc.setDrawColor(...colors.border);
    doc.roundedRect(margin, y, contentW, 4, 1, 1, 'F');
    y += 2;
    addText(computed.identidade.historia, 9, { color: [60, 50, 40], spacing: 1.5 });
    y += 4;
  }

  // ================= VALIDAÇÃO =================
  addSectionTitle('✅', 'Validação');
  if (computed.validacao.erros.length === 0 && computed.validacao.avisos.length === 0) {
    doc.setFillColor(230, 245, 220);
    doc.setDrawColor(100, 160, 80);
    doc.roundedRect(margin, y, contentW, 8, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 100, 40);
    doc.text('✅ Ficha válida! Pronta para aventura.', margin + 3, y + 5);
    y += 12;
  } else {
    for (const e of computed.validacao.erros) {
      checkPage(8);
      doc.setFillColor(250, 220, 215);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 40, 30);
      doc.text(`⛔ ${e.msg}`.slice(0, 110), margin + 2, y + 4.5);
      y += 9;
    }
    for (const a of computed.validacao.avisos) {
      checkPage(8);
      doc.setFillColor(255, 240, 200);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 80, 20);
      doc.text(`⚠️ ${a.msg}`.slice(0, 110), margin + 2, y + 4.5);
      y += 9;
    }
  }

  // ================= RODAPÉ =================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // linha footer
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...colors.inkDim);
    doc.text(`GAU v2.0 — Grimório Digital — ${computed.identidade.nome} — Margem 10 = humano comum — Gerado ${new Date().toLocaleDateString('pt-BR')}`, margin, pageH - 8);
    doc.text(`p. ${i}/${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
    // ornamento footer
    doc.setFontSize(8);
    doc.setTextColor(...colors.gold);
    doc.text('❧', pageW/2, pageH - 8, { align: 'center' });
  }

  doc.save(`GAU_${(computed.identidade.nome || 'personagem').replace(/\s+/g,'_')}_ficha.pdf`);
}

function renderFichaPrintBonita(computed, db) {
  const wrap = el('div', { style: 'font-family:Georgia,serif;color:#000;padding:1rem;max-width:800px;margin:auto;background:#fffaf0;border:2px solid #c9a55c' },
    el('div', { style: 'background:#1e1b14;color:#e8cd8f;padding:1rem 1.2rem;border-bottom:3px solid #c9a55c;margin:-1rem -1rem 1rem' },
      el('h1', { style: 'margin:0;font-size:1.8rem;color:#e8cd8f' }, computed.identidade.nome),
      el('div', { style: 'color:#b7a888;font-size:.9rem;margin-top:.3rem' }, `${computed.identidade.conceito} • ${computed.identidade.categoria.nome} • ${computed.identidade.categoria.dados}`)
    ),
    el('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1rem' },
      ...Object.entries(computed.atributos.margens).filter(([k,v])=>v).map(([k,v]) => el('div', { style: 'border:1px solid #d5c6a5;padding:.5rem;border-radius:6px;background:#fff' },
        el('div', { style: 'font-size:.7rem;text-transform:uppercase;color:#8a7d68;font-weight:700' }, k),
        el('div', { style: 'font-size:1.3rem;font-weight:700' }, `${v.valor} [${v.margemTexto}]`),
        el('div', { style: 'font-size:.7rem;color:#6b5d45' }, `Crítico ${v.critico}`)
      ))
    ),
    el('div', { style: 'border-top:2px solid #c9a55c;padding-top:.6rem;margin-top:.8rem' },
      el('h2', { style: 'font-size:1.1rem;color:#8a6d2f;margin:.2rem 0' }, 'Derivados'),
      el('div', {}, `Deslocamento ${computed.derivados.deslocamento.atual} m/s • Carga ${computed.derivados.deslocamento.carga.nome} • PF ${computed.derivados.pf.atual}/${computed.derivados.pf.max} • PV ${computed.derivados.pv.atual}/${computed.derivados.pv.max}`)
    ),
    computed.pericias.length ? el('div', { style: 'border-top:2px solid #c9a55c;padding-top:.6rem;margin-top:.8rem' },
      el('h2', { style: 'font-size:1.1rem;color:#8a6d2f' }, `Perícias (${computed.pericias.length})`),
      el('div', {}, computed.pericias.map(p=>`${p.nome} ${p.valor} [${p.margemTexto}]`).join(' • '))
    ) : '',
    (computed.poderes && computed.poderes.length) ? el('div', { style: 'border-top:2px solid #c9a55c;padding-top:.6rem;margin-top:.8rem' },
      el('h2', { style: 'font-size:1.1rem;color:#8a6d2f' }, `Poderes Psíquicos (${computed.poderes.length}) — ${computed.custoPoderes} pts`),
      el('div', {}, computed.poderes.map(p=>`${p.nome} Pot ${p.potencia} [${p.pericias.map(per=>`${per.nome} ${per.nivel}`).join(', ')}]`).join(' | '))
    ) : '',
    computed.equipamentos.length ? el('div', { style: 'border-top:2px solid #c9a55c;padding-top:.6rem;margin-top:.8rem' },
      el('h2', { style: 'font-size:1.1rem;color:#8a6d2f' }, 'Equipamentos'),
      el('div', {}, computed.equipamentos.map(e=>`${e.nome} ${e.dano||''}`).join(' • '))
    ) : '',
    computed.identidade.historia ? el('div', { style: 'border-top:2px solid #c9a55c;padding-top:.6rem;margin-top:.8rem;white-space:pre-wrap' },
      el('h2', { style: 'font-size:1.1rem;color:#8a6d2f' }, 'História'),
      el('div', {}, computed.identidade.historia)
    ) : ''
  );
  return wrap;
}
