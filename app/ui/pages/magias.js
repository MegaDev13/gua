/* Aba PODERES — grimório com filtros universais e requisitos contextuais. */
import { el, toast, modal, valorCalculado, dadosVisual, requisitoBadge } from '../ui.js';
import { createFilterPanel, createFavoriteStore } from '../filters.js';
import { store } from '../store.js';
import { computeAll } from '../../engine/engine.js';
import { iqMagico, nivelMagia, custoBase, custoManutencao, conjurar, parsePrereqs, reducaoCusto } from '../../engine/spells.js';
import { dice } from '../../engine/combat.js';
import { gastarFadiga } from '../../engine/fatigue.js';

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function renderMagias(main, { db }) {
  const pc = store.atual;
  const snap = computeAll(db, pc);
  const magicIQ = iqMagico(pc, db);
  const favorites = createFavoriteStore('spells');
  const known = new Set((pc.magias || []).map(spell => spell.id));
  const aptitude = (pc.vantagens || []).find(trait => /aptid[aã]o m[aá]gica/i.test(trait.nome || '') || trait.id === 'aptidao-magica');

  const header = el('div', { class: 'panel' },
    el('h3', {}, 'Magia (p. 300–314)'),
    el('div', { class: 'grid cols-4' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'IQ mágico'), valorCalculado(magicIQ, [
        { fonte: `IQ ${pc.atributos.IQ}` },
        ...(aptitude ? [{ fonte: `Aptidão Mágica nível ${aptitude.niveis || aptitude.nivel || 1}` }] : []),
      ], 'IQ + Aptidão Mágica (máx. 3) + Memória Eidética')),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Magias aprendidas'), el('div', { class: 'value' }, String((pc.magias || []).length))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Redução de custo'), el('div', { class: 'value' }, reductionText(snap))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'ST (energia)'), el('div', { class: 'value' }, `${snap.combate.stEfetiva}/${pc.atributos.ST}`))),
  );

  const levelOf = id => {
    const entry = (pc.magias || []).find(spell => spell.id === id);
    return entry ? nivelMagia(db, pc, entry).nivel : null;
  };
  const catalog = db.spells.map(spell => {
    const requirements = parsePrereqs(spell, db);
    const requirementStatus = checkPrereqs(requirements, db, pc);
    const baseCost = custoBase(spell);
    const isKnown = known.has(spell.id);
    return {
      ...spell, _spell: spell, _requirementStatus: requirementStatus,
      classesList: String(spell.classes || 'Comum').split(/[;,]/).map(value => value.trim()).filter(Boolean),
      objetosList: objectTags(spell.Objetos),
      custoNumerico: baseCost,
      status: isKnown ? 'Aprendida' : 'Não aprendida',
      podeAprender: !isKnown && requirementStatus.ok && requirementStatus.verified,
      podeUsarAgora: isKnown && requirementStatus.ok && requirementStatus.verified && baseCost != null && baseCost <= snap.combate.stEfetiva && !snap.combate.desmaiado,
      favorito: favorites.has(spell.id),
      tags: [spell.escola, ...String(spell.classes || '').split(/[;,]/), ...(spell['Pré-requisitos'] ? ['Com pré-requisito'] : ['Sem pré-requisito'])],
    };
  });

  const results = el('div');
  let filters;
  function draw(items) {
    results.innerHTML = '';
    const bySchool = groupBy(items, item => item.escola || 'Outras');
    for (const [school, spells] of Object.entries(bySchool).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
      const body = el('div', { class: 'list' }, spells.map(item => spellRow(item)));
      results.append(el('details', { open: items.length < 28, class: 'panel spell-group', style: 'padding:.6rem .9rem' },
        el('summary', { style: 'cursor:pointer;font-weight:600' }, `${school} (${spells.length})`), body));
    }
    if (!items.length) results.append(el('div', { class: 'row', style: 'justify-content:center' }, 'Nenhuma magia corresponde aos filtros.'));
  }

  function spellRow(item) {
    const spell = item._spell;
    const has = known.has(spell.id);
    const level = has ? levelOf(spell.id) : null;
    const base = custoBase(spell), maintenance = custoManutencao(spell);
    const learn = () => {
      if (!has && (!item._requirementStatus.ok || !item._requirementStatus.verified)) {
        const prefix = item._requirementStatus.verified ? 'Não pode aprender: ' : 'Requisito exige verificação manual: ';
        toast(prefix + item._requirementStatus.details.join('; '), 'bad');
        return;
      }
      store.update(character => {
        const entry = (character.magias || []).find(current => current.id === spell.id);
        if (entry) entry.pontos += 1;
        else character.magias.push({ id: spell.id, pontos: 1 });
      });
    };
    return el('div', { class: 'row' },
      el('button', {
        class: 'favorite-button', title: item.favorito ? 'Remover dos favoritos' : 'Marcar como favorita',
        'aria-label': item.favorito ? 'Remover dos favoritos' : 'Marcar como favorita',
        onclick: () => { item.favorito = favorites.toggle(spell.id); filters.refresh(); },
      }, item.favorito ? '★' : '☆'),
      el('div', { class: 'grow' },
        el('div', { class: 'name' }, spell.nome, has ? el('span', { class: 'pill ok', style: 'margin-left:.4rem' }, `NH ${level}`) : ''),
        el('div', { class: 'meta' }, [spell.classes || '', base != null ? `custo ${base}` : 'custo N/D', maintenance != null ? `manter ${maintenance}` : '', spell.Duração || ''].filter(Boolean).join(' · ')),
        el('div', { class: 'meta fonte' }, (spell.descricao || '').slice(0, 140) + '…'),
        spell['Pré-requisitos'] ? el('div', {}, requirementBadge(item._requirementStatus)) : ''),
      el('div', { class: 'btn-row magic-actions', style: 'margin:0;flex-direction:column;gap:.25rem' },
        el('button', {
          class: 'btn small', title: item._requirementStatus.details.join('; ') || 'Investir 1 ponto', onclick: learn,
          disabled: !has && (!item._requirementStatus.ok || !item._requirementStatus.verified),
        }, has ? '+1 pt' : item._requirementStatus.ok && item._requirementStatus.verified ? 'Aprender' : item._requirementStatus.verified ? 'Bloqueada' : 'Verificar'),
        has ? el('button', { class: 'btn small primary', onclick: () => castSpell(spell) }, '✨ Conjurar') : '',
        has ? el('button', { class: 'btn small danger', title: 'Remover 1 ponto', onclick: () => store.update(character => {
          const entry = character.magias.find(current => current.id === spell.id);
          entry.pontos -= 1;
          if (entry.pontos < 1) character.magias = character.magias.filter(current => current !== entry);
        }) }, '−1') : '',
        el('button', { class: 'btn small ghost', onclick: () => detail(spell, level) }, '👁'),
        el('a', { class: 'btn small ghost', href: `#/livro/ler/magia/magia-${spell.id}`, title: 'Ver no livro' }, '📖')),
    );
  }

  filters = createFilterPanel({
    id: 'spells', items: catalog,
    searchFields: ['nome', 'descricao', 'escola', 'classes', 'Pré-requisitos', 'Objetos', 'tags'],
    searchPlaceholder: 'Pesquisar magia, efeito, escola ou objeto…',
    schema: [
      { key: 'escola', label: 'Escola', type: 'multi' },
      { key: 'classesList', label: 'Classe / tipo', type: 'multi' },
      { key: 'custoNumerico', label: 'Custo base', type: 'range' },
      { key: 'status', label: 'Status', type: 'multi' },
      { key: 'objetosList', label: 'Objetos', type: 'multi' },
      { key: 'podeAprender', label: 'Somente o que posso aprender', type: 'relation' },
      { key: 'podeUsarAgora', label: 'Somente o que posso usar agora', type: 'relation' },
      { key: 'favorito', label: 'Favoritas', type: 'relation' },
      { key: 'tags', label: 'Tags', type: 'multi' },
    ],
    quickFilters: [
      { label: 'Aprendidas', apply: state => state.groups.status.include = ['Aprendida'] },
      { label: 'Posso aprender', apply: state => state.groups.podeAprender = true },
      { label: 'Posso usar agora', apply: state => state.groups.podeUsarAgora = true },
      { label: 'Favoritas', apply: state => state.groups.favorito = true },
      { label: 'Área', apply: state => state.groups.classesList.include = ['Área'] },
      { label: 'Projétil', apply: state => state.groups.classesList.include = ['Projétil'] },
    ],
    onChange: draw,
  });

  const powers = el('div', { class: 'panel' },
    el('h3', {}, 'Módulo PODERES — pronto e vazio'),
    el('p', {}, 'O material fornecido não define poderes não-mágicos. O mecanismo de filtros e requisitos já é reutilizável; um catálogo futuro poderá usar a mesma arquitetura sem inventar regras.'),
    el('p', { class: 'fonte' }, 'Campos ausentes continuam marcados como REGRA NÃO DEFINIDA.'),
  );

  main.append(
    el('h1', { class: 'page-title' }, '✨ Poderes & Magias', el('small', {}, `${db.spells.length} magias do material`)),
    header,
    el('section', { style: 'margin-top:.9rem' }, filters.node, results),
    powers,
  );

  function castSpell(spell) {
    const mana = el('select', {}, ['Normal', 'Alta', 'Muito Alta', 'Baixa', 'Nula'].map(level => el('option', { value: level }, `Mana ${level}`)));
    const energy = el('input', { type: 'number', min: 0, value: 0, style: 'width:80px' });
    const roll = el('button', { class: 'btn primary' }, 'Conjurar');
    const output = el('div');
    roll.onclick = () => {
      const entry = (store.atual.magias || []).find(current => current.id === spell.id);
      const result = conjurar(db, store.atual, entry, { mana: mana.value, energiaExtra: parseInt(energy.value, 10) || 0, dice });
      if (result.erro) { toast(result.erro, 'bad'); return; }
      let content = el('div', {},
        result.resultado ? dadosVisual(result.resultado.rolls, { crit: result.resultado.critico && result.resultado.sucesso, fail: result.resultado.critico && !result.resultado.sucesso }) : '',
        el('p', {}, `NH ${result.nhEfetivo} · custo final ${result.custoFinal} · gasto ${result.gasto} ST`),
        result.resultado ? el('p', {}, el('b', {}, result.resultado.descricao)) : '');
      if (result.gasto > 0) store.update(character => { character.combate.fadiga = gastarFadiga(character, result.gasto).fadiga; });
      output.innerHTML = ''; output.append(el('div', { class: 'panel', style: 'margin-top:.6rem' }, content));
    };
    modal(`Conjurar: ${spell.nome}`, el('div', {},
      el('div', { class: 'btn-row', style: 'margin:0' }, mana, el('span', { class: 'label' }, 'Energia extra:'), energy, roll),
      el('p', { class: 'fonte' }, 'O Rule Engine calcula NH, mana, redução, custo e gasto de energia.'), output));
  }

  function detail(spell, level) {
    modal(spell.nome, el('div', {},
      el('p', {}, el('b', {}, `${spell.escola || '?'} · ${spell.classes || '?'}`), level != null ? ` · seu NH: ${level}` : ''),
      el('p', {}, spell.descricao || ''),
      el('table', { class: 'tbl' }, ['Custo', 'Duração', 'Pré-requisitos', 'Objetos'].filter(key => spell[key]).map(key => el('tr', {}, el('td', {}, el('b', {}, key)), el('td', {}, spell[key])))),
      el('p', { class: 'fonte' }, `Fonte: material, ${spell.fonte || ''}`),
      el('a', { class: 'btn', href: `#/livro/ler/magia/magia-${spell.id}` }, '📖 Ver no livro')));
  }
}

function reductionText(snapshot) {
  let max = 0;
  for (const entry of (store.atual.magias || [])) {
    const magic = snapshot.magias.find(item => item.entry === entry);
    if (magic && magic.nivel > max) max = magic.nivel;
  }
  const reduction = reducaoCusto(max);
  return reduction ? `−${reduction} (NH ${max})` : 'nenhuma';
}

function checkPrereqs(requirements, db, character) {
  if (!requirements.length) return { ok: true, verified: true, details: [] };
  const evaluate = requirement => {
    if (requirement.tipo === 'grupo-ou') {
      const alternatives = (requirement.requisitos || []).map(evaluate);
      const satisfied = alternatives.find(result => result.ok && result.verified);
      if (satisfied) return { ok: true, verified: true, detail: `Alternativa atendida: ${satisfied.detail}` };
      const unknown = alternatives.some(result => !result.verified);
      return { ok: unknown, verified: !unknown, detail: unknown ? `Verificar uma alternativa: ${requirement.texto}` : `Nenhuma alternativa atendida: ${requirement.texto}` };
    }
    if (requirement.tipo === 'magia') {
      const has = (character.magias || []).some(entry => entry.id === requirement.id || normalize(db.spell(entry.id)?.nome) === normalize(requirement.nome));
      return { ok: has, verified: true, detail: has ? `Possui ${requirement.nome}` : `Falta magia: ${requirement.nome}` };
    }
    if (requirement.tipo === 'vantagem') {
      const has = (character.vantagens || []).some(trait => trait.id === requirement.id || normalize(trait.nome) === normalize(requirement.nome));
      return { ok: has, verified: true, detail: has ? `Possui ${requirement.nome}` : `Falta vantagem: ${requirement.nome}` };
    }
    if (requirement.tipo === 'atributo') {
      const value = character.atributos[requirement.key];
      return { ok: value >= requirement.min, verified: true, detail: `${requirement.key} ${value} ${value >= requirement.min ? '≥' : '<'} ${requirement.min}` };
    }
    if (requirement.tipo === 'potencial') {
      const aptitude = (character.vantagens || []).find(trait => /aptid[aã]o m[aá]gica/i.test(trait.nome || '') || trait.id === 'aptidao-magica');
      const level = aptitude ? (aptitude.niveis || 1) : 0;
      return { ok: level >= requirement.niveis, verified: true, detail: `Aptidão Mágica ${level} ${level >= requirement.niveis ? '≥' : '<'} ${requirement.niveis}` };
    }
    if (requirement.tipo === 'texto') return { ok: true, verified: false, detail: `Verificação manual: ${requirement.texto}` };
    return { ok: true, verified: false, detail: `Requisito não estruturado: ${requirement.tipo}` };
  };
  const results = requirements.map(evaluate);
  return { ok: results.every(result => result.ok), verified: results.every(result => result.verified), details: results.map(result => result.detail) };
}

function requirementBadge(status) {
  if (!status.verified) return el('span', { class: 'pill warn', title: status.details.join('; ') }, '△ Verificação manual');
  return requisitoBadge(status.ok, status.ok ? 'Pré-requisitos atendidos' : status.details.join('; '));
}

function objectTags(text) {
  const value = normalize(text);
  const options = [['cajado', 'Cajado'], ['vara de condao', 'Vara de condão'], ['joia', 'Joia'], ['amuleto', 'Amuleto'], ['anel', 'Anel'], ['roupa', 'Roupa'], ['arma', 'Arma']];
  return options.filter(([needle]) => value.includes(needle)).map(([, label]) => label);
}
function groupBy(items, key) { return items.reduce((groups, item) => { (groups[key(item)] ||= []).push(item); return groups; }, {}); }
