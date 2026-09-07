# Refresh Windows trusted root certificates into a PEM bundle.
# PHP on Windows often ships with openssl.cafile empty, which makes ssl:// connections
# fail silently (false, errno=0, errstr empty). Mailer.php consumes this bundle.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File api/config/cert/refresh-cacert.ps1
#   powershell -ExecutionPolicy Bypass -File api/config/cert/refresh-cacert.ps1 -OutFile D:\path\to\cacert.pem
param(
  [string]$OutFile = (Join-Path $PSScriptRoot 'cacert.pem')
)

$sb = New-Object System.Text.StringBuilder
$seen = @{}
$count = 0

foreach ($storePath in @('Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root')) {
  $certs = Get-ChildItem $storePath -ErrorAction SilentlyContinue
  foreach ($c in $certs) {
    if ($seen.ContainsKey($c.Thumbprint)) { continue }
    $seen[$c.Thumbprint] = $true
    [void]$sb.AppendLine('-----BEGIN CERTIFICATE-----')
    [void]$sb.AppendLine([Convert]::ToBase64String($c.RawData, [System.Base64FormattingOptions]::InsertLineBreaks))
    [void]$sb.AppendLine('-----END CERTIFICATE-----')
    $count++
  }
}

if ($count -eq 0) {
  Write-Error 'No root certificate found, abort (file left untouched).'
  exit 1
}

$dir = Split-Path -Parent $OutFile
if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutFile, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
$size = (Get-Item $OutFile).Length
Write-Output "Exported $count root certificates, $size bytes -> $OutFile"
