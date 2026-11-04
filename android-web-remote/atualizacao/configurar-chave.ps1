$ErrorActionPreference = 'Stop'
# Execute apenas no seu computador. Não envie a chave nem o arquivo de backup a outras pessoas.
$repo = 'MegaDev13/gua'
if (!(Get-Command gh -ErrorAction SilentlyContinue) -or !(Get-Command keytool -ErrorAction SilentlyContinue)) { throw 'Instale GitHub CLI e Java JDK (keytool) antes de continuar.' }
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Entre na sua conta pelo GitHub CLI antes de continuar.' }
$secrets = gh secret list --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar os secrets do repositório.' }
if (($secrets -join "`n") -match 'AWR_(KEYSTORE_BASE64|STORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD)') { throw 'Já existe um secret de assinatura. Pare: substituí-lo pode impedir atualizações.' }
$backup = Join-Path $env:USERPROFILE 'AndroidWebRemote-chave-privada'
if (Test-Path $backup) { throw 'A pasta de backup já existe. Não sobrescreva sua chave.' }
New-Item -ItemType Directory -Path $backup | Out-Null
$key = Join-Path $backup 'assinatura.jks'
$pwfile = Join-Path $backup 'senha.txt'
$random = New-Object byte[] 36
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
$password = [Convert]::ToBase64String($random).Replace('+','a').Replace('/','b').Replace('=','c')
$alias = 'androidwebremote'
Set-Content -Path $pwfile -Value $password -NoNewline
& keytool -genkeypair -keystore $key -storetype JKS -storepass $password -keypass $password -alias $alias -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Android Web Remote' -noprompt
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar chave. Guarde a pasta e investigue antes de tentar novamente.' }
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($key))
$encoded | gh secret set AWR_KEYSTORE_BASE64 --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Erro ao enviar chave ao GitHub Actions. Não apague o backup.' }
$password | gh secret set AWR_STORE_PASSWORD --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Erro ao salvar senha. Não apague o backup.' }
$alias | gh secret set AWR_KEY_ALIAS --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Erro ao salvar alias. Não apague o backup.' }
$password | gh secret set AWR_KEY_PASSWORD --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Erro ao salvar senha da chave. Não apague o backup.' }
Write-Host "Secrets configurados. Faça backup privado e seguro da pasta $backup; perder esses arquivos impede atualizações assinadas. Não os compartilhe."
Write-Host 'Depois, execute novamente o workflow no GitHub Actions.'
