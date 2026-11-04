# Android Web Remote — versão experimental 0.1

## Situação

Este projeto é uma implementação inicial para testes em rede local. Não foi compilado ou executado em Android neste ambiente: não havia Android SDK, Gradle ou aparelho disponíveis. Não há APK e não há garantia de compilação ou funcionamento. **Não é a versão completa solicitada.**

O código implementa, de forma ainda não validada em aparelho:

- interface Android em Kotlin/Compose, servidor HTTP integrado NanoHTTPD e interface web;
- permissão de captura do Android, serviço em primeiro plano com notificação e botão para encerrar;
- captura por MediaProjection/ImageReader e exibição de quadros JPEG por polling;
- pareamento com código aleatório temporário, aprovação explícita no aparelho, sessão única, token aleatório, limite de tentativas e expiração;
- ações de voltar, início e recentes, gestos e substituição de texto em campo acessível;
- encerramento da captura quando a projeção termina.

## Aviso de segurança: leia antes de usar

O HTTP não é criptografado. Qualquer pessoa capaz de interceptar o tráfego pode ler o código, token, imagens da tela e comandos. Use somente em uma rede local privada confiável. Não exponha a porta 8080 à internet e não coloque este protótipo atrás de túnel público. A implementação não passou por auditoria de segurança; não a use com dados bancários, documentos sensíveis ou em dispositivo de produção. A autenticação não substitui criptografia. A proteção de origem reduz ataques via navegador, mas não protege contra invasores com acesso à rede. É possível que o app exiba informações privadas na captura. Algumas janelas protegidas por FLAG_SECURE não são capturáveis.

## Como tentar compilar

1. Instale Android Studio, JDK 17 e o Android SDK Platform 35, com acesso aos repositórios Google e Maven Central.
2. Abra a pasta `AndroidWebRemote` no Android Studio e aceite a sincronização do Gradle. O projeto utiliza Android Gradle Plugin 8.7.3; para executar o Gradle fora do Android Studio, use Gradle 8.9. Não inclui Gradle wrapper nem suas verificações de integridade: gere-o ou configure-o por uma instalação confiável de Gradle.
3. Sincronize e execute **Build > Build APK(s)**. Resolva eventuais erros de dependência, SDK e compilação, pois a compilação não foi verificada aqui.
4. Instale o APK de depuração somente no aparelho pessoal e de teste. Se o Android bloquear a instalação fora da loja, autorize a fonte apenas se confiar nela.

## Teste pretendido

1. Conecte celular e computador à mesma rede privada e confiável. Desative o compartilhamento por aplicativo específico e selecione a **tela inteira**, caso o Android ofereça a escolha.
2. Abra o aplicativo e ative o serviço em **Ativar acessibilidade** nas configurações do Android. Retorne ao app.
3. Toque em **Iniciar compartilhamento** e confirme a tela do próprio Android. Na permissão de notificações, permita quando apropriado nas configurações do aparelho.
4. Abra no navegador o endereço HTTP mostrado no celular. Digite o código. No celular, toque em **Autorizar navegador**. O código expira em cinco minutos e é invalidado após cinco tentativas erradas; para gerar outro, encerre e reinicie a sessão.
5. Toque ou arraste sobre a imagem; os botões acionam navegação. Para texto, selecione primeiro o campo no aparelho, escreva todo o conteúdo na caixa do navegador e envie. A operação substitui o conteúdo e depende do suporte do aplicativo alvo.
6. Toque em **Encerrar sessão** no celular ou na notificação para parar. Encerrar pelo navegador revoga a sessão e gera um novo código, mas mantém a captura e o serviço ativos até serem encerrados no celular.

A interface de acessibilidade deve ser desativada nas configurações do Android quando não estiver em uso. A notificação e a interface não fazem persistência oculta nem reinício automático.

## Limitações e pendências importantes

- Sem acesso pela internet, túnel HTTPS, TLS local, WebRTC, H.264, WebSocket, STUN/TURN, relay ou QR Code.
- JPEG tem maior latência e consumo do que vídeo; o limite pretendido é aproximadamente 5 quadros/s, sem medição real. Não há escolha de resolução, FPS, bitrate, bateria ou indicadores de desempenho.
- A rotação não é tratada: reinicie o compartilhamento após mudar a orientação. A captura de uma única janela e mudanças de tamanho não são suportadas; selecione tela inteira.
- Gestos e coordenadas não foram verificados em celulares com recortes, barras, escala, rotação ou diferentes fabricantes. Gestos contínuos precisos, rolagem com roda, combinações de teclado e copiar/colar não foram implementados. O texto usa ACTION_SET_TEXT, não um teclado virtual, e pode falhar ou substituir o campo inteiro.
- Sem lista persistente de dispositivos, revogação individual, reconexão automática nem persistência de sessões.
- O IP exibido escolhe o primeiro endereço IPv4 privado e pode não corresponder à interface desejada. Redes que isolam clientes podem impedir a conexão.
- O serviço e a captura estão acoplados: ao iniciar o servidor, o usuário também autoriza a projeção. A compressão só ocorre após aprovação; o consumo e o tratamento de recursos precisam de testes no aparelho.
- O comportamento com suspensão, bloqueio da tela e otimizações de bateria da Xiaomi/POCO/HyperOS não foi testado. Não desative proteções de bateria até avaliar a necessidade real em seu aparelho.
- Não há testes instrumentados, teste com navegadores, auditoria, medição de desempenho nem confirmação de funcionamento no Android 13–16. A versão mínima declarada é Android 8, mas nenhuma versão foi testada.

## Trabalho necessário para a versão final

Implementar transporte de vídeo com WebRTC e codec negociado, servidor de sinalização e TURN quando necessário, resize da projeção e interface adaptativa, TLS autenticado mesmo na rede local, aprovação identificável de cada dispositivo, limites de requisições e revisão independente de segurança. Para internet, projetar relay ou túnel Android compatível, com serviço externo e política de operação. Testar em dispositivos e navegadores reais antes de instalar fora de um ambiente de testes.

## Referências

- Android MediaProjection e consentimento: https://developer.android.com/media/grow/media-projection
- Restrições do Android 14 e redimensionamento: https://developer.android.com/about/versions/14/behavior-changes-14
- AccessibilityService: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- Cloudflare Tunnel e plataformas disponíveis: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/

## Compilar pelo GitHub Actions

O projeto inclui `.github/workflows/android.yml`. Ao enviar os arquivos para a raiz de um repositório no GitHub, o envio à branch `main` inicia a compilação; também é possível iniciá-la manualmente na aba Actions. Se o build terminar com sucesso, baixe o artefato `android-web-remote-debug` na página da execução. O arquivo contém um APK de depuração. A execução e a instalação ainda não foram testadas; eventuais erros devem ser corrigidos a partir do log antes de considerar o APK disponível.
