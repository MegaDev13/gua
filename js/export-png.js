/* GAU — Exportação PNG da ficha via html2canvas */

export async function exportarPNGFicha(elemento, nomeArquivo) {
  if (!window.html2canvas) {
    alert('html2canvas não carregado. Verifique conexão.');
    return;
  }
  try {
    const canvas = await window.html2canvas(elemento, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
      width: elemento.scrollWidth,
      height: elemento.scrollHeight
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo || `GAU_ficha_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('Erro ao exportar PNG', e);
    alert('Falha ao exportar PNG: ' + e.message);
  }
}

export async function exportarPNGElementoPorId(id, nome) {
  const el = document.getElementById(id);
  if (!el) { alert('Elemento não encontrado: ' + id); return; }
  return exportarPNGFicha(el, nome);
}
