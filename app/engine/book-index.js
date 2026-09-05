/* Índice de consulta do livro, derivado da mesma base usada pela ficha. */
import { normalizeSearch } from './filters.js';

const slug = value => normalizeSearch(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const excerpt = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
const pageFrom = source => String(source || '').match(/p\.\s*(\d+)/i)?.[1] || null;

/* Rotas do índice: uma seção real de data/book.json ou uma âncora `.book-anchor`
 * renderizada dentro do capítulo (armas, materiais, efeitos, extensões, potências, blocos da ficha). */
const SECTION_CRIACAO_FICHA = { atributos: 'atributos', secundarios: 'secundarios', parametros: 'modelo-ficha' };

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
  const ROTULO_GRUPO_VANTAGEM = { classica: 'Clássica', social: 'Custo variável', nova: 'Nova (2026)' };
  for (const advantage of db.advantages || []) add({
    id: `advantage-${advantage.id}`, title: advantage.nome,
    text: [
      advantage.descricao || '', `Custo: ${advantage.custo || 'variável'}.`,
      (advantage.efeitos || []).map(e => `${e.nome || e.alvo || e.tipo} ${e.valor ?? ''} ${e.nota || ''}`.replace(/\s+/g, ' ').trim()).join(' '),
      (advantage.niveis || []).map(n => `${n.nome} (${n.custo} pts) ${n.efeito || ''}`.replace(/\s+/g, ' ').trim()).join(' '),
      (advantage.requisitos || []).length ? `Requisitos: ${advantage.requisitos.join('; ')}.` : '',
      (advantage.incompativel || []).length ? `Incompatível: ${advantage.incompativel.join('; ')}.` : '',
      advantage.unicidade || '', advantage.fonteLegada || '',
    ].filter(Boolean).join(' '),
    chapterId: 'vantagens', sectionId: `vantagem-${advantage.id}`,
    kind: advantage.grupo === 'nova' ? 'Vantagem nova' : 'Vantagem',
    categories: ['Vantagens', 'Criação', ROTULO_GRUPO_VANTAGEM[advantage.grupo] || 'Clássica',
      ...(advantage.efeitos || []).map(e => e.tipo).filter((v, i, lista) => lista.indexOf(v) === i)],
    source: advantage.fonte, entityId: advantage.id,
  });

  /* Capítulo de Vantagens: regras publicadas (Aliado, Patrono, Riqueza), exemplo de criação,
   * conflitos de fonte e a migração de ids das fichas salvas. */
  const capVantagens = db.vantagens || {};
  add({
    id: 'vantagens-definicao', title: 'O que são vantagens', text: `${capVantagens.definicao?.regra || ''} ${capVantagens.definicao?.custos || ''} Momento de compra: ${capVantagens.definicao?.momentoDeCompra || ''}.`,
    chapterId: 'vantagens', sectionId: 'definicao', kind: 'Regra', categories: ['Vantagens', 'Criação'], source: capVantagens.definicao?.fonte || capVantagens._fonte,
  });
  add({
    id: 'vantagens-novas', title: capVantagens.novasVantagens?.titulo || 'Novas Vantagens',
    text: `${capVantagens.novasVantagens?.regra || ''} ${capVantagens.novasVantagens?.publicacao || ''} ${(db.advantages || []).filter(a => a.grupo === 'nova').map(a => `${a.nome} (${a.custo})`).join('; ')}`,
    chapterId: 'vantagens', sectionId: 'novas-vantagens', kind: 'Catálogo', categories: ['Vantagens', 'Novas Vantagens', 'Criação'],
    source: capVantagens.novasVantagens?.fonte || capVantagens._fonteNovas,
  });
  for (const linha of capVantagens.aliado?.poder?.tabela || []) add({
    id: `aliado-${slug(String(linha.pontosDoAliado))}`, title: `Aliado — ${linha.pontosDoAliado} pontos de personagem`,
    text: `${linha.custo ? `Custa ${linha.custo} pontos.` : ''} ${linha.resultado || ''} ${(capVantagens.aliado?.poder?.regras || []).join(' ')}`,
    chapterId: 'vantagens', sectionId: 'aliado', kind: 'Tabela', categories: ['Vantagens', 'Aliado', 'NPC'], source: capVantagens.aliado?.fonte,
  });
  for (const linha of capVantagens.aliado?.frequencia?.tabela || []) add({
    id: `aliado-freq-${linha.id}`, title: `Freqüência do Aliado — ${linha.rotulo}`,
    text: `3d ≤ ${linha.dado}: custo ×${linha.multiplicador}. ${linha.nota || ''} ${capVantagens.aliado?.frequencia?.regra || ''}`,
    chapterId: 'vantagens', sectionId: 'aliado', kind: 'Tabela', categories: ['Vantagens', 'Aliado', 'Tabelas', 'Dados'], source: capVantagens.aliado?.fonte,
  });
  for (const linha of capVantagens.patrono?.poder?.tabela || []) add({
    id: `patrono-${linha.id}`, title: `Patrono — ${linha.custo} pontos`,
    text: `${linha.descricao || ''} Exemplo: ${linha.exemplo || '—'}. ${capVantagens.patrono?.custo || ''}`,
    chapterId: 'vantagens', sectionId: 'patrono', kind: 'Tabela', categories: ['Vantagens', 'Patrono', 'NPC', 'Tabelas'], source: capVantagens.patrono?.fonte,
  });
  add({
    id: 'patrono-equipamento', title: 'Equipamento e Patronos',
    text: `${capVantagens.patrono?.equipamento?.regra || ''} Acréscimo padrão +${capVantagens.patrono?.equipamento?.acrescimoPadrao ?? 5} pontos; ${capVantagens.patrono?.equipamento?.acrescimoMaior?.condicao || ''} +${capVantagens.patrono?.equipamento?.acrescimoMaior?.valor ?? 10}.`,
    chapterId: 'vantagens', sectionId: 'patrono', kind: 'Regra', categories: ['Vantagens', 'Patrono', 'Equipamentos'], source: capVantagens.patrono?.fonte,
  });
  add({
    id: 'patrono-frequencia', title: capVantagens.patrono?.frequencia?.titulo || 'Freqüência de Participação do Patrono',
    text: `${capVantagens.patrono?.frequencia?.regra || ''} ${capVantagens.patrono?.frequencia?.jogada || ''} ${capVantagens.patrono?.frequencia?.limite || ''} ${(capVantagens.patrono?.frequencia?.relacionamentos || []).join(' ')}`,
    chapterId: 'vantagens', sectionId: 'patrono', kind: 'Regra', categories: ['Vantagens', 'Patrono', 'Tabelas'], source: capVantagens.patrono?.fonte,
  });
  for (const nivel of (db.advantage?.('riqueza')?.niveis || [])) add({
    id: `riqueza-${slug(nivel.nome)}`, title: `Riqueza — ${nivel.nome}`,
    text: `Custo ${nivel.custo} pontos. Multiplicador de recursos ${nivel.multiplicadorRecursos ?? '—'}; dinheiro inicial ${nivel.dinheiro ?? '—'}. ${capVantagens.riqueza?.regra || ''}`,
    chapterId: 'vantagens', sectionId: 'riqueza', kind: 'Tabela', categories: ['Vantagens', 'Riqueza', 'Economia', 'Tabelas'], source: capVantagens.riqueza?.fonte,
  });
  for (const compra of capVantagens.exemploSelecao?.compra || []) add({
    id: `exemplo-${slug(compra.vantagem)}`, title: `Exemplo de seleção — ${compra.vantagem}`,
    text: `${compra.nivel ? `Nível ${compra.nivel}. ` : ''}${compra.pontos} pontos. ${compra.nota || ''} ${capVantagens.exemploSelecao?.texto || ''} ${capVantagens.exemploSelecao?._aviso || ''}`,
    chapterId: 'vantagens', sectionId: 'exemplo-selecao', kind: 'Exemplo', categories: ['Vantagens', 'Criação', 'Exemplo'], source: capVantagens.exemploSelecao?.fonte,
  });
  for (const conflito of capVantagens.conflitos || []) add({
    id: `conflito-${conflito.id}`, title: `Conflito — ${conflito.assunto || conflito.id}`,
    text: `${conflito.descricao || ''} Resolução adotada: ${conflito.resolucaoAdotada || '—'}.`,
    chapterId: 'vantagens', sectionId: 'conflitos-vantagens', kind: 'Conflito', categories: ['Vantagens', 'Fontes', 'Conflitos'], source: conflito.fonte,
  });
  add({
    id: 'vantagens-migracao', title: 'Migração de ids de vantagens',
    text: `${capVantagens.migracaoDeIds?.nota || ''} ${Object.entries(capVantagens.migracaoDeIds?.mapa || {}).map(([v, n]) => `${v} → ${n}`).join('; ')}`,
    chapterId: 'vantagens', sectionId: 'migracao-ids', kind: 'Nota', categories: ['Vantagens', 'Dados', 'Ficha'], source: capVantagens._nota,
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

  /* ------------------------------------------------------- material G.A.U. (d20) */

  /* Arsenal: armas das três eras, materiais de estrutura e níveis de tecnologia. */
  for (const era of db.armas?.eras || []) for (const weapon of era.armas || []) add({
    id: `arma-${weapon.id}`, title: weapon.nome,
    text: `Dano ${weapon.dano || '—'} (média ${weapon.media ?? '—'}). Característica: ${weapon.caracteristica || '—'}. Tipo: ${weapon.tipo || '—'}. Era: ${era.nome}.`,
    chapterId: 'arsenal', sectionId: `arma-${weapon.id}`, kind: 'Arma',
    categories: ['Arsenal', 'Tabelas', era.nome, weapon.tipo], source: era.fonte || db.armas?._fonte, entityId: weapon.id,
  });
  for (const linha of db.armas?.precisao?.tabela || []) add({
    id: `prec-${linha.id}`, title: `PREC — ${linha.categoria}`,
    text: `Precisão Extraordinária ${linha.prec}. Exemplos: ${linha.exemplos || '—'}. ${db.armas?.precisao?.regra || ''}`,
    chapterId: 'arsenal', sectionId: 'precisao', kind: 'Tabela', categories: ['Arsenal', 'Combate', 'Tabelas'], source: db.armas?.precisao?.fonte,
  });
  for (const material of db.estruturas?.estruturas?.materiais || []) add({
    id: `material-${material.id}`, title: material.material,
    text: `Limiar de Dano ${material.limiarDeDano}. PE: pequeno ${material.pePequeno ?? '—'}, médio ${material.peMedio ?? '—'}, grande ${material.peGrande ?? '—'}. Exemplos: ${(material.exemplos || []).join(', ')}.`,
    chapterId: 'arsenal', sectionId: `material-${material.id}`, kind: 'Material', categories: ['Arsenal', 'Estruturas', 'Tabelas'], source: db.estruturas?._fonte, entityId: material.id,
  });
  for (const nivel of db.estruturas?.nivelTecnologico?.tabela || []) add({
    id: `nt-${nivel.nt}`, title: `NT ${nivel.nt} — ${nivel.era}`,
    text: `Início: ${nivel.inicio || '—'}. Assinatura: ${nivel.assinatura || '—'}. ${db.estruturas?.nivelTecnologico?.regra || ''}`,
    chapterId: 'arsenal', sectionId: 'nt', kind: 'Tabela', categories: ['Arsenal', 'Cenário', 'Tabelas'],
  });

  /* Combate: nós da árvore de manobras, empunhaduras, defesas, graus e luminosidade. */
  for (const manobra of db.maneuvers?.manobras || []) {
    const nos = [];
    (function walk(no, trilha) {
      if (!no || typeof no !== 'object') return;
      if (no.id && no.nome) nos.push({ ...no, trilha: [...trilha, no.nome] });
      const ramo = no.nome ? [...trilha, no.nome] : trilha;
      for (const chave of ['estilos', 'formas', 'caminhos', 'derivacoes', 'opcoes']) for (const filho of no[chave] || []) walk(filho, ramo);
    })(manobra, []);
    for (const no of nos) add({
      id: `manobra-${no.id}`, title: no.trilha.join(' › '),
      text: `${no.descricao || ''} ${no.textoEfeito || ''} ${(no.requisitos || []).join(' ')} ${JSON.stringify(no.efeitos || {}).replace(/[{}"]/g, '')}`,
      chapterId: 'combate', sectionId: manobra.id, kind: no.trilha.length > 1 ? 'Manobra' : 'Manobra básica',
      categories: ['Combate', 'Manobras', manobra.nome], source: db.maneuvers?._fonte, entityId: no.id,
    });
  }
  for (const emp of db.maneuvers?.empunhaduras?.lista || []) add({
    id: `empunhadura-${emp.id}`, title: `Empunhadura ${emp.nome}`,
    text: `${emp.descricao || ''} Especialidade: ${emp.especialidade || '—'}. Estilo: ${emp.estilo || '—'}. Vantagens: ${(emp.vantagens || []).join('; ')}.`,
    chapterId: 'combate', sectionId: 'preparar', kind: 'Empunhadura', categories: ['Combate', 'Arsenal'], source: db.maneuvers?.empunhaduras?.fonte, entityId: emp.id,
  });
  for (const defesa of db.maneuvers?.defesasAtivas?.tabela || []) add({
    id: `defesa-${defesa.id}`, title: defesa.defesa,
    text: `Base: ${defesa.base}. Uso: ${defesa.uso}. Equipamento: ${defesa.equipamento}. ${db.maneuvers?.defesasAtivas?.descricoes?.[defesa.id] || ''}`,
    chapterId: 'combate', sectionId: 'defesas', kind: 'Defesa ativa', categories: ['Combate', 'Defesas'], source: db.maneuvers?.defesasAtivas?.fonte,
  });
  for (const grau of db.maneuvers?.grauDano?.graus || []) add({
    id: `grau-${grau.id}`, title: `${grau.id} — ${grau.nome}`,
    text: `Faixa ${grau.max == null ? `${grau.min}+` : `${grau.min}–${grau.max}`}. ${grau.conceito || ''} ${db.maneuvers?.grauDano?.detalhes?.[grau.id]?.descricao || ''}`,
    chapterId: 'combate', sectionId: 'grau-dano', kind: 'Grau de Dano', categories: ['Combate', 'Dano', 'Tabelas'], source: db.maneuvers?.grauDano?.fonte,
  });
  for (const luz of db.maneuvers?.luminosidade?.tabela || []) add({
    id: `luz-${luz.id}`, title: `Luminosidade — ${luz.nivel}`,
    text: `Penalidade ${luz.penalidadeMin} a ${luz.penalidadeMax}. Exemplos: ${luz.exemplos}. ${db.maneuvers?.luminosidade?.regra || ''}`,
    chapterId: 'combate', sectionId: 'luminosidade', kind: 'Tabela', categories: ['Combate', 'Tabelas'], source: db.maneuvers?.luminosidade?.fonte,
  });

  /* Testes: margens, categorias de poder e disputas. */
  for (const [valor, margem] of Object.entries(db.resolucao?.margens?.tabela || {})) add({
    id: `margem-${valor}`, title: `Referência ${valor} → margem ${margem.texto}`,
    text: `Margem de sucesso ${margem.texto}; valor crítico ${margem.critico ?? '—'}; largura ${margem.largura ?? '—'}. ${db.resolucao?.margens?.nota || ''}`,
    chapterId: 'testes', sectionId: 'margens', kind: 'Tabela', categories: ['Testes', 'Tabelas', 'Dados'], source: db.resolucao?.margens?.fonte,
  });
  for (const categoria of db.resolucao?.categorias?.lista || []) add({
    id: `categoria-${categoria.id}`, title: `Categoria — ${categoria.nome}`,
    text: `${categoria.dados == null ? 'Quantidade de dados não publicada' : `${categoria.dados} d20`}. Escala: ${categoria.escala || '—'}. ${categoria.nota || ''}`,
    chapterId: 'testes', sectionId: 'categorias', kind: 'Categoria', categories: ['Testes', 'Categorias', 'Poderes'], source: db.resolucao?.categorias?.fonte,
  });

  /* Proezas: superfícies de escalada, limites de levantamento, ritmos de escavação e pânico. */
  for (const tipo of db.proezas?.escalada?.tabela || []) add({
    id: `escalada-${slug(tipo.tipo)}`, title: `Escalada — ${tipo.tipo}`,
    text: `Modificador ${tipo.modificador ?? 'sem jogada'}. Escalada curta: ${tipo.escaladaCurta || '—'}; longa: ${tipo.escaladaLonga || '—'}. ${tipo._aviso || ''}`,
    chapterId: 'proezas', sectionId: 'escalada', kind: 'Tabela', categories: ['Proezas', 'Tabelas'],
  });
  for (const limite of db.proezas?.levantamento?.limites || []) add({
    id: `levantamento-${limite.id}`, title: limite.nome,
    text: `${limite.formula}. ${limite.nota || ''} ${db.proezas?.levantamento?.regraGeral || ''}`,
    chapterId: 'proezas', sectionId: 'levantamento', kind: 'Regra', categories: ['Proezas', 'Força'],
  });
  for (const ritmo of db.proezas?.cavar?.ritmos || []) add({
    id: `cavar-${slug(ritmo.situacao)}`, title: `Cavar — ${ritmo.situacao}`,
    text: `${ritmo.formula}. ${ritmo.nota || ''}`, chapterId: 'proezas', sectionId: 'cavar', kind: 'Tabela', categories: ['Proezas', 'Tabelas'],
  });
  for (const linha of db.proezas?.panico?.rolagem?.tabela || []) add({
    id: `panico-${slug(linha.resultado)}`, title: `Pânico — resultado ${linha.resultado}`,
    text: linha.efeito, chapterId: 'proezas', sectionId: 'panico', kind: 'Tabela', categories: ['Proezas', 'Vontade', 'Tabelas'],
  });
  for (const [chave, sentido] of Object.entries(db.proezas?.sentidos || {})) {
    if (!sentido || typeof sentido !== 'object') continue;
    add({
      id: `sentido-${chave}`, title: `Sentido — ${chave === 'olfatoPaladar' ? 'Olfato/Paladar' : chave.charAt(0).toUpperCase() + chave.slice(1)}`,
      text: `${sentido.uso || ''} ${sentido.limites || ''} ${(sentido.modificadoresNegativos || []).join(' ')} ${(sentido.modificadoresPositivos || []).join(' ')}`,
      chapterId: 'proezas', sectionId: 'sentidos', kind: 'Regra', categories: ['Proezas', 'Sentidos', 'Testes'],
    });
  }

  /* Poderes: cada item comprável do catálogo modular. */
  for (const grupo of db.poderes?.modulos?.efeitos?.grupos || []) for (const item of grupo.itens || []) add({
    id: `poder-efeito-${item.id}`, title: `Efeito — ${item.nome}`,
    text: `${grupo.nome}. Custo ${item.pontos}${item.escalonavel ? '+' : ''} pontos de poder. ${db.poderes?.modulos?.efeitos?.descricao || ''}`,
    chapterId: 'poderes', sectionId: `efeito-${item.id}`, kind: 'Efeito', categories: ['Poderes', 'Efeitos', grupo.nome], entityId: item.id,
  });
  for (const modulo of ['extensao', 'potencia']) {
    const fonte = db.poderes?.modulos?.[modulo] || {};
    for (const sub of fonte.submodulos || []) for (const item of fonte[sub]?.itens || []) add({
      id: `poder-${modulo}-${sub}-${item.id}`, title: `${modulo === 'extensao' ? 'Extensão' : 'Potência'} — ${item.nome}`,
      text: `${fonte[sub]?.descricao || sub}. Custo ${item.pontos}${item.escalonavel ? '+' : ''} pontos. ${item.exemplo || ''} ${item.grau ? `Grau de Dano ${item.grau}.` : ''}`,
      chapterId: 'poderes', sectionId: `${modulo}-${sub}-${item.id}`, kind: modulo === 'extensao' ? 'Extensão' : 'Potência',
      categories: ['Poderes', modulo === 'extensao' ? 'Extensão' : 'Potência', sub], entityId: item.id,
    });
  }
  for (const [modulo, rotulo] of [['condicoes', 'Condição'], ['bonus', 'Bônus'], ['penalidades', 'Penalidade'], ['pv', 'Pontos de Vida'], ['rd', 'Redução de Dano'], ['outros', 'Outro bônus']]) {
    for (const item of db.poderes?.modulos?.[modulo]?.itens || []) add({
      id: `poder-${modulo}-${item.id}`, title: `${rotulo} — ${item.nome || `+${item.bonus ?? item.penalidade ?? item.pv ?? item.rd}`}`,
      text: `Custo ${item.pontos}${item.escalonavel ? '+' : ''} pontos. ${db.poderes?.modulos?.[modulo]?.descricao || ''} ${item.bonus != null ? `Bônus +${item.bonus}.` : ''} ${item.penalidade != null ? `Penalidade ${item.penalidade}.` : ''} ${item.pv != null ? `+${item.pv} PV.` : ''} ${item.rd != null ? `+${item.rd} RD.` : ''}`,
      chapterId: 'poderes', sectionId: modulo === 'condicoes' ? 'condicoes' : 'bonus', kind: rotulo,
      categories: ['Poderes', rotulo], entityId: item.id,
    });
  }
  add({
    id: 'dimensionalidade', title: 'Dimensionalidade', text: `${db.poderes?.dimensionalidade?.definicao || ''} ${db.poderes?.dimensionalidade?.implicacoes || ''}`,
    chapterId: 'poderes', sectionId: 'dimensionalidade', kind: 'Regra', categories: ['Poderes', 'Escala'],
  });
  add({
    id: 'hax', title: 'Hax', text: `${db.poderes?.hax?.definicao || ''} ${db.poderes?.hax?.relatividade || ''} ${db.poderes?.hax?.limite || ''}`,
    chapterId: 'poderes', sectionId: 'hax', kind: 'Regra', categories: ['Poderes', 'Escala'],
  });

  /* Ficha oficial: blocos da planilha de personagem. */
  for (const bloco of db.ficha?.blocos || []) add({
    id: `ficha-${bloco.id}`, title: `Planilha — ${bloco.titulo || bloco.id}`,
    text: `${bloco.descricao || ''} ${(bloco.colunas || bloco.campos || bloco.grupos || []).join(' ')} ${(bloco.contas || []).map(c => `${c.id} = ${c.formula}`).join(' ')} ${(bloco.definicoes || []).map(d => `${d.id}: ${d.base}`).join(' ')}`,
    chapterId: 'criacao', sectionId: SECTION_CRIACAO_FICHA[bloco.id] || 'modelo-ficha',
    kind: 'Ficha', categories: ['Criação', 'Ficha'], source: db.ficha?._fonte,
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
  return ({ regra: 'Regra', tabela: 'Tabela', catalogo: 'Catálogo', dica: 'Dica', nota: 'Nota', referencia: 'Referência', exemplo: 'Exemplo', conflito: 'Conflito' })[type] || 'Seção';
}
