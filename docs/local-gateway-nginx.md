# Gateway local Nginx

Nginx recibe HTTPS local en `127.0.0.1:443` y lo enruta por hostname. HTTP queda disponible en `127.0.0.1:8080` porque Windows reserva el puerto 80 para el sistema.

- `http://orca.dev` → contenedor `orca:4173`
- `http://hermes.dev` → contenedor `hermes:8000`
- `https://orca.dev` → contenedor `orca:4173`
- `https://hermes.dev` → contenedor `hermes:8000`

Configura los dominios y levanta el stack desde PowerShell como administrador:

```powershell
.\scripts\configure-orca-dev.ps1
.\scripts\create-orca-local-ssl.ps1
docker compose -f docker-compose.orca.yml up -d --build
docker compose -f docker-compose.orca.yml ps
```

El contenedor Hermes debe estar en la misma red Docker y llamarse `hermes`, escuchando en el puerto interno `8000`. Si su runtime usa otro nombre o puerto, se cambia únicamente `docker/nginx.local.conf`.

Los tres servicios (`orca`, `orca-dns` y `local-gateway`) usan `restart: unless-stopped`. Docker Desktop los vuelve a levantar automáticamente después de reiniciar Windows o Docker, una vez que el motor Docker esté disponible.

No se toca la topología ni el túnel de producción.
