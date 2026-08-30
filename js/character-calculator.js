/* GAU — Motor de Regras Centralizado (Character Calculator)
   Toda fórmula vive aqui. UI não contém regras.

   Fluxo:
   Character -> Rules Engine -> Modifiers -> Derived Stats -> Validation -> Sheet
*/

import { calcularCarga, calcularLevantamento } from './dice.js';

export function computeCharacter(db, char) {
  // char = { nome, conceito, categoria, atributos: {ST,DX,IQ,HT}, pericias: [], manobras: [], empunhadura, equipamentos: [], historia }
  const atributos = char.atributos || { ST: 10, DX: 10, IQ: 10, HT: 10 };
  const ST = atributos.ST ?? 10;
  const DX = atributos.DX ?? 10;
  const IQ = atributos.IQ ?? 10;
  const HT = atributos.HT ?? 10;

  // Margens para cada atributo
  const margens = {};
  for (const [k, v] of Object.entries(atributos)) {
    const m = db.getMarginForValue(v);
    margens[k] = m ? {
      valor: v,
      margem: m.margem,
      margemTexto: m.margemTexto,
      critico: m.critico,
      descricao: m.descricao,
      extrapolado: m.extrapolado || false
    } : null;
  }

  // Vontade e Percepção derivados de IQ
  const vontadeBase = IQ;
  const perBase = IQ;
  const vontade = {
    valor: vontadeBase + (char.bonusVontade || 0),
    margem: db.getMarginForValue(vontadeBase + (char.bonusVontade || 0))
  };
  const percepcao = {
    valor: perBase + (char.bonusPercepcao || 0),
    margem: db.getMarginForValue(perBase + (char.bonusPercepcao || 0))
  };

  // Deslocamento: base = DX ou ST? Regra simplificada: (DX+HT)/4 ou ST? Usaremos (DX+HT)/4 arredondado
  // Mas livro menciona deslocamento base determina sequência. Usaremos fórmula: floor((DX+HT)/4) ou ST/2?
  // Vamos usar: Deslocamento = floor((DX + HT)/4) + modificador de categoria? E carga afeta.
  const deslocBase = Math.floor((DX + HT) / 4) + (ST >= 14 ? 1 : 0);
  const pesoEquip = (char.equipamentos || []).reduce((s, e) => s + (e.peso || 0) * (e.qtd || 1), 0);
  const carga = calcularCarga(ST, pesoEquip);
  const deslocAtual = Math.max(1, deslocBase - carga.penalidade);

  // Levantamento
  const levantamento = calcularLevantamento(ST);

  // PF e PV
  const pfMax = ST;
  const pvMax = HT;
  const pfAtual = pfMax - (char.fadiga || 0);
  const pvAtual = pvMax - (char.ferimentos || 0);

  // Perícias com margens
  const periciasCalc = (char.pericias || []).map(p => {
    // p = { nome, atributoBase, valor, nivel? } — valor já é NH final
    const valor = p.valor ?? (atributos[p.atributoBase] ?? 10) + (p.bonus || 0) - (p.redutor || 0);
    const margem = db.getMarginForValue(valor);
    return {
      ...p,
      valor,
      margem,
      margemTexto: margem?.margemTexto || '—',
      critico: margem?.critico ?? null
    };
  });

  // Manobras: verifica se personagem tem atributos mínimos?
  const manobras = char.manobras || [];

  // Poderes
  const poderesRaw = char.poderes || {};
  const poderesCalc = [];
  let custoPoderes = 0;
  for (const [poderId, dados] of Object.entries(poderesRaw)) {
    const def = (db.powers?.poderes || []).find(p => p.id === poderId);
    if (!def) continue;
    const potencia = dados.potencia || 0;
    const custoPot = potencia * (def.custo || 5);
    custoPoderes += custoPot;
    const periciasPsi = (dados.pericias || []).map(pp => {
      const perDef = (def.pericias || []).find(pd => pd.id === pp.id);
      const nivel = pp.nivel || 0;
      const margem = db.getMarginForValue(nivel);
      const custoHab = nivel * 2; // Mental/Difícil aproximado
      custoPoderes += custoHab;
      return {
        ...pp,
        poderId,
        poderNome: def.nome,
        potencia,
        margem,
        margemTexto: margem?.margemTexto || '—',
        custo: custoHab,
        descricao: perDef?.descricao || ''
      };
    });
    poderesCalc.push({
      id: poderId,
      nome: def.nome,
      sigla: def.sigla,
      potencia,
      custoPot,
      pericias: periciasPsi,
      alcance: def.alcance?.find(a => a.potencia === potencia)?.alcance || (potencia>0 ? `${potencia*10}m estimado` : '—')
    });
  }

  // Empunhadura
  const empunhadura = char.empunhadura ? (db.empunhaduras.empunhaduras || []).find(e => e.id === char.empunhadura) : null;

  // Validação
  const validacao = validarPersonagem(db, char, { atributos, margens, carga, deslocAtual, periciasCalc, poderesCalc, custoPoderes });

  // Categoria
  const categoria = (db.categories.categorias || []).find(c => c.id === (char.categoria || 'mundano')) || { id: 'mundano', nome: 'Mundano', dados: '1d20' };

  return {
    identidade: {
      nome: char.nome || 'Sem nome',
      conceito: char.conceito || '',
      categoria,
      jogador: char.jogador || '',
      historia: char.historia || ''
    },
    atributos: {
      ST, DX, IQ, HT,
      margens,
      vontade,
      percepcao
    },
    derivados: {
      deslocamento: { base: deslocBase, atual: deslocAtual, carga },
      levantamento,
      pf: { max: pfMax, atual: pfAtual, fadiga: char.fadiga || 0 },
      pv: { max: pvMax, atual: pvAtual, ferimentos: char.ferimentos || 0 },
      pesoEquip
    },
    pericias: periciasCalc,
    manobras,
    poderes: poderesCalc,
    custoPoderes,
    empunhadura,
    equipamentos: char.equipamentos || [],
    validacao,
    raw: char
  };
}

function validarPersonagem(db, char, calc) {
  const avisos = [];
  const erros = [];
  const infos = [];

  const { atributos, carga, poderesCalc, custoPoderes } = calc;

  // Atributos fora do limite mundano
  for (const [k, v] of Object.entries(atributos)) {
    if (v < 1) erros.push({ tipo: 'erro', msg: `${k} não pode ser menor que 1 (atual ${v})`, campo: k });
    if (v > 20 && (char.categoria || 'mundano') === 'mundano') {
      avisos.push({ tipo: 'aviso', msg: `${k}=${v} ultrapassa limite mundano (20). Requer categoria Sobre-Humana ou superior.`, campo: k });
    }
    if (v === 1) {
      avisos.push({ tipo: 'aviso', msg: `${k}=1 — Nenhuma margem de sucesso. Personagem incapaz nesta capacidade.`, campo: k });
    }
  }

  // Carga
  if (carga.excesso) {
    erros.push({ tipo: 'erro', msg: `Carga ${carga.peso}kg excede máximo carregável ${carga.limites.max}kg (15×ST). Personagem não pode se mover.`, campo: 'carga' });
  } else if (carga.nivel >= 3) {
    avisos.push({ tipo: 'aviso', msg: `Carga ${carga.nome} (${carga.peso}kg) — penalidade de movimento -${carga.penalidade}, -${carga.nivel * 2} em Natação, fadiga extra.`, campo: 'carga' });
  }

  // Perícias sem atributo base
  for (const p of calc.periciasCalc || []) {
    if (!p.atributoBase) {
      infos.push({ tipo: 'info', msg: `Perícia ${p.nome} sem atributo base definido — usando valor manual.`, campo: 'pericias' });
    }
  }

  // Empunhadura sem arma
  if (char.empunhadura && (!char.equipamentos || char.equipamentos.length === 0)) {
    infos.push({ tipo: 'info', msg: `Empunhadura ${char.empunhadura} selecionada mas nenhum equipamento de combate equipado.`, campo: 'empunhadura' });
  }

  // Categoria
  const cat = char.categoria || 'mundano';
  if (cat !== 'mundano') {
    infos.push({ tipo: 'info', msg: `Categoria ${cat} — testes podem ser limitados por categoria. Mundanos não podem realizar feitos de ${cat}.`, campo: 'categoria' });
  }

  // Nome
  if (!char.nome || char.nome.trim().length < 2) {
    avisos.push({ tipo: 'aviso', msg: 'Nome do personagem muito curto. Defina identidade.', campo: 'nome' });
  }

  // Poderes
  if (poderesCalc && poderesCalc.length > 0) {
    for (const p of poderesCalc) {
      if (p.potencia === 0) avisos.push({ tipo: 'aviso', msg: `Poder ${p.nome} com Potência 0 — sem efeito.`, campo: 'poderes' });
      if (p.potencia > 0 && p.pericias.length === 0) infos.push({ tipo: 'info', msg: `Poder ${p.nome} Pot ${p.potencia} sem perícias treinadas — pode usar níveis pré-definidos IQ-4 onde permitido.`, campo: 'poderes' });
      for (const per of p.pericias) {
        if (per.nivel < 8) avisos.push({ tipo: 'aviso', msg: `${per.nome} NH ${per.nivel} baixo — controle ruim.`, campo: 'poderes' });
      }
    }
    infos.push({ tipo: 'info', msg: `Custo estimado poderes: ${custoPoderes} pts (Potência + perícias).`, campo: 'poderes' });
  }

  const total = erros.length + avisos.length;
  const valido = erros.length === 0;
  const nivel = erros.length > 0 ? 'invalido' : avisos.length > 0 ? 'alerta' : 'ok';

  return { erros, avisos, infos, total, valido, nivel };
}

export function calcularDisputa(db, charA, attrA, rollA, charB, attrB, rollB) {
  // attrA = valor de atributo/perícia de A
  // rollA = rolagem d20 de A (ou null para rolar)
  // retorna vencedor
  const margemA = db.getMarginForValue(attrA);
  const margemB = db.getMarginForValue(attrB);
  const rA = rollA ?? Math.floor(Math.random()*20)+1;
  const rB = rollB ?? Math.floor(Math.random()*20)+1;
  const dentroA = margemA?.margem ? (rA >= margemA.margem[0] && rA <= margemA.margem[1]) : false;
  const dentroB = margemB?.margem ? (rB >= margemB.margem[0] && rB <= margemB.margem[1]) : false;
  const distA = margemA ? Math.abs(rA - margemA.critico) : 999;
  const distB = margemB ? Math.abs(rB - margemB.critico) : 999;

  let vencedor = 'empate';
  let motivo = '';
  if (dentroA && !dentroB) { vencedor = 'A'; motivo = 'A sucesso, B falha'; }
  else if (!dentroA && dentroB) { vencedor = 'B'; motivo = 'B sucesso, A falha'; }
  else if (distA < distB) { vencedor = 'A'; motivo = `A mais próximo do crítico (${distA} vs ${distB})`; }
  else if (distB < distA) { vencedor = 'B'; motivo = `B mais próximo do crítico (${distB} vs ${distA})`; }
  else { vencedor = 'empate'; motivo = 'Mesma distância ao crítico'; }

  return {
    a: { valor: attrA, roll: rA, margem: margemA, sucesso: dentroA, dist: distA },
    b: { valor: attrB, roll: rB, margem: margemB, sucesso: dentroB, dist: distB },
    vencedor, motivo
  };
}
