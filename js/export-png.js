/* GAU — Exportação PNG da ficha via html2canvas
   FIX: createPattern com canvas 0x0 — ocorre com backgrounds complexos
   Solução: clona elemento limpo, remove efeitos problemáticos, tenta múltiplas estratégias
*/

export async function exportarPNGFicha(elemento, nomeArquivo) {
  if (!window.html2canvas) {
    alert('html2canvas não carregado. Verifique conexão com internet (CDN).');
    return;
  }

  const fileName = nomeArquivo || `GAU_ficha_${Date.now()}.png`;

  // Garante que elemento está visível e tem tamanho
  if (!elemento || elemento.offsetWidth === 0 || elemento.offsetHeight === 0) {
    alert('Ficha não está visível para exportar. Abra a ficha completa primeiro.');
    return;
  }

  // Mostra toast de progresso se disponível
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

  showProgress('📸 Preparando ficha para PNG...');

  try {
    // Estratégia 1: captura direta com fundo sólido e onclone limpando efeitos problemáticos
    const canvas = await window.html2canvas(elemento, {
      backgroundColor: '#1e1b14', // fundo sólido evita createPattern com null
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      // Remove elementos que causam problema no clone
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elemento.id);
        if (!clonedEl) return;

        // Remove backdrop, modals, toasts do clone
        clonedDoc.querySelectorAll('.sidebar-backdrop, .modal-back, #toast-root, #pngProgress, .topbar, .sidebar').forEach(el => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });

        // Força fundo sólido e remove filtros problemáticos
        clonedEl.style.background = '#1e1b14';
        clonedEl.style.backgroundImage = 'none';
        clonedEl.style.backdropFilter = 'none';
        clonedEl.style.filter = 'none';
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.transform = 'none';

        // Limpa pseudo-elementos problemáticos via style tag
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

        // Garante que todos os canvas internos tenham tamanho
        clonedDoc.querySelectorAll('canvas').forEach(c => {
          if (c.width === 0 || c.height === 0) {
            c.width = 100;
            c.height = 20;
          }
        });
      }
    });

    hideProgress();
    showProgress('💾 Baixando PNG...');

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(hideProgress, 1500);

    // Toast de sucesso se disponível
    if (window.toast) window.toast('PNG exportado!', 'ok');
    else console.log('PNG exportado', fileName);

  } catch (e) {
    console.error('Erro export PNG tentativa 1', e);
    hideProgress();

    // Estratégia 2: tenta com scale 1 e background branco (mais compatível)
    try {
      showProgress('🔄 Tentando método alternativo...');
      const canvas2 = await window.html2canvas(elemento, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(elemento.id);
          if (clonedEl) {
            clonedEl.style.background = '#ffffff';
            clonedEl.style.color = '#000000';
            clonedEl.style.backgroundImage = 'none';
            clonedEl.style.boxShadow = 'none';
            clonedEl.style.filter = 'none';
            clonedEl.style.backdropFilter = 'none';
          }
          clonedDoc.querySelectorAll('.sidebar-backdrop, .modal-back, #toast-root, #pngProgress').forEach(el => el.remove());
          const style = clonedDoc.createElement('style');
          style.textContent = `* { backdrop-filter:none !important; filter:none !important; box-shadow:none !important; } *::before, *::after { display:none !important; }`;
          clonedDoc.head.appendChild(style);
        }
      });

      const url = canvas2.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      hideProgress();
      if (window.toast) window.toast('PNG exportado (modo compatibilidade)', 'ok');

    } catch (e2) {
      console.error('Erro export PNG tentativa 2', e2);
      hideProgress();
      alert(`Falha ao exportar PNG: ${e.message}\n\nDica: Tente exportar PDF (mais estável) ou use Ctrl+P → Salvar como PDF.\nSe persistir, tire print da tela.`);
    }
  }
}

export async function exportarPNGElementoPorId(id, nome) {
  const el = document.getElementById(id);
  if (!el) { alert('Elemento não encontrado: ' + id); return; }
  return exportarPNGFicha(el, nome);
}
