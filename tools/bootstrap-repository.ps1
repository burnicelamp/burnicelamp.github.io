[CmdletBinding()]
param(
  [string]$Target = (Join-Path (Split-Path $PSScriptRoot -Parent) '..\burnicelamp-repo')
)

$ErrorActionPreference = 'Stop'
$repository = 'https://github.com/burnicelamp/burnicelamp.github.io.git'
$targetPath = [IO.Path]::GetFullPath($Target)

if (Test-Path -LiteralPath $targetPath) {
  $existing = @(Get-ChildItem -LiteralPath $targetPath -Force)
  if ($existing.Count -gt 0) {
    throw "Target must be absent or empty: $targetPath"
  }
} else {
  New-Item -ItemType Directory -Path $targetPath | Out-Null
}

Write-Host "Cloning $repository"
Write-Host "Target: $targetPath"
& git -c http.sslBackend=openssl clone --branch main --single-branch $repository $targetPath
if ($LASTEXITCODE -ne 0) {
  throw 'Clone failed. The target directory was preserved for diagnosis.'
}

& git -C $targetPath config http.sslBackend openssl
& git -C $targetPath fetch origin main
if ($LASTEXITCODE -ne 0) {
  throw 'Clone completed, but the verification fetch failed.'
}

$head = (& git -C $targetPath rev-parse HEAD).Trim()
$remote = (& git -C $targetPath rev-parse origin/main).Trim()
if ($head -ne $remote) {
  throw "Local HEAD ($head) does not match origin/main ($remote)."
}

Write-Host "Ready: main @ $head"
Write-Host 'Run node tools/preflight.mjs inside the cloned repository before editing.'
