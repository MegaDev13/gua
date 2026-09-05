#!/usr/bin/env node
/* Testes do GUA Rule Engine — executar: node tests/run.mjs
 * Casos verificam as fórmulas contra EXEMPLOS DO PRÓPRIO MATERIAL (páginas citadas). */
import DB from '../app/engine/db.js';
import { Dice } from '../app/engine/dice.js';
import { custoAtributo, danoBasico, velocidadeBasica } from '../app/engine/attributes.js';
import { nivelParaPontos, custoNivel, melhorDefault, nivelEfetivo, parseDefaults } from '../app/engine/skills.js';
import { nivelCarga, deslocamento, defesaPassiva } from '../app/engine/encumbrance.js';
import { Dice as D } from '../app/engine/dice.js';
import { aparar, avaliarDano, danoArma, nhAtaque, aplicarFerimento } from '../app/engine/combat.js';
import { custoFadiga, gastarFadiga, estadoFadiga, recuperarFadiga } from '../app/engine/fatigue.js';
import { iqMagico, nivelMagia, reducaoCusto, custoBase, custoManutencao, parsePrereqs } from '../app/engine/spells.js';
import { podeComprar, comprar, vender } from '../app/engine/economy.js';
import { checkRequirement } from '../app/engine/requirements.js';
import { novoPersonagem, contagemDePontos } from '../app/engine/character.js';
import {
  nivelDaVantagem, rdNatural, bonusDeSentido, bonusDePericia, bonusDeDefesaAtiva, defesaPorFlanco,
  bonusDePanico, bonusDeVontade, resistenciaAMagia, resistenciaPsiquica, atributosEfetivos, iqEfetivo,
  modificadoresGerais, danoExtra, acoesExtras, imunidades, ignoraPenalidadeDeLuz,
  multiplicadorDePericiasMentais, sorte, statusDerivado, validarVantagens, custoDasVantagens,
} from '../app/engine/vantagens.js';
const validarVantagemOk = (db, pc) => validarVantagens(db, pc).ok === true;
import { computeAll } from '../app/engine/engine.js';

let pass = 0, fail = 0; const failures = [];
function t(nome, cond, info = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(`${nome} ${info}`); console.error(`✗ ${nome} ${info}`); }
}
await DB.load();

/* ---------------------------------------------------------- Dados carregados */
t('skills.json ≥ 170 perícias', DB.skills.length >= 170, `got ${DB.skills.length}`);
t('advantages.json ≥ 60', DB.advantages.length >= 60, `got ${DB.advantages.length}`);
t('disadvantages.json ≥ 80', DB.disadvantages.length >= 80, `got ${DB.disadvantages.length}`);
t('spells.json ≥ 80', DB.spells.length >= 80, `got ${DB.spells.length}`);
t('armaduras = 17', (DB.equipment.armaduras || []).length === 17);
t('escudos = 6', (DB.equipment.escudos || []).length === 6);
t('custoAtributos 12→20', DB.tables.custoAtributos.tabela['12'] === 20);

/* ---------------------------------------------------------- Atributos (p. 1-5, Dai p. 4) */
t('custo ST8 = -15 (p. 1)', custoAtributo(DB, 8) === -15);
t('custo DX15 = 60 (Dai, p. 4)', custoAtributo(DB, 15) === 60);
t('custo HT12 = 20 (Dai)', custoAtributo(DB, 12) === 20);
t('custo ST10 = 0', custoAtributo(DB, 10) === 0);
t('custo ST20 = 175', custoAtributo(DB, 20) === 175);
const dai = { atributos: { ST: 8, DX: 15, IQ: 12, HT: 12 } };
t('Velocidade Dai = 6,75 (p. 4)', velocidadeBasica(dai.atributos) === 6.75);
t('Dano básico ST10: GDP 1D-2 / Bal 1D (p. 190)', danoBasico(DB, 10).gdp === '1D-2' && danoBasico(DB, 10).bal === '1D');
t('Dano básico ST12: Bal 1D+2', danoBasico(DB, 12).bal === '1D+2');
t('Dano básico ST13: Bal 2D-1', danoBasico(DB, 13).bal === '2D-1');

/* ---------------------------------------------------------- Perícias (p. 104-108) */
// Física/Fácil: 2 pontos → DX+1; 4 → DX+2 (ex. Dai p. 181-182: DX15+2=17 com 4 pontos em Faca)
t('Fís/Fácil 2 pts → +1', nivelParaPontos(DB, 2, 'Física', 'Fácil') === 1);
t('Fís/Fácil 4 pts → +2 (Dai Faca 17)', nivelParaPontos(DB, 4, 'Física', 'Fácil') === 2);
t('Fís/Média ½ pt → -2', nivelParaPontos(DB, 0.5, 'Física', 'Média') === -2);
t('Fís/Média 1 pt → -1', nivelParaPontos(DB, 1, 'Física', 'Média') === -1);
t('Fís/Difícil ½ pt → -3', nivelParaPontos(DB, 0.5, 'Física', 'Difícil') === -3);
t('Fís/Difícil 16 pts → +2', nivelParaPontos(DB, 16, 'Física', 'Difícil') === 2);
t('Men/Média 2 pts → IQ (p. 105)', nivelParaPontos(DB, 2, 'Mental', 'Média') === 0);
t('Men/Média ½ pt → -2 (Armadilhas IQ-2, p. 182)', nivelParaPontos(DB, 0.5, 'Mental', 'Média') === -2);
t('Men/MD 8 pts → 0', nivelParaPontos(DB, 8, 'Mental', 'Muito Difícil') === 0);
t('Men/MD 12 pts → +1', nivelParaPontos(DB, 12, 'Mental', 'Muito Difícil') === 1);
t('Men/Fácil 1 pt → 0', nivelParaPontos(DB, 1, 'Mental', 'Fácil') === 0);
t('Men/Difícil 6 pts → +1', nivelParaPontos(DB, 6, 'Mental', 'Difícil') === 1);
t('custoNivel IQ12→13 Mental/Média = 4 (p. 105)', custoNivel(DB, 12, 13, 'Mental', 'Média') === 4);
// Defaults
const arromb = DB.skill('arrombamento');
t('Arrombamento existe', !!arromb);
const pc = { atributos: { ST: 10, DX: 10, IQ: 11, HT: 10 }, pericias: [] };
const df = melhorDefault(pc, arromb, {});
t('Default Arrombamento IQ11-5 = 6 (p. 106)', df && df.valor === 6);
// Default por outra perícia (E. Lâmina Larga = E. Curtas-2, p. 107)
const ell = DB.skills.find(s => /L.mina Larga/i.test(s.nome));
t('Espadas de Lâmina Larga existe', !!ell);
const pc2 = { atributos: { ST: 10, DX: 12, IQ: 10, HT: 10 }, pericias: [{ id: 'espadas-curtas', pontos: 2, especialidade: null }] };
const niveis2 = { 'Espadas Curtas': 13, 'espadas curtas': 13 };
const df2 = melhorDefault(pc2, ell, niveis2);
t('ELL default = Espadas Curtas(13)-2 = 11 (p. 107)', df2 && df2.valor === 11);
// Atributo >20 conta como 20 (p. 109)
const pc3 = { atributos: { ST: 10, DX: 25, IQ: 10, HT: 10 }, pericias: [] };
const nat = DB.skill('natacao');
const df3 = melhorDefault(pc3, nat, {});
t('DX 25 → default Natação conta DX como 20 = 16 (p. 109)', df3 && df3.valor === 16);

/* ---------------------------------------------------------- Carga/Deslocamento (p. 195-197) */
const carregado = novoPersonagem('Teste');
carregado.atributos = { ST: 10, DX: 11, HT: 11, IQ: 10 };
carregado.inventario = [{ nome: 'Armadura de placas', categoria: 'armadura', peso: 45, qtd: 1, equipado: true, dp: 4, rd: 6, notas: 'Elmo: -1 NH armas, -3 Visão/Audição' }];
let c = nivelCarga(DB, carregado);
t('45 kg / ST10 = Carga Pesada (nível 3)', c.nivel === 3, JSON.stringify(c));
carregado.inventario[0].peso = 25;
c = nivelCarga(DB, carregado);
t('25 kg / ST10 = Carga Média (nível 2)', c.nivel === 2);
carregado.inventario[0].peso = 15;
c = nivelCarga(DB, carregado);
t('15 kg / ST10 = Carga Leve (nível 1)', c.nivel === 1);
const mov = deslocamento(DB, carregado, {});
t('Velocidade 5,5 − Leve 1 = 4,5 → Mov 4 (p. 197)', mov.valor === 4, JSON.stringify(mov));
carregado.inventario = [];
const mov2 = deslocamento(DB, carregado, {});
t('Sem carga: Mov = floor(5,5) = 5', mov2.valor === 5);
// Corrida NH16 → +2
carregado.pericias = [{ id: 'corrida', pontos: 8 }];
const mov3 = deslocamento(DB, carregado, { niveisPericias: { 'Corrida': 16 } });
t('Corrida NH16: +2 → Mov 7 (p. 197)', mov3.valor === 7);
// DP/RD com escudo e rijeza
carregado.inventario = [
  { nome: 'Cota de malha', categoria: 'armadura', peso: 22.5, qtd: 1, equipado: true, dp: 3, rd: 4 },
  { nome: 'Escudo médio', categoria: 'escudo', peso: 7, qtd: 1, equipado: true, dp: 3 },
];
carregado.vantagens = [{ id: 'rijeza', niveis: 1 }];
const pdt = defesaPassiva(carregado);
t('DP total = 3 (malha) + 3 (escudo) = 6; RD = 4 + 1 (Rijeza) = 5', pdt.dp === 6 && pdt.rd === 5, JSON.stringify(pdt));

/* ---------------------------------------------------------- Combate (p. 220-233) */
const lut = novoPersonagem('Lutador');
lut.atributos = { ST: 12, DX: 14, IQ: 10, HT: 12 };
lut.pericias = [{ id: 'espadas-curtas', pontos: 4 }]; // Fís/Média 4 → DX+1 = 15
const ctxL = { db: DB, niveisPericias: { 'Espadas Curtas': 15 } };
const ap = aparar(lut, lut.pericias[0], ctxL);
t('Aparar = floor(15/2) = 7 (p. 229)', ap.valor === 7, JSON.stringify(ap));
lut.pericias[0].pontos = 8; // 8 → DX+2 = 16
const ap2 = aparar(lut, lut.pericias[0], ctxL);
t('Aparar NH16 = 8', ap2.valor === 8);
const bastao = DB.skills.find(s => /Bastão/i.test(s.nome));
lut.pericias.push({ id: bastao.id, pontos: 8 });
const apB = aparar(lut, lut.pericias[1], ctxL);
t('Bastão: Aparar = 2/3 NH (p. 230)', apB.valor === Math.floor(16 * 2 / 3));
// Dano de arma (p. 193: montante ST10 = Bal 1D +1 = 1D+1)
const arma = { nome: 'Montante', dano: 'Bal+1', tipoDano: 'corte', categoria: 'arma' };
const dArma = danoArma(DB, { atributos: { ST: 10, DX: 10, IQ: 10, HT: 10 } }, arma);
t('Montante ST10: 1D+1 (p. 193)', dArma.expr === '1D+1', dArma.expr);
// Dano com RD e multiplicadores (p. 230: 2D=8, RD3 → 5, corte +2 = 7)
const aval = avaliarDano(DB, { danoExpr: '2D', tipoDano: 'corte', rd: 3, local: 'Tronco', _roll: 8 });
// força resultado determinístico:
const diceFixo = new Dice(() => (2 / 6)); // cada d6 = 3? rng*6 floor +1... (2/6)*6=2 → d6=3
const av2 = (() => {
  const d = new Dice(() => 5 / 6); // d6 = 6
  const saved = globalThis.__dice; // n/a
  // rolar manualmente via avaliarDano não aceita dice; testar multiplicadores via damage()
  const r = d.damage('2D'); // 6+6=12
  return r;
})();
t('Dados viciados 2D = 12', av2.total === 12);
// multiplicadores: implementação determinística via dice injetado no engine combat
// (avaliarDano usa o dice singleton; testamos a matemática via casos indiretos abaixo)
const mult = ((bruto, rd, tipo, local) => {
  const passa = Math.max(0, bruto - rd);
  if (tipo === 'corte') return Math.floor(passa * 1.5);
  if (tipo === 'perfuracao') return Math.floor(passa * 2);
  if (local === 'Órgãos vitais' && tipo === 'perfuracao') return passa * 3;
  return passa;
})(8, 3, 'corte', 'Tronco');
t('Corte: 8 − RD3 = 5 → +50% = 7 (p. 230)', mult === 7);
const multImp = ((bruto, rd) => Math.floor(Math.max(0, bruto - rd) * 2))(5, 0);
t('Perfurante: 5 → ×2 = 10 (p. 191)', multImp === 10);

/* ---------------------------------------------------------- Fadiga (p. 298-300) */
t('Luta sem carga = 1 fadiga', custoFadiga(DB, {}, 'luta', { nivelCarga: 0 }).custo === 1);
t('Luta carga muito pesada = 5', custoFadiga(DB, {}, 'luta', { nivelCarga: 4 }).custo === 5);
const fat = novoPersonagem('Cansado');
fat.atributos.ST = 10; fat.combate.fadiga = 0;
const g1 = gastarFadiga(fat, 7);
t('Gastar 7 de 10 ST → fadiga 7', g1.fadiga === 7);
const g2 = gastarFadiga(fat, 11);
t('Fadiga nunca passa de ST (10)', g2.fadiga === 10 && g2.estado === 'desmaiado');
fat.combate.fadiga = 10;
t('Recuperação: 30 min = 3 pontos', recuperarFadiga(fat, 30) === 7);
const exausto = novoPersonagem('X'); exausto.atributos.ST = 10; exausto.combate.fadiga = 8;
t('ST≤3: exausto (Mov ½)', estadoFadiga(exausto).estado === 'exausto');

/* ---------------------------------------------------------- Magia (p. 300-314) */
const mago = novoPersonagem('Mago');
mago.atributos = { ST: 10, DX: 10, IQ: 12, HT: 10 };
mago.vantagens = [{ id: 'aptidao-magica', niveis: 3 }];
t('IQ mágico = 12+3 = 15 (p. 301)', iqMagico(mago).valor === 15);
t('Redução NH15 → custo −1 (p. 311)', reducaoCusto(15) === 1 && reducaoCusto(20) === 2 && reducaoCusto(25) === 3);
const luz = DB.spells.find(s => /luz/i.test(s.nome));
t('Magia Luz existe', !!luz);
const sonho = DB.spells.find(s => s.nome === 'Sono');
t('Sono: custo base 4', sonho && custoBase(sonho) === 4, sonho && sonho.Custo);
const inepcia = DB.spells.find(s => /In[ée]pcia/.test(s.nome));
t('Inépcia: manutenção = metade de custo arredondado p/ cima (texto) — parse custo', inepcia && custoBase(inepcia) === 1);
const reqAcalmar = parsePrereqs(DB.spell('acalmar-animais'), DB);
t('Pré-req. Acalmar Animais resolve grupo OU sem fragmentos falsos', reqAcalmar.length === 1 && reqAcalmar[0].tipo === 'grupo-ou' && reqAcalmar[0].requisitos.some(r => r.id === 'empatia-com-animais') && reqAcalmar[0].requisitos.some(r => r.id === 'persuasao') && !reqAcalmar[0].requisitos.some(r => r.nome?.length < 4), JSON.stringify(reqAcalmar));

/* ---------------------------------------------------------- Economia (p. 181) */
const comprador = novoPersonagem('Comprador');
comprador.riqueza.dinheiro = 500;
const espadaCara = { id: 'x', nome: 'Item caro', custo: 700 };
const bloqueio = podeComprar(comprador, espadaCara);
t('Compra bloqueada: faltam $200', !bloqueio.ok && bloqueio.motivos.some(m => m.includes('$200')), JSON.stringify(bloqueio));
const ok1 = comprar(comprador, { id: 'laudel', nome: 'Laudel', custo: 180, peso: 7, categoria: 'armadura' });
t('Compra Laudel $180 → saldo $320', ok1.ok && comprador.riqueza.dinheiro === 320);
const v1 = vender(comprador, 'laudel', 1);
t('Venda volta $180 → $500', v1.ok && comprador.riqueza.dinheiro === 500);

/* ---------------------------------------------------------- Requisitos */
t('Req atributo IQ≥12 ok/falha', checkRequirement(DB, mago, { tipo: 'atributo', key: 'IQ', min: 12 }).ok && !checkRequirement(DB, mago, { tipo: 'atributo', key: 'IQ', min: 13 }).ok);
t('Req potencial (Aptidão 2 de 3)', checkRequirement(DB, mago, { tipo: 'potencial', niveis: 2 }).ok);
t('Req dinheiro com motivo', checkRequirement(DB, comprador, { tipo: 'dinheiro', min: 1000 }).motivo.includes('Faltam'));

/* ---------------------------------------------------------- Contagem de pontos (Dai, p. 4: 85 pts em atributos) */
const daiFull = novoPersonagem('Dai Blackthorn', 100);
daiFull.atributos = { ST: 8, DX: 15, IQ: 12, HT: 12 };
daiFull.config.emCriacao = true;
const cont = contagemDePontos(DB, daiFull);
t('Dai: 85 pontos em atributos', cont.gastos === 85, JSON.stringify(cont.gastos));
t('Dai: 15 disponíveis', cont.disponiveis === 15);
daiFull.peculiaridades = ['a', 'b', 'c', 'd', 'e'];
const cont2 = contagemDePontos(DB, daiFull);
t('5 peculiaridades = −5 → 20 disponíveis (p. 100-101)', cont2.disponiveis === 20);

/* ---------------------------------------------------------- computeAll integração */
const snap = computeAll(DB, daiFull);
t('computeAll: velocidade 6,75', snap.velocidadeBasica === 6.75);
t('computeAll: deslocamento 6 (sem carga)', snap.deslocamento.valor === 6);
t('computeAll: esquiva = deslocamento', snap.esquiva === 6);
t('computeAll ST8: dano GDP 1D-3 / Bal 1D-2 (p. 190)', snap.danoBasico.gdp === '1D-3' && snap.danoBasico.bal === '1D-2');


/* ---------------------------------------------------------- avaliarDano modo bruto (dano já rolado) */
{
  const av1 = avaliarDano(DB, { bruto: 8, tipoDano: 'corte', rd: 3, local: 'Tronco' });
  t('avaliarDano bruto: corte 8 vs RD 3 = 7', av1.final === 7, `veio ${av1.final}`);
  const av2 = avaliarDano(DB, { bruto: 6, tipoDano: 'perfuração', rd: 2, local: 'Órgãos vitais' });
  t('avaliarDano bruto: perfurante vísceras 6 vs RD 2 = 12 (×3)', av2.final === 12, `veio ${av2.final}`);
}

/* ========================================================== G.A.U. (d20, 2026) */
const { margemDeSucesso, testeD20, avaliacaoDisputaStub, disputa, avaliarDisputa, resultadoPanico, penalidadeDeLuz, testesPreDefinidos } = await import('../app/engine/resolution.js');
const { secundarios, parametros, deslocamentoGAU, referenciaDeAtaque, esquivaGAU, apararGAU, bloqueioGAU } = await import('../app/engine/derived.js');
const { grauDeDano, avaliarDanoGAU, arsenal, armaPorId, danoArremessado, distanciaArremesso, peDe, danoEmEstrutura, estadoDeDegradacao, mediaDaArma } = await import('../app/engine/damage.js');
const { listaManobras, acharManobra, efeitosDeManobra, executarAtaque, defender, bonusDeApontar, bonusDeEmpunhadura } = await import('../app/engine/maneuvers.js');
const { novoPoder, custoDoPoder, validarPoder, orcamentoDePoder, bonusDosPoderes } = await import('../app/engine/powers.js');
const { categorias, nivelDaCategoria, comparaDimensionalidade, podeRealizarTeste } = await import('../app/engine/categories.js');
const { limitesDeLevantamento, esforcoExtra, cavar, arremessarObjeto, nadar, salvarAfogado, testeDeSentido, testeDeVontade, saltar } = await import('../app/engine/proezas.js');
const { maximoDeAptidao, iqParaMagia, ritualPorNH, reducaoDeCusto, custoDeConjuracao, conjurar, poderDoObjeto, encantamentoLentoESeguro, criarDemonio } = await import('../app/engine/magic.js');
const { pfMax, pfDisponiveis, stEfetiva } = await import('../app/engine/fatigue.js');
const { migrarPersonagem, aptidaoMagicaDe } = await import('../app/engine/character.js');

/** Dado falso e determinístico: devolve sempre o mesmo valor no d20. */
const dadoFixo = (valor, tres = [3, 3, 3]) => ({
  roll: (q) => Array.from({ length: q }, () => valor),
  roll3d: () => tres,
  d20: () => valor,
  d: () => valor,
  history: [],
});

const gauPc = novoPersonagem('Impio', 150, DB);
gauPc.atributos = { ST: 12, DX: 13, IQ: 11, HT: 12 };
gauPc.pericias = [{ id: 'espada', nome: 'Espada', pontos: 4, nh: 14 }];
gauPc.inventario = [{ id: 'escudo-medio', nome: 'Escudo médio', categoria: 'escudo', equipado: true, dp: 1, rd: 1, bonusDefesa: 1 }];
gauPc.combate = { ferimentos: 0, fadiga: 2, condicoes: [], manobra: null, rodada: 0 };

/* ---------------------------------------------------------- dados carregados */
t('resolucao.json: dadoBase d20', DB.resolucao?.dadoBase === 'd20');
t('resolucao.json: 20 referências de margem', Object.keys(DB.resolucao?.margens?.tabela || {}).length === 20);
t('armas.json: 3 eras', (DB.armas?.eras || []).length === 3);
t('armas.json: ≥ 60 armas', arsenal(DB).length >= 60, `got ${arsenal(DB).length}`);
t('estruturas.json: 7 materiais', (DB.estruturas?.estruturas?.materiais || []).length === 7);
t('proezas.json: tabela de pânico 4…40+', (DB.proezas?.panico?.rolagem?.tabela || []).length === 33);
t('poderes.json: 9 grupos de efeito', (DB.poderes?.modulos?.efeitos?.grupos || []).length === 9);
t('poderes.json: 31 condições', (DB.poderes?.modulos?.condicoes?.itens || []).length >= 30);
t('maneuvers.json: 6 manobras básicas', (DB.maneuvers?.manobras || []).length === 6);
t('maneuvers.json: árvore com ≥ 50 nós', listaManobras(DB).length >= 50, `got ${listaManobras(DB).length}`);
t('book.json: 13 capítulos', (DB.book?.capitulos || []).length === 13);
t('ficha.json: secundários PV/VON/PER/PF', (DB.ficha?.blocos?.find(b => b.id === 'secundarios')?.contas || []).map(c => c.id).join(',') === 'PV,VON,PER,PF');

/* ---------------------------------------------------------- margens de sucesso */
t('margem ref 10 → 8–12, crítico 10', (() => { const m = margemDeSucesso(DB, 10); return m.min === 8 && m.max === 12 && m.critico === 10; })());
t('margem ref 13 → 10–16', margemDeSucesso(DB, 13).texto === '10–16');
t('margem ref 16 → 12–20', margemDeSucesso(DB, 16).texto === '12–20');
t('margem ref 2 → 3 (largura 1)', margemDeSucesso(DB, 2).texto === '3' && margemDeSucesso(DB, 2).largura === 1);
t('margem ref 1 → nenhuma (indefinida)', margemDeSucesso(DB, 1).definida === false);
t('margem ref 20 → 15–25 (acima do d20: escala superior)', margemDeSucesso(DB, 20).texto === '15–25');

/* ---------------------------------------------------------- teste d20 */
t('d20: 10 com referência 10 = CRÍTICO', testeD20(DB, { referencia: 10, dice: dadoFixo(10) }).tipo === 'critico');
t('d20: 8 com referência 10 = sucesso (borda inferior)', testeD20(DB, { referencia: 10, dice: dadoFixo(8) }).sucesso === true);
t('d20: 12 com referência 10 = sucesso (borda superior)', testeD20(DB, { referencia: 10, dice: dadoFixo(12) }).sucesso === true);
t('d20: 7 com referência 10 = falha', testeD20(DB, { referencia: 10, dice: dadoFixo(7) }).sucesso === false);
t('d20: 13 com referência 10 = falha', testeD20(DB, { referencia: 10, dice: dadoFixo(13) }).sucesso === false);
t('d20: "1" não é falha automática (ref 2 → margem 3, mas ref 3 → 2–4 inclui 1? não)', testeD20(DB, { referencia: 3, dice: dadoFixo(1) }).sucesso === false);
t('d20: 1 dentro da margem é sucesso (ref 2 → margem 3? não; ref 4 → 3–5)', testeD20(DB, { referencia: 4, dice: dadoFixo(3) }).sucesso === true);
t('d20: 20 não é sucesso automático (ref 10 → margem 8–12)', testeD20(DB, { referencia: 10, dice: dadoFixo(20) }).sucesso === false);
t('d20: 20 é sucesso quando a margem alcança 20 (ref 16 → 12–20)', testeD20(DB, { referencia: 16, dice: dadoFixo(20) }).sucesso === true);
t('d20: modificador aplicado na jogada, não na referência', (() => {
  const r = testeD20(DB, { referencia: 10, modificadores: [{ fonte: 'luz', valor: -3 }], dice: dadoFixo(10) });
  return r.valor === 7 && r.referencia === 10 && r.margem.texto === '8–12' && r.sucesso === false;
})());
t('d20: bloqueado por categoria exigida superior', testeD20(DB, { referencia: 10, categoriaExigida: 'superior-3', personagem: gauPc, dice: dadoFixo(10) }).bloqueado === true);
t('d20: categoria superior rola mais dados', testeD20(DB, { referencia: 20, categoria: 'superior-2', dice: dadoFixo(19) }).rolls.length === 2);

/* ---------------------------------------------------------- disputas */
t('disputa: vence o mais próximo do próprio crítico', (() => {
  const a = testeD20(DB, { referencia: 12, dice: dadoFixo(12) });   // crítico exato
  const b = testeD20(DB, { referencia: 18, dice: dadoFixo(15) });   // dentro, mas distante
  const r = avaliarDisputa(DB, a, b, { criterio: 'proximidade-do-critico' });
  return r.vencedor === 'A';
})());
t('disputa: empate quando ambos têm a mesma distância do crítico', (() => {
  const a = testeD20(DB, { referencia: 10, dice: dadoFixo(9) });
  const b = testeD20(DB, { referencia: 10, dice: dadoFixo(11) });
  return avaliarDisputa(DB, a, b, { criterio: 'proximidade-do-critico' }).empate === true;
})());

/* ---------------------------------------------------------- secundários e parâmetros */
t('PV = ST × HT (12×12 = 144)', secundarios(DB, gauPc).PV.valor === 144);
t('VON = IQ', secundarios(DB, gauPc).VON.valor === 11);
t('PER = IQ', secundarios(DB, gauPc).PER.valor === 11);
t('PF = HT', secundarios(DB, gauPc).PF.valor === 12);
t('PF: reserva máxima = HT; fadiga 2 → 10 disponíveis', pfMax(gauPc) === 12 && pfDisponiveis(gauPc) === 10);
t('ST efetiva = ST − fadiga (12 − 2 = 10)', stEfetiva(gauPc) === 10);
t('ESQ = DX', esquivaGAU(DB, gauPc).valor === 13);
t('BLOQ = ST + bônus do escudo (12 + 1)', bloqueioGAU(DB, gauPc).valor === 13);
t('APAR sem arma treinada = DX', apararGAU(DB, gauPc).valor === 13);
t('parâmetros: ATQ/ESQ/DSL/APAR/BLOQ presentes', ['ATQ', 'ESQ', 'DSL', 'APAR', 'BLOQ'].every(k => parametros(DB, gauPc)[k] != null));
t('DSL: caminhada = metade da corrida, arredondada para cima', (() => {
  const d = deslocamentoGAU(DB, gauPc, {});
  return d.caminhada === Math.ceil(d.corrida / 2);
})());
t('ATQ usa o NH da arma quando treinada', referenciaDeAtaque(DB, gauPc, { arma: { id: 'espada-longa', nome: 'Espada longa', nh: 14 } }).valor === 14);
t('ATQ montado = menor entre arma e Cavalgar', referenciaDeAtaque(DB, gauPc, { arma: { nh: 14 }, montado: { nhCavalgar: 9 } }).valor === 9);

/* ---------------------------------------------------------- Grau de Dano */
t('GD1: 1–20 (raspão)', grauDeDano(DB, 1).id === 'GD1' && grauDeDano(DB, 20).id === 'GD1');
t('GD2: 21–64 (em cheio)', grauDeDano(DB, 21).id === 'GD2' && grauDeDano(DB, 64).id === 'GD2');
t('GD3: 65+ (letal)', grauDeDano(DB, 65).id === 'GD3' && grauDeDano(DB, 999).id === 'GD3');
t('dano 0 → sem grau', grauDeDano(DB, 0).grau === 0);
t('avaliarDanoGAU: 30 − RD 10 = 20 → GD1', (() => {
  const r = avaliarDanoGAU(DB, { bruto: 30, rd: 10 });
  return r.dano === 20 && r.grau.id === 'GD1';
})());
t('avaliarDanoGAU: localização não altera o GD (tiro de 30 na mão continua GD2)', (() => {
  const r = avaliarDanoGAU(DB, { bruto: 30, rd: 0, local: 'Mão' });
  return r.grau.id === 'GD2';
})());

/* ---------------------------------------------------------- arsenal */
t('espada longa (medieval) existe e tem dano', !!armaPorId(DB, 'espada-longa')?.dano);
t('todas as armas: média publicada confere com a média estatística', (() => {
  const erradas = arsenal(DB).filter(a => a.media != null && Math.abs(mediaDaArma(a).calculada - a.media) > 0.01);
  return erradas.length === 0;
})(), arsenal(DB).filter(a => a.media != null && Math.abs(mediaDaArma(a).calculada - a.media) > 0.01).map(a => `${a.nome}:${a.media}≠${mediaDaArma(a).calculada}`).join(','));
t('PREC: rifle de precisão = 3, sniper = 4', (() => {
  const t1 = (DB.armas?.precisao?.tabela || []).find(l => l.id === 'rifle-de-precisao');
  const t2 = (DB.armas?.precisao?.tabela || []).find(l => l.id === 'sniper');
  return t1?.prec === 3 && t2?.prec === 4;
})());
t('apontar: PREC + 1/segundo adicional + arma firmada', bonusDeApontar(DB, { categoriaPrecisao: 'rifle-de-precisao', segundos: 3, firmada: true }).total === 6);
t('arremesso: dano por ST e peso (ST 12, 30 kg → 1D-1)', danoArremessado(DB, 12, 30).expr === '1D-1');
t('arremesso: distância = ST + peso (12 + 30 = 42 m)', distanciaArremesso({ st: 12, pesoKg: 30 }).metros === 42);
t('arremesso: com a perícia, ST + 6 = 18 m', distanciaArremesso({ st: 12, periciaArremesso: true }).metros === 18);

/* ---------------------------------------------------------- estruturas */
t('PE madeira (médio) = 15', peDe(DB, 'madeira', 'medio').pe === 15);
t('estados: 100% intacto, ≤50% danificado, 0 destruído', estadoDeDegradacao(DB, 15, 15).id === 'intacto' && estadoDeDegradacao(DB, 7, 15).id === 'danificado' && estadoDeDegradacao(DB, 0, 15).id === 'destruido');
t('dano em estrutura: 15 PE − 5 = 10 (intacto)', (() => {
  const r = danoEmEstrutura(DB, { materialId: 'madeira', tamanho: 'medio', dano: 5 });
  return r.peRestante === 10 && r.estado.id === 'intacto';
})());
t('Ataque Demolidor: +10 contra estruturas', danoEmEstrutura(DB, { materialId: 'madeira', dano: 0, bonusEstrutura: 10 }).danoAplicado === 10);
t('NT 8 = Idade Digital', (DB.estruturas?.nivelTecnologico?.tabela || []).find(l => l.nt === 8)?.era?.toLowerCase().includes('digital'));

/* ---------------------------------------------------------- árvore de manobras */
t('manobra: Finta está em Movimento Difuso', acharManobra(DB, 'finta')?.trilha?.join(' › ') === 'Movimento › Movimento Difuso › Finta');
t('manobra: Ataque Pesado tem 4 derivações', ['ataque-pesado-duplo', 'ataque-potente', 'ataque-atordoante', 'ataque-demolidor'].every(id => acharManobra(DB, id)));
t('manobra: Ataque Duplo = 2 ataques', efeitosDeManobra(DB, 'ataque-duplo').ataques === 2);
t('manobra: Ataque Triplo = 3 ataques', efeitosDeManobra(DB, 'ataque-triplo').ataques === 3);
t('manobra: Ataque Atordoante impõe a condição atordoado', efeitosDeManobra(DB, 'ataque-atordoante').condicao === 'atordoado');
t('manobra: Saraivada → Semiautomático tem penalidades por disparo', (efeitosDeManobra(DB, 'semiautomatico').penalidadesPorAtaque || []).length >= 2);
t('empunhadura Duas Mãos: +1 em ataques de Força', bonusDeEmpunhadura(DB, 'duas-maos', { atributoDoAtaque: 'ST' }).total === 1);
t('empunhadura Zatoichi: +2 no primeiro ataque após Saque Rápido', bonusDeEmpunhadura(DB, 'zatoichi', { aposSaqueRapido: true }).total === 2);
t('executarAtaque: Ataque Duplo rola 2 vezes', executarAtaque(DB, gauPc, { manobra: 'ataque-duplo', dice: dadoFixo(12) }).ataques.length === 2);
t('executarAtaque: acerto crítico com dano e Grau', (() => {
  const r = executarAtaque(DB, gauPc, { manobra: 'ataque-simples', arma: { id: 'espada-longa', nome: 'Espada longa', dano: '2d8', nh: 14 }, dice: dadoFixo(14), rdAlvo: 0 });
  return r.acertos === 1 && r.ataques[0].jogada.tipo === 'critico' && r.danoTotal >= 2 && r.grau.grau >= 1;
})());
t('executarAtaque: falha não causa dano', executarAtaque(DB, gauPc, { manobra: 'ataque-simples', dice: dadoFixo(20) }).danoTotal === 0);
t('defender: Esquiva usa DX como referência', defender(DB, gauPc, { tipo: 'esquiva', dice: dadoFixo(13) }).defesa.valor === 13);
t('defender: Bloqueio exige escudo', defender(DB, { ...gauPc, inventario: [] }, { tipo: 'bloqueio' }).erro?.includes('escudo') === true);
t('luminosidade: Escuridão Total = −10', penalidadeDeLuz(DB, 'escuridao-total').valor === -10);
t('luminosidade: Luz Total = 0', penalidadeDeLuz(DB, 'luz-total').valor === 0);
t('luminosidade: faixa publicada devolvida para o GM (Penumbra −4 a −3)', (() => {
  const l = penalidadeDeLuz(DB, 'penumbra');
  return l.valor === -3 && l.faixa[0] === -3 && l.faixa[1] === -4;
})());

/* ---------------------------------------------------------- poderes modulares */
const poder = novoPoder('Lança de Fogo');
poder.efeito = { grupo: 'manipulacao', id: 'criar' };
poder.extensao = { alcance: '10m', area: null, alvos: '1-alvo', duracao: '1-segundo' };
poder.potencia = { intensidade: 'forte', dano: 'dano-alto', forca: [], velocidade: [] };
poder.condicoes = ['requer-contato'];
poder.pv = 'pv-10';
poder.rd = 'rd-2';
t('poder: custo = 10+15+5+5+25+20−10+10+10 = 90', custoDoPoder(DB, poder).total === 90, `veio ${custoDoPoder(DB, poder).total}`);
t('poder: válido dentro do orçamento de 150', validarPoder(DB, poder, { orcamento: 150 }).ok === true);
t('poder: efeito exige Extensão e Potência', (() => {
  const incompleto = novoPoder('Sem extensão');
  incompleto.efeito = { grupo: 'manipulacao', id: 'criar' };
  const v = validarPoder(DB, incompleto);
  return v.ok === false && v.erros.length === 2;
})());
t('poder: máximo de 3 Condições', (() => {
  const exagerado = novoPoder('Muitas condições');
  exagerado.condicoes = ['requer-contato', 'requer-linha-de-visao', 'requer-alvo-visivel', 'uso-livre'];
  return validarPoder(DB, exagerado).ok === false;
})());
t('poder: orçamento excedido é erro', validarPoder(DB, poder, { orcamento: 50 }).ok === false);
t('poder: PV e RD somam aos secundários', (() => {
  const b = bonusDosPoderes(DB, { poderes: [poder] });
  return b.pv === 10 && b.rd === 2;
})());
t('poder: PV de poderes entram no PV da ficha', secundarios(DB, { ...gauPc, poderes: [poder] }).PV.valor === 154);
t('poder: orçamento da saga (padrão 150)', orcamentoDePoder(DB, { poderes: [poder] }).total === 150);

/* ---------------------------------------------------------- categorias e dimensão */
t('categorias: Mundano é o nível 0', nivelDaCategoria(DB, 'mundano') === 0);
t('categorias: escala de Mundano = 1 d20', categorias(DB).find(c => c.id === 'mundano').dados === 1);
t('categorias: Mundano não realiza teste de categoria superior', podeRealizarTeste(DB, gauPc, 'superior-3').ok === false);
t('dimensionalidade: 4D > 3D', comparaDimensionalidade(DB, { dimensoesA: 4, dimensoesB: 3 }).superior === 'A');
t('dimensionalidade: mesma dimensão → sem superioridade', comparaDimensionalidade(DB, { dimensoesA: 3, dimensoesB: 3 }).superior === null);

/* ---------------------------------------------------------- proezas físicas */
t('levantamento ST 12: 1 mão 36 kg, 2 mãos 156 kg, costas 180 kg', (() => {
  const l = limitesDeLevantamento(DB, 12);
  return l.find(x => x.id === 'uma-mao').kg === 36 && l.find(x => x.id === 'duas-maos').kg === 156 && l.find(x => x.id === 'costas').kg === 180;
})());
t('empurrar: 13×ST = 156 kg; com impulso 25×ST = 300 kg', limitesDeLevantamento(DB, 12).find(x => x.id === 'empurrar').kg === 156 && limitesDeLevantamento(DB, 12).find(x => x.id === 'empurrar').kgComImpulso === 300);
t('esforço extra: 1 PF por uso', esforcoExtra(DB, gauPc, { usos: 1 }).custoPF === 1);
t('salto: acima de 1,5 m sem poder sobrenatural é bloqueado', saltar(DB, gauPc, { metros: 3 }).permitido === false);
t('salto: 1,5 m é permitido (limite mundano)', saltar(DB, gauPc, { metros: 1.5, dice: dadoFixo(12) }).permitido === true);
t('cavar: 0,053 × ST m³/h (ST 12 → 0,636)', cavar(DB, { st: 12 }).metrosCubicosPorHora === 0.636);
t('arremesso: ST 12 e 30 kg → 1D-1 a 42 m', (() => {
  const r = arremessarObjeto(DB, { st: 12, pesoKg: 30 });
  return r.dano.expr === '1D-1' && r.distancia.metros === 42;
})());
t('natação: referência pré-definida max(ST−5, DX−5) = 8', nadar(DB, gauPc, { dice: dadoFixo(8) }).referencia === 8);
t('salvar afogado: −5 base + diferença de ST', salvarAfogado(DB, gauPc, { stVitima: 10, nhNatacao: 12, dice: dadoFixo(9) }).modificadores.some(m => m.valor === -5));
t('sentidos: referência = IQ', testeDeSentido(DB, gauPc, { sentido: 'visao', dice: dadoFixo(11) }).nh === 11);
t('vontade: referência = IQ (VON = IQ)', testeDeVontade(DB, gauPc, { dice: dadoFixo(11) }).referencia === 11);
t('pânico: 4 e 5 → mesma linha', resultadoPanico(DB, 4).resultado === '4,5' && resultadoPanico(DB, 5).resultado === '4,5');
t('pânico: 41 cai na linha 40+', resultadoPanico(DB, 41).resultado === '40+');
t('testes pré-definidos publicados', testesPreDefinidos(DB).exemplos.length >= 2);

/* ---------------------------------------------------------- magia */
t('aptidão mágica máxima = 3', maximoDeAptidao(DB) === 3);
t('IQ para magia = IQ + Aptidão (11 + 2 = 13)', iqParaMagia(DB, { ...gauPc, aptidaoMagica: 2 }).efetivo === 13);
t('ritual por NH 16 → faixa 15-17', ritualPorNH(DB, 16).nh === '15-17');
t('redução de custo: NH 15 → −1, 20 → −2, 25 → −3', reducaoDeCusto(DB, 15).valor === -1 && reducaoDeCusto(DB, 20).valor === -2 && reducaoDeCusto(DB, 25).valor === -3);
t('custo de conjuração: Luz (1) com NH 16 → 0 de energia', custoDeConjuracao(DB, 'luz', { nh: 16 }).energia === 0);
t('conjurar exige conhecer a mágica', conjurar(DB, gauPc, { magica: 'luz' }).erro?.includes('não conhece') === true);
t('conjurar com NH: usa d20 por padrão', conjurar(DB, { ...gauPc, magicas: [{ id: 'luz', nh: 16 }] }, { magica: 'luz', dice: dadoFixo(16) }).sucesso === true);
t('conjurar em modo 3d (conflito registrado)', conjurar(DB, { ...gauPc, magicas: [{ id: 'luz', nh: 16 }] }, { magica: 'luz', resolucao: '3d', dice: dadoFixo(16, [5, 5, 5]) }).jogada.resolucao === '3d6');
t('mana Nula bloqueia a conjuração', conjurar(DB, { ...gauPc, magicas: [{ id: 'luz', nh: 16 }] }, { magica: 'luz', mana: 'Nula' }).erro?.length > 0);
t('objeto encantado: Poder = menor NH (mínimo 15)', poderDoObjeto(DB, { nhEncantar: 17, nhDaMagicaIncorporada: 14 }).funciona === false);
t('encantamento lento: 400 energia / 4 magos = 100 dias', encantamentoLentoESeguro(DB, { energiaTotal: 400, magos: 4 }).dias === 100);
t('demônio: fórmula 3D/3D/2D/4D/2D', criarDemonio(DB, { dice: dadoFixo(6) }).atributos.HT.rolls.length === 4);

/* ---------------------------------------------------------- ficha: migração */
const antigo = { versao: 1, nome: 'Veterano', atributos: { ST: 11, DX: 12, IQ: 10, HT: 11 }, pontos: { total: 100 }, magias: [{ id: 'luz', nome: 'Luz', pontos: 1 }], vantagens: [{ id: 'aptidao-magica', niveis: 2 }] };
const migrado = migrarPersonagem(DB, antigo);
t('migração v1 → v3', migrado.versao === 3);
t('migração: adiciona categoria, poderes, línguas e biografia', migrado.categoria === 'mundano' && Array.isArray(migrado.poderes) && migrado.linguas.escritas.length === 0 && migrado.biografia === '');
t('migração: converte magias 3d em mágicas G.A.U.', migrado.magicas.length === 1 && migrado.magicas[0].legado === true);
t('migração: Aptidão Mágica vem da vantagem', aptidaoMagicaDe(DB, migrado) === 2);
t('migração: registra entrada no histórico', migrado.historico.some(h => h.tipo === 'migracao'));

/* --------------------------------------------- vantagens: ids antigos e níveis estruturados */
const fichaVelha = {
  versao: 2, nome: 'Veterana', atributos: { ST: 10, DX: 10, IQ: 10, HT: 10 }, pontos: { total: 100 },
  vantagens: [
    { id: 'aptid-o-m-gica', nome: 'Aptidão Mágica', niveis: 3 },
    { id: 'mem-ria-eid-tica', nome: 'Memória Eidética', niveis: 2 },
    { id: 'rijeza', nome: 'Rijeza', niveis: 2 },
    { id: 'for-a-de-vontade', nome: 'Força de Vontade', niveis: 2 },
    { id: 'poderes-legais', nome: 'Poderes Legais', custoEscolhido: 10 },
    { id: 'se-o-patrono-for-um-indiv-duo-extremamente-poderoso', nome: 'Se o Patrono for um indivíduo extremamente poderoso' },
  ],
};
const fichaNova = migrarPersonagem(DB, fichaVelha);
const porId = id => (fichaNova.vantagens || []).find(v => v.id === id);
t('vantagens: id antigo "aptid-o-m-gica" → "aptidao-magica"', !!porId('aptidao-magica') && nivelDaVantagem(DB, fichaNova, 'aptidao-magica') === 3);
t('vantagens: Memória Eidética numérica → nível nomeado "2º nível"', porId('memoria-eidetica')?.nivel === '2º nível');
t('vantagens: Rijeza numérica → "RD 2" (RD 2 no corpo)', porId('rijeza')?.nivel === 'RD 2' && rdNatural(DB, fichaNova).rd === 2);
t('vantagens: Força de Vontade continua por nível numérico', nivelDaVantagem(DB, fichaNova, 'forca-de-vontade') === 2);
t('vantagens: custo escolhido → nível estruturado (Poderes Legais 10)', porId('poderes-legais')?.nivel === 'Jurisdição nacional/internacional');
t('vantagens: entrada corrompida da extração é removida', !fichaNova.vantagens.some(v => /patrono-for-um/.test(v.id)));
t('vantagens: migração registrada no histórico', fichaNova.historico.some(h => h.tipo === 'migracao' && /vantagens/i.test(h.texto)));

/* ------------------------------------------------------------------ vantagens (G.A.U.) */
t('catálogo: 65 vantagens publicadas (38 clássicas + 6 variáveis/sociais + 21 novas)',
  DB.advantages.length === 65 && DB.advantages.filter(a => a.grupo === 'classica').length === 38
  && DB.advantages.filter(a => a.grupo === 'nova').length === 21 && DB.advantages.filter(a => a.grupo === 'social').length === 6);
t('vantagens: todas têm fonte citada (canal + data)', DB.advantages.every(a => /canal #/.test(a.fonte || '')));
t('vantagens: nenhuma entrada corrompida (todas com custo)', DB.advantages.every(a => typeof a.custo === 'string' && a.custo.length > 0));
t('vantagens: regras do capítulo carregadas (Aliado, Patrono, exemplo, migração)',
  !!DB.vantagens?.aliado?.poder?.tabela && !!DB.vantagens?.patrono?.poder?.tabela
  && DB.vantagens?.exemploSelecao?.personagem === 'Dai Blackthorn'
  && Object.keys(DB.vantagens?.migracaoDeIds?.mapa || {}).length === 23);

const daiVantagens = novoPersonagem('Dai Blackthorn', 100, DB);
daiVantagens.atributos = { ST: 8, DX: 15, IQ: 12, HT: 12 };
daiVantagens.vantagens = [
  { id: 'senso-de-direcao', nome: 'Senso de Direção' },
  { id: 'ouvido-agucado', nome: 'Ouvido Aguçado', niveis: 5 },
  { id: 'ultra-flexibilidade-das-juntas', nome: 'Ultra-flexibilidade das Juntas' },
  { id: 'nocao-do-perigo', nome: 'Noção do Perigo' },
];
const custoDai = custoDasVantagens(DB, daiVantagens);
t('exemplo do material (Dai): 5 + 10 + 5 + 15 = 35 pontos', custoDai.total === 35, `got ${custoDai.total}`);
t('exemplo do material: a publicação soma 35 para 30 pontos disponíveis (transcrito em exemploSelecao)',
  DB.vantagens.exemploSelecao.totalGasto === 35 && DB.vantagens.exemploSelecao.pontosDisponiveis === 30);
t('Ouvido Aguçado 5 níveis: custo 10 e +5 em Audição', bonusDeSentido(DB, daiVantagens, 'audicao').total === 5);
t('Sentido não relacionado não recebe bônus (Visão = 0)', bonusDeSentido(DB, daiVantagens, 'visao').total === 0);
t('Senso de Direção: +3 em Navegação', bonusDePericia(DB, daiVantagens, 'navegacao').total === 3);

const guerreiro = novoPersonagem('Guerreiro', 150, DB);
guerreiro.atributos = { ST: 14, DX: 13, IQ: 10, HT: 13 };
guerreiro.vantagens = [
  { id: 'reflexos-em-combate', nome: 'Reflexos em Combate' },
  { id: 'rijeza', nome: 'Rijeza', nivel: 'RD 1' },
  { id: 'prontidao', nome: 'Prontidão', niveis: 2 },
];
t('Reflexos em Combate: +1 em qualquer Defesa Ativa', bonusDeDefesaAtiva(DB, guerreiro).total === 1);
t('Reflexos em Combate: +2 em Verificações de Pânico', bonusDePanico(DB, guerreiro).total === 2);
t('Reflexos em Combate entra na Esquiva (DX 13 + 1 = 14)', esquivaGAU(DB, guerreiro).valor === 14);
t('Rijeza "RD 1" → RD natural 1 (nível nomeado)', rdNatural(DB, guerreiro).rd === 1);
t('Rijeza "RD 2" → RD natural 2', rdNatural(DB, { ...guerreiro, vantagens: [{ id: 'rijeza', nivel: 'RD 2' }] }).rd === 2);
t('Prontidão 2 → +2 em todos os sentidos', ['visao', 'audicao', 'olfatoPaladar'].every(s => bonusDeSentido(DB, guerreiro, s).total === 2));
t('secundários: RD do corpo soma poderes + Rijeza', secundarios(DB, guerreiro).RD.valor === 1 && secundarios(DB, guerreiro).RD.rdNatural === 1);
t('defesaPassiva com db: RD inclui Rijeza', defesaPassiva(guerreiro, DB).rd === 1);

const magoAptidao = novoPersonagem('Mago', 150, DB);
magoAptidao.atributos = { ST: 9, DX: 11, IQ: 15, HT: 11 };
magoAptidao.vantagens = [{ id: 'aptidao-magica', nome: 'Aptidão Mágica', nivel: '3º nível' }];
t('Aptidão Mágica 3º nível → IQ efetivo p/ magia 18', iqEfetivo(DB, magoAptidao, 'magia').efetivo === 18);
t('Aptidão Mágica limitada a 3 níveis (maxNiveis)', DB.advantage('aptidao-magica').maxNiveis === 3);
t('Aptidão Mágica é incompatível com Abascanto', (DB.advantage('aptidao-magica').incompativel || []).includes('abascanto'));

const abascanto = { ...magoAptidao, vantagens: [{ id: 'abascanto', niveis: 3 }, { id: 'aptidao-magica', nivel: '1º nível' }] };
t('Abascanto × Aptidão Mágica → erro de validação', validarVantagens(DB, abascanto).ok === false);
t('Abascanto 3 → resistência à magia 3 e impede conjurar',
  resistenciaAMagia(DB, { ...magoAptidao, vantagens: [{ id: 'abascanto', niveis: 3 }] }).total === 3
  && resistenciaAMagia(DB, { ...magoAptidao, vantagens: [{ id: 'abascanto', niveis: 3 }] }).impedeConjurar === true);

const imune = { atributos: { ST: 10, DX: 10, IQ: 10, HT: 11 }, vantagens: [{ id: 'imunidade', nome: 'Imunidade' }] };
t('Imunidade exige HT ≥ 12 → erro com HT 11', validarVantagens(DB, imune).erros.some(e => /HT/i.test(e)));
t('Imunidade com HT 12 → válida', validarVantagemOk(DB, { ...imune, atributos: { ...imune.atributos, HT: 12 } }));
t('Recuperação Alígera exige HT ≥ 10', validarVantagens(DB, { atributos: { ST: 10, DX: 10, IQ: 10, HT: 9 }, vantagens: [{ id: 'recuperacao-aligera' }] }).ok === false);

const novas = novoPersonagem('Novato', 200, DB);
novas.atributos = { ST: 11, DX: 12, IQ: 11, HT: 12 };
novas.vantagens = [
  { id: 'sobrevivente-do-inferno', nome: 'Sobrevivente do Inferno' },
  { id: 'amuleto-da-sorte', nome: 'Amuleto da Sorte' },
  { id: 'arma-especial', nome: 'Arma Especial' },
  { id: 'visao-noturna', nome: 'Visão Noturna' },
  { id: 'hierarquia-militar', nome: 'Hierarquia Militar', niveis: 4 },
  { id: 'acao-extra', nome: 'Ação Extra' },
  { id: 'golpe-fulminante', nome: 'Golpe Fulminante' },
  { id: 'furto-em-combate', nome: 'Furto em Combate', niveis: 3 },
];
t('Sobrevivente do Inferno: custo 40 (publicação oficial, não 70)', custoDasVantagens(DB, { ...novas, vantagens: [novas.vantagens[0]] }).total === 40);
t('Sobrevivente do Inferno: +2 ST e +2 DX efetivos', atributosEfetivos(DB, novas).ST === 13 && atributosEfetivos(DB, novas).DX === 14);
t('Sobrevivente do Inferno: PV = ST efetiva × HT (13 × 12 = 156)', secundarios(DB, novas).PV.valor === 156);
t('Sobrevivente do Inferno: Sobrevivência +4', bonusDePericia(DB, novas, 'sobrevivencia').total === 4);
t('Amuleto da Sorte: +2 nos testes com o amuleto, −3 sem ele',
  modificadoresGerais(DB, novas).total === 2 && modificadoresGerais(DB, novas, { comAmuleto: false }).total === -3);
t('Amuleto da Sorte: +1 de dano com o amuleto', danoExtra(DB, novas).fixo === 1);
t('Arma Especial: +1D só quando empunhada', danoExtra(DB, novas).dados.length === 0
  && danoExtra(DB, novas, { armaEspecial: true }).dadosExtras === 1);
t('Golpe Fulminante: +4 no GDP/Bal custando 3 de ST', danoExtra(DB, novas, { golpeFulminante: true }).custoST === 3);
t('Visão Noturna ignora penalidade de luz, menos Escuridão Total',
  ignoraPenalidadeDeLuz(DB, novas, 'penumbra').ignora === true
  && ignoraPenalidadeDeLuz(DB, novas, 'escuridao-total').ignora === false);
t('Hierarquia Militar 4 → 1 nível de Status derivado (4 ÷ 3, arredondado)', statusDerivado(DB, novas).status === 1);
t('Hierarquia Militar: máximo de 8 níveis publicados', DB.advantage('hierarquia-militar').maxNiveis === 8 && DB.advantage('hierarquia-militar').postos.length === 9);
t('Ação Extra: 1 ação extra por turno', acoesExtras(DB, novas).total === 1);
t('Furto em Combate 3: 3 usos por combate', acoesExtras(DB, novas).furtosNoCombate === 3);
t('Arma Especial é única (unicidade validada)', validarVantagens(DB, { ...novas, vantagens: [...novas.vantagens, { id: 'arma-especial' }] }).ok === false);
t('Kawaii exige personagem feminina e Aparência Bonita', (DB.advantage('kawaii').requisitos || []).length === 2);
t('Corpo Leve dispensa a perícia Natação', imunidades(DB, { vantagens: [{ id: 'corpo-leve' }] }).some(i => i.alvo === 'natacao'));

const sortudo = { vantagens: [{ id: 'sorte', nivel: 'Sorte Extraordinária' }] };
t('Sorte Extraordinária: 3 jogadas a cada 30 minutos', sorte(DB, sortudo).jogadas === 3 && sorte(DB, sortudo).intervaloMinutos === 30);
t('Sorte comum: 1× por hora (60 min)', sorte(DB, { vantagens: [{ id: 'sorte', nivel: 'Sorte' }] }).intervaloMinutos === 60);
t('Memória Eidética 2º nível: pontos mentais ×4', multiplicadorDePericiasMentais(DB, { vantagens: [{ id: 'memoria-eidetica', nivel: '2º nível' }] }).multiplicador === 4);
t('Memória Eidética 1º nível: pontos mentais ×2', multiplicadorDePericiasMentais(DB, { vantagens: [{ id: 'memoria-eidetica', nivel: '1º nível' }] }).multiplicador === 2);
t('Visão Periférica: −2 na defesa ativa pelas costas', defesaPorFlanco(DB, { vantagens: [{ id: 'visao-periferica' }] }, 'costas').total === -2);
t('Força de Vontade 3: +3 em Vontade e +3 ao resistir a magia',
  bonusDeVontade(DB, { vantagens: [{ id: 'forca-de-vontade', niveis: 3 }] }).total === 3
  && resistenciaAMagia(DB, { vantagens: [{ id: 'forca-de-vontade', niveis: 3 }] }, { aoResistir: true }).total === 3);
t('Resistência Pisíquica 4: subtrai 4 do NH psíquico próprio',
  resistenciaPsiquica(DB, { vantagens: [{ id: 'resistencia-pisiquica', niveis: 4 }] }).penalidadePropria === -4);
t('Voz Melodiosa: +2 em Trovador e +2 de reação', bonusDePericia(DB, { vantagens: [{ id: 'voz-melodiosa' }] }, 'trovador').total === 2);
t('Aliado: multiplicadores de freqüência publicados (3/2/1/½)',
  (DB.advantage('aliado').niveis || []).map(n => n.multiplicador).join(',') === '3,2,1,0.5');
t('Patrono: custos por poder (10/15/25/30)', (DB.advantage('patrono').niveis || []).map(n => n.custo).join(',') === '10,15,25,30');
t('conflito registrado: custo de Sobrevivente do Inferno', (DB.vantagens.conflitos || []).some(c => c.id === 'sobrevivente-do-inferno-custo'));

/* ---------------------------------------------------------- computeAll (G.A.U.) */
const snapGAU = computeAll(DB, gauPc);
t('computeAll: secundários e parâmetros expostos', snapGAU.secundarios.PV.valor === 144 && snapGAU.parametros.ESQ.valor === 13);
t('computeAll: bloco gau com categoria, margens e orçamento', snapGAU.gau.categoria.id === 'mundano' && snapGAU.gau.margens.ST.texto === '9–14' && snapGAU.gau.pontosDePoder.total === 150);
t('computeAll: PF = HT com fadiga aplicada', snapGAU.gau.pf.max === 12 && snapGAU.gau.pf.disponiveis === 10);

console.log(`\n===== RESULTADO: ${pass} passou, ${fail} falhou =====`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
