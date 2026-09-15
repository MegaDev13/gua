%title: Noções de Informática e LGPD
%subtitle: Conhecimentos Gerais/Específicos — Bloco 4 da Ênfase (Windows 11, Office 2024, Segurança, LGPD)
%file_out: Vol6-Noes-de-Informatica-e-LGPD.pdf
%header_left: Vol. 6 • Informática e LGPD — Transpetro 2026
%vol_label: Volume 6

# 1. Fundamentos de Informática

## 1.1 Hardware

**Hardware:** a parte **física** do computador (circuitos, placas, chips, periféricos).

**Componentes principais:**
- **CPU (processador):** "cérebro" — executa as instruções. Medida em **GHz** (gigahertz = bilhões de ciclos/s). Tem **núcleos** (cores) e **threads**.
- **RAM (memória de trabalho):** **volátil** (perde tudo sem energia) — onde os dados ficam **em uso**. Medida em **GB**.
- **HD/SSD (armazenamento):** **não volátil** (mantém os dados sem energia). SSD = mais rápido (sem partes móveis).
- **Placa-mãe (motherboard):** conecta todos os componentes.
- **GPU (placa de vídeo):** processa imagens/vídeos.
- **Fontes, portas (USB, HDMI, LAN), Wi-Fi, Bluetooth.**

> [ATENÇÃO] A Cesgranrio **adora** o par **RAM × HD**: RAM = **volátil**, em uso; HD/SSD = **não volátil**, armazenamento permanente. "Onde ficam os dados quando o computador é desligado?" = HD/SSD. "O que perde o conteúdo ao desligar?" = RAM.

## 1.2 Processadores (o que cai)

- **Clock (GHz):** velocidade do relógio — ciclos por segundo.
- **Núcleos (cores):** processadores modernos têm 2, 4, 8+ núcleos — executam **várias tarefas em paralelo**.
- **Cache:** memória **ultrarrápida** **dentro** do processador.
- **Arquitetura:** x86 (32/64 bits), ARM (celulares). **64 bits** processa mais memória.
- **Multithreading:** mais threads por núcleo (hiperthreading).

## 1.3 Software

- **Sistema operacional (SO):** Windows, macOS, Linux, Android — **gerencia o hardware** e oferece ambiente para os aplicativos.
- **Aplicativo (programa):** Word, Excel, navegador — faz o **trabalho do usuário**.
- **Firmware/BIOS:** software **gravado no hardware** (placa-mãe) — inicia o computador (boot).
- **Driver:** pequeno software que permite o SO **comunicar** um dispositivo (impressora, placa).
- **Nuvem (cloud):** serviços online (armazenamento, software) — modelos:
  - **IaaS:** infraestrutura (servidor virtual).
  - **PaaS:** plataforma para desenvolver.
  - **SaaS:** software pronto (Office 365, Gmail).

# 2. Windows 11

## 2.1 Interface e navegação

- **Barra de tarefas:** centralizada por padrão (ícones fixos, busca, widgets, bandeja de notificação, **relógio**).
- **Menu Iniciar:** apps fixados, apps recentes, **ligar/desligar**.
- **Área de trabalho:** ícones; clique duplo abre; botão direito = menu de contexto.
- **Janelas:** minimizar, maximizar/restaurar, fechar; **snap** (arrastar a janela para a borda/canto = encaixar em meia tela).
- **Visualização de tarefas (Task View):** mostra **desktops virtuais** e janelas abertas.
- **Painel de Controle × Configurações (Settings):** no Win11, o **Configurações** é o caminho principal (Sistema, Rede, Bluetooth, Aplicativos, Conta, etc.).

**Atalhos essenciais (a banca cobra):**
- **Ctrl+C / Ctrl+X / Ctrl+V:** copiar / recortar / colar.
- **Ctrl+Z / Ctrl+Y:** desfazer / refazer.
- **Ctrl+A:** selecionar tudo.
- **Ctrl+F:** localizar.
- **Alt+Tab:** alternar entre janelas.
- **Win+D:** mostrar a área de trabalho.
- **Win+E:** abrir o Explorador de Arquivos.
- **Win+I:** abrir Configurações.
- **Win+L:** bloquear o PC.
- **Win+Shift+S:** captura de tela (área).
- **Print Screen:** captura a tela (no Win11, abre o editor de capturas).
- **Alt+F4:** fechar a janela/programa ativo.
- **Ctrl+Shift+Esc:** Gerenciador de Tarefas.

## 2.2 Explorador de Arquivos e arquivos

- **Pasta/arquivo:** organização em árvore; **caminho** (ex.: `C:\Users\joao\Documentos\rel.xlsx`).
- **Extensão:** `.docx` (Word), `.xlsx` (Excel), `.pdf`, `.png`, `.zip`.
- **Operações:** mover (recortar+colar), copiar, renomear (F2), excluir (→ Lixeira), **Restaurar da Lixeira** ou **Esvaziar Lixeira** (apaga de vez).
- **Barra de endereço / pesquisa:** localizar por nome.
- **Propriedades (botão direito):** tamanho, tipo, data.

## 2.3 Conta, segurança e manutenção no Windows

- **Conta de usuário:** local / **Microsoft (online)**.
- **Windows Hello:** login por **biometria** (rosto/digital) ou PIN.
- **Firewall do Windows:** filtro de tráfego de rede (ativação por padrão).
- **Windows Update:** atualizações automáticas.
- **Backup:** backup do sistema/contas Microsoft (OneDrive).

> [BANCA] A Cesgranrio cobra: (1) **RAM volátil × HD não volátil**; (2) **atalhos** (especialmente Ctrl+C/X/V, Alt+Tab, Win+E, Win+L, Ctrl+Shift+Esc); (3) **o que desligar/bloquear** (Win+L); (4) **SaaS/PaaS/IaaS**; (5) **extensões de arquivo**.

# 3. Microsoft Office 2024

## 3.1 Word (processamento de texto)

**Conceitos:**
- **Documento/página/margens/colunas/quebra de página.**
- **Fonte/tamanho/cor/negrita/italic/sublinhado.**
- **Estilos:** título 1, título 2, corpo de texto — formatam em lote e geram o **sumário automático**.
- **Sumário automático:** gerado a partir dos **estilos de título** (atualiza com F9).
- **Mala direta (mail merge):** **um modelo + uma lista de destinatários** = vários documentos personalizados (cartas, etiquetas) — **cai muito**.
- **Campo (insert > field):** data, número de página, etc.
- **Referências cruzadas/numeração de parágrafos.**
- **Revisão de texto:** ortografia/gramática, comentários, controle de alterações.

**Atalhos do Word:** os de Windows (Ctrl+C/X/V/Z/Y, Ctrl+B/I/U para negrito/itálico/sublinhado, Ctrl+S salvar, Ctrl+P imprimir, Ctrl+N novo documento).

## 3.2 Excel (planilha)

**Conceitos:**
- **Célula** (interseção linha/coluna, ex.: `B3`), **intervalo** (`A1:B5`), **planilha (sheet), pasta de trabalho (workbook).**
- **Referência absoluta × relativa:** `$A$1` = absoluta (não muda ao arrastar); `A1` = relativa; `$A1`/`A$1` = mistas.
- **Fórmulas básicas:**
  - `=SOMA(A1:A5)` / `=SUM(A1:A5)` — soma.
  - `=MÉDIA(...)` / `=AVERAGE(...)` — média aritmética.
  - `=CONT.NÚM(...)`, `=MÁXIMO`, `=MÍNIMO`.
  - `=SE(condição; valor_se_verdadeiro; valor_se_falso)` / `=IF(...)` — condicional.
  - `=PROCV(valor; intervalo; coluna; [FALSO])` / `=VLOOKUP(...)` — procura **vertical** (retorna valor da coluna correspondente).
- **Gráficos:** colunas, linha, pizza — gerados a partir de um intervalo.
- **Classificação/filtro:** ordenar e filtrar colunas.
- **Formatação condicional:** cor por regra.
- **Mesa de dados.**

> [ATENÇÃO] Em prova, a Cesgranrio pergunta o **resultado de uma fórmula** (ex.: `=SE(B2>10;"OK";"REVISAR")`) e o **que o PROCV procura** (vertical, a partir da 1ª coluna). Decore: **PROCV = procura vertical**; **PESQUISAR.V = vertical**; referência **$** = trava (absoluta).

## 3.3 PowerPoint, Outlook, OneDrive/Teams

- **PowerPoint:** **slides**, layouts, transições, animações, modo de apresentação (F5), notas do apresentador.
- **Outlook:** e-mail — **caixas** (Itens não lidos, Caixa de entrada, Enviados, Lixo eletrônico), **pastas**, **regras** (filtram mensagens), **agenda** (calendário, reuniões), **contatos**.
- **OneDrive:** armazenamento **na nuvem** (sincroniza arquivos com a conta Microsoft).
- **Teams:** colaboração (chats, reuniões, canais, arquivos compartilhados).
- **Office 365/Microsoft 365:** pacote em **assinatura** (SaaS) — sempre atualizado.

# 4. Internet, Intranet e Protocolos

## 4.1 Navegador e web

- **Navegador (browser):** Chrome, Edge, Firefox — interpreta o HTML/CSS e exibe a página.
- **URL:** endereço da página (`https://www.transpetro.com.br/...`).
- **HTTPS:** versão **segura** do HTTP (criptografado, cadeado no navegador).
- **Busca (search engine):** Google, Bing — indexam a web.
- **Cookies:** pequenos dados do **site** salvos no **navegador** (sessão, preferências).
- **Cache do navegador:** páginas **armazenadas localmente** para carregar mais rápido.
- **Modo anônimo/privado:** não salva histórico/localmente (não torna "invisível" a terceiros).
- **Download/Upload:** baixar **da internet** / enviar **para** a internet.

## 4.2 Intranet, extranet e e-mail

- **Intranet:** rede **privada** **internas** à organização (uso interno) — mesma tecnologia da web, mas restrita.
- **Extranet:** intranet **estendida** a parceiros/fornecedores externos (acesso controlado).
- **E-mail:**
  - **SMTP:** **envia** e-mails (Simple Mail Transfer Protocol).
  - **POP3:** **baixa** e-mails para o cliente (remove do servidor).
  - **IMAP:** **sincroniza** e-mails com o servidor (mantém cópias no servidor).
  - **Endereço:** `usuario@dominio.com` — o `@` separa usuário de domínio.

> [BANCA] Protocolos de e-mail são **certos**: **SMTP = enviar**, **POP3 = baixar e remover**, **IMAP = sincronizar (fica no servidor)**. "Qual protocolo envia e-mail?" = SMTP. "Qual mantém cópias no servidor e sincroniza entre dispositivos?" = IMAP.

## 4.3 DNS, IP e rede

- **DNS (Domain Name System):** traduz **nome de domínio** (ex.: transpetro.com.br) em **endereço IP**.
- **IP (Internet Protocol):** endereço **numérico** do dispositivo na rede (IPv4: 4 grupos; IPv6: mais).
- **Wi-Fi:** rede sem fio (Wi-Fi 5/6...).
- **Bluetooth:** curto alcance (periféricos).
- **Rede local (LAN) × WAN:** LAN = local (escritório); WAN = extensa (internet).
- **Modem/router:** conecta a rede local à internet; roteia tráfego.

# 5. Segurança da Informação

## 5.1 Ameaças (decore o nome + o que faz)

| Ameaça | O que faz |
|---|---|
| **Phishing** | e-mail/mensagem **falsa** fingindo ser confiável, pede dados/clica (roubo de credenciais) |
| **Spear phishing** | phishing **direcionado** a pessoa/organização específica |
| **Ransomware** | malware que **sequestra (criptografa) arquivos** e cobra resgate |
| **Spyware** | espiona **secretamente** (coleta hábitos, dados) |
| **Keylogger** | registra **teclas digitadas** (senhas) |
| **Trojan (cavalo de Tróia)** | software **finge** ser legítimo e abre porta para invasão |
| **Vírus** | código malicioso que **se replica** e danifica/infecta |
| **Worm (verme)** | replica-se **sozinho** pela rede (sem interação do usuário) |
| **Adware** | exibe **propagandas** indesejadas |
| **Hoax** | **falso alarme** (mensagem de "virus" que não é) |
| **Spoofing** | **finge ser** outra identidade (e-mail/IP/site) |
| **Engenharia social** | **manipula pessoas** para obter informação (a mais comum!) |

## 5.2 Defesas

- **Antivírus/antimalware:** detecta e remove malware (mantém **assinaturas atualizadas**).
- **Firewall:** **filtro** de tráfego entre rede e internet (bloqueia entradas não autorizadas).
- **Criptografia:** **codifica** dados (legíveis só com a chave) — em repouso, em trânsito (HTTPS) e no disco.
- **Autenticação:** prova de identidade — **senha** (frase de senha forte), **2FA/MFA** (senha + token/aplicativo/SMS/código), **biometria** (digital, rosto).
- **Certificado digital:** documento **eletrônico** que **identifica** a pessoa/empresa (ICP-Brasil) — permite **assinatura digital** e **acesso seguro** (gov.br).
- **Backup:** **cópia de segurança** dos dados (restaura em caso de perda/ransomware).
- **Atualizações (patch):** corrigem **vulnerabilidades** (portas de entrada de ataques).
- **Controle de acesso:** mínimo privilégio (cada um só o que precisa).

## 5.3 Boas práticas (a banca adora)

- **Senha forte:** longa, com maiúsculas/minúsculas/números/símbolos; **não reutilizar** a mesma senha; trocar periodicamente (política organizacional).
- **2FA** sempre que disponível.
- **Não clicar** em links/anexos de origem desconhecida (phishing).
- **Bloquear a tela** (Win+L) ao sair.
- **Usar Wi-Fi confiável** (evitar Wi-Fi público para dados sensíveis; VPN se necessário).
- **Backup regular** (3-2-1: 3 cópias, 2 mídias, 1 fora do local).
- **Atualizar** SO e apps.
- **Desconfiar** de urgência/ameaça em e-mail (engenharia social).

> [BANCA] A Cesgranrio pergunta "qual a melhor prática para evitar X": phishing = **não clicar + 2FA + educação**; ransomware = **backup + antivírus + atualizações**; engenharia social = **treinamento/educação**. E "o que é certificado digital" = **identificação eletrônica** (ICP-Brasil).

# 6. LGPD — Lei nº 13.709/2018

## 6.1 O que é e por que importa

**LGPD (Lei Geral de Proteção de Dados Pessoais):** regula o **tratamento de dados pessoais** (de **titular** identificado ou identificável) no Brasil — vale para **pessoa jurídica de direito público e privado**, **física** inclusive. A Transpetro trata dados de **funcionários, fornecedores, clientes** — e precisa de **DPO**.

**Conceitos-chave (art. 5º, 6º, 12):**
- **Dado pessoal:** informação sobre **pessoa natural** identificada/identificável (nome, CPF, e-mail, geolocalização, dados de saúde).
- **Dado sensível:** origem racial, crença religiosa, opinião política, saúde, vida sexual, dados biométricos/genéticos — proteção **maior**.
- **Titular:** a **pessoa** a quem o dado se refere.
- **Controlador:** quem toma as **decisões** sobre o tratamento (a **empresa**).
- **Operador:** quem **executa** o tratamento em nome do controlador (terceiro prestador).
- **DPO (Encarregado):** pessoa designada para **ponto de contato** entre titulares, autoridade e controlador.
- **Tratamento:** qualquer operação (coleta, armazenamento, uso, compartilhamento, eliminação).

## 6.2 Base legal (art. 7º)

O tratamento **só é lícito** com uma **base legal**:
- **Consentimento** do titular (livre, informado e inequívoco).
- Cumprimento de **obrigação legal ou regulatória**.
- Execução de **política pública**.
- **Pesquisa** (com salvaguardas).
- **Exercício regular de direitos** (judiciais).
- **Crédito** (análise de crédito).
- **Segurança do titular** (saúde/emergência).
- **Interesse legítimo** do controlador.

> [ATENÇÃO] A Cesgranrio pergunta "qual a base legal para tratar dado de saúde sem consentimento" = **segurança do titular (saúde)** ou **obrigação legal**. "Para analisar crédito" = **crédito**. Decore os 8.

## 6.3 Direitos do titular (art. 18)

O titular pode:
- **Confirmação** da existência de tratamento.
- **Acesso** aos dados.
- **Correção** de dados incompletos/inexatos.
- **Anonimização, bloqueio ou eliminação** (com exceções legais).
- **Portabilidade** (transferência a outro fornecedor).
- **Eliminação** dos dados tratados com consentimento.
- **Informação** sobre compartilhamento com terceiros.
- **Revogação do consentimento** (a qualquer tempo).
- **Informação sobre a não prestação de consentimento** (consequências).
- **Revisão de decisões automatizadas** (incluindo as que afetam interesses).

## 6.4 Princípios (art. 6º)

**Finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação, accountability.**

> [DICA] "Qual princípio exige tratar dados **só para a finalidade** informada?" = **finalidade**. "Qual exige **transparência** (informar como os dados serão usados)?" = **transparência**.

## 6.5 ANPD e sanções

- **ANPD (Autoridade Nacional de Proteção de Dados):** **regula e fiscaliza** a LGPD (criada em 2020, autônoma).
- **Sanções (art. 52):** advertência, **multa** (até **2% do faturamento** no Brasil, limitada a **R$ 50 milhões por infração**), **publicização**, bloqueio/eliminação dos dados, **proibição** (total ou parcial) das atividades.

> [BANCA] A Cesgranrio cobra: (1) **dado pessoal × sensível** (exemplos); (2) **controlador × operador × titular × DPO**; (3) **base legal** (consentimento × obrigação legal × segurança); (4) **direitos** (acesso, eliminação, portabilidade, revogação); (5) **ANPD** (quem fiscaliza) + **multa 2%**; (6) **LGPD vale para empresa privada E pública**.

# 7. Bloco de Questões (Q1–Q40)

::q
**Q1.** (ESTILO CESGRANRIO) A **RAM** é uma memória:
a) permanente, que mantém dados sem energia. b) volátil, onde os dados ficam em uso. c) de armazenamento em nuvem. d) de vídeo. e) interna do processador.
**GABARITO: B** — RAM é volátil (perde ao desligar).
::/q

::q
**Q2.** (ESTILO CESGRANRIO) Onde ficam armazenados os dados **quando o computador é desligado**?
a) RAM. b) CPU. c) HD/SSD. d) GPU. e) Cache.
**GABARITO: C** — HD/SSD = não volátil.
::/q

::q
**Q3.** (ESTILO CESGRANRIO) O **processador (CPU)** é responsável por:
a) armazenar arquivos. b) executar as instruções dos programas. c) exibir imagens. d) imprimir. e) conectar à rede.
**GABARITO: B** — CPU executa instruções.
::/q

::q
**Q4.** (ESTILO CESGRANRIO) A velocidade do processador é medida em:
a) GB. b) GHz. c) Gbps. d) lux. e) bits.
**GABARITO: B** — GHz = bilhões de ciclos/s.
::/q

::q
**Q5.** (ESTILO CESGRANRIO) O **SaaS** (Software as a Service) é um modelo de nuvem em que o usuário acessa:
a) infraestrutura virtual. b) software pronto na nuvem. c) plataforma de desenvolvimento. d) dados brutos. e) servidor físico.
**GABARITO: B** — SaaS = software pronto (Office 365, Gmail).
::/q

::q
**Q6.** (ESTILO CESGRANRIO) **Ctrl+Shift+Esc** abre o:
a) Explorador. b) Configurações. c) Gerenciador de Tarefas. d) Menu Iniciar. e) Prompt.
**GABARITO: C** — Gerenciador de Tarefas.
::/q

::q
**Q7.** (ESTILO CESGRANRIO) **Win+E** abre o:
a) Configurações. b) Explorador de Arquivos. c) Menu Iniciar. d) Bloco de Notas. e) Navegador.
**GABARITO: B** — Win+E = Explorador.
::/q

::q
**Q8.** (ESTILO CESGRANRIO) O atalho para **bloquear o PC** é:
a) Win+D. b) Win+E. c) Win+L. d) Win+I. e) Alt+F4.
**GABARITO: C** — Win+L = bloquear.
::/q

::q
**Q9.** (ESTILO CESGRANRIO) **Alt+Tab** serve para:
a) selecionar tudo. b) alternar entre janelas abertas. c) imprimir. d) salvar. e) copiar.
**GABARITO: B** — Alt+Tab = alternar janelas.
::/q

::q
**Q10.** (ESTILO CESGRANRIO) **Ctrl+B / Ctrl+I / Ctrl+U** aplicam, respectivamente:
a) sublinhado, itálico, negrito. b) negrito, itálico, sublinhado. c) itálico, negrito, sublinhado. d) negrito, sublinhado, itálico. e) sublinhado, negrito, itálico.
**GABARITO: B** — B=negrito, I=itálico, U=sublinhado.
::/q

::q
**Q11.** (ESTILO CESGRANRIO) A **mala direta** no Word serve para:
a) criar sumário automático. b) gerar vários documentos personalizados a partir de um modelo + lista de destinatários. c) revisar ortografia. d) criar tabelas. e) inserir imagens.
**GABARITO: B** — Mail merge = documento em lote.
::/q

::q
**Q12.** (ESTILO CESGRANRIO) O **sumário automático** do Word é gerado a partir de:
a) notas de rodapé. b) estilos de título. c) cabeçalhos. d) comentários. e) marca-d'água.
**GABARITO: B** — Sumário = estilos de título.
::/q

::q
**Q13.** (ESTILO CESGRANRIO) Em Excel, a célula onde está a interseção da **coluna B** e **linha 3** é:
a) 3B. b) B3. c) B-3. d) linha 3. e) planilha 3.
**GABARITO: B** — Célula = coluna + linha (B3).
::/q

::q
**Q14.** (ESTILO CESGRANRIO) A referência **$A$1** (absoluta) significa que, ao arrastar a fórmula:
a) a referência muda. b) a referência fica travada (não muda). c) a referência some. d) a planilha é criada. e) o valor é duplicado.
**GABARITO: B** — $ = trava (absoluta).
::/q

::q
**Q15.** (ESTILO CESGRANRIO) `=SE(B2>10;"APROVADO";"REPROVADO")` retorna "APROVADO" quando:
a) B2 for menor que 10. b) B2 for maior que 10. c) B2 for igual a 10. d) B2 for texto. e) B2 for vazio.
**GABARITO: B** — SE: condição verdadeira → primeiro valor.
::/q

::q
**Q16.** (ESTILO CESGRANRIO) A função **PROCV** (VLOOKUP) em Excel faz:
a) soma horizontal. b) procura **vertical** (retorna valor da coluna correspondente). c) contagem. d) média. e) gráfico.
**GABARITO: B** — PROCV = procura vertical.
::/q

::q
**Q17.** (ESTILO CESGRANRIO) No PowerPoint, cada "tela" de apresentação é um:
a) slide. b) quadro. c) parágrafo. d) layout. e) cabeçalho.
**GABARITO: A** — Slide = tela de apresentação.
::/q

::q
**Q18.** (ESTILO CESGRANRIO) O **OneDrive** é:
a) um antivírus. b) armazenamento na nuvem sincronizado com a conta Microsoft. c) um navegador. d) um editor de vídeo. e) um firewall.
**GABARITO: B** — OneDrive = nuvem Microsoft.
::/q

::q
**Q19.** (ESTILO CESGRANRIO) No Outlook, uma **regra** serve para:
a) imprimir e-mails. b) filtrar/organizar mensagens automaticamente. c) criar anexos. d) apagar o servidor. e) trocar a senha.
**GABARITO: B** — Regras = filtro automático.
::/q

::q
**Q20.** (ESTILO CESGRANRIO) O **HTTPS** difere do HTTP porque:
a) é mais lento. b) é criptografado (seguro). c) não usa navegador. d) é offline. e) usa outro DNS.
**GABARITO: B** — HTTPS = HTTP criptografado.
::/q

::q
**Q21.** (ESTILO CESGRANRIO) Um **cookie** é:
a) um vírus. b) pequenos dados do site salvos no navegador. c) um e-mail. d) uma senha. e) um download.
**GABARITO: B** — Cookie = dados do site no navegador.
::/q

::q
**Q22.** (ESTILO CESGRANRIO) O protocolo que **envia** e-mail é o:
a) POP3. b) IMAP. c) SMTP. d) FTP. e) DNS.
**GABARITO: C** — SMTP = envia.
::/q

::q
**Q23.** (ESTILO CESGRANRIO) O protocolo que **sincroniza** e-mails com o servidor (mantém cópias) é o:
a) SMTP. b) POP3. c) IMAP. d) HTTP. e) FTP.
**GABARITO: C** — IMAP = sincroniza (fica no servidor).
::/q

::q
**Q24.** (ESTILO CESGRANRIO) O **DNS** serve para:
a) enviar e-mail. b) traduzir nome de domínio em endereço IP. c) criptografar dados. d) imprimir. e) fazer backup.
**GABARITO: B** — DNS = nome → IP.
::/q

::q
**Q25.** (ESTILO CESGRANRIO) Uma **intranet** é:
a) a internet pública. b) rede privada interna da organização. c) um e-mail. d) um site. e) um firewall.
**GABARITO: B** — Intranet = rede interna.
::/q

::q
**Q26.** (ESTILO CESGRANRIO) Um e-mail **falso**, fingindo ser de banco, pedindo sua senha, é:
a) spam. b) phishing. c) hoax. d) worm. e) adware.
**GABARITO: B** — Phishing = fraude por e-mail.
::/q

::q
**Q27.** (ESTILO CESGRANRIO) O malware que **criptografa seus arquivos** e cobra **resgate** é o:
a) spyware. b) keylogger. c) ransomware. d) trojan. e) worm.
**GABARITO: C** — Ransomware = sequestro de dados.
::/q

::q
**Q28.** (ESTILO CESGRANRIO) O malware que **registra teclas digitadas** (rouba senhas) é o:
a) ransomware. b) keylogger. c) adware. d) trojan. e) worm.
**GABARITO: B** — Keylogger = registra teclas.
::/q

::q
**Q29.** (ESTILO CESGRANRIO) O **firewall** é:
a) um antivírus. b) filtro de tráfego de rede. c) um backup. d) uma senha. e) um e-mail.
**GABARITO: B** — Firewall = filtro de rede.
::/q

::q
**Q30.** (ESTILO CESGRANRIO) A **2FA (duas etapas)** adiciona à senha:
a) outra senha. b) um segundo fator (token/aplicativo/SMS/biometria). c) um e-mail. d) um backup. e) um firewall.
**GABARITO: B** — 2FA = segundo fator.
::/q

::q
**Q31.** (ESTILO CESGRANRIO) O **certificado digital** (ICP-Brasil) serve para:
a) fazer backup. b) identificar eletronicamente a pessoa/empresa (assinatura digital). c) criar e-mail. d) instalar antivírus. e) navegar anônimo.
**GABARITO: B** — Certificado = identificação eletrônica.
::/q

::q
**Q32.** (ESTILO CESGRANRIO) O ataque que **manipula pessoas** para obter informações (o mais comum) é:
a) ransomware. b) engenharia social. c) worm. d) DDoS. e) spoofing.
**GABARITO: B** — Engenharia social = manipulação humana.
::/q

::q
**Q33.** (ESTILO CESGRANRIO) A **LGPD (Lei 13.709/2018)** regula o tratamento de:
a) apenas dados de empresas. b) dados pessoais de pessoas naturais. c) apenas dados de saúde. d) apenas dados financeiros. e) dados públicos.
**GABARITO: B** — LGPD = dados pessoais (pessoa natural).
::/q

::q
**Q34.** (ESTILO CESGRANRIO) Dado **sensível** (LGPD) inclui:
a) nome. b) e-mail. c) dados de saúde. d) endereço. e) idade.
**GABARITO: C** — Saúde = sensível (proteção maior).
::/q

::q
**Q35.** (ESTILO CESGRANRIO) Na LGPD, quem toma as **decisões** sobre o tratamento dos dados é o:
a) titular. b) operador. c) controlador. d) DPO. e) ANPD.
**GABARITO: C** — Controlador = decide.
::/q

::q
**Q36.** (ESTILO CESGRANRIO) Na LGPD, quem **executa** o tratamento em nome do controlador é o:
a) titular. b) controlador. c) operador. d) DPO. e) ANPD.
**GABARITO: C** — Operador = executa.
::/q

::q
**Q37.** (ESTILO CESGRANRIO) O **DPO (Encarregado)** na LGPD é:
a) o fiscal da ANPD. b) o ponto de contato entre titulares, autoridade e controlador. c) o controlador. d) o operador. e) o titular.
**GABARITO: B** — DPO = ponto de contato.
::/q

::q
**Q38.** (ESTILO CESGRANRIO) A autoridade que **fiscaliza** a LGPD é a:
a) ANATEL. b) ANPD. c) ANAC. d) ANTT. e) CVM.
**GABARITO: B** — ANPD = Autoridade Nacional de Proteção de Dados.
::/q

::q
**Q39.** (ESTILO CESGRANRIO) A multa máxima da LGPD é:
a) R$ 10 mil. b) 2% do faturamento (limite R$ 50 mi por infração). c) 50% do faturamento. d) R$ 1 mi fixo. e) apenas advertência.
**GABARITO: B** — Multa 2% (limite R$ 50 mi).
::/q

::q
**Q40.** (ESTILO CESGRANRIO) Um dos **direitos do titular** na LGPD é:
a) vender os dados a terceiros. b) acesso aos dados e eliminação (quando aplicável). c) criar conta. d) pagar multa. e) definir o DPO.
**GABARITO: B** — Titular pode acessar e eliminar dados.
::/q

# 8. Fechamento do Bloco 4

> [RESUMO] Este volume cobriu o Bloco 4: fundamentos (hardware, CPU, RAM, SaaS), Windows 11 (interface, atalhos, arquivos), Office 2024 (Word/mala direta/sumário, Excel/PROCV/referências, Outlook/OneDrive), internet/intranet (protocolos de e-mail, DNS, cookies), segurança (ameaças, defesas, boas práticas, certificado digital) e **LGPD** (conceitos, base legal, direitos, ANPD, multa 2%).
>
> [ESTRATEGIA] As **certas** de informática que mais caem: RAM volátil × HD; atalhos (Ctrl+C/X/V, Alt+Tab, Win+E/L, Ctrl+Shift+Esc); **SMTP envia, IMAP sincroniza, POP3 baixa**; PROCV = vertical; $ = absoluta. Segurança: **phishing, ransomware, keylogger, engenharia social** (nome + o que faz); 2FA; certificado digital. LGPD: **controlador decide, operador executa, DPO é o contato, ANPD fiscaliza, multa 2%**; dado sensível = saúde/biométrico; direitos = acesso/eliminação/portabilidade/revogação.
