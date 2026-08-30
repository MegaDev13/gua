/* Índice de consulta do livro, derivado da mesma base usada pela ficha. */
import { normalizeSearch } from './filters.js';

const slug = value => normalizeSearch(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const excerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
const pageFrom = source => String(source || '').match(/p\.\s*(\d+)/i)?.[1] || null;

export function buildBookIndex(db) {
  const chapters = db.book?.capitulos || [];
  const chapterById = Object.fromEntries(chapters.map(chapter => [chapter.id, chapter]));
  const docs = [];
  const add = raw => {
    const chapter = chapterById[raw.chapterId];
    const id = raw.id || `${raw.chapterId}-${raw.sectionId || slug(raw.title)}`;
    docs.push({
      id,
      title: raw.title,
      text: raw.text || '',
      excerpt: excerpt(raw.excerpt || raw.text),
      chapterId: raw.chapterId,
      chapter: chapter?.titulo || raw.chapterId,
      sectionId: raw.sectionId || '',
      categories: [...new Set([...(chapter?.categorias || []), ...(raw.categories || [])])],
      kind: raw.kind || 'Seção',
      source: raw.source || chapter?.fonte || '',
      page: raw.page || pageFrom(raw.source || chapter?.fonte),
      entityId: raw.entityId || null,
      route: `#/livro/ler/${raw.chapterId}${raw.sectionId ? `/${raw.sectionId}` : ''}`,
    });
  };

  for (const chapter of chapters) {
    add({ id: `capitulo-${chapter.id}`, title: chapter.titulo, text: `${chapter.subtitulo}. ${chapter.resumo}`, chapterId: chapter.id, kind: 'Capítulo', categories: chapter.categorias, source: chapter.fonte });
    for (const section of chapter.secoes || []) add({
      id: `secao-${chapter.id}-${section.id}`, title: section.titulo,
      text: `${chapter.resumo} ${section.categorias?.join(' ') || ''}`,
      chapterId: chapter.id, sectionId: section.id, kind: labelKind(section.tipo),
      categories: section.categorias, source: chapter.fonte,
    });
  }

  for (const skill of db.skills || []) add({
    id: `skill-${skill.id}`, title: skill.nome, text: `${skill.descricao || ''} ${(skill.defaults || []).join(' ')} ${(skill.prereqs || []).join(' ')}`,
    chapterId: 'pericias', sectionId: `pericia-${skill.id}`, kind: 'Perícia', categories: ['Perícias', skill.categoria, skill.tipo, skill.dificuldade], source: skill.fonte, entityId: skill.id,
  });
  for (const advantage of db.advantages || []) add({
    id: `advantage-${advantage.id}`, title: advantage.nome, text: `${advantage.descricao || ''} ${advantage.custo || ''}`,
    chapterId: 'vantagens', sectionId: `vantagem-${advantage.id}`, kind: 'Vantagem', categories: ['Vantagens', 'Criação'], source: advantage.fonte, entityId: advantage.id,
  });
  for (const disadvantage of db.disadvantages || []) add({
    id: `disadvantage-${disadvantage.id}`, title: disadvantage.nome, text: `${disadvantage.descricao || ''} ${disadvantage.custo || ''}`,
    chapterId: 'vantagens', sectionId: `desvantagem-${disadvantage.id}`, kind: 'Desvantagem', categories: ['Desvantagens', 'Criação'], source: disadvantage.fonte, entityId: disadvantage.id,
  });
  for (const spell of db.spells || []) add({
    id: `spell-${spell.id}`, title: spell.nome,
    text: `${spell.descricao || ''} ${spell.classes || ''} ${spell.Custo || ''} ${spell.Duração || ''} ${spell['Pré-requisitos'] || ''} ${spell.Objetos || ''}`,
    chapterId: 'magia', sectionId: `magia-${spell.id}`, kind: 'Magia', categories: ['Magia', spell.escola, ...String(spell.classes || '').split(/[;,]/).map(x => x.trim()).filter(Boolean)], source: spell.fonte, entityId: spell.id,
  });

  const equipmentGroups = [
    ['armadura', 'Armadura', db.equipment?.armaduras || []],
    ['escudo', 'Escudo', db.equipment?.escudos || []],
    ['item', 'Equipamento', db.equipment?.itensAvulsos || []],
  ];
  for (const [prefix, kind, items] of equipmentGroups) for (const item of items) {
    const id = item.id || slug(item.nome);
    add({
      id: `${prefix}-${id}`, title: item.nome,
      text: `${item.notas || ''} custo ${item.custo ?? 'não definido'} peso ${item.peso ?? 'não definido'} ${item.dp != null ? `DP ${item.dp}` : ''} ${item.rd != null ? `RD ${item.rd}` : ''}`,
      chapterId: 'equipamento', sectionId: `equipamento-${id}`, kind, categories: ['Equipamentos', `${kind}s`], source: item.fonte, entityId: id,
    });
  }

  return docs;
}

function labelKind(type) {
  return ({ regra: 'Regra', tabela: 'Tabela', catalogo: 'Catálogo', dica: 'Dica', nota: 'Nota', referencia: 'Referência' })[type] || 'Seção';
}
