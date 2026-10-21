# Existing encrypted archive -> owned loopback cluster only. Never exports production.
param([Parameter(Mandatory=$true)][string]$RunPath)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$taskPrivateRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AgendePrivateRecovery'))
$taskArchive=(Resolve-Path -LiteralPath $RunPath).Path
if(-not $taskArchive.StartsWith($taskPrivateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'private_archive_required'}
if(-not (Test-Path -LiteralPath (Join-Path $taskArchive 'manifest.json'))){throw 'manifest_required'}
$taskStatus=Join-Path $PSScriptRoot '../docs/production-readiness/p0-isolated-restore-status.json'
function Status([string]$Stage,[bool]$Passed=$false){
  [IO.File]::WriteAllText($taskStatus,(@{checked_at=[DateTime]::UtcNow.ToString('o');stage=$Stage;passed=$Passed;scope='existing encrypted archive; owned local PostgreSQL only';production_connections=0;production_writes=0;secrets_in_report=$false}|ConvertTo-Json))
}
Status 'waiting_for_hidden_passphrase'
Write-Host 'Ensaio ISOLADO de backup existente. Nao conecta nem restaura producao.'
Write-Host 'Digite a senha somente no campo oculto abaixo. Ela nao sera gravada.'
$taskNode='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskRunner=Join-Path $PSScriptRoot 'production-backup.mjs'
$taskRetry=Join-Path $taskArchive 'retry-isolated-restore.signal'
$taskArgs=@($taskRunner,'restore','--authorized-local-restore','--run',$taskArchive)
$taskPhrase=Read-Host 'Senha de criptografia do backup (oculta)' -AsSecureString
$taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPhrase)
$taskSecret=@{}
try{
  $taskSecret.passphrase=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)
  for($taskAttempt=1;$taskAttempt -le 4;$taskAttempt++){
    Status 'local_restore_running'
    $taskResult=($taskSecret|ConvertTo-Json -Compress) | & $taskNode @taskArgs
    if($LASTEXITCODE -eq 0){
      $taskEvidence=$taskResult|ConvertFrom-Json
      if(-not $taskEvidence.passed){throw 'verification_missing'}
      Copy-Item -LiteralPath (Join-Path $taskArchive 'restore-evidence.json') -Destination (Join-Path $PSScriptRoot '../docs/production-readiness/p0-isolated-restore-evidence.json')
      Status 'complete' $true
      Write-Host 'Ensaio core concluido. Storage/plataforma completa ainda exigem validacao propria.'
      break
    }
    Status 'verification_failed_awaiting_local_retry'
    Write-Host 'Verificacao falhou; aguardando correcao local por ate 10 minutos. Senha permanece somente em memoria desta janela.'
    $taskDeadline=[DateTime]::UtcNow.AddMinutes(10)
    while(-not (Test-Path -LiteralPath $taskRetry) -and [DateTime]::UtcNow -lt $taskDeadline){Start-Sleep -Milliseconds 500}
    if(-not (Test-Path -LiteralPath $taskRetry)){break}
    Remove-Item -LiteralPath $taskRetry
  }
  if(-not $taskEvidence -or -not $taskEvidence.passed){Status 'verification_failed_session_closed'}
}finally{
  $taskSecret.Clear()
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
  $taskPhrase.Dispose()
}
Read-Host 'Pressione Enter para fechar'
