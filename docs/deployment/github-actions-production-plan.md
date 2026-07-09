# Plan De Despliegue GitHub Actions Para Galantes Jewelry

## Sugerencias Antes De Proceder

La estrategia correcta es separar "fuente de despliegue" y "workspace operativo". Hoy este checkout esta dentro de `GetUpSoft_Workspace` y el remoto actual apunta a `GetUpSoft_Workspace.git`, no a `https://github.com/JoelStalin/Galantesjewerly.git`. Recomiendo que `Galantesjewerly.git` sea el repo canonico de despliegue y que `GetUpSoft_Workspace` lo mantenga como espejo/subtree o clon controlado, no como origen de produccion.

Tambien hay que corregir el workflow existente antes de confiar en el: `.github/workflows/deploy.yml` actualmente despliega en `push main`, sobrescribe `ODOO_DB` con `galantes_db`, hace backup "no bloqueante", no rota backups, y fuerza recreacion de `cloudflared`. Eso contradice tus reglas y el estado real que vimos en produccion.

Ademas, antes de activar GitHub Actions como fuente de produccion, se debe renovar `https://github.com/JoelStalin/Galantesjewerly.git` contra el estado real de produccion porque tiene muchas diferencias. Esa renovacion debe hacerse con inventario, diff controlado y respaldo previo, para que el repo canonico represente lo que esta vivo en la VM sin perder configuracion, imagenes, datos Odoo, galerias ni integraciones.

Fuentes usadas para alinear el plan:
- GitHub recomienda `environments`, protection rules, secrets por entorno, concurrencia y aprobaciones para despliegues: https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions
- GitHub Environments permite aprobaciones, ramas permitidas y secretos por entorno: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
- GitHub branch protection evita force-push/delete y puede exigir checks antes de merge: https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Docker volumes son la capa persistente que debe respaldarse: https://docs.docker.com/engine/storage/volumes/
- Docker prune debe ser controlado; `builder prune` y `system prune` tienen distinto alcance: https://docs.docker.com/reference/cli/docker/builder/prune/ y https://docs.docker.com/reference/cli/docker/system/prune/
- Cloudflare Tunnel funciona con conexiones salientes de `cloudflared`; por eso debe mantenerse corriendo y no reiniciarse salvo aprobacion: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/

## Plan Propuesto

1. Inventario y linea base
- Inventariar componentes productivos: `web` Next.js, `odoo`, `postgres`, `nginx`, `cloudflared`, volumenes Docker, `.env.prod`, `data/`, imagenes Odoo, `galantes.product.gallery`, backups existentes y workflows.
- Registrar estado actual de produccion: `docker ps`, `docker compose config`, `df -h`, `docker system df`, conteo de productos, conteo de galerias, salud de `/api/health`, `/shop`, checkout, Google Calendar/Odoo sync.
- Crear un documento `docs/deployment/inventory.md` con rutas, puertos, dominios, servicios, volumenes, secretos esperados y dependencias.

2. Renovar `Galantesjewerly.git` contra produccion
- Tratar la VM de produccion como fuente de verdad inicial para reconciliacion, pero sin copiar secretos ni datos sensibles al repo.
- Comparar tres estados: checkout local en `GetUpSoft_Workspace`, repo remoto `Galantesjewerly.git`, y archivos versionables reales de `/home/yoeli/galantesjewelry` en `galantes-prod-vm`.
- Crear un branch de reconciliacion, por ejemplo `production-baseline-renewal`.
- Extraer desde produccion solo archivos versionables: app, lib, components, scripts, Dockerfile, compose, infra, odoo addons, docs y configuraciones ejemplo. Excluir `.env.prod`, backups, volumenes, `.next`, `node_modules`, dumps, blobs privados y credenciales.
- Generar diff auditable contra `Galantesjewerly.git` y documentar diferencias criticas.
- Validar localmente el baseline renovado antes de merge.
- Hacer PR hacia `main` de `Galantesjewerly.git` con evidencia de que no se perdieron funciones actuales.
- Despues del merge, usar ese repo renovado como origen unico del pipeline GitHub Actions.

3. Ordenar Git sin romper GetUpSoft Workspace
- Configurar `https://github.com/JoelStalin/Galantesjewerly.git` como repo canonico para Galantes.
- Mantener `GetUpSoft_Workspace` actualizado por una ruta explicita: subtree, submodule o clon espejo local. Mi recomendacion: repo separado dentro del workspace, con `origin = Galantesjewerly.git`, y el workspace general solo como contenedor operativo.
- Bloquear produccion para que solo despliegue commits que existan en `Galantesjewerly.git`.
- Agregar regla: ningun agente puede hacer `git reset --hard`, `scp`, `docker compose up`, `docker restart`, edicion remota o SQL directo en produccion como mecanismo normal de despliegue.

4. Reglas obligatorias para todos los agentes
- Actualizar `AGENTS.md` con una seccion "Galantes Production Deployment Policy".
- Regla central: ningun cambio directo a produccion; todo cambio entra por PR, pasa pruebas locales, CI, staging y luego GitHub Actions production.
- Regla de tunel: `cloudflared` no se detiene, recrea, reinicia ni reemplaza salvo que el paso de despliegue lo requiera explicitamente; si lo requiere, pedir permiso antes de ese paso.
- Regla de imagenes: ninguna operacion puede borrar o sobrescribir imagenes, galerias, blobs, Google Drive source o media Odoo sin backup verificable y aprobacion explicita.
- Regla de evidencia: cada entrega debe adjuntar backlog item, DoR, DoD, comandos de prueba y evidencia de navegador cuando toque shop/cart/PDP/imagenes.

5. Pipeline GitHub Actions
- Cambiar produccion para que no corra en cada `push main` sin controles. Flujo recomendado:
- PR a `develop`: CI localizable, lint, typecheck, unit tests, build.
- Merge a `develop`: deploy staging.
- PR `develop -> main`: requiere checks verdes y revision.
- `workflow_dispatch` o release tag en `main`: deploy production con GitHub Environment `production`.
- Usar `environment: production` con required reviewers y branch restriction a `main`.
- Agregar `concurrency: production` para impedir dos despliegues simultaneos.
- Usar secretos del environment `production`, no secretos globales mezclados.
- Pinnear acciones por version estable o SHA, no `appleboy/ssh-action@master`.

6. Backup previo obligatorio
- Crear script versionado `scripts/production/predeploy-backup.sh`.
- El workflow debe fallar si el backup falla. Nada de "backup no bloqueante".
- Backup minimo:
- `pg_dump -Fc` de `galantes_prod`.
- `odoo-data` volume.
- `postgres-data` volume si aplica.
- `data/` del app.
- `.env.prod` cifrado o copiado solo en VM con permisos `600`.
- `docker-compose.production.yml`, commit SHA y `docker inspect` de servicios.
- Guardar en `/home/yoeli/deploy-backups/<timestamp>-<sha>/`.
- Crear manifest `backup.json` con tamanos, checksums y commit.
- Validar que el dump no este vacio antes de continuar.

7. Rotacion de backups y espacio
- Politica recomendada: conservar ultimos 5 backups exitosos y backups de las ultimas 72 horas.
- Borrar backups viejos solo dentro de `/home/yoeli/deploy-backups`, con validacion de path absoluto.
- Nunca usar `docker system prune --volumes`.
- Limpieza permitida:
- `docker builder prune -af --filter until=72h`
- `docker image prune -af --filter until=168h`
- borrar backups antiguos validados
- Antes de build: exigir espacio minimo, por ejemplo `8GB` libres. Si no hay espacio, abortar antes de tocar servicios.

8. Despliegue production seguro
- El deploy debe hacer:
- Preflight: disco, Docker, compose config, health actual, tunel activo.
- Backup bloqueante.
- `git fetch` y checkout del SHA de GitHub Actions.
- Restaurar `.env.prod` desde archivo local de la VM, no regenerarlo con valores equivocados.
- Build de imagen.
- Migraciones Odoo solo si cambio `odoo/`.
- Recreate solo del servicio necesario, normalmente `web`.
- No tocar `cloudflared` salvo que el diff incluya infraestructura de tunel y exista aprobacion.
- Corregir bug actual: el workflow no puede escribir `ODOO_DB=galantes_db`; debe preservar `galantes_prod`.

9. Validacion local antes de produccion
- Antes de merge:
- `npm run lint`
- `npm run test`
- `npx tsc --noEmit`
- `npm run build`
- smoke local de `/api/health`, `/shop`, PDP representativo.
- Para cambios de imagenes:
- verificar `naturalWidth > 0` en cards de catalogo.
- verificar fallback si Odoo no trae imagen.
- verificar galeria PDP.
- Para checkout/calendario:
- validar flujo de cart/checkout sin crear pagos reales salvo test mode.
- validar Google Calendar/Odoo sync si el cambio toca esas areas.

10. Validacion staging
- Staging debe usar DB separada, dominios separados y tunel separado.
- Deploy staging automatico desde `develop`.
- Staging no puede tocar `galantes_prod`.
- Debe probar:
- `/api/health`
- `/shop`
- producto con imagen
- login/customer account si toco auth
- checkout preflight si toco checkout
- Odoo login publico si toco nginx/Odoo
- Solo con staging verde se permite PR a `main`.

11. Validacion produccion post deploy
- Verificar:
- contenedores healthy.
- `cloudflared` sigue activo y no fue recreado salvo aprobacion.
- `/api/health` 200.
- `/shop` muestra productos reales.
- imagenes representativas devuelven bytes y `naturalWidth > 0`.
- PDP carga galeria.
- Odoo admin responde.
- checkout no queda roto.
- Google Calendar/Odoo sync no regresa errores.
- Guardar evidencia en `docs/deployment/evidence/<timestamp>.md`.

## Backlog Inicial

- `DPL-1`: Inventario productivo completo.
- `DPL-2`: Reglas de agentes en `AGENTS.md`.
- `DPL-3`: Renovacion de `Galantesjewerly.git` contra produccion.
- `DPL-4`: Estrategia Git `Galantesjewerly.git` + espejo en `GetUpSoft_Workspace`.
- `DPL-5`: Workflow CI para PR/local parity.
- `DPL-6`: Workflow staging desde `develop`.
- `DPL-7`: Workflow production con Environment approval.
- `DPL-8`: Backup bloqueante + rotacion.
- `DPL-9`: Proteccion Cloudflare tunnel.
- `DPL-10`: Verificacion de imagenes y shop.
- `DPL-11`: Runbook de rollback.

## DoR

- Acceso confirmado a `Galantesjewerly.git`.
- Secretos definidos en GitHub Environments `staging` y `production`.
- Produccion inventariada y backup manual inicial creado.
- Decision tomada sobre como mantener sincronizado `GetUpSoft_Workspace`.
- Decision tomada sobre el procedimiento de renovacion del repo contra produccion.
- Estado de disco en VM con espacio suficiente para build.

## DoD

- `Galantesjewerly.git` renovado contra produccion sin secretos, sin artefactos generados y sin perdida de funciones actuales.
- Ningun deploy directo a produccion queda documentado como permitido.
- `main` protegido con checks y PR review.
- Production deploy solo via GitHub Actions + Environment approval.
- Backup previo bloqueante y rotacion automatica funcionando.
- `cloudflared` no se toca durante deploy normal.
- Staging pasa antes de production.
- Produccion validada con evidencia de shop, imagenes, Odoo, checkout y health.
- `GetUpSoft_Workspace` queda actualizado despues del cambio sin convertirse en origen accidental de produccion.
