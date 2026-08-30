/* GAU — Exportação PNG da ficha
   FIX: createPattern com canvas 0x0 — html2canvas quebra com gradients complexos
   Estratégias:
   1) html2canvas com limpeza
   2) html2canvas compatibilidade
   3) Fallback manual canvas (sempre funciona) desenhando ficha bonita
*/

export async function exportarPNGFicha(elemento, nomeArquivo) {
  const fileName = nomeArquivo || `GAU_ficha_${Date.now()}.png`;

  if (!elemento || elemento.offsetWidth === 0 || elemento.offsetHeight === 0) {
    alert('Ficha não está visível para exportar. Abra a ficha completa primeiro.');
    return;
  }

  const showProgress = (msg) => {
    let prog = document.getElementById('pngProgress');
    if (!prog) {
      prog = document.createElement('div');
      prog.id = 'pngProgress';
      prog.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e1b14;color:#e8cd8f;padding:.8rem 1.2rem;border-radius:10px;border:1px solid #6b5a36;z-index:9999;font-family:Inter,sans-serif;font-size:.9rem;box-shadow:0 8px 32px rgba(0,0,0,.5)';
      document.body.appendChild(prog);
    }
    prog.textContent = msg;
    prog.style.display = 'block';
  };
  const hideProgress = () => {
    const prog = document.getElementById('pngProgress');
    if (prog) prog.style.display = 'none';
  };

  // Tenta html2canvas se disponível
  if (window.html2canvas) {
    showProgress('📸 Tentando captura visual (método 1)...');
    try {
      const canvas = await window.html2canvas(elemento, {
        backgroundColor: '#1e1b14',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(elemento.id);
          if (!clonedEl) return;
          clonedDoc.querySelectorAll('.sidebar-backdrop, .modal-back, #toast-root, #pngProgress, .topbar, .sidebar, .btn, .no-print').forEach(el => el.remove());
          clonedEl.style.background = '#1e1b14';
          clonedEl.style.backgroundImage = 'none';
          clonedEl.style.backdropFilter = 'none';
          clonedEl.style.filter = 'none';
          clonedEl.style.boxShadow = 'none';
          clonedEl.style.transform = 'none';
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * { backdrop-filter: none !important; filter: none !important; }
            .char-sheet::before, .char-sheet::after, .sheet-header::before, .panel::before { display: none !important; }
            .bar > i::after { display: none !important; animation: none !important; }
            .attr-bar, .bar { background: #2a2418 !important; }
            .attr-bar i, .bar i { background: #c9a55c !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          `;
          clonedDoc.head.appendChild(style);
          clonedDoc.querySelectorAll('canvas').forEach(c => { if (c.width===0||c.height===0){c.width=100;c.height=20;} });
        }
      });
      hideProgress();
      showProgress('💾 Baixando PNG...');
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(hideProgress, 1200);
      return;
    } catch (e) {
      console.warn('PNG método 1 falhou', e);
    }

    showProgress('🔄 Tentando método compatibilidade...');
    try {
      const canvas2 = await window.html2canvas(elemento, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(elemento.id);
          if (clonedEl) {
            clonedEl.style.background='#ffffff'; clonedEl.style.color='#000000';
            clonedEl.style.backgroundImage='none'; clonedEl.style.boxShadow='none';
            clonedEl.style.filter='none'; clonedEl.style.backdropFilter='none';
          }
          clonedDoc.querySelectorAll('.sidebar-backdrop, .modal-back, #toast-root, #pngProgress, .topbar, .sidebar, .btn, .no-print').forEach(el=>el.remove());
          const style = clonedDoc.createElement('style');
          style.textContent=`* { backdrop-filter:none !important; filter:none !important; box-shadow:none !important; } *::before, *::after { display:none !important; }`;
          clonedDoc.head.appendChild(style);
        }
      });
      const url = canvas2.toDataURL('image/png');
      const a = document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
      hideProgress();
      return;
    } catch (e2) {
      console.warn('PNG método 2 falhou', e2);
    }
  }

  // FALLBACK MANUAL — sempre funciona, desenha ficha bonita no canvas
  showProgress('🎨 Gerando PNG manual (fallback garantido)...');
  try {
    await exportarPNGManual(elemento, fileName);
    hideProgress();
  } catch (e3) {
    console.error('PNG fallback falhou', e3);
    hideProgress();
    alert(`Falha ao exportar PNG: ${e3.message}\n\nUse PDF que é mais estável, ou Ctrl+P → Salvar como PDF.`);
  }
}

async function exportarPNGManual(elemento, fileName) {
  // Extrai dados da ficha do DOM
  const nome = elemento.querySelector('.sheet-char-name')?.textContent?.trim() || 'Personagem';
  const conceito = elemento.querySelector('.sheet-char-concept')?.textContent?.trim() || '';
  const meta = elemento.querySelector('.sheet-meta')?.textContent?.trim() || '';
  const sections = [...elemento.querySelectorAll('.sheet-section')].map(sec => {
    const title = sec.querySelector('.sheet-section-header')?.textContent?.trim() || '';
    const body = sec.querySelector('.sheet-section-body')?.innerText?.trim().slice(0, 800) || '';
    return { title, body };
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 900;
  const padding = 30;
  let H = 1200; // estimado, vai crescer

  // Calcula altura necessária aproximada
  const lineHeight = 20;
  let estimatedLines = 20; // header
  sections.forEach(s => {
    estimatedLines += 2 + Math.ceil(s.body.length / 90) + 1;
  });
  H = Math.max(800, 200 + estimatedLines * lineHeight + 100);

  canvas.width = W;
  canvas.height = H;

  // Fundo
  ctx.fillStyle = '#1e1b14';
  ctx.fillRect(0,0,W,H);

  // Borda dourada
  ctx.strokeStyle = '#c9a55c';
  ctx.lineWidth = 3;
  ctx.strokeRect(6,6,W-12,H-12);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(201,165,92,0.3)';
  ctx.strokeRect(14,14,W-28,H-28);

  // Header escuro
  ctx.fillStyle = '#2a2418';
  ctx.fillRect(14,14,W-28,110);

  // Ornamento
  ctx.fillStyle = '#c9a55c';
  ctx.font = 'bold 24px Cinzel, Georgia, serif';
  ctx.fillText('GAU', padding, 50);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#b7a888';
  ctx.fillText('GRIMÓRIO DIGITAL', padding, 68);

  // Nome
  ctx.fillStyle = '#efe6d2';
  ctx.font = 'bold 28px Cinzel, Georgia, serif';
  wrapText(ctx, nome, padding, 95, W - padding*2 - 200, 30);

  // Conceito à direita
  ctx.fillStyle = '#e8cd8f';
  ctx.font = '14px Lora, Georgia, serif';
  ctx.textAlign = 'right';
  wrapText(ctx, conceito, W - padding, 50, 300, 18, true);
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#b7a888';
  wrapText(ctx, meta.slice(0,120), W - padding, 70, 320, 14, true);
  ctx.textAlign = 'left';

  // Linha dourada
  ctx.fillStyle = '#c9a55c';
  ctx.fillRect(padding, 135, W - padding*2, 2);

  let y = 160;

  // Seções
  for (const sec of sections) {
    if (y > H - 100) break;

    // Título seção
    ctx.fillStyle = '#2a2418';
    ctx.fillRect(padding, y, W - padding*2, 28);
    ctx.strokeStyle = '#c9a55c';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, y, W - padding*2, 28);

    ctx.fillStyle = '#e8cd8f';
    ctx.font = 'bold 13px Cinzel, Georgia, serif';
    ctx.fillText(sec.title.toUpperCase().slice(0,80), padding + 10, y + 18);

    y += 38;

    // Corpo
    ctx.fillStyle = '#efe6d2';
    ctx.font = '12px Inter, sans-serif';
    const lines = wrapText(ctx, sec.body, padding + 10, y, W - padding*2 - 20, 16, false, true);
    y += lines * 16 + 16;

    // separador
    ctx.fillStyle = 'rgba(201,165,92,0.2)';
    ctx.fillRect(padding, y, W - padding*2, 1);
    y += 12;
  }

  // Rodapé
  ctx.fillStyle = '#8a7d68';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`GAU v2.0 — ${nome} — Gerado ${new Date().toLocaleDateString('pt-BR')} — GAU Sistema Universal`, W/2, H - 20);
  ctx.textAlign = 'left';

  // Download
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, alignRight = false, countOnly = false) {
  if (!text) return 0;
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  let curY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      if (!countOnly) {
        if (alignRight) ctx.fillText(line.trim(), x, curY, maxWidth);
        else ctx.fillText(line.trim(), x, curY);
      }
      line = words[n] + ' ';
      curY += lineHeight;
      lines++;
      if (curY > ctx.canvas.height - 50) break;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    if (!countOnly) {
      if (alignRight) ctx.fillText(line.trim(), x, curY, maxWidth);
      else ctx.fillText(line.trim(), x, curY);
    }
    lines++;
  }
  return lines;
}

export async function exportarPNGElementoPorId(id, nome) {
  const el = document.getElementById(id);
  if (!el) { alert('Elemento não encontrado: ' + id); return; }
  return exportarPNGFicha(el, nome);
}
