param([Parameter(Mandatory=$true)][string]$RunPath)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AgendePrivateRecovery'))
$taskSource=(Resolve-Path -LiteralPath $RunPath).Path
if(-not $taskSource.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'private_source_required'}
$taskName=Split-Path $taskSource -Leaf
if($taskName -notmatch '^production-[0-9]+$'){throw 'production_archive_required'}
if((Get-Item -LiteralPath $taskSource).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'source_junction_refused'}
$taskEvidence=Get-Content -LiteralPath (Join-Path $taskSource 'data-restore-evidence.json') -Raw|ConvertFrom-Json
if(-not $taskEvidence.passed -or -not $taskEvidence.storage.all_object_bytes_recovered){throw 'verified_data_and_storage_required'}
$taskSourceDisk=(Get-Partition -DriveLetter C).DiskNumber
$taskDestinationDisk=(Get-Partition -DriveLetter D).DiskNumber
if($taskSourceDisk -eq $taskDestinationDisk){throw 'different_physical_disk_required'}
$taskDestination=[IO.Path]::GetFullPath((Join-Path 'D:\AgendePrivateRecovery' $taskName))
if(-not $taskDestination.StartsWith('D:\AgendePrivateRecovery\',[StringComparison]::OrdinalIgnoreCase)){throw 'destination_outside_private_root'}
if((Test-Path -LiteralPath 'D:\AgendePrivateRecovery') -and ((Get-Item -LiteralPath 'D:\AgendePrivateRecovery').Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'destination_junction_refused'}
if(Test-Path -LiteralPath $taskDestination){throw 'never_overwrite_existing_copy'}
[void][IO.Directory]::CreateDirectory($taskDestination)
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskDirectory=[IO.DirectoryInfo]::new($taskDestination)
$taskAcl=[IO.FileSystemAclExtensions]::GetAccessControl($taskDirectory,[Security.AccessControl.AccessControlSections]::Access)
$taskAcl.SetAccessRuleProtection($true,$false)
foreach($taskRule in $taskAcl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier])){$taskAcl.RemoveAccessRuleSpecific($taskRule)}
$taskAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
[IO.FileSystemAclExtensions]::SetAccessControl($taskDirectory,$taskAcl)
$taskCheck=Get-Acl -LiteralPath $taskDestination
if(-not $taskCheck.AreAccessRulesProtected -or @($taskCheck.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object {$_.IdentityReference.Value -ne $taskSid.Value}).Count -ne 0){throw 'private_acl_required'}
$taskManifest=Get-Content -LiteralPath (Join-Path $taskSource 'manifest.json') -Raw|ConvertFrom-Json
$taskEntries=@($taskManifest.files)
foreach($taskEntry in $taskEntries){if($taskEntry.file -notmatch '^(database[.]dump|core[.]dump|roles[.]sql|snapshot[.]json)[.]enc$'){throw 'unexpected_archive_file'}}
$taskFiles=@('manifest.json','data-restore-evidence.json')+@($taskEntries|ForEach-Object {$_.file})
if($taskManifest.storage){
 [void][IO.Directory]::CreateDirectory((Join-Path $taskDestination 'storage'))
 $taskStorageEntries=@($taskManifest.storage.index)+@($taskManifest.storage.objects)
 foreach($taskEntry in $taskStorageEntries){if($taskEntry.file -notmatch '^(index|object-[0-9]{6})[.]enc$'){throw 'unexpected_storage_file'};$taskFiles+=('storage/'+$taskEntry.file)}
}
foreach($taskFile in $taskFiles){
 $taskOriginal=Join-Path $taskSource $taskFile;$taskCopied=Join-Path $taskDestination $taskFile
 Copy-Item -LiteralPath $taskOriginal -Destination $taskCopied
 if((Get-FileHash -LiteralPath $taskOriginal -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $taskCopied -Algorithm SHA256).Hash){throw 'copy_checksum_mismatch'}
}
$taskReport=@{checked_at=[DateTime]::UtcNow.ToString('o');passed=$true;encrypted_files_verified=$true;files_copied=$taskFiles.Count;different_physical_disk=$true;source_disk=$taskSourceDisk;destination_disk=$taskDestinationDisk;private_acl_verified=$true;offsite_copy=$false;production_writes=0}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '../docs/production-readiness/auth21-independent-copy.json'),($taskReport|ConvertTo-Json))
Write-Output ($taskReport|ConvertTo-Json -Compress)
