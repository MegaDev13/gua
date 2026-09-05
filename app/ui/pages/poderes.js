/* Aba PODERES — Construtor Modular de Poderes G.A.U.
 * Fonte: CRIANDO SEUS PODERES (data/poderes.json). O jogador recebe um orçamento de
 * pontos de poder (baseado no nível da saga) e compra EFEITO + EXTENSÃO + POTÊNCIA,
 * podendo assumir até 3 CONDIÇÕES para recuperar pontos, além de BÔNUS/PENALIDADES,
 * PV e RD. Toda a matemática vive em app/engine/powers.js — aqui só há interface.
 */
import { el, toast, valorCalculado, confirmar } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import {
  novoPoder, catalogo, opcoesDe, custoDoPoder, validarPoder, resumoDoPoder, acharItem,
} from '../../engine/powers.js';
import { categorias, comparaDimensionalidade, notaDeHax } from '../../engine/categories.js';

let editando = null;   // poder em edição (rascunho local)
let aba = 'efeito';    // aba do editor
let dbAtual = null;    // banco carregado (para re-renderizações internas)

export function renderPoderes(main, { db }) {
  dbAtual = db;
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const orc = snap.gau.pontosDePoder;

  main.append(
    el('h1', { class: 'page-title' }, '🌀 Poderes'),
    painelOrcamento(db, pc, orc),
    painelCategoria(db, pc, snap),
    editando ? editor(db, pc, orc) : listaDePoderes(db, pc, orc),
    painelDimensionalidade(db, pc),
  );
}

/* ------------------------------------------------------------------ orçamento */

function painelOrcamento(db, pc, orc) {
  const usado = orc.total ? Math.min(100, Math.round((orc.gasto / orc.total) * 100)) : 0;
  return el('div', { class: 'panel' },
    el('h3', {}, 'Pontos de poder da saga'),
    el('div', { class: 'row', style: 'gap:1.2rem;flex-wrap:wrap' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Orçamento'), el('div', { class: 'value' }, String(orc.total))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Gasto'), el('div', { class: 'value' }, String(orc.gasto))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Disponível'),
        el('div', { class: `value ${orc.disponiveis < 0 ? 'neg' : ''}` }, String(orc.disponiveis))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Nível da saga'),
        el('select', {
          'aria-label': 'Categoria de poder do personagem',
          onchange: e => store.update(p => { p.categoria = e.target.value; }),
        }, ...categorias(db).map(c => el('option', { value: c.id, selected: (pc.categoria || 'mundano') === c.id }, `${c.nome}${c.dados ? ` — ${c.dados}d20` : ''}`)))),
    ),
    el('div', { class: 'bar' }, el('div', { class: `bar-fill${orc.disponiveis < 0 ? ' over' : ''}`, style: `width:${usado}%` })),
    orc.disponiveis < 0 ? el('p', { class: 'aviso' }, `Orçamento estourado em ${-orc.disponiveis} ponto(s) de poder.`) : '',
    el('p', { class: 'fonte' }, orc.regra || 'O orçamento é definido pelo nível de poder da saga.'),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => { editando = novoPoder(); aba = 'efeito'; rerender(); } }, '＋ Novo poder'),
      el('button', {
        class: 'btn ghost', onclick: () => {
          const total = parseInt(prompt('Orçamento de pontos de poder da saga:', String(orc.total)), 10);
          if (!Number.isNaN(total)) store.update(p => { p.pontosDePoder = { ...p.pontosDePoder, total }; });
        },
      }, 'Definir orçamento'),
    ),
  );
}

function painelCategoria(db, pc, snap) {
  const cat = snap.gau.categoria;
  return el('div', { class: 'panel' },
    el('h3', {}, 'Categoria de poder e escala'),
    el('p', {}, `${cat.nome} — ${cat.dados ? `${cat.dados} d20 por teste` : 'quantidade de dados não publicada'}. ${cat.nota || ''}`),
    el('div', { class: 'grid cols-4' },
      ...['ST', 'DX', 'IQ', 'HT'].map(k => el('div', { class: 'stat small' },
        el('div', { class: 'label' }, `${k} ${pc.atributos[k]}`),
        el('div', { class: 'value' }, snap.gau.margens[k].texto),
        el('div', { class: 'label' }, `crítico ${snap.gau.margens[k].critico}`))),
    ),
    el('p', { class: 'fonte' }, 'A quantidade de dados representa a escala na qual o personagem existe: um indivíduo mundano está limitado a um único d20. Como vários d20 são combinados acima de Mundano é REGRA NÃO DEFINIDA — a ficha usa o melhor dado (config.modoEscala).'),
  );
}

/* ------------------------------------------------------------------ lista */

function listaDePoderes(db, pc, orc) {
  const poderes = pc.poderes || [];
  if (!poderes.length) {
    return el('div', { class: 'panel' },
      el('h3', {}, 'Poderes do personagem'),
      el('div', { class: 'row', style: 'justify-content:center;color:var(--ink-dim)' }, 'Nenhum poder comprado ainda. O sistema é um catálogo: escolha um Efeito, defina sua Extensão e sua Potência.'),
    );
  }
  return el('div', { class: 'panel' },
    el('h3', {}, `Poderes do personagem (${poderes.length})`),
    ...poderes.map(poder => {
      const custo = custoDoPoder(db, poder);
      const validacao = validarPoder(db, poder, { orcamento: orc.total });
      return el('div', { class: 'card' },
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
          el('strong', {}, poder.nome || 'Sem nome'),
          el('span', { class: 'pill' }, `${custo.total} pts`),
        ),
        el('ul', { class: 'lista' }, ...resumoDoPoder(db, poder).map(l => el('li', {}, l))),
        poder.descricao ? el('p', { class: 'fonte' }, poder.descricao) : '',
        validacao.ok ? '' : el('p', { class: 'aviso bad' }, validacao.erros.join(' ')),
        validacao.avisos.length ? el('p', { class: 'aviso' }, validacao.avisos.join(' ')) : '',
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn small', onclick: () => { editando = JSON.parse(JSON.stringify(poder)); aba = 'efeito'; rerender(); } }, 'Editar'),
          el('button', { class: 'btn small ghost', onclick: () => {
            const linhas = custo.partes.map(p => `${p.moduloNome}${p.grupoNome ? ' — ' + p.grupoNome : ''}: ${p.nome} (${p.pontos})`).join('\n');
            alert(`Custo de "${poder.nome}"\n\n${linhas}\n\nTOTAL: ${custo.total} pontos`);
          } }, 'Ver custo'),
          el('button', { class: 'btn small danger', onclick: () => confirmar('Excluir poder', `Remover "${poder.nome}" da ficha?`, () => {
            store.update(p => { p.poderes = (p.poderes || []).filter(x => x.id !== poder.id); });
            store.historico('poder', `Poder "${poder.nome}" removido.`);
            toast('Poder removido.');
          }) }, 'Excluir'),
        ),
      );
    }),
  );
}

/* ------------------------------------------------------------------ editor */

const ABAS = [
  { id: 'efeito', nome: 'Efeito' },
  { id: 'extensao', nome: 'Extensão' },
  { id: 'potencia', nome: 'Potência' },
  { id: 'condicoes', nome: 'Condições' },
  { id: 'extras', nome: 'Bônus · PV · RD' },
];

function editor(db, pc, orc) {
  const custo = custoDoPoder(db, editando);
  const validacao = validarPoder(db, editando, { orcamento: orc.total });
  const maxCond = catalogo(db).maxCondicoes;

  return el('div', { class: 'panel editor' },
    el('h3', {}, editando.nome ? `Editando: ${editando.nome}` : 'Novo poder'),
    el('div', { class: 'row' },
      el('input', {
        type: 'text', value: editando.nome, placeholder: 'Nome do poder', 'aria-label': 'Nome do poder',
        oninput: e => { editando.nome = e.target.value; },
      }),
      el('span', { class: 'pill' }, `${custo.total} / ${orc.total} pts`),
    ),
    el('textarea', {
      rows: 2, placeholder: 'Descrição / conceito do poder', 'aria-label': 'Descrição do poder',
      oninput: e => { editando.descricao = e.target.value; },
    }, editando.descricao || ''),
    el('div', { class: 'tabs' }, ...ABAS.map(a => el('button', {
      class: `tab small${aba === a.id ? ' active' : ''}`,
      onclick: () => { aba = a.id; rerender(); },
    }, a.nome))),
    el('div', { class: 'tab-body' }, ...corpoDaAba(db, maxCond)),
    el('div', { class: 'resumo' },
      el('strong', {}, 'Custo: '),
      valorCalculado(custo.total, custo.partes.map(p => ({ fonte: `${p.moduloNome}${p.grupoNome ? ' — ' + p.grupoNome : ''}: ${p.nome}`, valor: p.pontos })), 'Como este poder foi calculado'),
      validacao.ok ? el('span', { class: 'pill ok' }, 'válido') : el('span', { class: 'pill bad' }, `${validacao.erros.length} erro(s)`),
    ),
    validacao.erros.length ? el('ul', { class: 'lista bad' }, ...validacao.erros.map(e => el('li', {}, e))) : '',
    validacao.avisos.length ? el('ul', { class: 'lista aviso' }, ...validacao.avisos.map(a => el('li', {}, a))) : '',
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => salvar(db, pc) }, 'Salvar poder'),
      el('button', { class: 'btn ghost', onclick: () => { editando = null; rerender(); } }, 'Cancelar'),
    ),
  );
}

function corpoDaAba(db, maxCond) {
  if (aba === 'efeito') return secaoEfeito(db);
  if (aba === 'extensao') return secaoModulos(db, 'extensao', () => editando.extensao, (grupo, id) => { editando.extensao[grupo] = id || null; });
  if (aba === 'potencia') return secaoPotencia(db);
  if (aba === 'condicoes') return secaoCondicoes(db, maxCond);
  return secaoExtras(db);
}

function secaoEfeito(db) {
  const grupos = opcoesDe(db, 'efeito');
  return grupos.map(g => el('div', { class: 'grupo' },
    el('h4', {}, g.grupoNome),
    el('div', { class: 'chips' }, ...g.itens.map(item => el('button', {
      class: `chip${editando.efeito?.id === item.id ? ' on' : ''}`,
      title: `${item.pontos} pontos${item.escalonavel ? ' (escalonável)' : ''}`,
      onclick: () => { editando.efeito = { grupo: g.grupo, id: item.id }; rerender(); },
    }, `${item.nome} · ${item.pontos}`))),
  ));
}

function secaoModulos(db, modulo, ler, escrever) {
  return opcoesDe(db, modulo).map(sub => el('div', { class: 'grupo' },
    el('h4', {}, sub.grupoNome, sub.descricao && sub.descricao !== sub.grupoNome ? el('span', { class: 'fonte' }, ` — ${sub.descricao}`) : ''),
    el('div', { class: 'chips' }, ...sub.itens.map(item => el('button', {
      class: `chip${ler()[sub.grupo] === item.id ? ' on' : ''}`,
      title: `${item.pontos} pontos${item.exemplo ? ` — ${item.exemplo}` : ''}`,
      onclick: () => { escrever(sub.grupo, ler()[sub.grupo] === item.id ? null : item.id); rerender(); },
    }, `${item.nome} · ${item.pontos}`))),
  ));
}

function secaoPotencia(db) {
  const unicos = ['intensidade', 'dano'];
  const multiplos = ['forca', 'velocidade'];
  const secoes = [];
  for (const sub of opcoesDe(db, 'potencia')) {
    if (unicos.includes(sub.grupo)) {
      secoes.push(el('div', { class: 'grupo' },
        el('h4', {}, sub.grupoNome, el('span', { class: 'fonte' }, ` — ${sub.descricao || ''}`)),
        el('div', { class: 'chips' }, ...sub.itens.map(item => el('button', {
          class: `chip${editando.potencia[sub.grupo] === item.id ? ' on' : ''}`,
          onclick: () => { editando.potencia[sub.grupo] = editando.potencia[sub.grupo] === item.id ? null : item.id; rerender(); },
        }, `${item.nome} · ${item.pontos}${item.grau ? ` (GD ${item.grau})` : ''}`))),
      ));
    } else if (multiplos.includes(sub.grupo)) {
      secoes.push(el('div', { class: 'grupo' },
        el('h4', {}, sub.grupoNome, el('span', { class: 'fonte' }, ` — ${sub.descricao || ''}`)),
        el('div', { class: 'chips' }, ...sub.itens.map(item => {
          const ativo = (editando.potencia[sub.grupo] || []).includes(item.id);
          return el('button', {
            class: `chip${ativo ? ' on' : ''}`,
            title: item.escalonavel ? `${item.pontos}+ pontos (escalonável — informe o custo pago)` : `${item.pontos} pontos`,
            onclick: () => {
              const lista = editando.potencia[sub.grupo] || [];
              editando.potencia[sub.grupo] = ativo ? lista.filter(x => x !== item.id) : [...lista, item.id];
              rerender();
            },
          }, `${item.nome} · ${item.pontos}${item.escalonavel ? '+' : ''}`);
        })),
      ));
    }
  }
  secoes.push(painelCustosInformados(db));
  return secoes;
}

function secaoCondicoes(db, maxCond) {
  const itens = opcoesDe(db, 'condicao')[0]?.itens || [];
  const escolhidas = editando.condicoes || [];
  return [
    el('p', { class: 'fonte' }, `As Condições determinam o que precisa acontecer para o poder funcionar — e devolvem pontos ao jogador. Máximo de ${maxCond} por poder (você escolheu ${escolhidas.length}).`),
    el('div', { class: 'chips' }, ...itens.map(item => {
      const ativo = escolhidas.includes(item.id);
      return el('button', {
        class: `chip${ativo ? ' on' : ''}`,
        disabled: !ativo && escolhidas.length >= maxCond,
        onclick: () => {
          editando.condicoes = ativo ? escolhidas.filter(x => x !== item.id) : [...escolhidas, item.id];
          rerender();
        },
      }, `${item.nome} · ${item.pontos}`);
    })),
    painelCustosInformados(db),
  ];
}

function secaoExtras(db) {
  const secoes = [];
  const bonus = opcoesDe(db, 'bonus')[0]?.itens || [];
  const penalidades = opcoesDe(db, 'penalidade')[0]?.itens || [];
  secoes.push(el('div', { class: 'grupo' },
    el('h4', {}, 'Bônus'),
    el('div', { class: 'chips' }, ...bonus.map(item => el('button', {
      class: `chip${editando.bonus?.id === item.id ? ' on' : ''}`,
      onclick: () => { editando.bonus = editando.bonus?.id === item.id ? null : { id: item.id, alvo: editando.bonus?.alvo || '' }; rerender(); },
    }, `+${item.bonus} · ${item.pontos}`))),
    editando.bonus ? el('input', {
      type: 'text', value: editando.bonus.alvo || '', placeholder: 'Onde o bônus se aplica (ex.: ataques, defesas)',
      oninput: e => { editando.bonus.alvo = e.target.value; },
    }) : '',
  ));
  secoes.push(el('div', { class: 'grupo' },
    el('h4', {}, 'Penalidades'),
    el('div', { class: 'chips' }, ...penalidades.map(item => el('button', {
      class: `chip${editando.penalidade?.id === item.id ? ' on' : ''}`,
      onclick: () => { editando.penalidade = editando.penalidade?.id === item.id ? null : { id: item.id, alvo: editando.penalidade?.alvo || '' }; rerender(); },
    }, `${item.penalidade} · ${item.pontos}`))),
    editando.penalidade ? el('input', {
      type: 'text', value: editando.penalidade.alvo || '', placeholder: 'Onde a penalidade se aplica',
      oninput: e => { editando.penalidade.alvo = e.target.value; },
    }) : '',
  ));
  for (const [modulo, titulo] of [['pv', 'Pontos de Vida'], ['rd', 'Redução de Dano']]) {
    const itens = opcoesDe(db, modulo)[0]?.itens || [];
    secoes.push(el('div', { class: 'grupo' },
      el('h4', {}, titulo),
      el('div', { class: 'chips' }, ...itens.map(item => el('button', {
        class: `chip${editando[modulo] === item.id ? ' on' : ''}`,
        onclick: () => { editando[modulo] = editando[modulo] === item.id ? null : item.id; rerender(); },
      }, `${item.nome} · ${item.pontos}`))),
    ));
  }
  const outros = opcoesDe(db, 'outros')[0]?.itens || [];
  secoes.push(el('div', { class: 'grupo' },
    el('h4', {}, 'Outros bônus'),
    el('p', { class: 'fonte' }, 'Praticamente qualquer vantagem numérica pode virar compra.'),
    el('div', { class: 'chips' }, ...outros.map(item => {
      const ativo = (editando.outros || []).includes(item.id);
      return el('button', {
        class: `chip${ativo ? ' on' : ''}`,
        title: item.escalonavel ? `${item.pontos}+ (escalonável)` : `${item.pontos} pontos`,
        onclick: () => { editando.outros = ativo ? editando.outros.filter(x => x !== item.id) : [...(editando.outros || []), item.id]; rerender(); },
      }, `${item.nome} · ${item.pontos}${item.escalonavel ? '+' : ''}`);
    })),
  ));
  secoes.push(painelCustosInformados(db));
  return secoes;
}

/** Itens publicados como "N+" (escalonáveis): o custo dos níveis adicionais é REGRA NÃO DEFINIDA. */
function painelCustosInformados(db) {
  const escalonaveis = custoDoPoder(db, editando).partes.filter(p => p.escalonavel);
  if (!escalonaveis.length) return [];
  return [el('div', { class: 'grupo destaque' },
    el('h4', {}, 'Custos escalonáveis'),
    el('p', { class: 'fonte' }, 'Estes itens são publicados com "+" (ex.: 15+). O material não define o custo dos níveis adicionais — informe quantos pontos você pagou.'),
    el('table', { class: 'tbl' },
      el('tr', {}, ['Item', 'Publicado', 'Pago'].map(h => el('th', {}, h))),
      ...escalonaveis.map(item => el('tr', {},
        el('td', {}, item.nome),
        el('td', { class: 'num' }, `${item.publicado}+`),
        el('td', {}, el('input', {
          type: 'number', min: item.publicado, value: editando.custosInformados?.[item.id] ?? item.publicado, 'aria-label': `Custo pago em ${item.nome}`,
          onchange: e => {
            editando.custosInformados = { ...(editando.custosInformados || {}), [item.id]: parseInt(e.target.value, 10) || item.publicado };
            rerender();
          },
        })),
      )),
    ),
  )];
}

function salvar(db, pc) {
  const orcamento = pc.pontosDePoder?.total ?? 150;
  const outros = (pc.poderes || []).filter(p => p.id !== editando.id);
  const gastoOutros = outros.reduce((soma, p) => soma + custoDoPoder(db, p).total, 0);
  const validacao = validarPoder(db, editando, { orcamento: orcamento - gastoOutros });
  if (!validacao.ok) {
    toast('Corrija os erros antes de salvar.', 'erro');
    return;
  }
  const poder = JSON.parse(JSON.stringify(editando));
  store.update(p => {
    p.poderes = [...(p.poderes || []).filter(x => x.id !== poder.id), poder];
  });
  store.historico('poder', `Poder "${poder.nome}" salvo (${validacao.custo.total} pontos de poder).`);
  toast(`Poder "${poder.nome}" salvo — ${validacao.custo.total} pts.`);
  editando = null;
  rerender();
}

/* ------------------------------------------------------------------ dimensionalidade e hax */

function painelDimensionalidade(db, pc) {
  const nota = notaDeHax(db, { categoria: pc.categoria || 'mundano' });
  return el('div', { class: 'panel' },
    el('h3', {}, 'Dimensionalidade e Hax'),
    el('p', {}, db.poderes?.dimensionalidade?.definicao || ''),
    el('div', { class: 'row', style: 'gap:.6rem;align-items:flex-end;flex-wrap:wrap' },
      el('label', {}, 'Entidade A (dimensões)', el('input', { id: 'dimA', type: 'number', value: 4, min: 0, style: 'width:5rem' })),
      el('label', {}, 'Entidade B (dimensões)', el('input', { id: 'dimB', type: 'number', value: 3, min: 0, style: 'width:5rem' })),
      el('button', {
        class: 'btn small', onclick: () => {
          const a = parseInt(document.getElementById('dimA').value, 10) || 0;
          const b = parseInt(document.getElementById('dimB').value, 10) || 0;
          const r = comparaDimensionalidade(db, { dimensoesA: a, dimensoesB: b });
          alert(`${r.veredito}\n\n${r.superior ? r.naoTotalmenteImune : ''}\n\n${r.ressalva || ''}`);
        },
      }, 'Comparar'),
    ),
    el('h4', {}, 'Hax'),
    el('p', { class: 'fonte' }, nota.definicao),
    el('p', { class: 'fonte' }, nota.relatividade),
    el('p', { class: 'fonte' }, nota.limite),
  );
}

/* ------------------------------------------------------------------ utils */

/** Re-renderiza a página preservando o rascunho em edição. */
function rerender() {
  const main = document.getElementById('main');
  if (!main || !dbAtual) return;
  main.innerHTML = '';
  renderPoderes(main, { db: dbAtual });
}
