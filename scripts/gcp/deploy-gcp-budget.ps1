param(
    [string]$ProjectId = "galantes-jewelry-prod",
    [string]$ProjectName = "Galantes Jewelry Production",
    [string]$BillingAccount = "",
    [string]$Region = "us-central1",
    [string]$Zone = "us-central1-a",
    [string]$InstanceName = "galantes-prod-vm",
    [string]$MachineType = "e2-small",
    [int]$BootDiskGb = 30,
    [string]$StaticIpName = "galantes-prod-ip",
    [double]$BudgetUsd = 30,
    [string]$RepoUrl = "",
    [string]$Branch = "main",
    [string]$GcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

function Invoke-Gcloud {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [switch]$IgnoreErrors
    )

    & $GcloudPath @Args
    $exitCode = $LASTEXITCODE
    if (-not $IgnoreErrors -and $exitCode -ne 0) {
        throw "gcloud failed: $($Args -join ' ')"
    }
    return $exitCode
}

if (-not (Test-Path $GcloudPath)) {
    Write-Err "No se encontro gcloud en: $GcloudPath"
    Write-Err "Instala/repara Google Cloud CLI y vuelve a ejecutar este script."
    exit 1
}

Write-Info "Validando gcloud"
Invoke-Gcloud -Args @("--version")

if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    try {
        $RepoUrl = (git config --get remote.origin.url).Trim()
    } catch {
        $RepoUrl = ""
    }
}
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    Write-Err "No se pudo detectar RepoUrl. Pasa -RepoUrl con la URL git del repositorio."
    exit 1
}

if (-not (Test-Path ".env.prod")) {
    Write-Err "No existe .env.prod en el directorio actual."
    Write-Err "Este script despliega tu stack productivo y necesita ese archivo."
    exit 1
}

Write-Info "Asegurando autenticacion de gcloud"
$accountsRaw = & $GcloudPath auth list --format="value(account)"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountsRaw)) {
    Write-Warn "No hay sesion activa en gcloud. Abriendo login web..."
    Invoke-Gcloud -Args @("auth", "login")
}

Write-Info "Creando o verificando proyecto $ProjectId"
$projectCheck = & $GcloudPath projects describe $ProjectId --format="value(projectId)" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($projectCheck)) {
    Invoke-Gcloud -Args @("projects", "create", $ProjectId, "--name=$ProjectName")
    Write-Ok "Proyecto creado"
} else {
    Write-Ok "Proyecto ya existe"
}

Invoke-Gcloud -Args @("config", "set", "project", $ProjectId)

if (-not [string]::IsNullOrWhiteSpace($BillingAccount)) {
    Write-Info "Vinculando billing account $BillingAccount"
    Invoke-Gcloud -Args @("beta", "billing", "projects", "link", $ProjectId, "--billing-account=$BillingAccount")

    Write-Info "Creando presupuesto de USD $BudgetUsd"
    Invoke-Gcloud -Args @(
        "beta", "billing", "budgets", "create",
        "--billing-account=$BillingAccount",
        "--display-name=galantes-monthly-budget",
        "--budget-amount=$($BudgetUsd)USD",
        "--threshold-rule=percent=0.5",
        "--threshold-rule=percent=0.9",
        "--threshold-rule=percent=1.0"
    ) -IgnoreErrors
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "No se pudo crear el presupuesto automaticamente. Puedes crearlo luego en Billing > Budgets."
    } else {
        Write-Ok "Presupuesto mensual configurado"
    }
} else {
    Write-Warn "No se proporciono BillingAccount. Omitiendo enlace de facturacion y presupuesto."
}

Write-Info "Habilitando APIs requeridas"
Invoke-Gcloud -Args @("services", "enable", "compute.googleapis.com", "cloudresourcemanager.googleapis.com", "serviceusage.googleapis.com")

Write-Info "Creando IP estatica (si no existe)"
Invoke-Gcloud -Args @("compute", "addresses", "create", $StaticIpName, "--region=$Region") -IgnoreErrors

Write-Info "Creando firewall HTTP/HTTPS (si no existe)"
Invoke-Gcloud -Args @(
    "compute", "firewall-rules", "create", "galantes-allow-web",
    "--allow=tcp:80,tcp:443",
    "--target-tags=galantes-web",
    "--source-ranges=0.0.0.0/0"
) -IgnoreErrors

Write-Info "Creando VM productiva (si no existe)"
$instanceExists = & $GcloudPath compute instances describe $InstanceName --zone=$Zone --format="value(name)" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($instanceExists)) {
    Invoke-Gcloud -Args @(
        "compute", "instances", "create", $InstanceName,
        "--zone=$Zone",
        "--machine-type=$MachineType",
        "--boot-disk-size=$($BootDiskGb)GB",
        "--boot-disk-type=pd-balanced",
        "--image-family=ubuntu-2204-lts",
        "--image-project=ubuntu-os-cloud",
        "--address=$StaticIpName",
        "--tags=galantes-web",
        "--metadata-from-file=startup-script=scripts/gcp/vm-startup.sh"
    )
    Write-Ok "VM creada"
} else {
    Write-Ok "VM ya existe"
}

Write-Info "Esperando bootstrap de Docker en la VM"
Start-Sleep -Seconds 25

Write-Info "Preparando repositorio en VM"
$remoteBootstrap = @"
set -e
if [ ! -d ~/galantesjewelry ]; then
  git clone '$RepoUrl' ~/galantesjewelry
fi
cd ~/galantesjewelry
git fetch --all
git checkout '$Branch'
git pull origin '$Branch'
"@

Invoke-Gcloud -Args @("compute", "ssh", $InstanceName, "--zone=$Zone", "--command=$remoteBootstrap")

Write-Info "Copiando .env.prod a la VM"
Invoke-Gcloud -Args @("compute", "scp", ".env.prod", "${InstanceName}:~/galantesjewelry/.env.prod", "--zone=$Zone")

Write-Info "Levantando stack productivo (sin cloudflared)"
$remoteDeploy = @"
set -e
cd ~/galantesjewelry
sudo usermod -aG docker $USER || true
docker compose --env-file .env.prod -f docker-compose.production.yml pull || true
docker compose --env-file .env.prod -f docker-compose.production.yml up -d postgres odoo web nginx
docker compose --env-file .env.prod -f docker-compose.production.yml ps
"@
Invoke-Gcloud -Args @("compute", "ssh", $InstanceName, "--zone=$Zone", "--command=$remoteDeploy")

$externalIp = (& $GcloudPath compute instances describe $InstanceName --zone=$Zone --format="value(networkInterfaces[0].accessConfigs[0].natIP)").Trim()

Write-Host ""
Write-Ok "Despliegue base en GCP completado"
Write-Host "IP publica: $externalIp"
Write-Host "Costo estimado mensual (sin trafico alto):"
Write-Host "- VM $MachineType + disco ${BootDiskGb}GB: aprox USD 20-28/mes"
Write-Host "- Mantener alertas de budget al 50%, 90% y 100%"
Write-Host ""
Write-Host "Siguiente paso recomendado: configurar dominio y TLS (Cloud DNS + Load Balancer o proxy actual)."
