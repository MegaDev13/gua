/* Aba EQUIPAMENTOS — loja (armaduras/escudos/itens), inventário, equipar, carga e economia.
 * REGRA NÃO DEFINIDA: tabela de armas corpo-a-corpo não fornecida — o jogador pode
 * cadastrar armas com dano/ST mínima, e o motor calcula NH, Aparar, dano e carga.
 */
import { el, toast, fmtMoney, fmtKg, modal, valorCalculado, confirmar } from '../ui.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { novoItem, podeComprar, comprar, vender, recursosIniciais } from '../../engine/economy.js';
import { custoFadiga } from '../../engine/fatigue.js';

const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderEquipamentos(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);

  /* ---------------------------------------------- economia */
  const defRiqueza = db.advantages.find(a => a.id === 'riqueza');
  const selRiqueza = el('select', { 'aria-label': 'Nível de riqueza', onchange: e => {
    const n = defRiqueza.niveis.find(x => x.nome === e.target.value);
    store.update(p => { p.riqueza.nivel = n.nome; p.riqueza.multiplicador = n.multiplicadorRecursos; });
  } }, defRiqueza.niveis.map(n => el('option', { value: n.nome, selected: pc.riqueza?.nivel === n.nome }, `${n.nome} (${n.multiplicadorRecursos}×)`)));
  const inpDinheiro = el('input', { type: 'number', min: 0, value: Math.round(pc.riqueza?.dinheiro ?? 0), onchange: e => store.update(p => p.riqueza.dinheiro = parseFloat(e.target.value) || 0) });

  const economia = el('div', { class: 'panel' },
    el('h3', {}, 'Economia (Riqueza p. 12–13 · Dinheiro p. 181)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Nível de Riqueza'), selRiqueza),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Dinheiro ($)'), inpDinheiro),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Recursos iniciais (média × nível)'),
        el('div', { class: 'value' }, fmtMoney(recursosIniciais(pc, pc.riqueza?.recursosBase ?? 1000)))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso carregado'),
        valorCalculado(fmtKg(snap.carga.peso.kg), snap.carga.peso.detalhes.map(d => ({ fonte: `${d.qtd}× ${d.nome}`, valor: d.peso })))),
    ),
    el('p', { class: 'fonte' }, 'A média de riqueza do cenário é configurável em Configurações. Toda compra/venda é bloqueada quando impossível — com o motivo exato (ex.: "Faltam: $200") — e registrada no Histórico.'),
  );

  /* ---------------------------------------------- loja */
  const lojaList = el('div', { class: 'list' });
  function lojaDef(raw, categoria) {
    const d = { ...raw, categoria };
    if (!d.id) d.id = slug(d.nome);
    if (typeof d.peso !== 'number') d.peso = d.peso ?? null;
    if (d.custo === undefined) d.custo = null;
    return d;
  }
  function montarLoja() {
    lojaList.innerHTML = '';
    const grupos = [
      ['Armaduras (p. 186–194)', db.equipment.armaduras.map(a => lojaDef(a, 'armadura'))],
      ['Escudos (p. 195)', db.equipment.escudos.filter(s => typeof s.peso === 'number').map(a => lojaDef(a, 'escudo'))],
      ['Itens citados no material', db.equipment.itensAvulsos.map(a => lojaDef(a, 'item'))],
      ['Armas de longo alcance — exemplos (p. 257; dano/custo/peso NÃO DEFINIDOS)', db.equipment.armasLongoAlcanceExemplos.map(a => lojaDef(a, 'arma-distancia'))],
    ];
    for (const [titulo, itens] of grupos) {
      lojaList.append(el('h4', {}, titulo));
      for (const it of itens) lojaList.append(linhaLoja(it));
    }
    lojaList.append(el('h4', {}, 'Armas corpo-a-corpo — REGRA NÃO DEFINIDA'));
    lojaList.append(el('div', { class: 'row' },
      el('span', { class: 'grow meta' }, 'A Tabela de Armas não foi fornecida no material. Cadastre a arma com dano (ex.: Bal+1), ST mínima, peso e custo — o motor calcula NH, Aparar, dano e carga.'),
      el('button', { class: 'btn', onclick: () => cadastrarArma() }, '＋ Cadastrar arma')));
  }
  function linhaLoja(it) {
    const tem = (store.atual.inventario || []).find(i => i.id === it.id);
    const comprarAgora = () => {
      const v = podeComprar(store.atual, it, 1);
      if (!v.ok) { v.motivos.forEach(m => toast('✗ COMPRA IMPOSSÍVEL — ' + m, 'bad')); return; }
      store.update(p => { comprar(p, it, 1); });
      toast(`Comprado: ${it.nome} (${fmtMoney(v.preco)})`, 'ok');
    };
    return el('div', { class: 'row' },
      el('div', { class: 'grow' },
        el('div', { class: 'name' }, it.nome, tem ? ' ✓' : ''),
        el('div', { class: 'meta' },
          [it.dp !== undefined ? `DP ${it.dp}` : '', it.rd !== undefined ? `RD ${it.rd}` : '',
           it.custo != null ? fmtMoney(it.custo) : 'preço N/D',
           typeof it.peso === 'number' ? fmtKg(it.peso) : '',
           it.tr !== undefined ? `TR ${it.tr} · Prec +${it.prec} · ½D ${it.meioDano} · Max ${it.max}` : '']
            .filter(Boolean).join(' · '),
          it.notas ? ` — ${it.notas}` : '')),
      el('button', { class: 'btn small', onclick: comprarAgora }, 'Comprar'),
    );
  }
  function cadastrarArma() {
    const f = {};
    const campo = (label, key, ph, opts) => {
      const input = opts
        ? el('select', { onchange: e => f[key] = e.target.value }, opts.map(o => el('option', { value: o }, o)))
        : el('input', { placeholder: ph, oninput: e => f[key] = e.target.value });
      if (opts) f[key] = opts[0]; else f[key] = ph || '';
      return el('label', { class: 'field' }, label, input);
    };
    const form = el('div', { class: 'grid cols-2' },
      campo('Nome', 'nome', 'Espada curta'),
      campo('Dano (ex.: GDP-2, Bal+1, 1D+1)', 'dano', 'Bal+1'),
      campo('Tipo de dano', 'tipoDano', '', ['corte', 'contusão', 'perfuração']),
      campo('ST mínima', 'stMin', '10'),
      campo('Custo ($)', 'custo', '400'),
      campo('Peso (kg)', 'peso', '1.5'),
      campo('Perícia (id, ex.: espadas-curtas)', 'periciaId', 'espadas-curtas'),
      campo('Notas', 'notas', ''));
    modal('Cadastrar arma corpo-a-corpo', el('div', {},
      el('p', { class: 'fonte' }, 'Use os dados do material quando disponível. Campos vazios entram como N/D.'),
      form), {
      acoes: [el('button', { class: 'btn primary', onclick: () => {
        const def = {
          id: 'arma-' + slug(f.nome || 'custom'),
          nome: f.nome || 'Arma sem nome', categoria: 'arma',
          dano: f.dano || null, tipoDano: f.tipoDano || null,
          stMin: parseInt(f.stMin, 10) || null,
          custo: f.custo === '' ? null : parseFloat(String(f.custo).replace(',', '.')),
          peso: f.peso === '' ? 0 : parseFloat(String(f.peso).replace(',', '.')),
          periciaId: f.periciaId || null, notas: f.notas || '',
        };
        store.update(p => p.inventario.push(novoItem(def, 1)));
        document.querySelector('.modal-back')?.remove();
        toast('Arma cadastrada no inventário.', 'ok');
      } }, 'Salvar')],
    });
  }

  /* ---------------------------------------------- inventário */
  const invList = el('div', { class: 'list' });
  function montarInventario() {
    invList.innerHTML = '';
    const inv = store.atual.inventario || [];
    if (!inv.length) { invList.append(el('div', { class: 'row' }, 'Inventário vazio. Compre algo na loja ou cadastre uma arma.')); return; }
    const bloco = (titulo, itens) => {
      if (!itens.length) return;
      invList.append(el('h4', {}, titulo));
      for (const it of itens) {
        const e = !!it.equipado;
        const equipavel = ['armadura', 'escudo', 'arma'].includes(it.categoria) || !!it.dano;
        const venderAgora = () => {
          const fatorCfg = store.atual.config?.fatorVenda ?? 1;
          let res = null;
          store.update(p => { res = vender(p, it.id, 1, fatorCfg); });
          if (res.ok) toast(`Vendido por ${fmtMoney(res.ganho)}.` + (res.nota ? ' ' + res.nota : ''), 'ok');
          else toast(res.motivos[0], 'bad');
        };
        invList.append(el('div', { class: 'row' },
          el('div', { class: 'grow' },
            el('div', {}, el('span', { class: 'name' }, `${(it.qtd || 1) > 1 ? it.qtd + '× ' : ''}${it.nome}`), ' ',
              e ? el('span', { class: 'pill ok' }, 'equipado') : ''),
            el('div', { class: 'meta' },
              [it.custo != null ? fmtMoney(it.custo) : '', typeof it.peso === 'number' && it.peso ? fmtKg(it.peso) : '',
               it.dp !== undefined ? `DP ${it.dp}` : '', it.rd !== undefined ? `RD ${it.rd}` : '',
               it.dano ? `dano ${it.dano}${it.tipoDano ? ' (' + it.tipoDano + ')' : ''}` : '',
               it.stMin ? `ST mín ${it.stMin}` : '', it.periciaId ? `perícia: ${it.periciaId}` : '',
               it.tr !== undefined ? `TR ${it.tr}` : ''].filter(Boolean).join(' · '))),
          equipavel ? el('button', {
            class: `btn small ${e ? 'danger' : 'primary'}`,
            onclick: () => store.update(p => { const item = p.inventario.find(x => x.id === it.id); item.equipado = !item.equipado; }),
          }, e ? 'Desequipar' : 'Equipar') : '',
          el('button', { class: 'btn small', title: 'Armazenado não conta como Carga (p. 181)', onclick: () => store.update(p => { const item = p.inventario.find(x => x.id === it.id); item.armazenado = !item.armazenado; item.equipado = false; }) }, it.armazenado ? 'Carregar' : 'Armazenar'),
          el('button', { class: 'btn small', onclick: () => store.update(p => { const item = p.inventario.find(x => x.id === it.id); item.qtd = Math.max(1, (item.qtd || 1) + 1); }) }, '+'),
          el('button', { class: 'btn small', onclick: () => store.update(p => { const item = p.inventario.find(x => x.id === it.id); item.qtd = Math.max(1, (item.qtd || 1) - 1); }) }, '−'),
          el('button', { class: 'btn small', onclick: venderAgora }, 'Vender'),
          el('button', { class: 'btn small danger', onclick: () => confirmar('Descartar item', `Remover ${it.nome} do inventário?`, () => store.update(p => p.inventario = p.inventario.filter(x => x.id !== it.id))) }, '✕'),
        ));
      }
    };
    bloco('CARREGADO', inv.filter(i => !i.armazenado));
    bloco('ARMAZENADO (não conta como Carga)', inv.filter(i => i.armazenado));
  }

  /* ---------------------------------------------- carga */
  const c = snap.carga;
  const carga = el('div', { class: 'panel' },
    el('h3', {}, 'Carga e Consequências (p. 195–197)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Peso'), el('div', { class: 'value' }, fmtKg(c.peso.kg))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Nível'), valorCalculado(c.nome, [{ fonte: `ST ${pc.atributos.ST}` }, { fonte: `Peso ${fmtKg(c.peso.kg)} vs limites ST / 2×ST / 3×ST / 6×ST / 10×ST` }])),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Penalidade no Movimento'), el('div', { class: 'value' }, c.penalidade === null ? '—' : `−${c.penalidade}`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Fadiga por luta'), el('div', { class: 'value' }, (() => {
        const cf = custoFadiga(db, pc, 'luta', { nivelCarga: snap.carga.nivel });
        return cf.erro ? '—' : `+${cf.custo}`;
      })())),
    ),
    c.nota ? el('p', { class: 'pill bad', style: 'margin-top:.5rem' }, '⚠ ' + c.nota) : '',
    el('p', { class: 'fonte' }, 'Fluxo automático: peso total → relação com ST → nível de carga → penalidade → Deslocamento → Esquiva → fadiga em combate.'),
  );

  main.append(
    el('h1', { class: 'page-title' }, '⚔️ Equipamentos'),
    economia, carga,
    el('div', { class: 'grid cols-2', style: 'margin-top:.9rem' },
      el('div', { class: 'panel' }, el('h3', {}, '🛒 Loja'), lojaList),
      el('div', { class: 'panel' }, el('h3', {}, '🎒 Inventário'), invList),
    ),
  );
  montarLoja(); montarInventario();
}
