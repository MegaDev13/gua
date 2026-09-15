%title: Finanças e Contabilidade
%subtitle: Conhecimentos Específicos — Bloco 2 da Ênfase Administração e Controle
%file_out: Vol4-Financas-e-Contabilidade.pdf
%header_left: Vol. 4 • Finanças e Contabilidade — Transpetro 2026
%vol_label: Volume 4

# 1. Matemática Financeira (aprofundamento)

## 1.1 Porcentagem e taxas

- **Taxa de juros:** preço do empréstimo do dinheiro, expressa por período. i = 2% a.m. (ao mês) = 0,02/mês.
- **Conversão de taxas:** 2% a.m. ≠ 24% a.a. (compostos!). Taxas **equivalentes** (mesmo efeito): (1 + i_a)^(1/12) = 1 + i_m. Para 2% a.m.: 1,02^12 ≈ 1,268 → ~26,8% a.a.
- **Taxa nominal × efetiva:** taxa nominal (i_n) é a taxa do período menor que **não capitaliza** dentro do período maior (ex.: 24% a.a. divididos em 12 parcelas de 2% a.m.). Taxa efetiva é a real (com capitalização).
- **Porcentagem sobre porcentagem:** multiplicam os fatores. Aumento de 20% seguido de 10% → 1,2 × 1,1 = 1,32 (32% no total).

## 1.2 Juros simples

J = C · i · t
M = C + J = C(1 + i·t)

**Cuidados:**
- A taxa e o tempo devem estar na **mesma unidade** (se i é ao mês, t em meses).
- Juros simples **não capitalizam** (o juro não gera juro).

**Exemplo.** Empréstimo de R$ 10.000 a 1,5% a.m. por 8 meses: J = 10.000 × 0,015 × 8 = R$ 1.200. M = R$ 11.200.

## 1.3 Juros compostos

M = C · (1 + i)^t
J = M − C

- **Capitalização:** o juro de cada período soma-se ao capital e passa a gerar juro ("juros sobre juros").
- **Períodos:** (1 + i)^t — se t = 3 a 10% a.m.: 1,1³ = 1,331 → M = 1,331 × C.

**Exemplo.** R$ 5.000 a 10% a.m. por 3 meses: M = 5.000 × 1,331 = R$ 6.655. J = R$ 1.655.

**Regra dos 70:** tempo de dobra ≈ 70 ÷ i (em %). A 10% a.a.: ~7 anos.

## 1.4 Descontos

**Desconto** = valor abatido de um título/valor futuro para obter o valor presente.

| Tipo | Fórmula | Observação |
|---|---|---|
| **Desconto simples comercial (fora)** | D = N · i · t | Calculado sobre o **valor nominal (N)** — mais barato para o devedor... na verdade mais caro (desconto maior) |
| **Desconto simples racional (dentro)** | D = VP · i · t | Calculado sobre o **valor presente (VP)** — coerente com juros simples |
| **Desconto composto** | VP = N ÷ (1 + i)^t | Coerente com juros compostos |

**Exemplo (comercial).** Nota de R$ 5.000, 4 meses, 2% a.m.: D = 5.000 × 0,02 × 4 = R$ 400. VP = R$ 4.600.

**Exemplo (racional).** VP · 0,02 · 4 = D; VP = N − D = VP(1 + 0,08) → VP = 5.000/1,08 ≈ R$ 4.629,63; D ≈ R$ 370,37.

> [BANCA] A Cesgranrio cobra a **diferença comercial × racional** e o **desconto composto**. Regra mnemônica: "comercial desconta sobre o NOMINAL; racional desconta sobre o PRESENTE".

## 1.5 Equivalência de pagamentos (o essencial)

Dois pagamentos são **equivalentes** se, num mesmo instante (data-focal), valem a mesma quantia.

**Método:**
1. Escolha uma **data-focal** (geralmente a data de um dos pagamentos ou a de hoje).
2. Traga (desconte) ou leve (juros) cada pagamento até a data-focal.
3. Some os valores de um lado e iguale aos do outro.

**Exemplo.** R$ 1.000 para 2 meses equivale, a 5% a.m., a R$ X para 1 mês?
Data-focal = hoje (t = 0). VP do pagamento de 2 meses: 1.000/1,10 ≈ 909,09. VP do pagamento de 1 mês: X/1,05. Igualando: X/1,05 = 909,09 → X ≈ R$ 954,55.

> [DICA] Em prova, a **data-focal** mais usada é "hoje" (valor presente). Se a questão der 2 datas de pagamento e pedir a equivalência, sempre traga tudo para o presente (desconto) e some.

## 1.6 Noções de VPL e TIR (o mínimo)

- **VPL (Valor Presente Líquido):** soma dos fluxos de caixa descontados menos o investimento inicial. VPL > 0 → projeto viável (gera valor).
- **TIR (Taxa Interna de Retorno):** taxa que faz o VPL = 0. TIR > custo de capital → viável.

**Exemplo (VPL).** Investe R$ 100 hoje e recebe R$ 110 em 1 ano. A 8% a.a.: VPL = 110/1,08 − 100 ≈ 101,85 − 100 = **+1,85** → viável (TIR = 10% > 8%).

# 2. Registros Contábeis Fundamentais

## 2.1 A equação fundamental

**Ativo = Passivo + Patrimônio Líquido**

| Elemento | O que é | Exemplos |
|---|---|---|
| **Ativo** | Recursos/econômicos que a empresa **possui ou controla** (bens, direitos) | Caixa, contas a receber, estoques, máquinas, imóveis |
| **Passivo** | Obrigações/dívidas da empresa (com terceiros) | Fornecedores, empréstimos, salários a pagar |
| **Patrimônio Líquido (PL)** | Recursos dos **sócios** (residual: Ativo − Passivo) | Capital social, reservas, lucros acumulados |

- **Ativo circulante:** liquidez alta (caixa, recebíveis, estoques) — vira caixa em curto prazo.
- **Ativo não circulante (permanente/imobilizado):** longo prazo (máquinas, imóveis, veículos).
- **Passivo circulante:** obrigações de curto prazo (fornecedores, empréstimos a pagar em < 12 meses).
- **Passivo não circulante:** obrigações de longo prazo (empréstimos longos).

## 2.2 Partidas dobradas (o coração da contabilidade)

Toda operação tem **duas faces**: origem e aplicação de recursos. Regra: **o que entra em um ativo, sai de outro ativo, ou aumenta passivo/PL.**

**Operações-tipo:**

| Operação | Débito (D) | Crédito (C) |
|---|---|---|
| Comprar mercadoria **a vista** (caixa) | Mercadorias (Ativo) | Caixa (Ativo) |
| Comprar mercadoria **a prazo** | Mercadorias (Ativo) | Fornecedores (Passivo) |
| Receber cliente (a prazo) | Caixa (Ativo) | Contas a receber (Ativo) |
| Pagar fornecedor | Fornecedores (Passivo) | Caixa (Ativo) |
| Pagar salário | Salários (Despesa/Resultado) | Caixa (Ativo) |
| Vender mercadoria a vista | Caixa (Ativo) | Vendas (Receita/Resultado) |
| Depreciação do mês | Depreciação (Despesa) | Redução imobilizado (Contra-ativo) |
| Lucro do mês | Resultado do exercício (PL) | Lucros (PL) |

> [BANCA] A Cesgranrio cobra a **lógica da partida dobrada** mais que a "memorização de contas". A questão típica: "ao comprar equipamento a prazo, a contabilidade registra..." → Ativo aumenta (equipamento) e Passivo aumenta (fornecedor). **A equação continua em equilíbrio.**

## 2.3 O Diário e o Razão

- **Diário:** registro **cronológico** (data) de todas as operações — cada lançamento tem débito e crédito (soma dos débitos = soma dos créditos).
- **Razão (livro razão):** contas **abertas e resumidas** (saldos por conta) — deriva do diário (rastreamento).
- **Balancetes de verificação:** conferem se débitos = créditos.

## 2.4 Balanço Patrimonial

Fotografia **numa data** (situacional):

```
ATIVO                              PASSIVO
Ativo Circulante                   Passivo Circulante
  Caixa 100                          Fornecedores 200
  Contas a receber 150               Empréstimos (CP) 300
  Estoques 250
Ativo Não Circulante               Passivo Não Circulante
  Imobilizado (líquido) 500          Empréstimos (LP) 400
                                    Patrimônio Líquido
  Capital 300
  Lucros acumulados 100

TOTAL ATIVO 1.000              TOTAL PASSIVO + PL 1.000
```

**Leituras que a banca faz:**
- **Liquidez corrente** = Ativo circulante ÷ Passivo circulante. (Ex.: 500/500 = 1,0.)
- **Endividamento** = Passivo ÷ Ativo total (ex.: 900/1.000 = 90%).
- **PL positivo** = empresa pagou as dívidas e sobrou para os sócios.

## 2.5 DRE — Demonstração do Resultado do Exercício

Conta o **resultado num período** (fluxo):

```
Receita de Vendas           1.000
(−) CMV (Custo das Merc. Vendidas)   400
(=) Lucro Bruto                    600
(−) Despesas operacionais           300
(=) EBITDA (resultado operacional)   300
(−) Depreciação                       50
(=) EBIT (resultado antes juros/IR)  250
(−) Juros                             30
(−) IR/CSLL                           35
(=) LÍQUIDO DO EXERCÍCIO             185
```

**Conceitos:**
- **Receita:** ingresso de recursos pela venda (produção de bens/serviços).
- **Custo (CMV):** diretamente ligado à produção/venda do que é vendido.
- **Despesa:** recurso consumido na **administração** (não ligado diretamente à produção: aluguel, salários administrativos, marketing).
- **Lucro bruto** = Receita − CMV.
- **EBITDA** = Lucro antes de juros, impostos, depreciação e amortização (mede o "cash" operacional).
- **Lucro líquido** = sobra final (vai para o PL: lucros acumulados).

> [BANCA] A distinção **custo × despesa** é clássica:
> - Custo = ligado ao **produto/serviço vendido** (CMV).
> - Despesa = ligado à **administração/estrutura** (período).
> "O salário do operário da linha" → custo; "o salário do gerente" → despesa.

# 3. Obrigações Acessórias e Controle Fiscal

## 3.1 O que é obrigação acessória

**Obrigação principal** = pagar o imposto.
**Obrigação acessória** = **fornecer informações** para o fisco (e-fiscal): emitir/entregar documentos, escriturar, declarar. Exemplos:
- **Emitir e guardar documentos fiscais** (nota fiscal, cupom).
- **Escrever os livros** (diário, razão, inventário).
- **Prestar informações ao fisco** (declarações, escrituração).

**Consequência de descumprir:** multa (independente do imposto), impedimento de emitir notas, bloqueio de benefícios fiscais.

## 3.2 Principais tributos (conceito)

| Tributo | Incide sobre | Esfera |
|---|---|---|
| **IRPJ** (Imposto de Renda Pessoa Jurídica) | Lucro da empresa | Federal |
| **CSLL** (Contribuição Social sobre Lucro Líquido) | Lucro líquido | Federal |
| **PIS/COFINS** | Receita bruta da empresa | Federal |
| **ICMS** | Circulação de mercadorias e transporte | Estadual |
| **ISS** | Prestação de serviços | Municipal |
| **IPI** | Produção de bens industrializados | Federal |
| **Contribuições previdenciárias (INSS patronal)** | Folha de pagamento | Federal |

> [BANCA] A banca cobra o **conceito de incidência** (o que incide sobre o quê) e a **esfera** (federal/estadual/municipal). Não precisa decorar alíquotas — precisa saber classificar: "ICMS incide sobre circulação de mercadorias e é estadual".

## 3.3 Controle fiscal e SPED (o conceito)

- **SPED (Sistema Público de Escrituração Digital):** conjunto de escriturações digitais obrigatórias (escrituração fiscal e contábil transmitida eletronicamente ao fisco).
- **NF-e (Nota Fiscal Eletrônica):** documento fiscal digital que autoriza o transporte/entrega da mercadoria e registra a operação.
- **CT-e (Conhecimento de Transporte Eletrônico):** documento fiscal do transporte.
- **Controle fiscal:** cruzar as informações declaradas (notas, escrituração) com as bases do fisco para verificar a conformidade.

# 4. Fluxo de Caixa

## 4.1 Conceito e tipos

**Fluxo de caixa** = registro das **entradas e saídas de dinheiro** num período. É a "saúde financeira" da empresa — **lucro ≠ caixa** (pode lucrar e não ter caixa, ou ter caixa e não lucrar).

**Tipos:**
- **Fluxo de caixa direto:** registra as entradas e saídas **reais** (operações).
- **Fluxo de caixa indireto (projeção):** parte do lucro contábil e **ajusta** os itens não-caixa (depreciação, variações de ativo/passivo circulante) para chegar ao caixa.
- **Fluxo de caixa orçado (planejado):** projeção para o futuro — base do planejamento financeiro.

## 4.2 Elaboração e análise

**Estrutura básica:**
```
Saldo inicial (caixa)         500
(+) Recebimentos              800
(−) Pagamentos               600
(=) Saldo final              700
```

**Análise:**
- **Saldo final positivo** → caixa confortável; **negativo** → necessidade de capital de giro/empréstimo.
- **Ponto de equilíbrio de caixa:** quando entradas = saídas (caixa neutro).
- **Capital de giro:** valor necessário para as operações diárias (caixa + recebíveis + estoques − fornecedores).

## 4.3 Gestão de entradas e saídas

- **Entradas:** recebimentos de clientes, vendas a vista, capital, empréstimos.
- **Saídas:** pagamentos a fornecedores, salários, impostos, investimentos, despesas.
- **Gestão:** antecipar recebimentos (desconto), retardar pagamentos (prazo), alinhar com o ciclo de caixa.

## 4.4 Integração com orçamento e projeções

- **Orçamento de caixa:** fluxo de caixa projetado para o período (planejamento).
- **Projeção financeira:** estende o fluxo de caixa para meses/anos futuros (cenários).
- **Gestão de liquidez:** manter caixa suficiente para cobrir as saídas (reserva de liquidez).

> [ESTRATEGIA] Fluxo de caixa + custo × despesa + equação fundamental = o **triângulo da contabilidade básica** que a Cesgranrio cobra. Domine esses três e você resolve ~50% das questões de Finanças e Contabilidade.

# 5. Bloco de Questões (Q1–Q40)

::q
**Q1.** (ESTILO CESGRANRIO) Juros simples: C = R$ 8.000, i = 2% a.m., t = 6 meses. Juros = ?
a) 80 b) 960 c) 96 d) 1.600 e) 160
**GABARITO: B** — J = 8.000 × 0,02 × 6 = 960.
::/q

::q
**Q2.** (ESTILO CESGRANRIO) Juros compostos: C = R$ 4.000, i = 10% a.m., t = 2 meses. Montante = ?
a) 4.400 b) 4.840 c) 4.800 d) 5.000 e) 4.440
**GABARITO: B** — M = 4.000 × 1,1² = 4.000 × 1,21 = 4.840.
::/q

::q
**Q3.** (ESTILO CESGRANRIO) A taxa efetiva anual equivalente a 2% ao mês é aproximadamente:
a) 24% b) 26,8% c) 20% d) 30% e) 22%
**GABARITO: B** — 1,02^12 ≈ 1,268 → ~26,8% a.a. (nominal seria 24%).
::/q

::q
**Q4.** (ESTILO CESGRANRIO) Um título de R$ 10.000, 3 meses, desconto simples **comercial** a 2% a.m. O desconto é:
a) 300 b) 600 c) 620 d) 900 e) 1.000
**GABARITO: B** — D = N·i·t = 10.000 × 0,02 × 3 = 600 (sobre o NOMINAL).
::/q

::q
**Q5.** (ESTILO CESGRANRIO) No desconto simples **racional**, o desconto é calculado sobre o:
a) valor nominal. b) valor presente. c) valor de mercado. d) valor contábil. e) valor justo.
**GABARITO: B** — Racional = sobre o PRESENTE; comercial = sobre o NOMINAL.
::/q

::q
**Q6.** (ESTILO CESGRANRIO) Dois pagamentos são equivalentes quando, numa mesma data, valem:
a) valores diferentes. b) a mesma quantia. c) o dobro. d) metade. e) juros iguais.
**GABARITO: B** — Equivalência = mesma quantia na data-focal.
::/q

::q
**Q7.** (ESTILO CESGRANRIO) VPL > 0 significa que o projeto:
a) não é viável. b) é viável (gera valor). c) está em empate. d) tem TIR zero. e) tem prejuízo.
**GABARITO: B** — VPL positivo = viável (TIR > custo de capital).
::/q

::q
**Q8.** (ESTILO CESGRANRIO) Na equação fundamental, o que a empresa POSSUI (bens e direitos) é o:
a) Passivo. b) Ativo. c) PL. d) Caixa. e) Lucro.
**GABARITO: B** — Ativo = recursos que possui/controlla.
::/q

::q
**Q9.** (ESTILO CESGRANRIO) As obrigações/dívidas da empresa (com terceiros) são o:
a) Ativo. b) PL. c) Passivo. d) Resultado. e) Caixa.
**GABARITO: C** — Passivo = dívidas com terceiros.
::/q

::q
**Q10.** (ESTILO CESGRANRIO) O que sobra (Ativo − Passivo) e pertence aos sócios é o:
a) Passivo. b) Caixa. c) Patrimônio Líquido. d) Resultado. e) Lucro.
**GABARITO: C** — PL = recursos dos sócios (residual).
::/q

::q
**Q11.** (ESTILO CESGRANRIO) Ao comprar um equipamento **a prazo**, a contabilidade registra:
a) Ativo aumenta e Passivo aumenta. b) Ativo aumenta e PL aumenta. c) Passivo diminui e PL aumenta. d) Ativo diminui e Passivo aumenta. e) PL diminui e Caixa aumenta.
**GABARITO: A** — Ativo (equipamento) ↑ e Passivo (fornecedor) ↑. A equação equilibra.
::/q

::q
**Q12.** (ESTILO CESGRANRIO) O salário do **operário da linha de produção** é, em regra:
a) despesa. b) custo. c) receita. d) lucro. e) patrimônio.
**GABARITO: B** — Ligado à produção = custo. (O do gerente = despesa.)
::/q

::q
**Q13.** (ESTILO CESGRANRIO) O aluguel da sede administrativa é, em regra:
a) custo. b) despesa. c) receita. d) lucro. e) investimento.
**GABARITO: B** — Ligado à administração/estrutura = despesa.
::/q

::q
**Q14.** (ESTILO CESGRANRIO) Receita de vendas − CMV = ?
a) Lucro líquido. b) Lucro bruto. c) EBITDA. d) EBIT. e) Caixa.
**GABARITO: B** — Lucro bruto = Receita − CMV.
::/q

::q
**Q15.** (ESTILO CESGRANRIO) O resultado operacional antes de juros, impostos, depreciação e amortização é o:
a) EBIT. b) EBITDA. c) Lucro bruto. d) Lucro líquido. e) Caixa.
**GABARITO: B** — EBITDA = antes de juros, impostos, depreciação, amortização.
::/q

::q
**Q16.** (ESTILO CESGRANRIO) A liquidez corrente é:
a) Passivo ÷ Ativo. b) Ativo circulante ÷ Passivo circulante. c) PL ÷ Ativo. d) Lucro ÷ Receita. e) Caixa ÷ Lucro.
**GABARITO: B** — Liquidez corrente = AC ÷ PC.
::/q

::q
**Q17.** (ESTILO CESGRANRIO) O IRPJ incide sobre:
a) receita bruta. b) lucro da empresa. c) folha. d) serviços. e) transporte.
**GABARITO: B** — IRPJ incide sobre o LUCRO (federal).
::/q

::q
**Q18.** (ESTILO CESGRANRIO) O ICMS incide sobre:
a) lucro. b) circulação de mercadorias/transporte (estadual). c) folha. d) serviços. e) renda.
**GABARITO: B** — ICMS = circulação de mercadorias e transporte (estadual).
::/q

::q
**Q19.** (ESTILO CESGRANRIO) O ISS incide sobre:
a) mercadorias. b) prestação de serviços (municipal). c) lucro. d) folha. e) transporte interestadual.
**GABARITO: B** — ISS = serviços (municipal).
::/q

::q
**Q20.** (ESTILO CESGRANRIO) Fornecer informações ao fisco (emitir notas, escriturar) é obrigação:
a) principal. b) acessória. c) penal. d) previdenciária. e) eleitoral.
**GABARITO: B** — Acessória = informar; principal = pagar o imposto.
::/q

::q
**Q21.** (ESTILO CESGRANRIO) A NF-e (Nota Fiscal Eletrônica) é um:
a) livro contábil. b) documento fiscal digital. c) imposto. d) boleto. e) contrato.
**GABARITO: B** — NF-e = documento fiscal digital da operação.
::/q

::q
**Q22.** (ESTILO CESGRANRIO) Lucro ≠ caixa porque:
a) são a mesma coisa. b) o lucro é contábil (reconhecido) e o caixa é dinheiro real. c) o lucro é sempre maior. d) o caixa é sempre maior. e) o lucro não existe.
**GABARITO: B** — Lucro é reconhecido (competência); caixa é dinheiro (pagamento). Podem divergir.
::/q

::q
**Q23.** (ESTILO CESGRANRIO) O fluxo de caixa **direto** registra:
a) ajustes do lucro. b) entradas e saídas reais de dinheiro. c) o lucro. d) o passivo. e) a depreciação.
**GABARITO: B** — Direto = entradas/saídas reais.
::/q

::q
**Q24.** (ESTILO CESGRANRIO) O fluxo de caixa **indireto** parte do:
a) caixa inicial. b) lucro contábil (ajustado). c) passivo. d) ativo. e) investimento.
**GABARITO: B** — Indireto parte do lucro e ajusta itens não-caixa.
::/q

::q
**Q25.** (ESTILO CESGRANRIO) Saldo final negativo no fluxo de caixa indica:
a) excesso de caixa. b) necessidade de capital de giro/empréstimo. c) lucro. d) PL positivo. e) baixa de ativo.
**GABARITO: B** — Saldo negativo = falta de caixa (precisa de capital/empréstimo).
::/q

::q
**Q26.** (ESTILO CESGRANRIO) O capital de giro refere-se ao:
a) lucro líquido. b) valor para as operações diárias (caixa + recebíveis + estoques − fornecedores). c) imobilizado. d) PL. e) passivo.
**GABARITO: B** — Capital de giro = capital para as operações do dia a dia.
::/q

::q
**Q27.** (ESTILO CESGRANRIO) Ao vender mercadoria **a vista**, registra-se:
a) Caixa ↑ e Fornecedores ↑. b) Caixa ↑ e Vendas (Receita) ↑. c) Caixa ↓ e Estoques ↑. d) Fornecedores ↑ e Caixa ↑. e) PL ↑ e Caixa ↓.
**GABARITO: B** — Caixa (ativo) ↑ e Vendas (receita) ↑.
::/q

::q
**Q28.** (ESTILO CESGRANRIO) Ao pagar um fornecedor, registra-se:
a) Caixa ↑ e Fornecedores ↑. b) Fornecedores ↓ e Caixa ↓. c) Caixa ↑ e PL ↓. d) PL ↑ e Caixa ↓. e) Estoques ↑ e Caixa ↓.
**GABARITO: B** — Fornecedores (passivo) ↓ e Caixa (ativo) ↓.
::/q

::q
**Q29.** (ESTILO CESGRANRIO) A depreciação mensal registra:
a) Caixa ↓ e Ativo ↓. b) Despesa (resultado) ↑ e Redução do imobilizado (contra-ativo) ↑. c) PL ↑ e Caixa ↑. d) Passivo ↑ e Ativo ↑. e) Receita ↑ e Caixa ↑.
**GABARITO: B** — Depreciação: despesa (resultado) e contra-ativo (reduz o imobilizado).
::/q

::q
**Q30.** (ESTILO CESGRANRIO) O EBIT é o resultado:
a) após impostos. b) antes de juros e impostos. c) bruto. d) do caixa. e) do PL.
**GABARITO: B** — EBIT = antes de juros e impostos (após depreciação).
::/q

::q
**Q31.** (ESTILO CESGRANRIO) O PIS/COFINS incide sobre:
a) lucro. b) receita bruta. c) folha. d) mercadorias. e) serviços.
**GABARITO: B** — PIS/COFINS = receita bruta (federal).
::/q

::q
**Q32.** (ESTILO CESGRANRIO) As contribuições previdenciárias patronais (INSS) incidem sobre:
a) receita. b) folha de pagamento. c) lucro. d) mercadorias. e) serviços.
**GABARITO: B** — INSS patronal = folha.
::/q

::q
**Q33.** (ESTILO CESGRANRIO) O SPED é:
a) um imposto. b) o sistema de escrituração digital obrigatória. c) um livro. d) uma nota. e) um contrato.
**GABARITO: B** — SPED = Sistema Público de Escrituração Digital.
::/q

::q
**Q34.** (ESTILO CESGRANRIO) A "data-focal" na equivalência de pagamentos é:
a) o lucro. b) a data na qual todos os pagamentos são comparados. c) o caixa. d) o passivo. e) o PL.
**GABARITO: B** — Data-focal = data de referência para comparar.
::/q

::q
**Q35.** (ESTILO CESGRANRIO) A regra dos 70 estima o tempo de dobra dividindo 70 pela:
a) taxa efetiva. b) taxa (em %). c) taxa nominal em décimos. d) inflação. e) taxa de desconto.
**GABARITO: B** — Tempo de dobra ≈ 70 ÷ i(%).
::/q

::q
**Q36.** (ESTILO CESGRANRIO) A TIR é a taxa que faz o VPL igual a:
a) 1. b) 0. c) 100. d) infinito. e) o investimento.
**GABARITO: B** — TIR = taxa com VPL = 0.
::/q

::q
**Q37.** (ESTILO CESGRANRIO) Um ativo **circulante** tem:
a) liquidez alta (curto prazo). b) liquidez baixa. c) vida útil longa. d) valor de mercado. e) depreciação zero.
**GABARITO: A** — Circulante = vira caixa em curto prazo (caixa, recebíveis, estoques).
::/q

::q
**Q38.** (ESTILO CESGRANRIO) O "diário" registra as operações em ordem:
a) por conta. b) cronológica (data). c) alfabética. d) por valor. e) por cliente.
**GABARITO: B** — Diário = cronológico. (Razão = por conta.)
::/q

::q
**Q39.** (ESTILO CESGRANRIO) A soma dos débitos deve ser igual à soma dos créditos porque:
a) é convenção. b) toda operação tem duas faces (partida dobrada). c) é opcional. d) é por lei. e) é o lucro.
**GABARITO: B** — Partida dobrada: débitos = créditos sempre.
::/q

::q
**Q40.** (ESTILO CESGRANRIO) Um projeto com TIR de 12% e custo de capital de 10% é:
a) inviável. b) viável (TIR > custo de capital). c) empate. d) prejudicial. e) duvidoso.
**GABARITO: B** — TIR (12%) > custo de capital (10%) → viável.
::/q

# 6. Fechamento do Bloco 2

> [RESUMO] Este volume cobriu o Bloco 2: matemática financeira (juros simples/compostos, descontos comercial × racional, equivalência, VPL/TIR), contabilidade fundamental (equação, partida dobrada, diário/razão, balanço, DRE, custo × despesa), obrigações acessórias/tributos (conceito de incidência) e fluxo de caixa (direto/indireto, análise, capital de giro).
>
> [ESTRATEGIA] O **triângulo de ouro** para a prova: (1) juros compostos + desconto composto; (2) equação fundamental + partida dobrada (o que sobe/desce em cada operação); (3) custo × despesa + DRE. Se sobrar pouco tempo, domine esses três conjuntos — respondem por ~60% das questões de Finanças e Contabilidade.
