param(
  [ValidateSet('prepare','check-tls','selftest','export','restore','restore-data')][string]$Mode='prepare',
  [string]$ConfigPath,
  [string]$RunPath,
  [string]$AuthorizedProject,
  [switch]$AuthorizedLocalRestore
)
$ErrorActionPreference='Stop'
$taskNode='C:/Users/PLBR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskScript=Join-Path $PSScriptRoot 'production-backup.mjs'
if($Mode -eq 'prepare' -or $Mode -eq 'selftest') { & $taskNode $taskScript $Mode; exit $LASTEXITCODE }
if($Mode -eq 'check-tls') { & $taskNode $taskScript $Mode --config $ConfigPath; exit $LASTEXITCODE }
if($Mode -eq 'export' -and $AuthorizedProject -ne 'wohimauqgywshbbejjcl') { throw 'specific_production_export_authorization_required' }
if($Mode -in @('restore','restore-data') -and -not $AuthorizedLocalRestore) { throw 'specific_local_restore_authorization_required' }
function Reveal-InMemory([Security.SecureString]$Value) {
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
# No secret in command arguments, environment files, transcript or Git.
$phrase=Read-Host 'Senha de criptografia do backup (20+ caracteres; guarde fora deste computador)' -AsSecureString
$secret=@{passphrase=(Reveal-InMemory $phrase)}
if($Mode -eq 'export') {
  $password=Read-Host 'Senha EXISTENTE do banco; nao redefina a senha de producao' -AsSecureString
  $secret.password=Reveal-InMemory $password
}
$taskArguments=@($taskScript,$Mode)
if($ConfigPath) {$taskArguments+=@('--config',$ConfigPath)}
if($RunPath) {$taskArguments+=@('--run',$RunPath)}
if($AuthorizedProject) {$taskArguments+=@('--authorized-project',$AuthorizedProject)}
if($AuthorizedLocalRestore) {$taskArguments+='--authorized-local-restore'}
try { ($secret | ConvertTo-Json -Compress) | & $taskNode @taskArguments; $taskExit=$LASTEXITCODE }
finally { $secret.Clear(); $phrase.Dispose(); if($password){$password.Dispose()} }
exit $taskExit
