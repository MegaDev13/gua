/* Aba HISTÓRICO — registro de eventos, XP e anotações de sessão. */
import { el, toast } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';

const ICONES = { criacao: '✨', compra: '💰', venda: '🏷️', xp: '⭐', sessao: '📝', export: '⬇', import: '⬆', dano: '🗡️' };

export function renderHistorico(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);

  const xpQtd = el('input', { type: 'number', min: 1, value: 5, style: 'width:80px' });
  const xpMotivo = el('input', { type: 'text', placeholder: 'ex.: Derrotou o bandido na ponte', style: 'flex:1' });
  const nota = el('input', { type: 'text', placeholder: 'Anotação livre da sessão…', style: 'flex:1' });

  const lista = el('div', { class: 'list' });
  function desenhar() {
    lista.innerHTML = '';
    const h = store.atual.historico || [];
    if (!h.length) lista.append(el('div', { class: 'row' }, 'Nada registrado ainda.'));
    for (const e of h.slice(0, 200)) {
      const d = new Date(e.quando);
      lista.append(el('div', { class: 'row' },
        el('span', {}, ICONES[e.tipo] || '•'),
        el('span', { class: 'grow' }, e.texto),
        el('span', { class: 'meta' }, `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)));
    }
  }

  main.append(
    el('h1', { class: 'page-title' }, '🗂️ Histórico', el('small', {}, `${pc.nome || ''}`)),
    el('div', { class: 'grid cols-2' },
      el('div', { class: 'panel' },
        el('h3', {}, 'Pontos de experiência'),
        el('p', {}, 'Total: ', el('b', {}, String(snap.contagem.total)), ' · extras ganhos: ', el('b', {}, String(pc.pontos.extrasGanhos || 0)), ' · disponíveis: ', el('b', {}, String(snap.contagem.disponiveis))),
        el('div', { class: 'btn-row' },
          xpQtd, el('span', { class: 'label' }, 'pts'), xpMotivo,
          el('button', { class: 'btn primary', onclick: () => {
            const q = Math.max(1, parseInt(xpQtd.value, 10) || 1);
            const motivo = xpMotivo.value.trim();
            store.update(p => p.pontos.extrasGanhos = (p.pontos.extrasGanhos || 0) + q);
            store.historico('xp', `Ganhou ${q} ponto(s) de experiência${motivo ? ' — ' + motivo : ''}.`);
            xpMotivo.value = '';
            toast(`+${q} XP registrado.`, 'ok');
          } }, '⭐ Registrar XP')),
        el('p', { class: 'fonte' }, 'Evolução pós-criação de perícias/atributos: REGRA NÃO DEFINIDA no material fornecido — os pontos podem ser registrados aqui e gastos normalmente pelas abas.'),
      ),
      el('div', { class: 'panel' },
        el('h3', {}, 'Anotação de sessão'),
        el('div', { class: 'btn-row' },
          nota,
          el('button', { class: 'btn', onclick: () => {
            const t = nota.value.trim();
            if (!t) return;
            store.historico('sessao', t);
            nota.value = '';
          } }, '📝 Anotar')),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn danger', onclick: () => store.update(p => p.historico = [{ quando: new Date().toISOString(), tipo: 'criacao', texto: 'Histórico limpo.' }]) }, '🗑 Limpar histórico')),
      ),
    ),
    el('div', { class: 'panel', style: 'margin-top:.9rem' }, el('h3', {}, 'Registro'), lista),
  );
  desenhar();
  store.subscribe && null;
}
