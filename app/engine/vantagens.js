/* GUA Rule Engine — VANTAGENS (sistema G.A.U.)
 *
 * Fontes (transcritas em data/advantages.json e data/vantagens.json):
 *  · VANTAGENS — canal #『📕』vantagens (Impio, 26/07/2026 09:06 e 10:45)
 *  · NOVAS VANTAGENS — canal #『📕』vantagens (Impio, 16/08/2026 12:36)
 *
 * Regra do capítulo: "Estas são habilidades inatas do personagem. Com poucas exceções, só podemos dar
 * uma vantagem a um personagem no momento em que ele é criado." → `soNaCriacao` é exposto para a UI
 * e para a validação de criação.
 *
 * TODO bônus concedido por vantagem é calculado AQUI (nenhuma página da interface contém fórmulas):
 * sentidos, defesas ativas, RD natural, Vontade, resistência à magia/psíquica, atributos, perícias,
 * testes gerais, dano, ações extras, imunidades e IQ efetivo por contexto.
 */
import { custoTrait } from './traits.js';

const normalizar = valor => String(valor ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* ------------------------------------------------------------------ acesso às definições */

const lista = db => db?.advantages || [];

/** Definição de uma vantagem pelo id (aceita ids antigos via data/vantagens.json → migracaoDeIds) ou pelo nome. */
export function definicaoDaVantagem(db, idOuNome) {
  if (!idOuNome) return null;
  const direto = lista(db).find(a => a.id === idOuNome);
  if (direto) return direto;
  const migrado = db?.vantagens?.migracaoDeIds?.mapa?.[idOuNome];
  if (migrado) {
    const alvo = lista(db).find(a => a.id === migrado);
    if (alvo) return alvo;
  }
  const chave = normalizar(idOuNome);
  return lista(db).find(a => normalizar(a.nome) === chave || normalizar(a.id) === chave) || null;
}

/** Entrada da vantagem na ficha (aceita ids antigos). */
export function entradaDaVantagem(db, personagem, idOuNome) {
  if (!idOuNome) return null;
  const ids = [idOuNome];
  const def = definicaoDaVantagem(db, idOuNome);
  if (def && !ids.includes(def.id)) ids.push(def.id);
  // ids antigos que foram normalizados para este (data/vantagens.json → migracaoDeIds)
  for (const [velho, novo] of Object.entries(db?.vantagens?.migracaoDeIds?.mapa || {})) {
    if (ids.includes(novo) && !ids.includes(velho)) ids.push(velho);
  }
  const chave = normalizar(idOuNome);
  return (personagem?.vantagens || []).find(v => ids.includes(v.id) || normalizar(v.nome) === chave || normalizar(v.id) === chave) || null;
}

/** O personagem possui a vantagem? */
export function temVantagem(db, personagem, idOuNome) { return !!entradaDaVantagem(db, personagem, idOuNome); }

/**
 * Nível efetivo (número) de uma vantagem possuída — 0 se não a tem.
 * Funciona com os dois formatos de ficha:
 *  · `niveis` numérico (vantagens por nível: Ouvido Aguçado, Prontidão, Força de Vontade…)
 *  · `nivel` com o NOME do nível estruturado (Rijeza "RD 2", Memória Eidética "2º nível", Sorte…)
 */
export function nivelDaVantagem(db, personagem, idOuNome) {
  const def = definicaoDaVantagem(db, idOuNome);
  const entrada = entradaDaVantagem(db, personagem, idOuNome);
  if (!entrada) return 0;
  const maximo = def?.maxNiveis ?? null;
  let nivel = null;
  if (Number.isFinite(entrada.niveis)) nivel = entrada.niveis;
  else if (Number.isFinite(entrada.nivel)) nivel = entrada.nivel;
  else if (typeof entrada.nivel === 'string') {
    if (Array.isArray(def?.niveis)) {
      const indice = def.niveis.findIndex(n => n.nome === entrada.nivel);
      if (indice >= 0) nivel = indice + 1;
    }
    // sem a definição em mãos (chamadas sem db), extrai o número do nome do nível:
    // "1º nível" → 1 · "RD 2" → 2 · "Sorte Extraordinária" → mantém null (nível 1)
    if (nivel == null) {
      const m = String(entrada.nivel).match(/(\d+)/);
      if (m) nivel = Number(m[1]);
    }
  }
  if (nivel == null) nivel = 1;
  const limite = maximo ?? (Array.isArray(def?.niveis) && def.niveis.length ? def.niveis.length : null);
  return Math.max(1, limite ? Math.min(nivel, limite) : nivel);
}

/** Nível estruturado selecionado (para UI e custo) — null se a vantagem não tem níveis nomeados. */
export function nivelSelecionado(db, personagem, idOuNome) {
  const def = definicaoDaVantagem(db, idOuNome);
  const entrada = entradaDaVantagem(db, personagem, idOuNome);
  if (!def?.niveis?.length || !entrada) return null;
  return def.niveis.find(n => n.nome === entrada.nivel) || def.niveis[Math.min(nivelDaVantagem(db, personagem, idOuNome), def.niveis.length) - 1] || null;
}

/**
 * Normaliza uma entrada de vantagem da ficha para o catálogo atual:
 *  · id antigo → id normalizado (data/vantagens.json → migracaoDeIds)
 *  · nível numérico → nome do nível estruturado (Rijeza "RD 2", Memória Eidética "2º nível"…)
 *  · custo escolhido → nível correspondente (Poderes Legais, Alfabetização, Clericato…)
 * Retorna null quando a entrada não existe mais no catálogo (item corrompido removido).
 */
export function normalizarEntradaDeVantagem(db, entrada) {
  if (!entrada || typeof entrada !== 'object') return entrada;
  const def = definicaoDaVantagem(db, entrada.id);
  if (!def) {
    const removidos = db?.vantagens?.migracaoDeIds?.removidos || {};
    return removidos[entrada.id] ? null : entrada;   // mantém o que não conhecemos (desvantagens, itens caseiros)
  }
  const nova = { ...entrada, id: def.id, nome: def.nome };
  if (Array.isArray(def.niveis) && def.niveis.length) {
    if (typeof nova.nivel !== 'string') {
      if (Number.isFinite(nova.niveis)) {
        const indice = Math.max(0, Math.min(Number(nova.niveis), def.niveis.length) - 1);
        nova.nivel = def.niveis[indice].nome;
        delete nova.niveis;
      } else if (Number.isFinite(nova.custoEscolhido)) {
        const alvo = def.niveis.find(n => n.custo === nova.custoEscolhido);
        if (alvo) nova.nivel = alvo.nome;
      }
      if (typeof nova.nivel !== 'string') nova.nivel = def.niveis[0].nome;
    }
  } else if (def.custoPorNivel && !Number.isFinite(nova.niveis) && typeof nova.nivel !== 'string') {
    nova.niveis = 1;
  }
  return nova;
}

/* ------------------------------------------------------------------ efeitos */

const escalar = (efeito, nivel) => {
  if (!efeito || typeof efeito.valor !== 'number') return efeito?.valor ?? null;
  return efeito.porNivel ? efeito.valor * Math.max(1, nivel) : efeito.valor;
};

/** Efeitos de UMA vantagem, já escalados pelo nível possuído. */
export function efeitosDaVantagem(db, personagem, idOuNome) {
  const def = definicaoDaVantagem(db, idOuNome);
  const entrada = entradaDaVantagem(db, personagem, idOuNome);
  if (!def || !entrada) return [];
  const nivel = nivelDaVantagem(db, personagem, idOuNome);
  return (def.efeitos || []).map(efeito => ({
    ...efeito,
    vantagem: def.nome, vantagemId: def.id, nivel,
    valorEfetivo: escalar(efeito, nivel),
  }));
}

/** Todos os efeitos de todas as vantagens possuídas. */
export function todosOsEfeitos(db, personagem) {
  const out = [];
  for (const entrada of personagem?.vantagens || []) {
    const def = definicaoDaVantagem(db, entrada.id);
    if (!def) continue;
    out.push(...efeitosDaVantagem(db, personagem, def.id));
  }
  return out;
}

const doTipo = (db, personagem, tipo) => todosOsEfeitos(db, personagem).filter(e => e.tipo === tipo);
/** Soma os valores de efeitos (aceita tanto o efeito bruto quanto a parte já formatada). */
const soma = efeitos => efeitos.reduce((acc, e) => acc + (Number(e.valorEfetivo ?? e.valor) || 0), 0);

/* ------------------------------------------------------------------ agregados por domínio */

/** Bônus em testes de Sentido (Visão, Audição, Olfato/Paladar). */
export function bonusDeSentido(db, personagem, sentido = 'visao') {
  const partes = [];
  for (const e of doTipo(db, personagem, 'sentido')) {
    if (e.alvo === 'verAtraves') continue;              // Visão de raio X: outro efeito, não bônus
    if (e.alvo !== 'todos' && e.alvo !== sentido) continue;
    partes.push({ fonte: `${e.vantagem}${e.nivel > 1 ? ` ${e.nivel}` : ''}`, valor: e.valorEfetivo ?? 0 });
  }
  return { sentido, total: soma(partes), partes };
}

/** Bônus em qualquer Defesa Ativa (Esquiva, Aparar, Bloqueio). */
export function bonusDeDefesaAtiva(db, personagem) {
  const partes = doTipo(db, personagem, 'defesaAtiva')
    .filter(e => e.alvo === 'todas')
    .map(e => ({ fonte: e.vantagem, valor: e.valorEfetivo ?? 0 }));
  return { total: soma(partes), partes };
}

/** Modificador de defesa ativa para um flanco específico ('costas' — Visão Periférica). */
export function defesaPorFlanco(db, personagem, flanco = 'costas') {
  const partes = doTipo(db, personagem, 'defesaAtiva')
    .filter(e => e.alvo === flanco)
    .map(e => ({ fonte: e.vantagem, valor: e.valorEfetivo ?? 0 }));
  return { flanco, total: soma(partes), partes };
}

/** RD natural do corpo (Rijeza). */
export function rdNatural(db, personagem) {
  const def = definicaoDaVantagem(db, 'rijeza');
  const entrada = entradaDaVantagem(db, personagem, 'rijeza');
  if (!entrada) return { rd: 0, partes: [] };
  const nivel = nivelSelecionado(db, personagem, 'rijeza');
  const rd = Number(nivel?.rd) || (nivelDaVantagem(db, personagem, 'rijeza') >= 2 ? 2 : 1);
  return { rd, partes: [{ fonte: `Rijeza (${nivel?.nome || `nível ${rd}`})`, valor: rd, notas: def?.regras?.[0] || '' }] };
}

/** Bônus em testes de Vontade (Força de Vontade; Hipoalgia quando o GM permite). */
export function bonusDeVontade(db, personagem, { ignorarDor = false } = {}) {
  const partes = [];
  for (const e of doTipo(db, personagem, 'atributoEfetivo')) {
    if (e.contexto === 'vontade') partes.push({ fonte: `${e.vantagem} ${e.nivel}`, valor: e.valorEfetivo ?? 0 });
  }
  if (ignorarDor) for (const e of doTipo(db, personagem, 'vontade')) {
    if (e.alvo === 'ignorarDor') partes.push({ fonte: `${e.vantagem} (ignorar a dor, a critério do GM)`, valor: e.valorEfetivo ?? 0 });
  }
  for (const e of doTipo(db, personagem, 'resistencia')) {
    if (e.alvo === 'torturaFisica') partes.push({ fonte: `${e.vantagem} (tortura física)`, valor: e.valorEfetivo ?? 0 });
  }
  return { total: soma(partes), partes };
}

/** Bônus em Verificações de Pânico (Reflexos em Combate). */
export function bonusDePanico(db, personagem) {
  const partes = doTipo(db, personagem, 'panico').map(e => ({ fonte: e.vantagem, valor: e.valorEfetivo ?? 0 }));
  return { total: soma(partes), partes };
}

/** Resistência à Magia (Abascanto e Força de Vontade ao resistir). */
export function resistenciaAMagia(db, personagem, { aoResistir = false } = {}) {
  const partes = [];
  for (const e of doTipo(db, personagem, 'resistenciaMagica')) {
    if (e.alvo === 'resistir' && !aoResistir) continue;
    partes.push({ fonte: `${e.vantagem}${e.nivel > 1 ? ` ${e.nivel}` : ''}`, valor: e.valorEfetivo ?? 0 });
  }
  const abascanto = temVantagem(db, personagem, 'abascanto');
  return {
    total: soma(partes), partes, abascanto,
    impedeConjurar: abascanto,
    nota: abascanto
      ? 'Abascanto: o nível é subtraído do NH de quem realiza a operação; não pode ser "desligado" e impede o personagem de realizar Mágicas (armas mágicas continuam permitidas). Não defende contra mágicas de projétil, armas mágicas nem mágicas de informação não direcionadas.'
      : null,
  };
}

/** Resistência Psíquica (subtrai do NH de quem usa poder psíquico contra você — e do seu). */
export function resistenciaPsiquica(db, personagem) {
  const partes = doTipo(db, personagem, 'resistenciaPsiquica').map(e => ({ fonte: `${e.vantagem} ${e.nivel}`, valor: e.valorEfetivo ?? 0 }));
  return {
    total: soma(partes), partes,
    penalidadePropria: -soma(partes),
    nota: partes.length ? 'Nunca pode ser desligada; também é subtraída do seu NH em qualquer poder psíquico próprio.' : null,
  };
}

/**
 * Atributos efetivos: os atributos da ficha + bônus concedidos por vantagens
 * (Sobrevivente do Inferno: +2 ST e +2 DX). O valor da ficha nunca é reescrito.
 */
export function atributosEfetivos(db, personagem) {
  const base = { ...(personagem?.atributos || {}) };
  const breakdown = [];
  for (const e of doTipo(db, personagem, 'atributo')) {
    if (!(e.alvo in base)) continue;
    base[e.alvo] = (Number(base[e.alvo]) || 0) + (e.valorEfetivo ?? 0);
    breakdown.push({ fonte: `${e.vantagem}: +${e.valorEfetivo} ${e.alvo}`, atributo: e.alvo, valor: e.valorEfetivo ?? 0 });
  }
  return { ...base, _breakdown: breakdown };
}

/** IQ efetivo por contexto (magia, aprender línguas, perícias musicais, vontade). */
export function iqEfetivo(db, personagem, contexto = 'magia') {
  const iq = Number(atributosEfetivos(db, personagem).IQ) || 0;
  const partes = [{ fonte: 'IQ', valor: iq }];
  for (const e of doTipo(db, personagem, 'atributoEfetivo')) {
    if (e.alvo !== 'IQ' || e.contexto !== contexto) continue;
    // Aptidão Mágica já entra pelo campo próprio da ficha (pc.aptidaoMagica) — não contar duas vezes
    if (contexto === 'magia' && e.vantagemId === 'aptidao-magica') continue;
    partes.push({ fonte: `${e.vantagem}${e.nivel > 1 ? ` ${e.nivel}` : ''}`, valor: e.valorEfetivo ?? 0 });
  }
  if (contexto === 'magia') {
    // vale o maior entre o campo próprio da ficha e o nível comprado como vantagem (máx. publicado: 3)
    const aptidao = Math.min(
      Math.max(Number(personagem?.aptidaoMagica) || 0, nivelDaVantagem(db, personagem, 'aptidao-magica')),
      maximoDeAptidaoMagica(db),
    );
    if (aptidao) partes.push({ fonte: `Aptidão Mágica ${aptidao}`, valor: aptidao });
    if (temVantagem(db, personagem, 'abascanto')) {
      return { IQ: iq, contexto, efetivo: iq, partes, abascanto: true,
               nota: 'Abascanto: não é possível ter resistência à magia e aptidão para magia ao mesmo tempo — o personagem não realiza Mágicas.' };
    }
  }
  return { IQ: iq, contexto, efetivo: partes.reduce((a, p) => a + (Number(p.valor) || 0), 0), partes, nota: null };
}

/** Máximo de níveis de Aptidão Mágica publicado (data/magia.json → aptidao.limite). */
export function maximoDeAptidaoMagica(db) {
  const texto = String(db?.magia?.aptidao?.limite || '');
  const m = texto.match(/(\d+)/);
  return m ? Number(m[1]) : 3;
}

/** Bônus em uma perícia (Voz Melodiosa, Talento para Matemática, Empatia com Animais, Senso de Direção…). */
export function bonusDePericia(db, personagem, periciaIdOuNome) {
  const chave = normalizar(periciaIdOuNome);
  const partes = [];
  for (const e of todosOsEfeitos(db, personagem)) {
    if (e.tipo !== 'pericia') continue;
    const alvos = Array.isArray(e.pericias) ? e.pericias.map(normalizar) : [normalizar(e.alvo)];
    if (alvos.includes(chave) || alvos.some(a => chave.includes(a) || a.includes(chave))) {
      partes.push({ fonte: e.vantagem, valor: e.valorEfetivo ?? 0, nota: e.nota || '' });
    }
  }
  return { pericia: periciaIdOuNome, total: soma(partes), partes };
}

/** Modificadores que valem para QUALQUER teste (Amuleto da Sorte). */
export function modificadoresGerais(db, personagem, { comAmuleto = true } = {}) {
  const partes = [];
  for (const e of doTipo(db, personagem, 'testeGeral')) {
    const positivo = (e.valorEfetivo ?? 0) > 0;
    if (positivo && !comAmuleto) continue;
    if (!positivo && comAmuleto) continue;
    partes.push({
      fonte: `${e.vantagem} (${positivo ? 'com o amuleto' : 'sem o amuleto'})`,
      valor: e.valorEfetivo ?? 0,
    });
  }
  return { total: soma(partes), partes, comAmuleto };
}

/** Dano extra concedido por vantagens (Amuleto da Sorte, Arma Especial, Golpe Fulminante). */
export function danoExtra(db, personagem, { comAmuleto = true, armaEspecial = false, golpeFulminante = false } = {}) {
  const fixo = [];
  const dados = [];
  let custoST = 0;
  for (const e of doTipo(db, personagem, 'dano')) {
    const positivo = (typeof e.valor === 'number' ? e.valor : 1) > 0;
    if (e.condicao === 'comAmuleto' && !comAmuleto) continue;
    if (e.condicao === 'semAmuleto' && comAmuleto) continue;
    if (e.alvo === 'armaEspecial' && !armaEspecial) continue;
    if (e.alvo === 'gdpBal' && !golpeFulminante) continue;
    if (typeof e.valor === 'number') fixo.push({ fonte: e.vantagem, valor: e.valorEfetivo ?? e.valor, nota: e.nota || '' });
    else dados.push({ fonte: e.vantagem, valor: String(e.valor), nota: e.nota || '' });
    if (e.custo && /ST/.test(String(e.custo))) custoST += Number(String(e.custo).match(/\d+/)?.[0] || 0);
    if (!positivo && typeof e.valor !== 'number') continue;
  }
  return {
    fixo: fixo.reduce((a, f) => a + f.valor, 0), fixoPartes: fixo,
    dados, dadosExtras: dados.reduce((a, d) => a + 1, 0),
    custoST,
    nota: [
      custoST ? `Golpe Fulminante: perde ${custoST} pontos de ST para +4 no GDP/Bal do próximo ataque.` : null,
      dados.length ? dados.map(d => d.nota).join(' ') : null,
    ].filter(Boolean).join(' ') || null,
  };
}

/** Ações extras por turno (Ação Extra) e usos de Furto em Combate. */
export function acoesExtras(db, personagem) {
  const partes = [];
  let total = 0;
  let furtos = 0;
  for (const e of doTipo(db, personagem, 'acoesExtras')) {
    if (e.alvo === 'furtoEmCombate') { furtos += e.valorEfetivo ?? 0; partes.push({ fonte: `${e.vantagem} ${e.nivel}`, nota: e.nota }); continue; }
    total += e.valorEfetivo ?? 0;
    partes.push({ fonte: e.vantagem, nota: e.nota });
  }
  return { total, furtosNoCombate: furtos, partes };
}

/** Imunidades e dispensas concedidas (Corpo Leve, Transe, Hipoalgia, Imunidade…). */
export function imunidades(db, personagem) {
  return [...doTipo(db, personagem, 'imunidade'), ...doTipo(db, personagem, 'dispensaPericia')]
    .map(e => ({ vantagem: e.vantagem, alvo: e.alvo, nota: e.nota || '' }));
}

/** Visão Noturna: ignora a penalidade de luz, exceto em Escuridão Total. */
export function ignoraPenalidadeDeLuz(db, personagem, nivelLuz = null) {
  if (!temVantagem(db, personagem, 'visao-noturna')) return { ignora: false, motivo: null };
  const tabela = db?.maneuvers?.luminosidade?.tabela || [];
  const linha = tabela.find(l => l.id === nivelLuz || l.nivel === nivelLuz);
  const total = nivelLuz && String(nivelLuz).toLowerCase().includes('total');
  if (total) return { ignora: false, motivo: 'Visão Noturna não funciona em Escuridão Total.', linha: linha || null };
  return { ignora: true, motivo: 'Visão Noturna: penalidades por escuridão não se aplicam (exceto Escuridão Total).', linha: linha || null };
}

/** Multiplicador de pontos em perícias mentais (Memória Eidética: ×2 no 1º nível, ×4 no 2º). */
export function multiplicadorDePericiasMentais(db, personagem) {
  const def = definicaoDaVantagem(db, 'memoria-eidetica');
  const nivel = nivelSelecionado(db, personagem, 'memoria-eidetica');
  if (!nivel) return { multiplicador: 1, nivel: 0, nota: null };
  const indice = (def?.niveis || []).findIndex(n => n.nome === nivel.nome);
  return {
    multiplicador: Number(nivel.multiplicadorPericiasMentais) || (indice >= 1 ? 4 : 2),
    nivel: indice + 1,
    nota: 'Memória Eidética: pontos em perícias mentais contam em dobro (1º nível) ou em quádruplo (2º nível). Sem bônus para mágicas ou perícias psíquicas.',
  };
}

/** Configuração de Sorte possuída (3 jogadas, 1×/hora ou 1×/30 min). */
export function sorte(db, personagem) {
  const def = definicaoDaVantagem(db, 'sorte');
  const nivel = nivelSelecionado(db, personagem, 'sorte');
  if (!nivel) return null;
  return {
    nome: nivel.nome, jogadas: nivel.jogadas ?? 3, intervaloMinutos: nivel.intervaloMinutos ?? 60,
    regras: def?.regras || [], nota: nivel.efeito || '',
  };
}

/** Status derivado da Hierarquia Militar: 1 nível de Status para cada 3 níveis (arredondado para o mais próximo). */
export function statusDerivado(db, personagem) {
  const nivel = nivelDaVantagem(db, personagem, 'hierarquia-militar');
  if (!nivel) return { nivel: 0, status: 0, partes: [] };
  const efeito = (definicaoDaVantagem(db, 'hierarquia-militar')?.efeitos || []).find(e => e.tipo === 'statusDerivado');
  const aCada = efeito?.aCada ?? 3;
  return {
    nivel, aCada,
    status: Math.round(nivel / aCada),
    partes: [{ fonte: `Hierarquia Militar ${nivel} ÷ ${aCada} (arredondado para o mais próximo)`, valor: Math.round(nivel / aCada) }],
    nota: efeito?.nota || '',
  };
}

/* ------------------------------------------------------------------ validação e custo */

/**
 * Valida as vantagens da ficha contra o material publicado:
 * requisitos de atributo, incompatibilidades (Abascanto × Aptidão Mágica), unicidade
 * (Arma Especial) e níveis acima do máximo publicado.
 */
export function validarVantagens(db, personagem) {
  const erros = [];
  const avisos = [];
  const atributos = personagem?.atributos || {};
  for (const entrada of personagem?.vantagens || []) {
    const def = definicaoDaVantagem(db, entrada.id);
    if (!def) { avisos.push(`Vantagem desconhecida no catálogo: "${entrada.nome || entrada.id}".`); continue; }

    for (const req of def.requisitos || []) {
      const m = String(req).match(/(ST|DX|IQ|HT)\s*(?:inicial\s*)?[≥>]=?\s*(\d+)/i);
      if (m) {
        const valor = Number(atributos[m[1].toUpperCase()]) || 0;
        if (valor < Number(m[2])) erros.push(`${def.nome}: ${req} — o personagem tem ${m[1].toUpperCase()} ${valor}.`);
      } else if (/feminina/i.test(req)) {
        if (personagem?.sexo && !/f/i.test(String(personagem.sexo))) erros.push(`${def.nome}: ${req}.`);
      }
    }

    for (const idIncompativel of def.incompativel || []) {
      if (temVantagem(db, personagem, idIncompativel)) {
        const outra = definicaoDaVantagem(db, idIncompativel);
        erros.push(`${def.nome} não pode ser combinada com ${outra?.nome || idIncompativel}.`);
      }
    }

    if (def.maxNiveis) {
      const n = nivelDaVantagem(db, personagem, def.id);
      if (n > def.maxNiveis) erros.push(`${def.nome}: máximo publicado de ${def.maxNiveis} níveis (a ficha tem ${n}).`);
    }

    if (def.requisitos?.some(r => /Apar/i.test(r))) {
      const aparencia = String(personagem?.aparenciaNivel || '');
      if (aparencia && !/(bonit|elegante|atraente)/i.test(aparencia)) {
        avisos.push(`${def.nome} exige ${def.requisitos.find(r => /Apar/i.test(r))} — aparência atual: ${aparencia}.`);
      }
    }
  }

  const unicas = lista(db).filter(a => a.unicidade);
  for (const def of unicas) {
    const quantas = (personagem?.vantagens || []).filter(v => definicaoDaVantagem(db, v.id)?.id === def.id);
    if (quantas.length > 1) erros.push(`${def.nome}: só é possível adquirir uma (a ficha tem ${quantas.length}).`);
  }

  return { ok: !erros.length, erros, avisos };
}

/** Custo em pontos de todas as vantagens da ficha (usa custoTrait, de traits.js). */
export function custoDasVantagens(db, personagem) {
  const partes = [];
  let total = 0;
  for (const entrada of personagem?.vantagens || []) {
    const def = definicaoDaVantagem(db, entrada.id);
    const c = custoTrait(personagem, entrada, def);
    total += c?.custo || 0;
    partes.push({ id: def?.id || entrada.id, nome: def?.nome || entrada.nome || entrada.id, ...c });
  }
  return { total, partes };
}

/* ------------------------------------------------------------------ agregado para a UI */

/** Painel completo: tudo que as vantagens do personagem alteram, com a origem de cada número. */
export function resumoDasVantagens(db, personagem) {
  const atributos = atributosEfetivos(db, personagem);
  const sentidos = ['visao', 'audicao', 'olfatoPaladar'];
  const rd = rdNatural(db, personagem);
  const validacao = validarVantagens(db, personagem);
  return {
    quantidade: (personagem?.vantagens || []).length,
    custo: custoDasVantagens(db, personagem),
    atributos: { valores: atributos, ajustes: atributos._breakdown },
    sentidos: Object.fromEntries(sentidos.map(s => [s, bonusDeSentido(db, personagem, s)])),
    defesasAtivas: bonusDeDefesaAtiva(db, personagem),
    defesasPorFlanco: { costas: defesaPorFlanco(db, personagem, 'costas') },
    rd,
    vontade: bonusDeVontade(db, personagem),
    panico: bonusDePanico(db, personagem),
    resistenciaMagica: resistenciaAMagia(db, personagem),
    resistenciaPsiquica: resistenciaPsiquica(db, personagem),
    periciasMentais: multiplicadorDePericiasMentais(db, personagem),
    iqEfetivo: {
      magia: iqEfetivo(db, personagem, 'magia'),
      linguas: iqEfetivo(db, personagem, 'aprenderLinguas'),
      musica: iqEfetivo(db, personagem, 'periciasMusicais'),
    },
    acoes: acoesExtras(db, personagem),
    imunidades: imunidades(db, personagem),
    modificadoresGerais: modificadoresGerais(db, personagem),
    dano: danoExtra(db, personagem),
    sorte: sorte(db, personagem),
    statusDerivado: statusDerivado(db, personagem),
    validacao,
    soNaCriacao: db?.vantagens?.definicao?.momentoDeCompra || 'só na criação (com poucas exceções)',
  };
}
