# Configuração da assinatura permanente

O workflow só publica atualizações se os quatro GitHub Actions secrets estiverem configurados. Sem eles, compila um APK de teste e não publica release. O repositório é público: jamais coloque a chave, senhas ou arquivo de backup no Git, no release ou no chat.

No Windows, instale Java JDK 17 e GitHub CLI de fontes oficiais, execute `gh auth login` como o proprietário do repositório e execute o arquivo PowerShell `configurar-chave.ps1` no próprio computador. O script cria uma chave nova, faz backup local e salva os quatro secrets no repositório. Faça outro backup privado seguro da pasta criada e restrinja seu acesso; a senha no arquivo de backup dá acesso à chave. O script recusa sobrescrever secrets ou backup existentes.

Depois, reexecute o workflow do Android na branch android-web-remote-build. Um build assinado bem-sucedido publica o APK de atualização na release `android-web-remote-latest`; ela é pública porque o repositório é público. Instale pela primeira vez o APK assinado. Se houver conflito com o APK de teste anterior, desinstale-o antes: os dados são apagados. Novos builds usam o mesmo certificado. O aplicativo consulta a release ao ser aberto; baixa o APK, compara package, versão, hash e certificado com o instalado e oferece a instalação. Android requer autorização do usuário e pode solicitar permissão para instalar apps desconhecidos.

A verificação e o instalador ainda requerem testes reais no aparelho. O build de depuração não é compatível com futuras versões assinadas. Não configure este mecanismo em produção antes de revisar segurança e testar o circuito completo. GitHub e suas políticas de rate limit e acesso podem afetar o funcionamento.
