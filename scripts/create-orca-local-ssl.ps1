$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $root 'docker\certs'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  throw 'mkcert no está instalado. Instálalo con: winget install FiloSottile.mkcert'
}
mkcert -install
mkcert -cert-file (Join-Path $certDir 'orca.dev.pem') -key-file (Join-Path $certDir 'orca.dev-key.pem') orca.dev hermes.dev getupsoft.orca.dev galantesjewelry.orca.dev localhost 127.0.0.1 ::1
Write-Output 'SSL local creado y CA instalada.'
