param(
    [string]$ProjectId = "deft-haven-493016-m4",
    [string]$Zone = "us-central1-a",
    [string]$InstanceName = "galantes-prod-vm",
    [string]$MachineType = "e2-medium"
)

Write-Host "Iniciando creacion de instancia GCP..." -ForegroundColor Cyan

# 1. Configurar Proyecto
& gcloud config set project $ProjectId

# 2. Habilitar APIs
Write-Host "Habilitando APIs necesarias..."
& gcloud services enable compute.googleapis.com

# 3. Crear Instancia
Write-Host "Creando instancia $InstanceName ($MachineType)..."
& gcloud compute instances create $InstanceName `
    --zone=$Zone `
    --machine-type=$MachineType `
    --boot-disk-size=30GB `
    --boot-disk-type=pd-balanced `
    --image-family=ubuntu-2204-lts `
    --image-project=ubuntu-os-cloud `
    --tags=http-server,https-server `
    --metadata-from-file=startup-script=scripts/gcp/vm-startup.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host "Instancia creada con exito." -ForegroundColor Green
    & gcloud compute instances describe $InstanceName --zone=$Zone --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
} else {
    Write-Host "Error al crear la instancia." -ForegroundColor Red
}
