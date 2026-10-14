# Interactive entry only; authorization covers export + isolated restore, never DDL.
param([Parameter(Mandatory=$true)][switch]$AuthorizedProductionExportAndLocalRestore)
$ErrorActionPreference='Stop'
if(-not $AuthorizedProductionExportAndLocalRestore){throw 'Explicit authorization required'}
$taskNode='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskRunner=Join-Path $PSScriptRoot 'production-backup.mjs'
$taskStatus=Join-Path $PSScriptRoot '../docs/production-readiness/authorized-backup-status.json'
$taskConfig=Join-Path $env:LOCALAPPDATA 'AgendePrivateRecovery/source.json'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
function Status([string]$Stage,[bool]$Passed=$false){
  @{checked_at=[DateTime]::UtcNow.ToString('o');stage=$Stage;passed=$Passed;authorized=$true;production_writes=0;secrets_in_report=$false} |
    ConvertTo-Json | Set-Content -LiteralPath $taskStatus -Encoding utf8
}
function Reveal([Security.SecureString]$Value){
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
}
Status 'waiting_for_hidden_credentials'
Write-Host 'Autorizado: backup SQL cifrado + restore local. Nenhuma migration sera aplicada.'
Write-Host 'Guarde a senha de cifragem separadamente: ela sera necessaria para recuperar o backup.'
$taskPhrase=Read-Host 'Senha de cifragem (20+ caracteres)' -AsSecureString
while($taskPhrase.Length -lt 20){$taskPhrase.Dispose();Write-Host 'Use pelo menos 20 caracteres.';$taskPhrase=Read-Host 'Senha de cifragem' -AsSecureString}
$taskPassword=Read-Host 'Senha EXISTENTE do banco Supabase de producao (nao redefinir)' -AsSecureString
$taskSecret=@{}
$taskStage='credentials'
$taskSucceeded=$false
try{
  $taskSecret.passphrase=Reveal $taskPhrase
  $taskSecret.password=Reveal $taskPassword
  Status 'export_started'
  $taskStage='export'
  $taskExport=($taskSecret | ConvertTo-Json -Compress) | & $taskNode $taskRunner export --authorized-project wohimauqgywshbbejjcl --config $taskConfig
  if($LASTEXITCODE -ne 0){throw 'Export failed; no restore performed'}
  $taskResult=$taskExport | ConvertFrom-Json
  if(-not $taskResult.export_completed -or -not $taskResult.private_run){throw 'Export evidence missing'}
  $taskSecret.Remove('password')
  Status 'isolated_restore_started'
  $taskStage='restore'
  $taskRestore=($taskSecret | ConvertTo-Json -Compress) | & $taskNode $taskRunner restore --authorized-local-restore --run $taskResult.private_run
  if($LASTEXITCODE -ne 0){throw 'Isolated restore failed'}
  $taskEvidence=$taskRestore | ConvertFrom-Json
  if(-not $taskEvidence.passed){throw 'Restore evidence missing'}
  Copy-Item -LiteralPath (Join-Path $taskResult.private_run 'restore-evidence.json') -Destination (Join-Path $PSScriptRoot '../docs/production-readiness/authorized-restore-evidence.json')
  Status 'complete' $true
  $taskSucceeded=$true
  Write-Host ('Backup cifrado preservado em: '+$taskResult.private_run)
  Write-Host 'Verificacao concluida; nenhuma migration aplicada. Guarde uma segunda copia cifrada em midia autorizada.'
}catch{
  Status ($taskStage+'_failed')
  Write-Host 'Procedimento interrompido. Segredos e dados nao foram incluidos no diagnostico.'
}finally{
  $taskSecret.Clear();$taskPhrase.Dispose();$taskPassword.Dispose()
}
Read-Host 'Pressione Enter para fechar'
if(-not $taskSucceeded){exit 1}
