/* Aba PERÍCIAS — catálogo G.A.U. (canal #『📕』perícias) com FilterEngine universal.
 *
 * Modelo G.A.U.: a perícia é comprada no nível 1 pelo custo publicado e cada ponto adicional
 * depositado vale +1 nível. O nível pré-definido (atributo ou outra perícia treinada) vale
 * quando é maior que o nível comprado — sem encadeamento de pré-definidos.
 * Modelo legado (config.modeloPericias = 'legado'): tabela de dificuldade do material-base 3d6.
 */
import { el, toast, valorCalculado, modal } from '../ui.js';
import { createFilterPanel } from '../filters.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import {
  attrPadrao, podeComprarMelhoria, modeloDePericias, custoPublicado, nivelEfetivoGAU,
  custoDaPericiaGAU, podeComprarNivelGAU, regraDeFamiliaridade,
  planejarCompraEmLoteGAU, aplicarNivelDePericiaGAU,
} from '../../engine/skills.js';
import { simularGasto } from '../../engine/points.js';

const SEM_CUSTO = 'Sem custo publicado';

/* estado da aba (não faz parte da ficha — sobrevive à re-renderização após cada compra) */
let selecao = new Set();          // perícias marcadas para a compra em lote
const descricaoAberta = new Set(); // linhas com o texto completo aberto
let textoCompleto = false;        // interruptor global: todas as descrições inteiras
let ultimaLista = [];             // itens do filtro atual (para "marcar todas as filtradas")
let niveisDoLote = 1;             // quantos níveis comprar de cada perícia marcada
let personagemDaSelecao = null;   // trocar de personagem descarta a marcação anterior

export function renderPericias(main, { db }) {
  const pc = store.atual;
  if (personagemDaSelecao !== pc?.id) {
    personagemDaSelecao = pc?.id ?? null;
    selecao = new Set();
    descricaoAberta.clear();
  }
  const snap = computeAll(db, pc);
  const gau = modeloDePericias(db, pc) === 'gau';
  const fam = regraDeFamiliaridade(db);
  const entries = new Map((pc.pericias || []).map(entry => [entry.id, entry]));
  const disponiveis = snap.contagem?.disponiveis ?? null;
  const limite = snap.periciasGAU?.limiteCriacao ?? null;

  const catalog = db.skills.map(skill => {
    const entry = entries.get(skill.id);
    const effective = entry
      ? (snap.pericias.find(item => item.entry === entry) || nivelEfetivoGAU(db, pc, entry))
      : (gau ? nivelEfetivoGAU(db, pc, { id: skill.id }) : null);
    const atributos = [...new Set((skill.preDefinido || []).filter(f => f.tipo === 'atributo').map(f => f.atributo))];
    const publicado = custoPublicado(skill);
    return {
      ...skill, _skill: skill, _entry: entry, _effective: effective,
      grupo: skill.grupo || skill.categoria || 'Outras',
      atributo: atributos.length ? atributos.join('/') : (attrPadrao(skill) || '—'),
      status: entry ? (effective?.porDefault || effective?.nivelBase > (effective?.nivelComprado ?? -1) ? 'Treinada (vale o pré-definido)' : 'Treinada') : 'Não treinada',
      custo: publicado ?? SEM_CUSTO,
      custoNumerico: publicado,
      nivel: effective?.nivelEfetivo ?? null,
      familiaridade: skill.familiaridadeAplicavel ? (entry?.familiarizado === false ? 'Não familiar' : 'Familiar') : 'Não se aplica',
      podeMelhorar: gau
        ? publicado !== null
        : (() => { try { return podeComprarMelhoria(db, pc, entry || { id: skill.id, pontos: 0 }, .5).ok; } catch { return false; } })(),
      tags: [
        skill.tipo, skill.grupo, publicado === null ? SEM_CUSTO : `${publicado} pts`,
        skill.familiaridadeAplicavel ? 'Familiaridade' : null,
        skill.especializacao ? 'Com especialização' : null,
        skill.testeSecreto ? 'Teste secreto' : null,
        (skill.prereqs || []).length ? 'Com pré-requisito' : 'Sem pré-requisito',
        (skill.modificadores || []).some(m => m.vantagem) ? 'Bônus de vantagem' : null,
        skill.ntMinimo ? `NT ${skill.ntMinimo}+` : null,
      ].filter(Boolean),
    };
  });

  const tbody = el('tbody');
  const caixaTodas = el('input', {
    type: 'checkbox', 'aria-label': 'Marcar todas as perícias do filtro atual',
    title: 'Marcar/desmarcar todas as perícias visíveis',
    onchange: evento => {
      for (const item of ultimaLista) {
        if (evento.target.checked) selecao.add(item._skill.id);
        else selecao.delete(item._skill.id);
      }
      desenhar(ultimaLista);
    },
  });
  const thTodas = el('th', { class: 'sel' }, caixaTodas);

  /* ---------------------------------------------- compra em lote (várias perícias de uma vez) */
  const barraLote = el('div', { class: 'barra-lote', hidden: true });
  const entradaNiveis = el('input', {
    type: 'number', min: 1, max: 20, step: 1, value: niveisDoLote, style: 'width:62px',
    'aria-label': 'Níveis a comprar em cada perícia marcada',
    onchange: evento => {
      niveisDoLote = Math.max(1, Math.min(20, parseInt(evento.target.value, 10) || 1));
      evento.target.value = String(niveisDoLote);
      atualizarBarraLote();
    },
  });
  const planoDoLote = () => planejarCompraEmLoteGAU(db, pc, [...selecao], {
    niveis: niveisDoLote,
    disponiveis: snap.contagem?.disponiveis ?? null,
    limiteCriacao: pc.config?.emCriacao ? (limite?.limite ?? null) : null,
  });

  function atualizarBarraLote() {
    barraLote.innerHTML = '';
    if (!gau || selecao.size === 0) { barraLote.hidden = true; return; }
    const plano = planoDoLote();
    const fora = plano.bloqueadas.length + plano.semPontos.length;
    barraLote.hidden = false;
    barraLote.append(
      el('span', { class: 'bl-titulo' }, `${selecao.size} marcada${selecao.size > 1 ? 's' : ''}`),
      el('label', { class: 'bl-campo' }, 'níveis', entradaNiveis),
      el('span', { class: 'bl-custo' }, `${plano.custoTotal} pts`,
        plano.disponiveisDepois === null ? '' : el('small', {}, ` · restam ${plano.disponiveisDepois}`)),
      el('button', {
        class: 'btn small primary', disabled: plano.quantidade === 0,
        title: plano.quantidade ? `Comprar ${plano.quantidade} perícia(s) por ${plano.custoTotal} pontos` : 'Nenhuma marcada pode ser comprada agora',
        onclick: comprarLote,
      }, plano.quantidade ? `Comprar ${plano.quantidade}` : 'Nada a comprar'),
      fora ? el('button', { class: 'btn small ghost', title: 'Ver o que ficou de fora e o motivo de cada uma', onclick: () => mostrarPlano(planoDoLote()) }, `${fora} de fora`) : '',
      el('button', { class: 'btn small ghost', title: 'Desmarcar tudo', onclick: () => { selecao.clear(); desenhar(ultimaLista); } }, 'Limpar'),
    );
  }

  function comprarLote() {
    const plano = planoDoLote();
    if (!plano.quantidade) { toast('Nenhuma perícia marcada pode ser comprada agora — veja o motivo em "de fora".', 'bad'); return; }
    if (plano.quantidade > 3 || plano.bloqueadas.length || plano.semPontos.length) return mostrarPlano(plano, true);
    return aplicarLote(plano);
  }

  function aplicarLote(plano) {
    const mutar = character => {
      for (const item of plano.plano) aplicarNivelDePericiaGAU(character, item.id, item.nivelFinal);
      character.config ||= {};
      if (character.config.modeloPericias !== 'gau') character.config.modeloPericias = 'gau';
    };
    /* orçamento único: o lote inteiro tem de caber nos pontos do personagem */
    const teste = simularGasto(db, pc, mutar, `${plano.quantidade} perícias (${plano.custoTotal} pts)`);
    if (!teste.ok) { toast(teste.motivo, 'bad'); return; }
    store.update(mutar);
    const nomes = plano.plano.slice(0, 8).map(item => `${item.nome} ${item.nivelFinal}`).join(', ');
    store.historico('pericia', `Compra em lote: ${plano.quantidade} perícia(s) — ${nomes}`
      + `${plano.quantidade > 8 ? ` e mais ${plano.quantidade - 8}` : ''} (custo ${plano.custoTotal} pts).`);
    for (const item of plano.plano) selecao.delete(item.id);
    toast(`${plano.quantidade} perícia(s) comprada(s) por ${plano.custoTotal} pts${plano.disponiveisDepois === null ? '' : ` — restam ${plano.disponiveisDepois}`}.`, 'ok');
    desenhar(ultimaLista);
  }

  function mostrarPlano(plano, comConfirmacao = false) {
    const linhas = plano.plano.map(item => el('div', { class: 'row' },
      el('span', { class: 'grow' }, item.nome,
        el('span', { class: 'pill', style: 'margin-left:.4rem' }, `nível ${item.nivelFinal}`),
        (item.avisos || []).length ? el('div', { class: 'meta fonte' }, item.avisos.join(' · ')) : ''),
      el('span', { class: 'num' }, `${item.custo} pts`)));
    const fora = [...plano.bloqueadas, ...plano.semPontos].map(item => el('div', { class: 'row' },
      el('span', { class: 'grow' }, item.nome, el('div', { class: 'meta fonte' }, item.motivo)),
      el('span', { class: 'pill bad' }, 'fora')));
    const janela = modal(comConfirmacao ? 'Confirmar compra em lote' : 'O que ficou de fora do lote', el('div', {},
      el('p', {}, el('b', {}, `${plano.quantidade} perícia(s)`), ` · ${plano.custoTotal} pontos`
        + (plano.disponiveisDepois === null ? '' : ` · restam ${plano.disponiveisDepois} do orçamento do personagem`)),
      el('div', { class: 'list lista-plano' },
        ...(linhas.length ? linhas : [el('div', { class: 'row' }, 'Nenhuma perícia marcada pode ser comprada agora.')])),
      fora.length ? el('details', { style: 'margin-top:.6rem', open: comConfirmacao },
        el('summary', { class: 'fonte' }, `${fora.length} fora do lote — motivo de cada uma`),
        el('div', { class: 'list lista-plano' }, ...fora)) : ''), {
      acoes: comConfirmacao
        ? [el('button', { class: 'btn primary', disabled: plano.quantidade === 0, onclick: () => { janela.close(); aplicarLote(plano); } }, `Comprar ${plano.quantidade} (${plano.custoTotal} pts)`),
           el('button', { class: 'btn ghost', onclick: () => janela.close() }, 'Cancelar')]
        : [el('button', { class: 'btn ghost', onclick: () => janela.close() }, 'Fechar')],
    });
    return undefined;
  }

  const marcarTexto = el('input', {
    type: 'checkbox', checked: textoCompleto, 'aria-label': 'Mostrar o texto completo das descrições',
    onchange: evento => { textoCompleto = evento.target.checked; desenhar(ultimaLista); },
  });
  const toolbar = el('div', { class: 'btn-row pericias-toolbar' },
    el('label', { class: 'bl-campo', style: 'cursor:pointer' }, marcarTexto, 'texto completo'),
    gau ? el('button', {
      class: 'btn small', title: 'Marcar todas as perícias do filtro atual para comprar de uma vez',
      onclick: () => { for (const item of ultimaLista) selecao.add(item._skill.id); desenhar(ultimaLista); },
    }, '☑ Marcar filtradas') : '',
    el('button', { class: 'btn small ghost', title: 'Desmarcar todas', onclick: () => { selecao.clear(); desenhar(ultimaLista); } }, 'Limpar marcação'),
    el('span', { class: 'fonte' }, `${catalog.length} no catálogo · ${(pc.pericias || []).length} na ficha`
      + (gau ? ` · ${disponiveis ?? '—'} pts livres` : '')),
  );

  function desenhar(items) {
    ultimaLista = items;
    tbody.innerHTML = '';
    const rows = items.map(item => linhaPericia(db, pc, item._skill, item._entry, item._effective, {
      gau, snap, disponiveis, limite, aoSelecionar: atualizarBarraLote,
    }));
    tbody.append(...(rows.length ? rows : [el('tr', {}, el('td', { colspan: gau ? 8 : 7, style: 'text-align:center' }, 'Nenhuma perícia corresponde aos filtros.'))]));
    caixaTodas.checked = items.length > 0 && items.every(item => selecao.has(item._skill.id));
    atualizarBarraLote();
  }

  const filters = createFilterPanel({
    id: 'skills', items: catalog,
    searchFields: ['nome', 'descricao', 'grupo', 'preDefinidoTexto', 'modificadoresTexto', 'prereqs', 'tags'],
    searchPlaceholder: 'Pesquisar perícia, grupo, pré-definido ou modificador…',
    schema: [
      { key: 'grupo', label: 'Grupo', type: 'multi' },
      { key: 'tipo', label: 'Natureza', type: 'multi' },
      { key: 'custo', label: gau ? 'Custo publicado' : 'Custo', type: 'multi' },
      { key: 'atributo', label: 'Atributo-base', type: 'multi' },
      { key: 'status', label: 'Treinamento', type: 'multi' },
      { key: 'familiaridade', label: 'Familiaridade', type: 'multi' },
      { key: 'nivel', label: 'Nível efetivo', type: 'range' },
      { key: 'podeMelhorar', label: 'Somente o que posso comprar', type: 'relation' },
      { key: 'tags', label: 'Tags', type: 'multi' },
    ],
    quickFilters: [
      { label: 'Minhas', apply: state => { state.groups.status.include = ['Treinada', 'Treinada (vale o pré-definido)']; } },
      { label: 'Armas e Combate', apply: state => { state.groups.grupo.include = ['Perícias com Armas e Combate']; } },
      { label: 'Sociais', apply: state => { state.groups.grupo.include = ['Perícias Sociais']; } },
      { label: 'Familiaridade', apply: state => { state.groups.tags.include = ['Familiaridade']; } },
      { label: SEM_CUSTO, apply: state => { state.groups.tags.include = [SEM_CUSTO]; } },
      { label: 'Físicas', apply: state => { state.groups.tipo.include = ['Física']; } },
      { label: 'Mentais', apply: state => { state.groups.tipo.include = ['Mental']; } },
    ],
    onChange: desenhar,
  });

  main.append(
    el('h1', { class: 'page-title' }, '📜 Perícias', el('small', {},
      `${db.skills.length} perícias em ${(db.pericias?.grupos || []).length} grupos · pontos disponíveis: ${disponiveis ?? '—'}`
      + (gau ? ' · modelo G.A.U. (custo em pontos)' : ' · modelo legado (tabela de dificuldade)'))),
    gau ? painelGAU(db, snap, limite, fam, pc) : painelLegado(db),
    filters.node,
    el('div', { class: 'panel' },
      toolbar,
      el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl tabela-pericias' },
        el('thead', {}, el('tr', {},
          ...(gau ? [thTodas] : []),
          ...(gau ? ['Perícia', 'Grupo', 'Custo', 'Pré-definido', 'Nível', 'Modificadores', 'Ações']
               : ['Perícia', 'Tipo', 'Nível', 'Pontos', 'Default', 'Pré-req.', 'Ações']).map(title => el('th', {}, title)))),
        tbody))),
    el('p', { class: 'fonte' }, 'Dentro de cada filtro as opções são combinadas com OU; grupos diferentes são combinados com E. Marque várias perícias e compre todas de uma vez na barra inferior — o nível continua sendo calculado exclusivamente pelo Rule Engine.'),
    barraLote,
  );
}

/* ---------------------------------------------------------------- painéis de regra */
function painelGAU(db, snap, limite, fam, pc) {
  const custo = snap.periciasGAU?.custo || { total: 0, partes: [], semCustoPublicado: 0 };
  const pct = limite?.aplicavel && limite.limite ? Math.min(100, Math.round((custo.total / limite.limite) * 100)) : 0;
  return el('div', { class: 'panel' },
    el('div', { class: 'row', style: 'flex-wrap:wrap;gap:1rem;align-items:flex-start' },
      el('div', { style: 'flex:1;min-width:16rem' },
        el('strong', {}, 'Compra de perícias (G.A.U.)'),
        el('p', { class: 'fonte', style: 'margin:.25rem 0' }, db.pericias?.comprandoPericias?.texto
          || 'A perícia é comprada no nível 1 pelo custo publicado; cada ponto adicional depositado vale +1 nível.'),
        el('div', { class: 'row', style: 'gap:.4rem;flex-wrap:wrap' },
          el('span', { class: 'pill' }, `${custo.partes.length} perícias na ficha`),
          el('span', { class: 'pill' }, `${custo.total} pts gastos`),
          custo.semCustoPublicado ? el('span', { class: 'pill warn', title: 'A publicação não informa custo em pontos para estas perícias.' }, `${custo.semCustoPublicado} sem custo publicado`) : '')),
      limite?.aplicavel ? el('div', { style: 'flex:1;min-width:16rem' },
        el('strong', {}, `Limite de criação: ${limite.limite} pts (${limite.formula})`),
        el('div', { class: 'bar', title: `${custo.total} de ${limite.limite} pontos` },
          el('div', { class: `bar-fill${limite.excedido ? ' over' : ''}`, style: `width:${Math.max(2, pct)}%` })),
        el('p', { class: 'fonte', style: 'margin:.25rem 0' },
          limite.excedido ? `Excedido em ${custo.total - limite.limite} pontos.` : `${custo.total} de ${limite.limite} pontos usados.`,
          ` ${limite.aposCriacao || ''}`)) : '',
      fam?.pericias?.length ? el('div', { style: 'flex:1;min-width:16rem' },
        el('strong', {}, 'Familiaridade'),
        el('p', { class: 'fonte', style: 'margin:.25rem 0' },
          `${fam.texto || `Redutor de ${fam.redutor} quando o personagem usa um tipo de ferramenta, arma ou veículo com o qual não está familiarizado.`}`),
        el('p', { class: 'fonte', style: 'margin:.25rem 0' },
          `${fam.horasParaFamiliarizar} horas de prática tornam o novo modelo familiar · ${fam.pericias.length} perícias com bônus/penalidade de equipamento publicados.`),
        el('div', { class: 'row', style: 'gap:.3rem;flex-wrap:wrap' },
          el('span', { class: `pill${pc.pericias?.some(e => e.familiarizado === false) ? ' warn' : ''}` },
            pc.pericias?.some(e => e.familiarizado === false) ? 'Há equipamento marcado como não familiar' : 'Nenhum equipamento não familiar'))) : ''),
    (db.pericias?.divergencias || []).length ? el('details', { style: 'margin-top:.6rem' },
      el('summary', {}, `Divergências da publicação (${db.pericias.divergencias.length})`),
      el('ul', { class: 'fonte' }, ...db.pericias.divergencias.map(d => el('li', {},
        el('b', {}, `${d.assunto || d.id}: `), d.descricao || '')))) : '');
}

function painelLegado(db) {
  return el('div', { class: 'panel' },
    el('strong', {}, 'Modelo legado (material-base 3d6)'),
    el('p', { class: 'fonte', style: 'margin:.25rem 0' },
      'Perícias por pontos investidos na tabela de dificuldade. Para voltar ao modelo G.A.U., ajuste config.modeloPericias em Configurações.'));
}

/* ---------------------------------------------------------------- descrição na linha
 * O texto publicado aparece INTEIRO: 2 linhas recolhidas e clique para expandir (sem cortar
 * conteúdo). O interruptor "texto completo" acima da tabela expande todas de uma vez. */
/** Texto publicado inteiro, recolhido em 2 linhas até o clique (ou até ligar "texto completo"). */
function textoExpansivel(texto, chave, extra = '') {
  const conteudo = String(texto || '');
  if (!conteudo) return '';
  const aberta = textoCompleto || descricaoAberta.has(chave);
  return el('div', {
    class: `meta fonte descricao-pericia${extra ? ` ${extra}` : ''}${aberta ? ' expandida' : ''}`,
    title: aberta ? 'Clique para recolher o texto' : 'Clique para ler o texto inteiro',
    onclick: evento => {
      if (descricaoAberta.has(chave)) descricaoAberta.delete(chave);
      else descricaoAberta.add(chave);
      const alvo = evento?.currentTarget;
      if (alvo?.classList?.toggle) alvo.classList.toggle('expandida');
    },
  }, conteudo);
}

function descricaoPericia(skill) {
  return textoExpansivel(skill.descricao || '', skill.id);
}

/* ---------------------------------------------------------------- linha da tabela */
function linhaPericia(db, pc, skill, entry, effective, { gau, snap, disponiveis, limite, aoSelecionar }) {
  if (!gau) return linhaLegada(db, pc, skill, entry, effective, snap);

  const nivelComprado = effective?.nivelComprado ?? null;
  const nivelFinal = effective?.nivelEfetivo ?? null;
  const df = effective?.default;
  const mods = effective?.modificadores || [];
  const publicado = custoPublicado(skill);
  const custoAtual = nivelComprado !== null ? custoDaPericiaGAU(skill, nivelComprado) : null;

  const ajustar = delta => {
    const check = podeComprarNivelGAU(db, pc, entry || { id: skill.id }, delta, {
      disponiveis: pc.config?.emCriacao ? disponiveis : null,
      limiteCriacao: pc.config?.emCriacao ? limite?.limite ?? null : null,
    });
    if (!check.ok) { toast(check.erros[0], 'bad'); return; }
    const nivelAlvo = check.nivel ?? 1;
    /* orçamento único: a perícia também disputa os pontos do personagem */
    const teste = simularGasto(db, pc, character => {
      const atual = (character.pericias || []).find(item => item.id === skill.id);
      if (atual) {
        if (nivelAlvo <= 0) character.pericias = character.pericias.filter(item => item !== atual);
        else {
          if (!Number.isFinite(atual.nivel) && Number.isFinite(atual.pontos)) { atual.pontosLegados = atual.pontos; delete atual.pontos; }
          atual.nivel = nivelAlvo;
        }
      } else if (nivelAlvo > 0) (character.pericias ||= []).push({ id: skill.id, nivel: nivelAlvo });
    }, `${skill.nome} (nível ${nivelAlvo})`);
    if (!teste.ok) { toast(teste.motivo, 'bad'); return; }
    store.update(character => {
      const atual = (character.pericias || []).find(item => item.id === skill.id);
      if (atual) {
        const nivel = (check.nivel ?? 1);
        if (nivel <= 0) character.pericias = character.pericias.filter(item => item !== atual);
        else {
          /* entrada vinda do modelo legado: guarda os pontos antigos antes de anotar o nível */
          if (!Number.isFinite(atual.nivel) && Number.isFinite(atual.pontos)) {
            atual.pontosLegados = atual.pontos;
            delete atual.pontos;
          }
          atual.nivel = nivel;
        }
      } else if (delta > 0) {
        (character.pericias ||= []).push({ id: skill.id, nivel: 1, especialidade: null });
      }
      character.config ||= {};
      if (character.config.modeloPericias !== 'gau') character.config.modeloPericias = 'gau';
    });
    store.historico('pericia', `${skill.nome}: nível ${delta > 0 ? 'comprado/aumentado' : 'reduzido'} para ${check.nivel ?? '—'} (custo ${Math.abs(check.custo)} pt).`);
  };

  const alternarFamiliaridade = () => store.update(character => {
    const atual = (character.pericias || []).find(item => item.id === skill.id);
    if (!atual) { toast('Compre a perícia antes de marcar a familiaridade do equipamento.', 'bad'); return; }
    atual.familiarizado = atual.familiarizado === false;
  });

  return el('tr', { class: selecao.has(skill.id) ? 'marcada' : '' },
    ...(gau ? [el('td', { class: 'sel' }, el('input', {
      type: 'checkbox', checked: selecao.has(skill.id),
      'aria-label': `Marcar ${skill.nome} para comprar em lote`,
      title: 'Marcar para comprar várias de uma vez',
      onchange: evento => {
        if (evento.target.checked) selecao.add(skill.id);
        else selecao.delete(skill.id);
        if (aoSelecionar) aoSelecionar();
      },
    }))] : []),
    el('td', {}, el('strong', {}, skill.nome + (skill.ntMinimo ? `/NT ${skill.ntMinimo}` : '')),
      skill.especializacao ? el('span', { class: 'pill warn', title: `Especialização: ${skill.especializacao}` }, skill.especializacao) : '',
      entry?.especialidade ? el('span', { class: 'pill' }, entry.especialidade) : '',
      skill.testeSecreto ? el('span', { class: 'pill', title: 'O MJ rola em segredo.' }, '🕶 segredo') : '',
      descricaoPericia(skill)),
    el('td', { class: 'fonte' }, skill.grupo || '—'),
    el('td', { class: 'num' }, publicado === null
      ? el('span', { class: 'pill warn', title: skill._avisoCusto || 'A publicação informa a dificuldade, não o custo em pontos.' }, skill.custoTexto || SEM_CUSTO)
      : valorCalculado(`${publicado} pts`, [
          { fonte: 'Compra (nível 1)', valor: publicado },
          { fonte: 'Pontos adicionais (+1 nível cada)', valor: nivelComprado ? nivelComprado - 1 : 0 },
          { fonte: 'Total na ficha', valor: custoAtual ?? 0 },
        ], `Custo de ${skill.nome}`)),
    el('td', { style: 'font-size:.78rem' },
      df ? el('div', {},
        el('span', { class: 'pill' }, `${df.fonte} → ${df.valor}`),
        el('div', { class: 'fonte' }, (skill.preDefinidoTexto || '').replace(/^Pré-definido:? como:? ?/i, '')))
        : el('span', { class: 'fonte' }, skill.semNivelPreDefinido ? 'sem nível pré-definido' : (skill.preDefinidoTexto || '—'))),
    el('td', { class: 'num' }, nivelComprado === null
      ? el('span', { class: 'fonte' }, df ? `só pré-definido (${df.valor})` : '—')
      : el('div', {},
          el('div', {}, valorCalculado(nivelFinal, [
            { fonte: 'Nível comprado', valor: nivelComprado },
            ...(df ? [{ fonte: `Pré-definido (${df.fonte})`, valor: df.valor }] : []),
            { fonte: 'Base (maior entre comprado e pré-definido)', valor: effective.nivelBase },
            ...mods.map(m => ({ fonte: m.fonte, valor: m.valor >= 0 ? `+${m.valor}` : m.valor })),
          ], `Nível efetivo de ${skill.nome}`)),
          el('div', { class: 'fonte' }, `comprado ${nivelComprado} · ${entry?.convertidoDoLegado || effective?.convertidoDoLegado ? 'convertido do modelo legado' : `${custoAtual ?? 0} pts`}`))),
    el('td', { style: 'font-size:.75rem' },
      mods.length ? el('div', { class: 'row', style: 'gap:.25rem;flex-wrap:wrap' },
        ...mods.map(m => el('span', { class: `pill ${m.valor >= 0 ? 'ok' : 'bad'}`, title: m.situacao || m.nota || m.fonte },
          `${m.valor >= 0 ? '+' : ''}${m.valor} ${m.fonte}`)))
        : el('span', { class: 'fonte' }, (skill.modificadores || []).length ? `${skill.modificadores.length} situacional(is)` : '—')),
    el('td', {}, el('div', { class: 'btn-row', style: 'margin:0' },
      el('button', { class: 'btn small', title: 'Comprar 1 ponto (nível +1)', onclick: () => ajustar(1) }, entry ? '+1' : '＋'),
      entry ? el('button', { class: 'btn small danger', title: 'Reduzir 1 nível', onclick: () => ajustar(-1) }, '−1') : '',
      skill.familiaridadeAplicavel ? el('button', {
        class: `btn small ${entry?.familiarizado === false ? 'danger' : 'ghost'}`,
        title: entry?.familiarizado === false ? 'Equipamento não familiar (−2) — clique para marcar como familiar'
          : 'Marcar equipamento como não familiar (−2)',
        onclick: alternarFamiliaridade,
      }, entry?.familiarizado === false ? '🔧 −2' : '🔧') : '',
      (skill.especializacao || (skill.especializacoes || []).length) ? el('button', { class: 'btn small ghost', title: 'Escolher especialização', onclick: () => especializar(db, pc, skill) }, '✳') : '',
      el('button', { class: 'btn small ghost', title: 'Ver detalhes', onclick: () => detalharGAU(db, pc, skill, entry, effective) }, '👁'),
      el('a', { class: 'btn small ghost', title: 'Ler regra no livro', href: `#/livro/ler/pericias/pericia-${skill.id}` }, '📖'),
    )),
  );
}

function linhaLegada(db, pc, skill, entry, effective, snap) {
  const level = effective ? effective.nivelEfetivo : '—';
  const base = effective ? effective.baseAttr : attrPadrao(skill);
  const defaultValue = effective?.default;
  const prereqs = (skill.prereqs || []).join('; ');
  const comprar = points => {
    const check = podeComprarMelhoria(db, pc, entry || { id: skill.id, pontos: 0 }, points);
    if (!check.ok) { toast(check.erros[0] || 'Não é possível comprar.', 'bad'); return; }
    store.update(character => {
      const current = (character.pericias || []).find(item => item.id === skill.id);
      if (current) current.pontos += points;
      else character.pericias.push({ id: skill.id, pontos: points, especialidade: null });
    });
  };
  return el('tr', {},
    el('td', {}, el('strong', {}, skill.nome + (skill.ntMinimo ? `/NT ${skill.ntMinimo}` : '')),
      skill.especializacao ? el('span', { class: 'pill warn', title: `Especialização ${skill.especializacao}` }, skill.especializacao) : '',
      descricaoPericia(skill)),
    el('td', {}, `${skill.tipo === 'Física' ? 'Fís' : 'Men'}/${skill.dificuldade} · ${base}`),
    el('td', {}, entry
      ? (effective ? valorCalculado(level, [
          { fonte: `Atributo-base ${effective.baseAttr}`, valor: effective.attrValor },
          { fonte: `Pontos investidos (${effective.pontos})`, valor: effective.offsetTreino !== null ? `offset ${effective.offsetTreino >= 0 ? '+' : ''}${effective.offsetTreino}` : 'abaixo do mínimo' },
          ...(defaultValue ? [{ fonte: `Default ${defaultValue.origem}`, valor: defaultValue.valor }] : []),
          ...effective.modificadores.map(modifier => ({ fonte: modifier.fonte, valor: modifier.valor })),
        ]) : level)
      : (defaultValue ? valorCalculado(defaultValue.valor, [{ fonte: `Default: ${defaultValue.origem}` }]) : '—')),
    el('td', { class: 'num' }, entry ? String(entry.pontos) : '—'),
    el('td', { style: 'font-size:.75rem;color:var(--ink-dim)' },
      textoExpansivel((skill.defaults || []).join(' | ').replace(/Pré-definido:? como:? ?/g, ''), `legados-${skill.id}`)),
    el('td', {}, prereqs ? textoExpansivel(prereqs, `prereqs-${skill.id}`) : el('span', { class: 'pill' }, '—')),
    el('td', {}, el('div', { class: 'btn-row', style: 'margin:0' },
      el('button', { class: 'btn small', onclick: () => comprar(.5), title: 'Comprar ½ ponto' }, '+½'),
      el('button', { class: 'btn small', onclick: () => comprar(1), title: 'Comprar 1 ponto' }, '+1'),
      entry ? el('button', { class: 'btn small danger', title: 'Remover 1 ponto', onclick: () => store.update(character => {
        const current = character.pericias.find(item => item.id === skill.id);
        if (!current) return;
        current.pontos -= 1;
        if (current.pontos < .5) character.pericias = character.pericias.filter(item => item !== current);
      }) }, '−1') : '',
      el('button', { class: 'btn small ghost', title: 'Ver detalhes', onclick: () => detalharGAU(db, pc, skill, entry, effective) }, '👁'),
      el('a', { class: 'btn small ghost', title: 'Ler regra no livro', href: `#/livro/ler/pericias/pericia-${skill.id}` }, '📖'),
    )),
  );
}

/* ---------------------------------------------------------------- especialização */
function especializar(db, pc, skill) {
  const opcoes = skill.especializacoes || [];
  const entrada = (pc.pericias || []).find(e => e.id === skill.id);
  const livre = el('input', { type: 'text', placeholder: 'Outra especialização (texto livre)', value: entrada?.especialidade || '' });
  const lista = el('div', { class: 'list' },
    ...opcoes.map(op => el('button', {
      class: 'btn small', style: 'justify-content:flex-start',
      onclick: () => gravar(op.nome || op),
    }, `${op.nome || op}${op.nota ? ` — ${op.nota}` : ''}`)),
    livre,
    el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => gravar(livre.value.trim()) }, 'Gravar')));
  function gravar(valor) {
    if (!valor) { toast('Informe a especialização.', 'bad'); return; }
    store.update(character => {
      const atual = (character.pericias || []).find(item => item.id === skill.id);
      if (atual) atual.especialidade = valor;
      else (character.pericias ||= []).push({ id: skill.id, nivel: 1, especialidade: valor });
    });
    store.historico('pericia', `${skill.nome}: especialização "${valor}".`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }
  modal(`Especialização: ${skill.nome}`, el('div', {},
    el('p', { class: 'fonte' }, skill.especializacao || 'Escolha a especialização publicada para esta perícia.'),
    opcoes.length ? lista : el('div', {}, livre, el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => gravar(livre.value.trim()) }, 'Gravar')))));
}

/* ---------------------------------------------------------------- detalhes */
function detalharGAU(db, pc, skill, entry, effective) {
  const gau = modeloDePericias(db, pc) === 'gau';
  const publicado = custoPublicado(skill);
  const df = effective?.default;
  const mods = effective?.modificadores || [];
  const linhas = [
    ['Grupo', skill.grupo || skill.categoria || '—'],
    gau ? ['Custo publicado', publicado === null ? `${skill.custoTexto || '—'} (a publicação não informa custo em pontos)` : `${publicado} pontos`]
        : ['Dificuldade', `${skill.tipo}/${skill.dificuldade || '—'}`],
    ['Natureza', skill.tipo || '—'],
    ['Pré-definido', skill.preDefinidoTexto || (skill.semNivelPreDefinido ? 'sem nível pré-definido' : '—')],
    df ? ['Pré-definido ativo', `${df.fonte} → ${df.valor} (modo ${df.modoLido || df.modo})`] : null,
    entry ? [gau ? 'Nível comprado' : 'Pontos investidos', String(gau ? (effective?.nivelComprado ?? '—') : entry.pontos)] : null,
    effective?.nivelEfetivo != null ? ['Nível efetivo', String(effective.nivelEfetivo)] : null,
    entry ? ['Custo na ficha', `${effective?.custo ?? '—'} pts`] : null,
    skill.nivelEspecialista ? ['Especialista', `NH ≥ ${skill.nivelEspecialista}`] : null,
    skill.ntMinimo ? ['NT mínimo', String(skill.ntMinimo)] : null,
    skill.especializacao ? ['Especialização', skill.especializacao] : null,
    skill.testeSecreto ? ['Teste', 'o MJ rola em segredo'] : null,
    skill._notaGrafia ? ['Nota de transcrição', skill._notaGrafia] : null,
    skill._avisoCusto ? ['Aviso', skill._avisoCusto] : null,
  ].filter(Boolean);

  modal(`Perícia: ${skill.nome}`, el('div', {},
    el('p', {}, skill.descricao || ''),
    el('table', { class: 'tbl' },
      el('tr', {}, el('th', {}, 'Campo'), el('th', {}, 'Valor')),
      ...linhas.map(([campo, valor]) => el('tr', {}, el('td', {}, campo), el('td', {}, String(valor))))),
    (skill.prereqs || []).length ? el('div', {}, el('strong', {}, 'Pré-requisitos'),
      el('ul', { class: 'fonte' }, ...skill.prereqs.map(p => el('li', {}, p)))) : '',
    (skill.modificadoresTexto || (skill.modificadores || []).length) ? el('div', { style: 'margin-top:.5rem' },
      el('strong', {}, 'Modificadores publicados'),
      el('ul', { class: 'fonte' }, ...(skill.modificadores || []).map(m => el('li', {},
        m.valor != null ? el('b', {}, `${m.valor >= 0 ? '+' : ''}${m.valor} · `) : '',
        `${m.situacao || ''}${m.nota ? ` (${m.nota})` : ''}${m.vantagemNome ? ` — exige ${m.vantagemNome}` : ''}`))),
      mods.length ? el('p', { class: 'fonte' }, `Aplicados agora: ${mods.map(m => `${m.valor >= 0 ? '+' : ''}${m.valor} ${m.fonte}`).join(', ')}`) : '') : '',
    (skill.especializacoes || []).length ? el('div', { style: 'margin-top:.5rem' },
      el('strong', {}, 'Especializações publicadas'),
      el('ul', { class: 'fonte' }, ...skill.especializacoes.map(op => el('li', {}, op.nome || String(op))))) : '',
    el('p', { class: 'fonte' }, `Fonte: ${skill.fonte || 'PERÍCIAS — canal #『📕』perícias (publicação oficial)'}`),
    el('div', { class: 'btn-row' },
      el('a', { class: 'btn', href: `#/livro/ler/pericias/pericia-${skill.id}` }, '📖 Ver no livro'),
      (skill.especializacao || (skill.especializacoes || []).length) ? el('button', { class: 'btn ghost', onclick: () => especializar(db, pc, skill) }, '✳ Especialização') : '')));
}
