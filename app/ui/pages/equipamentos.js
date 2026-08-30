/* EQUIPAMENTOS — loja, inventário, carga e consulta inteligente universal. */
import { el, toast, fmtMoney, fmtKg, modal, valorCalculado, confirmar } from '../ui.js';
import { createFilterPanel, createFavoriteStore } from '../filters.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { novoItem, podeComprar, comprar, vender, recursosIniciais } from '../../engine/economy.js';
import { custoFadiga } from '../../engine/fatigue.js';

const slug = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderEquipamentos(main, { db }) {
  const pc = store.atual;
  const snapshot = computeAll(db, pc);
  const favorites = createFavoriteStore('equipment');

  /* Economia */
  const wealthDefinition = db.advantages.find(advantage => advantage.id === 'riqueza');
  const wealth = el('select', { 'aria-label': 'Nível de riqueza', onchange: event => {
    const level = wealthDefinition.niveis.find(item => item.nome === event.target.value);
    store.update(character => { character.riqueza.nivel = level.nome; character.riqueza.multiplicador = level.multiplicadorRecursos; });
  } }, wealthDefinition.niveis.map(level => el('option', { value: level.nome, selected: pc.riqueza?.nivel === level.nome }, `${level.nome} (${level.multiplicadorRecursos}×)`)));
  const money = el('input', { type: 'number', min: 0, value: Math.round(pc.riqueza?.dinheiro ?? 0), onchange: event => store.update(character => { character.riqueza.dinheiro = parseFloat(event.target.value) || 0; }) });
  const economy = el('div', { class: 'panel' },
    el('h3', {}, 'Economia (Riqueza p. 12–13 · Dinheiro p. 181)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Nível de Riqueza'), wealth),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Dinheiro ($)'), money),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Recursos iniciais'), el('div', { class: 'value' }, fmtMoney(recursosIniciais(pc, pc.riqueza?.recursosBase ?? 1000)))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso carregado'), valorCalculado(fmtKg(snapshot.carga.peso.kg), snapshot.carga.peso.detalhes.map(detail => ({ fonte: `${detail.qtd}× ${detail.nome}`, valor: detail.peso }))))),
    el('p', { class: 'fonte' }, 'Compra e uso impossíveis são explicados. Preço não publicado continua marcado como REGRA NÃO DEFINIDA.'),
  );

  /* Catálogo + propriedades derivadas apenas para consulta. */
  function normalizeItem(raw, category, categoryLabel, groupLabel) {
    const item = { ...raw, categoria: category, categoriaLabel: categoryLabel, grupo: groupLabel };
    item.id ||= slug(item.nome);
    item.custo = item.custo === undefined ? null : item.custo;
    item.pesoNumerico = typeof item.peso === 'number' ? item.peso : null;
    item.custoNumerico = typeof item.custo === 'number' ? item.custo : null;
    const purchase = podeComprar(pc, item, 1);
    item._purchase = purchase;
    item.podeComprar = purchase.ok;
    item.compraStatus = purchase.ok ? 'Pode comprar' : 'Bloqueado';
    item.possui = (pc.inventario || []).some(owned => owned.id === item.id);
    item.favorito = favorites.has(item.id);
    item.tipoCombate = category === 'arma-distancia' ? 'À distância' : item.dano ? 'Corpo a corpo' : null;
    item.podeUsar = category !== 'arma-distancia' && (!item.stMin || pc.atributos.ST >= item.stMin);
    item._useReason = item.podeUsar ? 'Requisitos conhecidos atendidos' : category === 'arma-distancia'
      ? 'Dano, perícia e requisitos não definidos no material'
      : `ST ${pc.atributos.ST} abaixo da ST mínima ${item.stMin}`;
    item.tags = [
      categoryLabel,
      item.dp != null ? 'Possui DP' : null,
      item.rd != null ? 'Possui RD' : null,
      item.nt != null ? `NT ${item.nt}` : null,
      item.custo == null ? 'Preço não definido' : 'Preço definido',
      item.pesoNumerico == null ? 'Peso não definido' : 'Peso definido',
      item.tipoCombate,
    ].filter(Boolean);
    return item;
  }

  const shopItems = [
    ...(db.equipment.armaduras || []).map(item => normalizeItem(item, 'armadura', 'Armaduras', 'Armaduras (p. 186–194)')),
    ...(db.equipment.escudos || []).map(item => normalizeItem(item, 'escudo', 'Escudos', 'Escudos (p. 195)')),
    ...(db.equipment.itensAvulsos || []).map(item => normalizeItem(item, 'item', 'Itens', 'Itens citados no material')),
    ...(db.equipment.armasLongoAlcanceExemplos || []).map(item => normalizeItem(item, 'arma-distancia', 'Armas à distância', 'Armas à distância — dados parciais (p. 257)')),
  ];
  const shopList = el('div', { class: 'list equipment-results' });
  let filters;
  function drawShop(items) {
    shopList.innerHTML = '';
    const groups = groupBy(items, item => item.grupo);
    for (const [group, entries] of Object.entries(groups)) {
      shopList.append(el('h4', {}, `${group} (${entries.length})`));
      for (const item of entries) shopList.append(shopRow(item));
    }
    if (!items.length) shopList.append(el('div', { class: 'row', style: 'justify-content:center' }, 'Nenhum equipamento corresponde aos filtros.'));
    shopList.append(el('div', { class: 'row equipment-undefined' },
      el('span', { class: 'grow meta' }, 'Armas corpo-a-corpo: tabela não fornecida. Cadastre somente dados conhecidos; o motor não inventa os demais.'),
      el('button', { class: 'btn', onclick: registerWeapon }, '＋ Cadastrar arma')));
  }

  function shopRow(item) {
    const buyNow = () => {
      const check = podeComprar(store.atual, item, 1);
      if (!check.ok) { check.motivos.forEach(reason => toast('✗ COMPRA IMPOSSÍVEL — ' + reason, 'bad')); return; }
      store.update(character => { comprar(character, item, 1); });
      toast(`Comprado: ${item.nome} (${fmtMoney(check.preco)})`, 'ok');
    };
    return el('div', { class: 'row equipment-row' },
      el('button', {
        class: 'favorite-button', title: item.favorito ? 'Remover dos favoritos' : 'Marcar como favorito',
        onclick: () => { item.favorito = favorites.toggle(item.id); filters.refresh(); },
      }, item.favorito ? '★' : '☆'),
      el('div', { class: 'grow' },
        el('div', { class: 'name' }, item.nome, item.possui ? ' ✓' : ''),
        el('div', { class: 'meta' }, [
          item.categoriaLabel, item.dp != null ? `DP ${item.dp}` : '', item.rd != null ? `RD ${item.rd}` : '',
          item.custo != null ? fmtMoney(item.custo) : 'preço N/D', typeof item.peso === 'number' ? fmtKg(item.peso) : item.peso ? `peso ${item.peso}` : 'peso N/D',
          item.tr != null ? `TR ${item.tr} · Prec +${item.prec} · ½D ${item.meioDano} · Max ${item.max}` : '',
        ].filter(Boolean).join(' · ')),
        item.notas ? el('div', { class: 'meta fonte' }, item.notas) : '',
        el('div', { class: 'equipment-status' },
          el('span', { class: `pill ${item.podeUsar ? 'ok' : 'bad'}`, title: item._useReason }, item.podeUsar ? '✓ Pode usar' : `✗ ${item._useReason}`),
          el('span', { class: `pill ${item.podeComprar ? 'ok' : 'bad'}`, title: item._purchase.motivos.join(' ') }, item.podeComprar ? '✓ Pode comprar' : `✗ ${item._purchase.motivos[0] || 'Bloqueado'}`))),
      el('a', { class: 'btn small ghost', href: `#/livro/ler/equipamento/equipamento-${item.id}`, title: 'Ver no livro' }, '📖'),
      el('button', { class: 'btn small', onclick: buyNow, disabled: !item.podeComprar }, 'Comprar'));
  }

  filters = createFilterPanel({
    id: 'equipment', items: shopItems,
    searchFields: ['nome', 'notas', 'categoriaLabel', 'tags', 'fonte'],
    searchPlaceholder: 'Pesquisar equipamento, proteção ou característica…',
    schema: [
      { key: 'categoriaLabel', label: 'Categoria', type: 'multi' },
      { key: 'tipoCombate', label: 'Tipo de combate', type: 'multi' },
      { key: 'custoNumerico', label: 'Preço', type: 'range' },
      { key: 'pesoNumerico', label: 'Peso (kg)', type: 'range', step: .1 },
      { key: 'dp', label: 'Defesa Passiva', type: 'range' },
      { key: 'rd', label: 'Resistência a Dano', type: 'range' },
      { key: 'podeUsar', label: 'Somente o que posso usar', type: 'relation' },
      { key: 'podeComprar', label: 'Somente o que posso comprar', type: 'relation' },
      { key: 'possui', label: 'Já possuo', type: 'relation' },
      { key: 'favorito', label: 'Favoritos', type: 'relation' },
      { key: 'tags', label: 'Tags', type: 'multi' },
    ],
    quickFilters: [
      { label: 'Todos', apply: () => {} },
      { label: 'Posso usar', apply: state => { state.groups.podeUsar = true; } },
      { label: 'Posso comprar', apply: state => { state.groups.podeComprar = true; } },
      { label: 'Favoritos', apply: state => { state.groups.favorito = true; } },
      { label: 'Armaduras', apply: state => { state.groups.categoriaLabel.include = ['Armaduras']; } },
      { label: 'Escudos', apply: state => { state.groups.categoriaLabel.include = ['Escudos']; } },
    ],
    onChange: drawShop,
  });

  /* Inventário */
  const inventoryList = el('div', { class: 'list' });
  function drawInventory() {
    inventoryList.innerHTML = '';
    const inventory = pc.inventario || [];
    if (!inventory.length) { inventoryList.append(el('div', { class: 'row' }, 'Inventário vazio.')); return; }
    const block = (title, items) => {
      if (!items.length) return;
      inventoryList.append(el('h4', {}, `${title} (${items.length})`));
      for (const item of items) {
        const equipped = Boolean(item.equipado);
        const canEquip = ['armadura', 'escudo', 'arma'].includes(item.categoria) || Boolean(item.dano);
        const sellNow = () => {
          let result;
          store.update(character => { result = vender(character, item.id, 1, character.config?.fatorVenda ?? 1); });
          result.ok ? toast(`Vendido por ${fmtMoney(result.ganho)}. ${result.nota || ''}`, 'ok') : toast(result.motivos[0], 'bad');
        };
        inventoryList.append(el('div', { class: 'row' },
          el('div', { class: 'grow' },
            el('div', {}, el('span', { class: 'name' }, `${(item.qtd || 1) > 1 ? item.qtd + '× ' : ''}${item.nome}`), equipped ? el('span', { class: 'pill ok', style: 'margin-left:.35rem' }, 'equipado') : ''),
            el('div', { class: 'meta' }, [item.custo != null ? fmtMoney(item.custo) : '', item.peso ? fmtKg(item.peso) : '', item.dp != null ? `DP ${item.dp}` : '', item.rd != null ? `RD ${item.rd}` : '', item.dano ? `dano ${item.dano}` : '', item.stMin ? `ST mín ${item.stMin}` : ''].filter(Boolean).join(' · '))),
          canEquip ? el('button', { class: `btn small ${equipped ? 'danger' : 'primary'}`, onclick: () => store.update(character => { const current = character.inventario.find(entry => entry.id === item.id); current.equipado = !current.equipado; }) }, equipped ? 'Desequipar' : 'Equipar') : '',
          el('button', { class: 'btn small', onclick: () => store.update(character => { const current = character.inventario.find(entry => entry.id === item.id); current.armazenado = !current.armazenado; current.equipado = false; }) }, item.armazenado ? 'Carregar' : 'Armazenar'),
          el('button', { class: 'btn small', onclick: () => store.update(character => { character.inventario.find(entry => entry.id === item.id).qtd += 1; }) }, '+'),
          el('button', { class: 'btn small', onclick: sellNow }, 'Vender'),
          el('button', { class: 'btn small danger', onclick: () => confirmar('Descartar item', `Remover ${item.nome} do inventário?`, () => store.update(character => { character.inventario = character.inventario.filter(entry => entry.id !== item.id); })) }, '✕')));
      }
    };
    block('CARREGADO', inventory.filter(item => !item.armazenado));
    block('ARMAZENADO', inventory.filter(item => item.armazenado));
  }

  /* Carga */
  const loadState = snapshot.carga;
  const fatigueCost = custoFadiga(db, pc, 'luta', { nivelCarga: loadState.nivel });
  const loadStats = el('div', { class: 'grid cols-4' },
    el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso'), el('div', { class: 'value' }, fmtKg(loadState.peso.kg))),
    el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Nível'), valorCalculado(loadState.nome, [
      { fonte: `ST ${pc.atributos.ST}` },
      { fonte: `Peso ${fmtKg(loadState.peso.kg)} comparado aos limites publicados` },
    ])),
    el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Penalidade no Movimento'), el('div', { class: 'value' }, loadState.penalidade == null ? '—' : `−${loadState.penalidade}`)),
    el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Fadiga por luta'), el('div', { class: 'value' }, fatigueCost.erro ? '—' : `+${fatigueCost.custo}`)));
  const loadPanel = el('div', { class: 'panel' },
    el('h3', {}, 'Carga e Consequências (p. 195–197)'),
    loadStats,
    loadState.nota ? el('p', { class: 'pill bad', style: 'margin-top:.5rem' }, '⚠ ' + loadState.nota) : '',
    el('p', { class: 'fonte' }, 'Peso → relação com ST → nível de carga → movimento → esquiva → fadiga. Toda fórmula permanece no engine.'));

  main.append(
    el('h1', { class: 'page-title' }, '⚔️ Equipamentos'), economy, loadPanel,
    el('section', { class: 'equipment-shop' }, el('h2', {}, '🛒 Banco de equipamentos'), filters.node, shopList),
    el('section', { class: 'panel', style: 'margin-top:.9rem' }, el('h3', {}, '🎒 Inventário'), inventoryList));
  drawInventory();

  function registerWeapon() {
    const formData = {};
    const field = (label, key, placeholder, options) => {
      const input = options
        ? el('select', { onchange: event => { formData[key] = event.target.value; } }, options.map(option => el('option', { value: option }, option)))
        : el('input', { placeholder, oninput: event => { formData[key] = event.target.value; } });
      formData[key] = options ? options[0] : placeholder || '';
      return el('label', { class: 'field' }, label, input);
    };
    modal('Cadastrar arma corpo-a-corpo', el('div', {},
      el('p', { class: 'fonte' }, 'Preencha somente dados conhecidos. Campo ausente continua N/D.'),
      el('div', { class: 'grid cols-2' },
        field('Nome', 'nome', 'Espada curta'), field('Dano', 'dano', 'Bal+1'), field('Tipo de dano', 'tipoDano', '', ['corte', 'contusão', 'perfuração']),
        field('ST mínima', 'stMin', '10'), field('Custo ($)', 'custo', '400'), field('Peso (kg)', 'peso', '1.5'), field('Perícia (id)', 'periciaId', 'espadas-curtas'), field('Notas', 'notas', ''))), {
      acoes: [el('button', { class: 'btn primary', onclick: () => {
        const definition = {
          id: 'arma-' + slug(formData.nome || 'custom'), nome: formData.nome || 'Arma sem nome', categoria: 'arma',
          dano: formData.dano || null, tipoDano: formData.tipoDano || null, stMin: parseInt(formData.stMin, 10) || null,
          custo: formData.custo === '' ? null : parseFloat(String(formData.custo).replace(',', '.')), peso: formData.peso === '' ? 0 : parseFloat(String(formData.peso).replace(',', '.')),
          periciaId: formData.periciaId || null, notas: formData.notas || '',
        };
        store.update(character => { character.inventario.push(novoItem(definition, 1)); });
        document.querySelector('.modal-back')?.remove(); toast('Arma cadastrada no inventário.', 'ok');
      } }, 'Salvar')],
    });
  }
}

function groupBy(items, key) { return items.reduce((groups, item) => { (groups[key(item)] ||= []).push(item); return groups; }, {}); }
