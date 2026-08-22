/* Aba PODERES — Magias (p. 300–337) e módulo PODERES (arquitetura pronta, sem invenção).
 * Níveis: IQ mágico = IQ + Aptidão Mágica (máx 3) + Memória Eidética. Mínimo 1 ponto.
 */
import { el, toast, modal, valorCalculado, dadosVisual, requisitoBadge } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { iqMagico, nivelMagia, custoBase, custoManutencao, conjurar, parsePrereqs, reducaoCusto } from '../../engine/spells.js';
import { dice } from '../../engine/combat.js';

const semAcento = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function renderMagias(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const iqM = iqMagico(pc);

  const aptidao = (pc.vantagens || []).find(v => /aptid[aã]o m[aá]gica/i.test(v.nome || '') || v.id === 'aptidao-magica');

  const cabecalho = el('div', { class: 'panel' },
    el('h3', {}, 'Magia (p. 300–314)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'IQ mágico'), valorCalculado(iqM, [
        { fonte: `IQ ${pc.atributos.IQ}` },
        ...(aptidao ? [{ fonte: `Aptidão Mágica nível ${aptidao.niveis || aptidao.nivel || 1}` }] : []),
      ], 'IQ + Aptidão Mágica (máx. 3) + Memória Eidética')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Magias aprendidas'), el('div', { class: 'value' }, String((pc.magias || []).length))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Redução de custo'), el('div', { class: 'value' }, reducaoTxt(snap))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'ST (energia)'), el('div', { class: 'value' }, `${snap.combate.stEfetiva}/${pc.atributos.ST}`)),
    ),
  );

  /* ---------------------------------------- catálogo por escola */
  const busca = el('input', { type: 'search', placeholder: 'Buscar magia…', 'aria-label': 'Buscar magia' });
  const catalogo = el('div', {});
  const minhas = new Set((pc.magias || []).map(m => m.id));
  const nivelDe = id => {
    const e = (pc.magias || []).find(m => m.id === id);
    return e ? nivelMagia(db, pc, e).nivel : null;
  };

  function desenhar() {
    catalogo.innerHTML = '';
    const f = semAcento(busca.value.trim());
    const porEscola = {};
    for (const s of db.spells) {
      if (f && !semAcento(s.nome).includes(f) && !semAcento(s.escola || '').includes(f) && !semAcento(s.descricao || '').includes(f)) continue;
      (porEscola[s.escola || 'Outras'] ||= []).push(s);
    }
    for (const [escola, magias] of Object.entries(porEscola).sort((a, b) => a[0].localeCompare(b[0], 'pt'))) {
      const corpo = el('div', { class: 'list' });
      for (const sp of magias) corpo.append(linhaMagia(sp));
      catalogo.append(el('details', { open: f ? true : false, class: 'panel', style: 'padding:.6rem .9rem' },
        el('summary', { style: 'cursor:pointer;font-weight:600' }, `${escola} (${magias.length})`),
        corpo));
    }
    busca.oninput = desenhar;
  }

  function linhaMagia(sp) {
    const tem = minhas.has(sp.id);
    const nivel = tem ? nivelDe(sp.id) : null;
    const cb = custoBase(sp), cm = custoManutencao(sp);
    const reqs = parsePrereqs(sp);
    const reqStatus = checarPrereqs(reqs, db, pc);
    const aprender = () => store.update(p => {
      const e = (p.magias || []).find(m => m.id === sp.id);
      if (e) e.pontos += 1; else p.magias.push({ id: sp.id, pontos: 1 });
    });
    return el('div', { class: 'row' },
      el('div', { class: 'grow' },
        el('div', { class: 'name' }, sp.nome, tem ? el('span', { class: 'pill ok', style: 'margin-left:.4rem' }, `NH ${nivel}`) : ''),
        el('div', { class: 'meta' },
          [`${sp.classes || ''}`, cb != null ? `custo ${cb}` : 'custo N/D', cm != null ? `manter ${cm}` : '',
           sp.Duração ? `${sp.Duração}` : ''].filter(Boolean).join(' · ')),
        el('div', { class: 'meta fonte' }, (sp.descricao || '').slice(0, 140) + '…'),
        sp['Pré-requisitos'] ? el('div', {}, requisitoBadge(reqStatus.ok, `Pré-req.: ${sp['Pré-requisitos']}`)) : ''),
      el('div', { class: 'btn-row', style: 'margin:0;flex-direction:column;gap:.25rem' },
        el('button', { class: 'btn small', title: 'Investir 1 ponto (mínimo p/ lançar)', onclick: aprender }, tem ? '+1 pt' : 'Aprender (1 pt)'),
        tem ? el('button', { class: 'btn small primary', onclick: () => lancar(sp) }, '✨ Conjurar') : '',
        tem ? el('button', { class: 'btn small danger', title: 'Remover 1 ponto', onclick: () => store.update(p => {
          const e = p.magias.find(m => m.id === sp.id);
          e.pontos -= 1;
          if (e.pontos < 1) p.magias = p.magias.filter(m => m !== e);
        }) }, '−1') : '',
        el('button', { class: 'btn small ghost', onclick: () => detalhar(sp, nivel) }, '👁'),
      ),
    );
  }

  function lancar(sp) {
    const manaSel = el('select', {}, ['Normal', 'Alta', 'Muito Alta', 'Baixa', 'Nula'].map(m => el('option', { value: m }, `Mana ${m}`)));
    const energia = el('input', { type: 'number', min: 0, value: 0, style: 'width:80px' });
    const rolar = el('button', { class: 'btn primary' }, 'Conjurar');
    const saida = el('div', {});
    rolar.onclick = () => {
      const entry = (store.atual.magias || []).find(m => m.id === sp.id);
      const r = conjurar(db, store.atual, entry, { mana: manaSel.value, energiaExtra: parseInt(energia.value, 10) || 0, dice });
      if (r.erro) { toast(r.erro, 'bad'); return; }
      let txt = `NH ${r.nhEfetivo}${r.nivel !== r.nhEfetivo ? ` (base ${r.nivel})` : ''} · custo ${r.custoBase}${r.reducao ? ` −${r.reducao} (NH alto)` : ''}${parseInt(energia.value) ? ` +${energia.value} energia extra` : ''} = <b>${r.custoFinal}</b>`;
      if (r.resultado) txt = `${dadosVisual(r.resultado.rolls, { crit: r.resultado.critico && r.resultado.sucesso, fail: r.resultado.critico && !r.resultado.sucesso })} ${txt}<br>Resultado: <b>${r.resultado.descricao}</b>`;
      txt += `<br>Gasto de energia: <b>${r.gasto}</b> ST`;
      if (r.gasto > 0) {
        store.update(p => {
          const atual = p.combate.fadiga || 0;
          p.combate.fadiga = Math.min(p.atributos.ST, atual + r.gasto);
        });
      }
      r.erros.filter(e => e.aviso).forEach(e => { txt += `<br><span class="pill warn">${e.aviso}</span>`; });
      saida.innerHTML = '';
      saida.append(el('div', { class: 'panel', style: 'margin-top:.6rem' }, el('div', { innerHTML: txt })));
    };
    modal(`Conjurar: ${sp.nome}`, el('div', {},
      el('div', { class: 'btn-row', style: 'margin:0' }, manaSel, el('span', { class: 'label' }, 'Energia extra: '), energia, rolar),
      el('p', { class: 'fonte' }, 'Custo pago em ST (fadiga) ou HT (lesão: −1 NH por ponto). Sucesso decisivo: custo 0. Falha: mínimo 1.'),
      saida,
    ));
  }

  function detalhar(sp, nivel) {
    modal(sp.nome, el('div', {},
      el('p', {}, el('b', {}, `${sp.escola || '?'} · ${sp.classes || '?'}`), nivel !== null ? ` · seu NH: ${nivel}` : ''),
      el('p', {}, sp.descricao || ''),
      el('table', { class: 'tbl' },
        ['Custo', 'Duração', 'Pré-requisitos', 'Objetos'].filter(k => sp[k]).map(k => el('tr', {}, el('td', {}, el('b', {}, k)), el('td', {}, sp[k])))),
      el('p', { class: 'fonte' }, `Fonte: material, ${sp.fonte || ''}`),
    ));
  }

  /* ---------------------------------------- módulo PODERES */
  const poderes = el('div', { class: 'panel' },
    el('h3', {}, 'Módulo PODERES — pronto e vazio'),
    el('p', {}, 'O material fornecido não define poderes (psíquicos, sobrenaturais etc.). A arquitetura é a mesma das magias: catálogo em ', el('code', {}, 'data/spells.json'),
      ' com pré-requisitos, custos e níveis — basta popular ', el('code', {}, 'data/powers.json'), ' e adicionar a aba. Nada foi inventado aqui.'),
    el('p', { class: 'fonte' }, 'O mesmo vale para a LOJA além do equipamento citado: preços não publicados no material = REGRA NÃO DEFINIDA (bloqueio com explicação).'),
  );

  main.append(
    el('h1', { class: 'page-title' }, '✨ Poderes & Magias', el('small', {}, `${db.spells.length} magias do material`)),
    cabecalho,
    el('div', { class: 'panel', style: 'margin-top:.9rem' }, el('h3', {}, 'Grimório'), busca, catalogo),
    poderes,
  );
  desenhar();
}

function reducaoTxt(snap) {
  let max = 0;
  for (const m of (store.atual.magias || [])) {
    const nm = snap.magias.find(x => x.entry === m);
    if (nm && nm.nivel > max) max = nm.nivel;
  }
  const r = reducaoCusto(max);
  return r ? `−${r} (NH ${max})` : 'nenhuma';
}

function checarPrereqs(reqs, db, pc) {
  if (!reqs.length) return { ok: true, detalhes: [] };
  const detalhes = [];
  let ok = true;
  for (const r of reqs) {
    if (r.tipo === 'magia') {
      const tem = (pc.magias || []).some(m => {
        const sp = db.spell(m.id);
        return sp && semAcento(sp.nome).includes(semAcento(r.nome).slice(0, 12));
      });
      if (!tem) { ok = false; detalhes.push(`Falta magia: ${r.nome}`); }
    } else if (r.tipo === 'atributo') {
      if (pc.atributos[r.key] < r.min) { ok = false; detalhes.push(`${r.key} < ${r.min}`); }
    } else if (r.tipo === 'potencial') {
      const ap = (pc.vantagens || []).find(v => /aptid[aã]o m[aá]gica/i.test(v.nome || '') || v.id === 'aptidao-magica');
      if (!ap || (ap.niveis || 1) < r.niveis) { ok = false; detalhes.push(`Aptidão Mágica ${r.niveis}`); }
    }
  }
  return { ok, detalhes };
}
