/* Aba LIVRO — livro digital navegável gerado da MESMA base de regras (data/*.json).
 * Nenhuma regra duplicada: o livro lê o banco como o app lê.
 */
import { el } from '../ui.js';

const LIMITE_LISTA = 400;

export function renderLivro(main, { db, params }) {
  const capitulos = montarCapitulos(db);
  const aberto = params[0] || capitulos[0].id;

  const nav = el('nav', { class: 'book-nav', 'aria-label': 'Capítulos' });
  const conteudo = el('div', { class: 'book-content' });

  for (const c of capitulos) {
    nav.append(el('a', {
      class: 'book-link' + (c.id === aberto ? ' active' : ''),
      href: `#/livro/${c.id}`,
    }, el('span', { class: 'book-num' }, c.num), el('span', {}, c.titulo)));
  }

  const cap = capitulos.find(c => c.id === aberto) || capitulos[0];
  conteudo.append(
    el('div', { class: 'book-chap-header' },
      el('div', { class: 'book-chap-num' }, `Capítulo ${cap.num}`),
      el('h2', {}, cap.titulo),
      cap.fonte ? el('p', { class: 'fonte' }, cap.fonte) : ''),
  );
  try { cap.render(conteudo, db); }
  catch (e) { conteudo.append(el('p', { class: 'pill bad' }, 'Erro ao renderizar capítulo: ' + e.message)); }

  const shell = el('div', { class: 'book-shell' }, nav, conteudo);
  main.append(el('h1', { class: 'page-title' }, '📖 Livro Digital'), shell);
}

/* ------------------------------------------------------------------ capítulos */

function montarCapitulos(db) {
  const T = db.tables;
  return [
    {
      id: 'abertura', num: 0, titulo: 'Abertura',
      render: (c) => {
        c.append(
          el('img', { src: 'book/images/capa.svg', alt: 'Capa do livro', class: 'book-cover' }),
          el('p', {}, el('b', {}, 'Bem-vindo ao Livro Digital.'), ' Tudo aqui é gerado da mesma base de regras usada pela ficha (arquivos ', el('code', {}, 'data/*.json'), '). O que o material não define aparece como ', el('span', { class: 'pill warn' }, 'REGRA NÃO DEFINIDA'), ' — nunca inventado.'),
          el('p', { class: 'fonte' }, T._fonte || ''),
        );
      },
    },
    {
      id: 'criacao', num: 1, titulo: 'Criação de Personagem', fonte: 'Atributos (p. 1–5) · Perícias (p. 104–112)',
      render: (c, db) => {
        c.append(
          el('h3', {}, 'Custo de atributos'),
          tabela(db.tables.custoAtributos.tabela),
          el('h3', {}, 'Progressão de custo'),
          valor(db.tables.custoAtributos.progressao),
          el('h3', {}, 'Custo de perícias'),
          el('p', { class: 'fonte' }, 'Físicas: Fácil ½pt→NH+1 … · Mentais: veja tabela do material (p. 105). O motor aplica exatamente esta tabela.'),
          tabela(db.tables.custoPericias.fisicas),
          tabela(db.tables.custoPericias.mentais),
        );
      },
    },
    {
      id: 'pericias', num: 2, titulo: 'Perícias', fonte: `Catálogo completo — ${db.skills.length} perícias`,
      render: (c, db) => {
        const porCat = {};
        for (const s of db.skills) (porCat[s.categoria] ||= []).push(s);
        for (const [cat, lista] of Object.entries(porCat).sort((a, b) => a[0].localeCompare(b[0], 'pt'))) {
          c.append(el('h3', {}, `${cat} (${lista.length})`));
          c.append(el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, el('th', {}, 'Perícia'), el('th', {}, 'Tipo'), el('th', {}, 'Default'), el('th', {}, 'Pré-req.')),
            lista.slice(0, LIMITE_LISTA).map(s => el('tr', {},
              el('td', {}, el('b', {}, s.nome), s.fonte ? el('div', { class: 'fonte' }, s.fonte) : ''),
              el('td', {}, `${s.tipo === 'Física' ? 'Fís' : 'Men'}/${s.dificuldade}`),
              el('td', {}, (s.defaults || []).join(' · ')),
              el('td', {}, (s.prereqs || []).join('; ')))))));
        }
      },
    },
    {
      id: 'vantagens', num: 3, titulo: 'Vantagens & Desvantagens', fonte: `Vantagens (p. 17–40) · Desvantagens (p. 40–88) · Peculiaridades (p. 88–99)`,
      render: (c, db) => {
        c.append(el('h3', {}, `Vantagens (${db.advantages.length})`));
        c.append(el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
          el('tr', {}, el('th', {}, 'Vantagem'), el('th', {}, 'Custo')),
          db.advantages.map(a => el('tr', {}, el('td', {}, el('b', {}, a.nome), el('div', { class: 'fonte' }, (a.descricao || '').slice(0, 120)), a.fonte ? el('div', { class: 'fonte' }, a.fonte) : ''), el('td', {}, a.custo || ''))))));
        c.append(el('h3', {}, `Desvantagens (${db.disadvantages.length})`));
        c.append(el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
          el('tr', {}, el('th', {}, 'Desvantagem'), el('th', {}, 'Custo')),
          db.disadvantages.slice(0, LIMITE_LISTA).map(a => el('tr', {}, el('td', {}, el('b', {}, a.nome), el('div', { class: 'fonte' }, (a.descricao || '').slice(0, 120))), el('td', {}, a.custo || ''))))));
        c.append(el('h3', {}, 'Peculiaridades'));
        c.append(el('p', {}, `Máximo ${db.quirks?.maximo ?? 5}, −1 ponto cada, fora do limite de desvantagens. Exemplos do material:`));
        c.append(el('ul', { style: 'padding-left:1.2rem' }, (db.quirks?.exemplos || []).slice(0, 60).map(x => el('li', {}, x))));
      },
    },
    {
      id: 'combate', num: 4, titulo: 'Combate', fonte: 'Sistema Básico (p. 220–233) · Avançado (p. 233–275) · Ferimentos (p. 276–300)',
      render: (c, db) => {
        const M = db.maneuvers || {};
        c.append(el('h3', {}, 'Início da rodada'), valor(M.inicioRodada));
        c.append(el('h3', {}, 'Manobras'),
          el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, el('th', {}, 'Manobra'), el('th', {}, 'Básico'), el('th', {}, 'Avançado')),
            (M.manobras || []).map(m => el('tr', {}, el('td', {}, el('b', {}, m.nome)), el('td', {}, m.basico || ''), el('td', {}, m.avancado || ''))))));
        c.append(el('h3', {}, 'Defesas'), valor(M.defesas));
        const F = db.tables.ferimentos || {};
        for (const [k, v] of Object.entries(F)) {
          if (k === 'fonte') continue;
          c.append(el('h4', {}, titulozinho(k)), valor(v));
        }
        c.append(el('h3', {}, 'Tipos de dano'), valor(db.tables.tiposDano));
        c.append(el('h3', {}, 'Locais de impacto'), valor(db.tables.locaisImpacto));
        c.append(el('h3', {}, 'Choques de retorno (críticos)'), valor(db.tables.choquesRetorno?.tabela3d || db.tables.choquesRetorno));
      },
    },
    {
      id: 'equipamento', num: 5, titulo: 'Carga & Equipamento', fonte: 'Carga (p. 195–197) · Armaduras (p. 186–194) · Escudos (p. 194–195) · Encantamento (p. 323)',
      render: (c, db) => {
        const E = db.equipment;
        c.append(el('h3', {}, 'Níveis de carga'), valor(db.tables.carga?.niveis), valor(db.tables.carga?.maximoCarregavel));
        c.append(el('h3', {}, `Armaduras (${E.armaduras?.length || 0})`),
          el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, ['Armadura', 'NT', 'DP', 'RD', 'Custo', 'Peso'].map(h => el('th', {}, h))),
            (E.armaduras || []).map(a => el('tr', {}, el('td', {}, el('b', {}, a.nome)), el('td', {}, a.nt), el('td', { class: 'num' }, String(a.dp)), el('td', { class: 'num' }, String(a.rd)), el('td', { class: 'num' }, a.custo != null ? '$' + a.custo : 'N/D'), el('td', { class: 'num' }, String(a.peso)))))));
        c.append(el('h3', {}, `Escudos (${E.escudos?.length || 0})`),
          el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, ['Escudo', 'DP', 'Custo', 'Peso'].map(h => el('th', {}, h))),
            (E.escudos || []).map(a => el('tr', {}, el('td', {}, el('b', {}, a.nome)), el('td', {}, String(a.dp)), el('td', { class: 'num' }, a.custo != null ? '$' + a.custo : 'N/D'), el('td', { class: 'num' }, String(a.peso)))))));
        c.append(el('h3', {}, 'Qualidade'), valor(E.qualidade));
        c.append(el('h3', {}, 'Encantamento (método lento)'), valor(E.encantamentoCustoLento?.regra || E.encantamentoCustoLento?._regra),
          el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, el('th', {}, 'Encantos'), el('th', {}, 'Custo')),
            Object.entries(E.encantamentoCustoLento || {}).filter(([k]) => !k.startsWith('_') && k !== 'regra').map(([k, v]) => el('tr', {}, el('td', {}, String(k)), el('td', { class: 'num' }, String(v)))))));
        c.append(el('p', { class: 'pill warn' }, 'Tabela de armas corpo-a-corpo e Lista de Equipamentos: REGRA NÃO DEFINIDA no material fornecido.'));
      },
    },
    {
      id: 'fadiga', num: 6, titulo: 'Fadiga', fonte: 'p. 298–300',
      render: (c, db) => {
        const F = db.tables.fadiga || {};
        for (const [k, v] of Object.entries(F)) {
          if (k === 'fonte') continue;
          c.append(el('h4', {}, titulozinho(k)), valor(v));
        }
      },
    },
    {
      id: 'magia', num: 7, titulo: 'Magia', fonte: 'p. 300–337',
      render: (c, db) => {
        c.append(el('h3', {}, 'Níveis de mana'), valor(db.tables.mana?.niveis));
        c.append(el('h3', {}, 'Rituais'), valor(db.tables.rituaisMagia?.faixas || db.tables.rituaisMagia));
        c.append(el('h3', {}, 'Redução de custo por NH'), valor(db.tables.reducaoCustoEnergia?.regra));
        const porEscola = {};
        for (const s of db.spells) (porEscola[s.escola || 'Outras'] ||= []).push(s);
        for (const [escola, lista] of Object.entries(porEscola).sort((a, b) => a[0].localeCompare(b[0], 'pt'))) {
          c.append(el('h3', {}, `${escola} (${lista.length})`));
          c.append(el('div', { class: 'tbl-scroll' }, el('table', { class: 'tbl' },
            el('tr', {}, ['Magia', 'Classe', 'Custo', 'Duração', 'Pré-req.', 'Pág.'].map(h => el('th', {}, h))),
            lista.map(s => el('tr', {},
              el('td', {}, el('b', {}, s.nome), el('div', { class: 'fonte' }, (s.descricao || '').slice(0, 140) + '…')),
              el('td', {}, s.classes || ''),
              el('td', {}, s.Custo || 'N/D'),
              el('td', {}, s.Duração || ''),
              el('td', {}, s['Pré-requisitos'] || ''),
              el('td', {}, (s.fonte || '').replace('p. ', '')))))));
        }
      },
    },
    {
      id: 'tabelas', num: 8, titulo: 'Tabelas de Referência',
      render: (c, db) => {
        const grupos = [
          ['Quedas', db.tables.queda],
          ['Primeiros socorros', db.tables.primeirosSocorros],
          ['Modificadores Velocidade/Distance', db.tables.modificadoresVelocidadeDistancia],
          ['Modificadores de Tamanho', db.tables.modificadoresTamanho],
          ['Altura e peso', db.tables.alturaPeso],
          ['Aparência aleatória', db.tables.aparenciaAleatoria],
          ['Probabilidades 3d', db.tables.probabilidades3d],
        ];
        for (const [titulo, g] of grupos) {
          if (!g) continue;
          c.append(el('h3', {}, titulo), el('p', { class: 'fonte' }, g.fonte || ''));
          if (g._aviso) c.append(el('p', { class: 'pill warn' }, g._aviso));
          for (const [k, v] of Object.entries(g)) {
            if (k === 'fonte' || k === '_aviso' || k === '_fonte') continue;
            c.append(el('h4', {}, titulozinho(k)), valor(v));
          }
        }
      },
    },
  ];
}

/* ------------------------------------------------------------------ helpers */

function tabela(dados) {
  if (!Array.isArray(dados)) return valor(dados);
  const wrap = el('div', { class: 'tbl-scroll' });
  const t = el('table', { class: 'tbl' });
  for (const linha of dados) {
    if (Array.isArray(linha)) t.append(el('tr', {}, linha.map(cel => el('td', { class: 'num' }, String(cel)))));
    else if (linha && typeof linha === 'object') t.append(el('tr', {}, Object.values(linha).map(cel => el('td', {}, String(cel)))));
  }
  wrap.append(t);
  return wrap;
}

/** Renderiza qualquer valor do banco: string, número, lista, objeto. */
function valor(v) {
  if (v === null || v === undefined) return el('p', { class: 'fonte' }, '—');
  if (typeof v === 'string' || typeof v === 'number') return el('p', { style: 'margin:.3rem 0' }, String(v));
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') {
      const wrap = el('div', { class: 'tbl-scroll' });
      const t = el('table', { class: 'tbl' }, el('tr', {}, Object.keys(v[0]).map(k => el('th', {}, titulozinho(k)))));
      for (const item of v) t.append(el('tr', {}, Object.values(item).map(x => el('td', {}, String(x)))));
      wrap.append(t);
      return wrap;
    }
    return el('ul', { style: 'padding-left:1.2rem' }, v.map(x => el('li', {}, String(x))));
  }
  if (typeof v === 'object') {
    const dl = el('div', { class: 'book-dl' });
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('_')) continue;
      dl.append(el('div', { class: 'book-dt' }, titulozinho(k)));
      dl.append(el('div', { class: 'book-dd' }, valor(val)));
    }
    return dl;
  }
  return el('p', {}, String(v));
}

function titulozinho(k) {
  const txt = String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
