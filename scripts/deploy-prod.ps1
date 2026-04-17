param(
    [string]$EnvFile = ".env.prod",
    [string]$ComposeFile = "docker-compose.production.yml"
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

function Get-EnvMap([string]$path) {
    $map = @{}
    Get-Content -Path $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $k = $line.Substring(0, $idx).Trim()
        $v = $line.Substring($idx + 1)
        $map[$k] = $v
    }
    return $map
}

function Test-Placeholder([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return $true }
    if ($value.StartsWith("your_") -or $value.StartsWith("change_me") -or $value.StartsWith("generate_with_") -or $value.StartsWith("test_") -or $value.Contains("replace_me")) {
        return $true
    }
    return $false
}

if (-not (Test-Path $EnvFile)) {
    Write-Err "$EnvFile no existe"
    exit 1
}
if (-not (Test-Path $ComposeFile)) {
    Write-Err "$ComposeFile no existe"
    exit 1
}

$envMap = Get-EnvMap $EnvFile
$required = @(
    "CF_TUNNEL_TOKEN_PROD",
    "ADMIN_PASSWORD",
    "ADMIN_SECRET_KEY",
    "ODOO_PASSWORD",
    "POSTGRES_PASSWORD",
    "META_SYNC_TOKEN"
)

foreach ($k in $required) {
    if (-not $envMap.ContainsKey($k) -or (Test-Placeholder $envMap[$k])) {
        Write-Err "Variable inválida en $EnvFile: $k"
        exit 1
    }
}

Write-Ok "Variables críticas validadas"

Write-Info "docker compose build"
docker compose --env-file $EnvFile -f $ComposeFile build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Ok "Build completado"

Write-Info "docker compose up -d"
docker compose --env-file $EnvFile -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Ok "Servicios iniciados"

Write-Info "Verificando health local"
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -Method Get -TimeoutSec 15
    Write-Ok "Health local OK: $($health.status)"
} catch {
    Write-Warn "Health local no respondió todavía: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "URLs esperadas:" -ForegroundColor Cyan
Write-Host "- https://galantesjewelry.com"
Write-Host "- https://shop.galantesjewelry.com"
Write-Host "- https://odoo.galantesjewelry.com"
Write-Host ""
Write-Host "Logs: docker compose --env-file $EnvFile -f $ComposeFile logs -f" -ForegroundColor DarkGray
