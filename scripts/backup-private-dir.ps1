param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
$base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AgendePrivateRecovery'))
$target=[IO.Path]::GetFullPath($Path)
if($target -ne $base -and -not $target.StartsWith($base+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'private_path_outside_root' }
[void][IO.Directory]::CreateDirectory($target)
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$directory=[IO.DirectoryInfo]::new($target)
$acl=[IO.FileSystemAclExtensions]::GetAccessControl($directory,[Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true,$false)
foreach($existing in $acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier])) {$acl.RemoveAccessRuleSpecific($existing)}
$rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule)
[IO.FileSystemAclExtensions]::SetAccessControl($directory,$acl)
$check=Get-Acl -LiteralPath $target
if(-not $check.AreAccessRulesProtected -or @($check.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -ne $sid.Value}).Count -ne 0) { throw 'private_acl_verification_failed' }
