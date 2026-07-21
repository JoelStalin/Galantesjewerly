# Dominio local de Orca

El dominio local es `orca.dev` y resuelve a `127.0.0.1`. El proyecto incluye CoreDNS en Docker para resolución DNS explícita y un registro hosts para que Windows y el navegador lo resuelvan sin configurar manualmente cada aplicación.

Como administrador de PowerShell:

```powershell
.\scripts\configure-orca-dev.ps1
docker compose -f docker-compose.orca.yml up -d --build
```

URL:

`http://orca.dev:4173`

El DNS interno de CoreDNS escucha en `127.0.0.1:15353`; el registro del sistema mantiene el acceso del navegador en el puerto estándar de la UI. No se modifica Cloudflare, nginx ni producción.
