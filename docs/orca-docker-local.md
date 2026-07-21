# Orca local en Docker

Desde `06_E_Commerce_Lux/Galantesjewelry`:

```powershell
docker compose -f docker-compose.orca.yml up -d --build
```

Verificación:

```powershell
docker compose -f docker-compose.orca.yml ps
Invoke-WebRequest http://127.0.0.1:4173/api/n8n/workflows
```

UI: `http://127.0.0.1:4173`

El contenedor contiene el build de la UI y el adaptador local que expone el blueprint `galantes-inventory-agent`. Las credenciales no se copian a la imagen.
