/* GUA UI — Exportação da ficha: PDF (impressão do navegador) e PNG (canvas).
 * Sem dependências externas; sem fórmulas — só valores já calculados pelo engine.
 */
import { el, fmtMoney, fmtKg } from './ui.js';

/** Ficha completa para impressão/PDF (o diálogo do navegador salva como PDF). */
export function exportarPDF(snap) {
  const pc = snap._pc;
  const antigo = document.getElementById('ficha-print');
  if (antigo) antigo.remove();

  const f = el('div', { id: 'ficha-print' },
    el('h1', {}, `Ficha de Personagem — ${pc.nome || 'Sem nome'}`),
    el('p', { class: 'sub' }, [pc.conceito, pc.jogador && `Jogador: ${pc.jogador}`].filter(Boolean).join(' · ')),

    sec('Atributos',
      linha('Força (ST)', pc.atributos.ST), linha('Destreza (DX)', pc.atributos.DX),
      linha('Inteligência (IQ)', pc.atributos.IQ), linha('Vitalidade (HT)', pc.atributos.HT),
      linha('Velocidade Básica', snap.velocidadeBasica), linha('Deslocamento', snap.deslocamento.valor),
      linha('Esquiva', snap.esquiva), linha('Carga', `${snap.carga.nome} (${fmtKg(snap.carga.peso.kg)})`),
      linha('Dano básico', `${snap.danoBasico.gdp} GDP / ${snap.danoBasico.bal} Bal`),
      linha('Defesa Passiva', `DP ${snap.defesaPassiva.dp} / RD ${snap.defesaPassiva.rd}`)),

    sec('Pontos',
      linha('Total', snap.contagem.total), linha('Gastos', snap.contagem.gastos),
      linha('Disponíveis', snap.contagem.disponiveis),
      linha('Dinheiro', fmtMoney(pc.riqueza?.dinheiro))),

    sec('Perícias',
      tabela([['Perícia', 'Nível', 'Pts']], snap.pericias
        .filter(p => p.nivelEfetivo !== null)
        .map(p => [p.nome, p.nivelEfetivo, p.custo ?? p.entry?.pontos ?? '—']))),

    sec('Vantagens', lista((pc.vantagens || []).map(v => v.nome || v.id))
      , secInline('Desvantagens', lista((pc.desvantagens || []).map(v => v.nome || v.id))),
      secInline('Peculiaridades', lista(pc.peculiaridades || []))),

    sec('Magias',
      tabela([['Magia', 'NH', 'Pts']], snap.magias
        .filter(m => m.nivel !== null && m.nivel !== undefined)
        .map(m => [m.spell?.nome || m.entry.id, m.nivel, m.entry.pontos]))),

    sec('Equipamento',
      tabela([['Item', 'Qtd', 'Peso', 'Notas']], (pc.inventario || [])
        .filter(i => !i.armazenado)
        .map(i => [i.nome + (i.equipado ? ' (equipado)' : ''), i.qtd || 1, i.peso ? fmtKg(i.peso) : '—',
          [i.dp !== undefined ? `DP ${i.dp}` : '', i.rd !== undefined ? `RD ${i.rd}` : '', i.dano || ''].filter(Boolean).join(' ')]))),
  );

  f.style.display = 'none';
  document.body.append(f);
  requestAnimationFrame(() => {
    const limpar = () => { f.remove(); window.removeEventListener('afterprint', limpar); };
    window.addEventListener('afterprint', limpar);
    window.print();
  });
}

/** Ficha resumida em PNG (canvas local, sem servidor). */
export async function exportarPNG(snap) {
  const pc = snap._pc;
  const W = 900, PAD = 46, LH = 26;
  const pericias = snap.pericias.filter(p => p.nivelEfetivo !== null).slice(0, 12);
  const linhas = (pc.inventario || []).filter(i => !i.armazenado).slice(0, 8);
  const H = PAD * 2 + 150 + 210 + Math.max(pericias.length * LH + 40, linhas.length * LH + 40) + 120;

  const canvas = document.createElement('canvas');
  canvas.width = W * 2; canvas.height = H * 2; // 2x p/ nitidez
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // fundo + moldura
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1512'); g.addColorStop(1, '#120806');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.5; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = 'rgba(201,162,39,.4)'; ctx.lineWidth = 1; ctx.strokeRect(22, 22, W - 44, H - 44);

  const ouro = '#f4d58d', claro = '#efe6d5', dim = '#b9a98f';
  ctx.textBaseline = 'top';

  // título
  ctx.fillStyle = ouro; ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText((pc.nome || 'Sem nome').toUpperCase(), PAD, PAD + 6);
  ctx.fillStyle = dim; ctx.font = '14px Georgia, serif';
  ctx.fillText([pc.conceito, `pontos: ${snap.contagem.total} (disp. ${snap.contagem.disponiveis})`].filter(Boolean).join('  ·  '), PAD, PAD + 44);

  // caixa de atributos
  const caixa = (x, y, w, h, titulo, valor) => {
    ctx.strokeStyle = 'rgba(201,162,39,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = dim; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(titulo.toUpperCase(), x + 10, y + 8);
    ctx.fillStyle = claro; ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(String(valor), x + 10, y + 22);
  };
  const y0 = PAD + 74;
  caixa(PAD, y0, 120, 62, 'ST', pc.atributos.ST);
  caixa(PAD + 130, y0, 120, 62, 'DX', pc.atributos.DX);
  caixa(PAD + 260, y0, 120, 62, 'IQ', pc.atributos.IQ);
  caixa(PAD + 390, y0, 120, 62, 'HT', pc.atributos.HT);
  caixa(PAD + 520, y0, 120, 62, 'Desloc.', snap.deslocamento.valor);
  caixa(PAD + 650, y0, 146, 62, 'Esquiva', snap.esquiva);

  // secundários
  const y1 = y0 + 86;
  ctx.fillStyle = dim; ctx.font = '13px system-ui, sans-serif';
  const sec = [
    `Velocidade ${snap.velocidadeBasica}   Dano ${snap.danoBasico.gdp}/${snap.danoBasico.bal}`,
    `Carga: ${snap.carga.nome} (${fmtKg(snap.carga.peso.kg)})`,
    `DP ${snap.defesaPassiva.dp} / RD ${snap.defesaPassiva.rd}   HT atual ${snap.combate.htAtual}   ST ${snap.combate.stEfetiva}/${pc.atributos.ST}`,
    `Dinheiro ${fmtMoney(pc.riqueza?.dinheiro)}`,
  ].join('\n');
  ctx.fillStyle = claro; ctx.font = '14px system-ui, sans-serif';
  sec.split('\n').forEach((l, i) => ctx.fillText(l, PAD, y1 + i * 22));

  // perícias
  const yP = y1 + 4 * 22 + 18;
  ctx.fillStyle = ouro; ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('Perícias', PAD, yP);
  ctx.fillStyle = claro; ctx.font = '13px system-ui, sans-serif';
  pericias.forEach((p, i) => {
    const y = yP + 26 + i * LH;
    ctx.fillText(p.nome, PAD, y);
    ctx.fillStyle = ouro; ctx.fillText(String(p.nivelEfetivo), W - PAD - 30, y);
    ctx.fillStyle = claro;
  });
  if (pericias.length === 12 && snap.pericias.length > 12) {
    ctx.fillStyle = dim; ctx.fillText(`… +${snap.pericias.length - 12} (ver ficha completa)`, PAD, yP + 26 + 12 * LH);
    ctx.fillStyle = claro;
  }

  // equipamento
  const yE = yP + 26 + Math.max(pericias.length, 1) * LH + 24;
  ctx.fillStyle = ouro; ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('Equipamento', PAD, yE);
  ctx.fillStyle = claro; ctx.font = '13px system-ui, sans-serif';
  linhas.forEach((i, idx) => {
    ctx.fillText(`${(i.qtd || 1) > 1 ? i.qtd + '× ' : ''}${i.nome}${i.equipado ? ' ✓' : ''}`, PAD, yE + 26 + idx * LH);
  });

  // rodapé
  ctx.fillStyle = dim; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('GUA — Ecossistema Digital · valores calculados pelo Rule Engine · ' + new Date().toLocaleDateString('pt-BR'), PAD, H - PAD + 4);

  // download
  const a = document.createElement('a');
  a.download = `${(pc.nome || 'personagem').replace(/\s+/g, '-').toLowerCase()}-ficha.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/* ---------------------------------------------------------------- helpers lociais (só layout) */
function sec(titulo, ...filhos) { return el('div', { class: 'print-sec' }, el('h2', {}, titulo), ...filhos); }
function secInline(titulo, ...filhos) { return el('div', { class: 'print-sec inline' }, el('h3', {}, titulo), ...filhos); }
function linha(k, v) { return el('div', { class: 'print-line' }, el('b', {}, k + ': '), el('span', {}, String(v))); }
function lista(itens) {
  return itens.length ? el('ul', {}, itens.map(i => el('li', {}, String(i)))) : el('p', { class: 'sub' }, '— nenhuma —');
}
function tabela(cabecalho, linhas) {
  if (!linhas.length) return el('p', { class: 'sub' }, '— nenhuma —');
  const t = el('table', { class: 'print-tbl' }, el('tr', {}, cabecalho[0].map(h => el('th', {}, h))));
  for (const l of linhas) t.append(el('tr', {}, l.map(c => el('td', {}, String(c ?? '—')))));
  return t;
}
