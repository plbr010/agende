# Authorized fresh read-only export + owned local data/Storage recovery, no DDL remote.
param([Parameter(Mandatory=$true)][switch]$AuthorizedProductionBackup)
$ErrorActionPreference='Stop'
if(-not $AuthorizedProductionBackup){throw 'backup_authorization_required'}
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$taskNode='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskRunner=Join-Path $PSScriptRoot 'production-backup.mjs'
$taskStatus=Join-Path $PSScriptRoot '../docs/production-readiness/auth21-backup-status.json'
$taskRoot=Join-Path $env:LOCALAPPDATA 'AgendePrivateRecovery'
function Status([string]$Stage,[bool]$Passed=$false){
 [IO.File]::WriteAllText($taskStatus,(@{checked_at=[DateTime]::UtcNow.ToString('o');stage=$Stage;passed=$Passed;production_writes=0;full_platform_recovery_verified=$false;secrets_in_report=$false}|ConvertTo-Json))
}
function Reveal([Security.SecureString]$Value){
 $taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
 try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)}
}
Write-Host 'Autorizado: NOVO backup cifrado PostgreSQL + Storage, somente leitura, e ensaio local de dados.'
Write-Host 'Nao executa migrations, muda grants, restaura producao ou publica servicos.'
Write-Host 'Guarde a senha de cifragem fora deste computador. Nunca envie senhas no chat.'
Status 'waiting_for_hidden_credentials'
$taskPhrase=Read-Host 'Senha de cifragem do novo backup (20+ caracteres)' -AsSecureString
$taskPassword=Read-Host 'Senha EXISTENTE do banco Supabase de producao (nao redefinir)' -AsSecureString
$taskSecret=@{}
try{
 $taskSecret.passphrase=Reveal $taskPhrase
 $taskSecret.password=Reveal $taskPassword
 Status 'read_only_export_running'
 $taskOutput=($taskSecret|ConvertTo-Json -Compress)|& $taskNode $taskRunner export --authorized-project wohimauqgywshbbejjcl --config (Join-Path $taskRoot 'source.json')
 if($LASTEXITCODE -ne 0){throw 'export_failed'}
 $taskExport=$taskOutput|ConvertFrom-Json
 if(-not $taskExport.export_completed){throw 'export_evidence_missing'}
 $taskSecret.Remove('password')
 [IO.File]::WriteAllText((Join-Path $taskRoot 'auth21-latest-export.json'),($taskExport|ConvertTo-Json))
 $taskRetry=Join-Path $taskExport.private_run 'retry-data-restore.signal'
 for($taskAttempt=1;$taskAttempt -le 4;$taskAttempt++){
  Status 'isolated_data_recovery_running'
  $taskOutput=($taskSecret|ConvertTo-Json -Compress)|& $taskNode $taskRunner restore-data --authorized-local-restore --run $taskExport.private_run
  if($LASTEXITCODE -eq 0){
   $taskEvidence=$taskOutput|ConvertFrom-Json
   if(-not $taskEvidence.passed -or -not $taskEvidence.storage.all_object_bytes_recovered){throw 'data_or_storage_recovery_missing'}
   Copy-Item -LiteralPath (Join-Path $taskExport.private_run 'data-restore-evidence.json') -Destination (Join-Path $PSScriptRoot '../docs/production-readiness/auth21-data-restore-evidence.json')
   Status 'data_and_storage_recovery_complete' $true
   Write-Host 'Dados e bytes Storage recuperados no ensaio local. Permissoes/plataforma completa NAO comprovadas por este modo.'
   break
  }
  Status 'data_recovery_failed_awaiting_local_retry'
  $taskDeadline=[DateTime]::UtcNow.AddMinutes(10)
  while(-not (Test-Path -LiteralPath $taskRetry) -and [DateTime]::UtcNow -lt $taskDeadline){Start-Sleep -Milliseconds 500}
  if(-not (Test-Path -LiteralPath $taskRetry)){break}
  Remove-Item -LiteralPath $taskRetry
 }
}catch{
 Status 'stopped_without_recovery_approval'
 Write-Host 'Operacao afetada interrompida. Arquivos preservados; nenhum segredo ou dado publicado.'
}finally{
 $taskSecret.Clear();$taskPhrase.Dispose();$taskPassword.Dispose()
}
Read-Host 'Pressione Enter para fechar'
