# Mapa de Regras — Engenharia Reversa do Material

**Fonte da verdade:** `docs/fonte-gua-material.pdf` (370 páginas, texto corrido, exportado de canal do Discord).
**Identificação do sistema:** o material é uma tradução/adaptação PT-BR do **GURPS® 3ª Edição (Basic Set)** — atributos ST/DX/IQ/HT, 3 dados (3d), pontos de personagem, sistema de hexágonos, manobras de combate, magia com custo em fadiga/mana. O nome de trabalho do projeto é **GUA**.
**NOTA:** "GURPS" é marca da Steve Jackson Games; este projeto é uma ferramenta pessoal baseada no material fornecido pelo usuário. Nenhuma regra foi inventada além do material.

Cada regra abaixo cita a página de origem no PDF. Referências de página usam o marcador `PÁGINA N` da extração.

---

## 1. Atributos Básicos (p. 1–5)

| Atributo | Nome PT | Mede |
|---|---|---|
| ST | Força | força muscular |
| DX | Destreza | agilidade e coordenação |
| IQ | Inteligência | capacidade mental, vivacidade, experiência geral |
| HT | Vitalidade | energia, saúde e **pontos de vida** (PV = HT; ao perder PV igual a HT, desmaia) |

- Valores 1–20 para humanos; 10 = média (custo 0); não há limite superior.
- **Tabela de custos** (p. 1–2): 10→0; 11→10; 12→20; 13→30; 14→45; 15→60; 16→80; 17→100; 18→125; 19→150; 20→175. Abaixo de 10: 9→−10; 8→−15; 7→−20; 6→−30; 5→−40; 4→−50; 3→−60; 2→−70; 1→−80.
- **Mão inábil:** −4 em ações importantes com a mão ruim; escudo na mão inábil não sofre penalidade (p. 3).
- **Crianças** (p. 5): tabela de atributos médios por idade; custo baseado na diferença vs. média da idade; máximo de pontos em perícias = 2× idade; ST/DX/HT +1 "grátis" ao completar 10 anos (IQ não muda).

## 2. Atributos Derivados

- **Velocidade Básica** = (DX + HT) / 4 — **não arredondar** (p. 3).
- **Deslocamento (Movimento)** = Velocidade Básica − penalidade de Carga, **arredondado para baixo**; se Carga 0, = Velocidade arredondada p/ baixo (p. 197).
  - Perícia **Corrida**: soma 1/8 do NH (arredondado p/ baixo) à Velocidade **apenas para este cálculo** (p. 197).
  - Nunca reduzido a zero (exceto inconsciente/pernas inúteis/peso > 15×ST) (p. 197).
- **Esquiva** = Deslocamento atual (p. 197, 228).
- **Dano Básico** por ST (p. 190): tabela GDP (golpe de ponta) e Balanço, ST 4→20 (+progressão óbvia).
- **Carga** ver §10.
- **Aparar** = ½ NH da arma (2/3 para Bastão e Esgrima c/ equipamento adequado), arredondado p/ baixo (p. 229).
- **Bloqueio** = ½ NH de Escudo/Broquel, arredondado p/ baixo (p. 228).

## 3. Aparência Física (p. 6–8)

Níveis: Hediondo (−4 reação, −20 pts) · Feio (−2, −10) · Desagradável (−1 própria raça, −5) · Comum (0) · Elegante/Bonito (+2 mesmo sexo/+4 oposto, 15) · Muito Elegante (+2/+6, 25; exceção −2 p/ mesmo sexo com antipatia prévia).
Altura média por ST; peso por altura; tabela de modificação 3d (−15 cm…+15 cm/+22,7 kg) — tabela original com corrupção de OCR na coluna ST (p. 7); mulher: −5 cm/−4,5 kg; séc. XIX: −7,5 cm.

## 4. Personagens Aleatórios (p. 9–16)

- 3d para cada atributo (pode repetir 1 resultado e manter o novo).
- Tabelas 3d de pele/cabelos/olhos (p. 9–10).

## 5. Riqueza e Status (p. 12–17)

**Riqueza** (nível inicial / trabalho semanal): Falido (−25, sem recursos) · Pobre (1/5 média, 50h, −15) · Batalhador (½ média, 40h, −10) · Médio (média, 40h, 0) · Confortável (2×, 40h, 10) · Rico (5×, 20h, 20) · Muito Rico (20×, 10h, 30) · Podre de Rico (100×, 10h, 50). 1 mês de salário ≈ 1 ponto.
**Reputação**: custo = 5 pts/nível de modificador de reação (máx ±4); × classe afetada (todos=valor cheio; grupo grande=½; grupo pequeno=⅓) × frequência (sempre=1; às vezes (≤10)=½; ocasional (≤7)=⅓); arredondamentos p/ baixo (p. 14–15).
**Status**: −4 a 8; 5 pts por nível (negativo devolve pontos). Bônus/penalidade de reação = diferença de Status relativa (mín −4). Riqueza ≥ Rico: −5 pts no custo de Status elevado. Trato Social = IQ+2 na própria cultura (p. 15–17).

## 6. Vantagens (p. 17–40)

~60 vantagens "clássicas" + 25 "novas". Formato: nome (custo) + efeito. Custos fixos, por nível (2–5 pts/nível) ou variáveis (Aliado, Patrono, Contato com tabelas próprias p. 30–36). Efeitos numéricos relevantes p/ engine:
- **Reflexos em Combate** (15): +1 defesas ativas, +1 Sacar Rápido, +2 pânico, +6 despertar.
- **Ambidestria** (10): sem −4 mão inábil.
- **Rijeza** (10/25): RD 1/2.
- **Força de Vontade** (4/nível): +1 nível/nível em testes de Vontade (base IQ).
- **Abascanto** (2/nível): +2/nível p/ resistir magias hostis? — **ver descrição no data file** (material define: cada nível dá +2 p/ resistir).
- **Voz Melodiosa** (10): +2 em Trovador, Diplomacia, Atuação, Política, Trato Social, Sex-Appeal, Canto.
- **Aptidão Mágica** (15 1º nível; 10/nível seguinte): soma ao IQ p/ magia; máx 3.
- **Memória Eidética** (30/60): pontos em perícias mentais contam em dobro (1º nível).
- Lista completa em `data/advantages.json`.

## 7. Desvantagens (p. 40–88)

~90 desvantagens físicas/mentais/sociais, formato nome (custo negativo). Efeitos numéricos relevantes:
- Limites físicos (Cegueira −50, Surdez −20, Maneta, Deficiente Físico…), sentidos (Disopia −10: −6 Visão >3 m…), sociais (Estigma, Primitivismo −5/NT…).
- **Vontade Fraca** (−8/nível): −1/nível em Vontade.
- Máx. de pontos por desvantagens: definido pela campanha (não fixado no material — **REGRA NÃO DEFINIDA**).
- Lista completa em `data/disadvantages.json`.

## 8. Peculiaridades (p. 88–99)

Máximo **5**, cada uma vale **−1 ponto**; não contam no limite de desvantagens da campanha. ~80 exemplos listados (p. 89–99). Lista em `data/quirks.json`.

## 9. Perícias (p. 100–180)

- Teste: 3d ≤ NH (modificado). 17/18 = falha automática. Não pode tentar se NH efetivo ≤ 3 (exceto defesa) (p. 200–202).
- **Custos** (p. 104–105):
  - Físicas (DX; Fácil/Média/Difícil): DX−3=–/–/½; DX−2=–/½/1; DX−1=½/1/2; DX=1/2/4; DX+1=2/4/8; DX+2=4/8/16; DX+3=8/16/24; DX+4=16/24/32; DX+5=24/32/40. Acima: **+8 pts/nível**.
  - Mentais (IQ; Fácil/Média/Difícil/Muito Difícil): IQ−4=–/–/–/½; IQ−3=–/–/½/1; IQ−2=–/½/1/2; IQ−1=½/1/2/4; IQ=1/2/4/8; IQ+1=2/4/6/12; IQ+2=4/6/8/16; IQ+3=6/8/10/20; IQ+4=8/10/12/24; IQ+5=10/12/14/28. Acima: **+2 pts/nível** (Muito Difícil: **+4**).
- **Nível pré-definido (default)**: Fácil = atributo−4; Média = −5; Difícil = −6; Muito Difícil = sem default (exceções na lista). Atributo contado como máx. 20 p/ defaults. Default entre perícias (ex.: E. Lámina Larga = E. Curtas−2); sem cascata (perícia conhecida só por default não gera default) (p. 106–109).
- Melhorar default: pagar diferença de custos entre níveis (exemplo p. 108).
- **Especialização obrigatória** (Condução, Pilotagem, Engenharia, Sobrevivência…): cada especialidade = perícia independente; cross-default −4 entre especialidades de Condução. **Opcional** (ciências): especialista +5 na área / −1 fora (−2 com 2 especialidades; máx 2).
- **Familiaridade**: ferramenta/marca desconhecida = −2; 8h de prática familiariza; 1 familiaridade extra por NH acima de 14.
- **Pré-requisitos**: NH ≥ 12 na perícia-pré (default não conta). Máx. pontos em perícias na criação = 2× idade.
- **/NT**: perícia varia por nível tecnológico.
- Lista completa (≈168 perícias + variantes) em `data/skills.json` com tipo, dificuldade, default, pré-reqs, categoria.

## 10. Equipamento e Carga (p. 181–200)

- Moeda genérica **$**; recursos iniciais dependem de Riqueza e cenário.
- **Armaduras** (p. 186): DP (defesa passiva 0–6) e RD (resistência a dano). Tabela completa de 18 tipos (roupas → armadura de combate reforçada) com NT/DP/RD/custo/peso e notas (¹²³⁴: vs perfuração, elmo −1 perícia/−3 visão+audição, protege só tronco, Reflec só laser).
  - Sobreposição: cota de malha sem laudel = DP 3/RD 1 vs perfurante; camada interna sob placas/loriga/campanha: +1 RD; malha sob placas: +2 RD (p. 185).
  - Elmo: −3 Visão/Audição, −1 NH armas. Luvas/manoplas: −8 DX p/ trabalho fino (p. 184).
- **Escudos** (p. 195): Broquel DP1 $25 1kg · Pequeno DP2 $40 4kg · Médio DP3 $60 7kg · Grande DP4 $90 12kg · Força (NT11+) DP4 $1500 0,2kg. Dano suportável (regra opcional): 5/20, 5/30, 7/40, 9/60. Escudo grande: −2 NH arma e −1 Aparar; em combate de perto (após 1º turno): subtrair DP do escudo de defesas e DX. Sem armas de 2 mãos com escudo (p. 194–195).
- **Qualidade de armas** (p. 192): barata 40% preço (quebra 2/3); boa (tabela) 1/3; superior ×4 (+1 dano; 1/6); altíssima ×20 (+2 dano; nunca quebra). Corte/perfurante não-espada superior: ×10 (+1 dano). Contusão superior: ×3. Arcos/bestas superiores: ×4 (+20% alcance). Armas de fogo baratas: ~60% (−1 a −10 Prec).
- **ST mínima** de arma: −1 NH por ponto de ST faltante + 1 fadiga extra ao fim da luta (p. 194).
- **Dano**: tipos contusão/corte/perfuração; perfurante ×2 após RD; corte +50% (arred. p/ baixo) após RD; cortante/perfurante mínimo 1 pt de dano básico (contusão pode dar 0). Balas: multiplicadores por tipo (Dum-Dum = perfurante; perfurante de arma de fogo: dano básico alto, ÷2 após passar RD) (p. 188–191).
- **DM (Dano Máximo)** de arma limita o dano total (p. 193).
- **Erguer/puxar/carregar**: 1 mão 3×ST; 2 mãos 13×ST; costas 15×ST; empurrar 13×ST (25×ST com impulso); esforço extra: teste ST −1 por +10% peso (p. 210, 6850).
- **CARGA** (p. 195–197): peso carregado vs ST:
  - ≤ ST: Nenhuma (0), sem penalidade
  - ≤ 2×ST: Leve (1), Mov −1
  - ≤ 3×ST: Média (2), Mov −2
  - ≤ 6×ST: Pesada (3), Mov −3
  - ≤ 10×ST: Muito Pesada (4), Mov −4; acima de 10×ST: só 1–2 m por vez; 15×ST = máximo
- Natação/escalada: penalidade = −2 × nível de Carga (p. 213–214).

## 11. Testes de Habilidade (p. 198–205)

- 3d ≤ NH efetivo (NH + modificadores cumulativos).
- **Sucesso automático** possível p/ tarefas triviais (decisão do GM).
- **Sucesso decisivo**: 3–4 sempre; 5 se NH≥15; 6 se NH≥16 (p. 200–201).
- **Falha crítica**: 18 sempre; 17 se NH efetivo < 16 (senão falha comum); qualquer resultado ≥ NH+10 (p. 201).
- **Disputas**: Rápida (1 turno; maior margem vence) e Normal (repete até alguém falhar e outro não); se ambos > 14: reduzir ambos pela diferença (máx → 14) (p. 204–205).
- **Testes de Reação**: 3d na tabela de reação (valores de modificadores por Status, Aparência, Reputação, Carisma etc.).
- Testes dos Sentidos: contra IQ (Visão/Audição/Olfato-Paladar) (p. 215).

## 12. Combate — Sistema Básico (p. 220–233)

- Turno = 1 segundo. Sequência: modo simples (1d, sentido horário) ou realista (maior Deslocamento primeiro; empate → maior Velocidade Básica) (p. 220–221).
- **Manobras básicas**: Deslocamento, Mudança de Posição, Preparar, Recarregar, Apontar, Ataque, Ataque Total (a: 2 ataques; b: finta+ataque; c: +4 NH; d: +2 dano; **nenhuma defesa ativa**), Finta, Aguardar, Defesa Total (2 jogadas de defesa/ataque; 2 bloqueios e 2 aparos), Concentrar, Ação Demorada, Ações Independentes (falar, largar, manter mágica) (p. 221–224).
- **Resolução**: Jogada de Ataque (3d ≤ NH) → Jogada de Defesa do alvo (3d ≤ total defesa) → Avaliação de Dano (p. 225–227).
- **Defesa total do defensor** = PD passiva (armadura + escudo + magia) + 1 defesa ativa escolhida.
- **Esquiva** = Movimento (ilimitada/rodada). **Bloqueio** = ½ Escudo (1×/rodada; 2× em Defesa Total; balas/feixes não bloqueáveis). **Aparar** = ½ NH arma (1×/rodada; 2× c/ 2 armas ou Def. Total; bastões ⅔; Esgrima ⅔ e 2×/rodada c/ equip. leve) (p. 227–231).
  - Aparar armas arremessadas −1; facas arremessadas −2; facas na mão −1; mangual −4; improviso −4.
  - Defesa 3–4 = sucesso sempre; 17/18 = falha sempre.
  - Atordoado: −4 defesas ativas. Reflexos em Combate: +1.
  - **Recuar**: +3 para defesa ativa contra ataque de perto, 1×/rodada (p. 240–241).
- **Ferimentos (básico)**: PV perdidos do tronco (HT); choque = −(PV perdidos) em IQ/DX/perícias no próximo turno; HT ≤ 3 → Mov e Esquiva ½; HT ≤ 0 → teste HT/turno p/ não desmaiar (com Vontade/Vontade Fraca); HT = −HT → teste HT ou morte (repetir a cada 5 PV; 6+ PV de um golpe = 2 testes); −5×HT = morte automática; −10×HT = corpo destruído (p. 230–232, 277–279).
- **Combate desarmado**: Soco = DX (Briga/Caratê melhoram), dano GDP−2 contusão (soqueiras +2); Chute = DX−2 (Briga−2/Caratê), GDP+1 c/ botas; falhar chute → teste p/ não cair; mordida 1d−4; aparar mãos limpas = ½DX (⅔ c/ Briga/Judô/Caratê); aparar arma desarmado −3 (Judô/Caratê sem penalidade) (p. 231–233).

## 13. Combate — Sistema Avançado (p. 233–275)

- Mesmas manobras + componente de movimento; hexágonos de 1 m; posições (pé/agachado/ajoelhado/sentado/deitado) afetam ataque/defesa/movimento (tabela de posições — **no caderno ausente**); 2 turnos p/ levantar de deitado.
- **Apontar**: 1 turno → +Prec da arma (bônus ≤ NH); +3 turnos → +1/turno (máx +3); apoio p/ arma de projétil +1; Tiro Rápido sem apontar: −4 exceto se NH ≥ TR da arma (p. 234–236, 255).
- **Ataque Total**: mover até 2 m (ou ½ Mov) e atacar; sem defesa ativa (p. 237).
- **Finta**: Disputa Rápida de NH; margem vira penalidade na defesa do alvo no próximo ataque seu; não vale contra quem não te vê; válida 1 rodada (2 golpes se Ataque Total duplo) (p. 237–238).
- **Defesa Total**: mover 1 m; 2 defesas/ataque; máx 2 bloqueios + 2 aparos/rodada (p. 239).
- **Ação Demorada**: tabela de tempos (apanhar objeto 1–2 s; trocar roupa 1 min; vestir armadura 10 min…) (p. 239–240).
- **Ponto de Impacto** (p. 241–246): redutores Tronco 0; Braço/Perna −2; Mão/Pé −4; Cabeça −5; Cérebro −7; Órgãos vitais: só perfurante (multiplicador ×3 p/ bala/perfurante); arma alvo: −3/−4/−5 conforme tamanho.
  - Trespassar: dano > HT/3 em mão/pé e > HT/2 em braço/perna é perdido; > HT no tronco (perfurante/bala) perdido; > 3×HT cabeça/vitais perdido; ×2 p/ feixes/bolas de fogo/elétrico; sem máximo p/ cérebro e armas 15D+.
  - **Lesões incapacitantes**: mão/pé ≥ HT/3; braço/perna ≥ HT/2 → membro inutilizado.
  - Tabela de local aleatório 3d — **no caderno ausente**.
- **Golpe fulminante** (ataque crítico): 3–4 sempre; 5 se NH≥15; 6 se NH≥16; alvo não tem defesa; consultar Tabela de Golpes Fulminantes — **no caderno ausente**. Atordoamento como efeito (p. 243).
- **Erro crítico** (ataque): 18 sempre; 17 se NH ≤ 16; margem ≥ 10; Tabela de Erros Críticos — **no caderno ausente** (p. 243–244).
- **Combate de Perto** (p. 246–253): Segurar (Disputa Rápida DX, +3), agarrar arma/braço, derrubar (Disputa melhor de ST/DX/Judô−5 vs ST), imobilizar (Disputa ST, +1/5 kg), sufocar (ST vs HT; dano = margem), desvencilhar-se (Disputa ST; +5/+10 adversário), armas em combate de perto −2; encontrão etc.
- **Armas de Longo Alcance** (p. 253–266): parâmetros TR/Prec/½D/Max; modificadores de tamanho do alvo e velocidade+distância (tabelas — **ausentes; reconstruídas a partir dos 6 exemplos numéricos do próprio material**: 7 m→−3; 70→−9; 100→−10; 200→−12; 1500→−17; escala geométrica ±6 por década); atirar às cegas −10 ou ≤9; alvo humano: usar só distância; encadeamento de modificadores (1 NH base → 2 tamanho → 3 vel/dist → 4 Prec se apontou → 5 condições).
  - Besta: engatilhar 2 s (ST ≤ sua), 6 s (ST+1/+2), pé-de-cabra 20 s (ST+3/+4; $50, 1 kg); impossível > +4 sem dispositivos.
  - Exemplos de arma (TR/Prec/½D/Max): Faca Pequena 11/0/ST−5? — tabela com corrupções (ver data/equipment.json, colunas conforme material p. 257).
- **Situações Especiais** (p. 266–275): cobertura, atirar em combate de perto, fogo (1d−3 parcial/1d−1 turno; armadura NT≤7 protege 3×RD turnos), calor/frio (teste HT/30 min; −1 fadiga; ST 3 → perde HT), quedas (1d−4/1d−3/1d−2 por metro conforme altura; acrobacia −5 m; máx 45 m; macio −1/m; RD de armadura parcialmente conta), objetos caindo (dados = múltiplos de 5 kg × múltiplos de 10 m; máx 180 m), afogamento/natação (teste/5 min; ST 0 → morte em 4 min), etc.

## 14. Ferimentos, Doenças e Fadiga (p. 276–300)

- Gerais: ver §12; prostração (perda > HT/2 de um golpe → teste HT ou cai; sempre atordoado); nocaute (cabeça: teste HT; cérebro > HT/2 = nocaute automático); atordoamento (defesas −4; recuperação por teste HT/IQ por turno) (p. 279–281).
- **Primeiros Socorros**: tabela por NT (NT1: 1d−4 PV/30 min … NT8: 1d PV/10 min); mínimo 1 PV; sucesso decisivo = recupera toda HT; falha crítica = −2 PV; ataduras simples = 1 PV/30 min (p. 282–283).
- **Cura natural**: teste HT/dia de repouso = +1 PV; médico NH≥12 = +1 nos testes; teste de Medicina por semana (NT-dependente): sucesso +1 PV (decisivo +2; crítico −1 PV) (p. 283–284).
- **Recuperação de lesões incapacitantes**: teste HT pós-combate; falha ≤3 → 1d meses; falha >3 → permanente (p. 285).
- **Inanição/sede**: −1 ST/refeição perdida (recupera 3/dia de descanso); ST 3 → perde HT; água 2 l/dia (3/5 em clima quente/deserto) (p. 284).
- **Doenças/venenos**: teste HT p/ resistir; tipos (contato/sanguíneo/digestivo/respiratório); exemplos: Alcatrão Cáustico $30, Acônito $40 (2d, −4 DX/2 h), Veneno de Cobra $100/dose (3d ou 1d) (p. 293–296).
- **Verificação de Pânico**: tabela 3d com 40+ resultados (p. 218–220) — incluída em `data/tables.json`.
- **FADIGA** (p. 298–300):
  - Fadiga = perda de ST (máx. até ST; nunca negativa).
  - Luta > 10 s: custo = **nível de Carga + 1** por luta (1–5); +1 se dia quente; +2 c/ armadura de placas/sobretudo.
  - Marcha: mesmo custo por hora de estrada; corrida/natação: teste HT a cada 100 m, falha = −1 fadiga; estafa (carregar > muito pesada): 1 fadiga/turno; esforço extra: 1/tentativa; noite sem dormir: 5; ½ noite: 2.
  - Efeitos: ST efetiva reduzida p/ testes de força e perícias baseadas em ST; **dano básico de armas NÃO muda**; Movimento não muda até ST 3 → ½ Mov; ST 1 → desfalece (só fala/magia); ST 0 → desmaia e descansa até ST 1.
  - Magia: custo em energia pago em ST (fadiga) ou HT (lesão; −1 NH magia por ponto de HT usado).
  - **Recuperação**: descanso — 1 ponto/10 min de descanso (ver p. 300/linha 9831 do texto extraído: "Recuperação da Fadiga" — regra exata transcrita no data file; magia Recuperação de Força acelera).

## 15. Magia (p. 300–370)

- Magias = perícias **Mental/Difícil** ou **Mental/Muito Difícil**; sem default; mínimo 1 ponto p/ aprender; **Aptidão Mágica** soma ao IQ (máx 3 níveis); Memória Eidética 1º/2º nível: +1/+2 (p. 301).
- **Pré-requisitos**: magia-pré com NH ≥ 12; Aptidão Mágica N; IQ/DX mínimos em algumas.
- **Conjuração**: 1+ turno(s) de Concentração → teste de NH no início do turno seguinte; sucesso = efeito + gasto de energia (ST como fadiga ou HT como lesão); sucesso decisivo = sem gasto de energia; falha com custo = −1 energia; falha crítica = custo total + Tabela de Choques de Retorno (3d, 16 resultados, p. 305).
- **Mana**: Muito Alta (qualquer um; magos sem custo; falha comum = crítica) / Alta (qualquer um) / Normal (só magos) / Baixa (−5 NH; itens potência < 20 não funcionam) / Nula (nada funciona) (p. 305–306).
- **Rituais por NH** (p. 307–308): ≤11 = mãos+pés livres, palavras em voz firme, 2× tempo; 12–14 = palavras+gesto; 15–17 = 1–2 palavras, mover 1 hex, **custo −1**; 18–20 = palavra OU gesto; **custo −2 (≥20)**; 21–24 = sem ritual, ½ tempo; 25+ = ¼ tempo, **custo −3**; +5 NH = ½ tempo e −1 energia adicionais.
- **Custo em energia**: NH ≥ 15 → −1; NH ≥ 20 → −2 etc. (calcular total antes da redução).
- **Manutenção**: duração + custo de manutenção por período; NH ≥ 15 reduz manutenção também; cancelar antes = +1 energia; −3 NH por magia ativa com concentração, −1 por magia ativa sem concentração; manter não exige teste (p. 310–311).
- **Classes**: Comum, Área (custo básico ×raio), Projétil (teste p/ criar + Arremesso ou DX−3 p/ acertar; bloqueável/não aparável), Informação, Resistível (teste de resistência do alvo), Encantamento, Especial (p. 312–314).
- **Objetos encantados**: custos em energia p/ encantar (ex.: 100–5000 por item na lista das magias); tabela de custo de encantamento "Lento e Seguro" $25/ponto etc. (p. 322–323).
- **Escolas** presentes no material: Animais, Terra, Ar, Água?, Fogo?, Curar (Cura), Luz e Trevas, Reconhecimento, Controle da Mente, + outras identificadas na extração (ver `data/spells.json` — 86 magias com classe, resistência, duração, custo, tempo, pré-requisitos e custos de encantamento de objetos).

## 16. Combate Montado/Veículos (p. 206–209)

- Esquiva da montaria = max(DX/2, Mov/2); teste de Cavalgar ao ser atingido (−1 por 4 PV de dano); montaria atingida > ¼ HT → teste DX; > ½ HT = como humano; condutor usando arma pessoal: −4 ataque.

## 17. Evolução do Personagem

Referida (p. 102: bônus por boa atuação, estudo; atributo sobe → perícias baseadas sobem) — **capítulo completo não presente no material → REGRA NÃO DEFINIDA** (arquitetura pronta em `progression.js`).

---

## LACUNAS — "REGRA NÃO DEFINIDA / MATERIAL NÃO FORNECIDO"

O material referencia cadernos externos que **não foram fornecidos**:

1. **Quadros e Tabelas** — tabelas de armas corpo-a-corpo (dano/custo/peso/alcance/ST mín), tabela de pontos de reação 3d, tabela de posições, tabelas de Golpes Fulminantes e Erros Críticos, tabela de local de impacto aleatório 3d, tabela completa de tamanho/velocidade-distância.
2. **Lista de Equipamentos** — preços de itens genéricos (rações, estojo médico, corda…).
3. **Personagens Instantâneos** — folheto com lista de perícias/planiha.
4. **Economia** (referida p. 12) e **Empregos** (referidos p. 33).
5. **Evolução do Personagem** (custos de melhoria pós-criação de atributos — só há regra indireta de custos de criação).

**Decisão de arquitetura:** todos esses dados são carregados dos arquivos JSON (`data/*.json`). Quando o usuário fornecer os capítulos ausentes, basta popular os arquivos — sem alteração do motor. Onde o próprio material traz exemplos numéricos autoconsistentes (modificadores de velocidade/distância), a tabela foi reconstruída **a partir dos exemplos** e marcada como `"_fonte": "reconstruído dos exemplos"`.

## Divergências/corrupções no texto-fonte (preservadas, não corrigidas)

- Tabela altura/peso (p. 7): coluna ST corrompida na exportação (linhas "1-", "15 ou menos", "10" fora de ordem). Transcrita como está.
- "Motonáutica (Fisico/Média)" (p. 178): grafia "Fisico" no original → normalizada com nota.
- Tabela de exemplos de armas de longo alcance (p. 257): colunas com ruído → transcritas conforme legível.
- Vontade/Vontade Fraca (p. 277): texto diz "teste de HT, mais ou menos o valor de Força de Vontade/Vontade Fraca" → implementado como modificador no teste de permanecer consciente.
