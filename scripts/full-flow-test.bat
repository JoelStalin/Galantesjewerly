@echo off
REM Full Flow Functional Testing - Galante's Jewelry (Windows)
REM Tests complete workflow: Products -> Shop -> Cart -> Order -> Shipping

setlocal enabledelayedexpansion

cls
echo.
echo ═══════════════════════════════════════════════════════
echo   Galante's Jewelry - Full Flow Functional Test
echo   Flujo Completo: Productos - Venta - Envio
echo ═══════════════════════════════════════════════════════
echo.

REM Configuration
set DOCKER_COMPOSE_FILE=docker-compose.production.yml
set NEXT_JS_URL=http://localhost:3000
set NGINX_URL=http://localhost:8080
set ODOO_URL=http://localhost:8069

REM ═══════════════════════════════════════════════════════
REM Step 1: Verify Docker
REM ═══════════════════════════════════════════════════════
echo [1/10] Verificando Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker no esta corriendo
    echo.
    echo Pasos para iniciar Docker:
    echo 1. Abre el Start Menu de Windows
    echo 2. Busca "Docker Desktop"
    echo 3. Haz click para ejecutar
    echo 4. Espera a que diga "Docker Engine started"
    echo 5. Vuelve a ejecutar este script
    pause
    exit /b 1
)
echo OK: Docker corriendo
echo.

REM ═══════════════════════════════════════════════════════
REM Step 2: Start Services
REM ═══════════════════════════════════════════════════════
echo [2/10] Deteniendo servicios previos...
docker-compose -f %DOCKER_COMPOSE_FILE% down >nul 2>&1

echo [3/10] Iniciando servicios (esto puede tomar 2-3 minutos)...
docker-compose -f %DOCKER_COMPOSE_FILE% up -d --build
if errorlevel 1 (
    echo ERROR: Fallo al iniciar servicios
    docker-compose -f %DOCKER_COMPOSE_FILE% logs
    pause
    exit /b 1
)
echo.

echo Esperando a que los servicios se inicialicen...
set retries=0
:wait_services
docker-compose -f %DOCKER_COMPOSE_FILE% ps | findstr "galantes_web" | findstr "Up.*healthy" >nul
if errorlevel 1 (
    set /a retries+=1
    if !retries! gtr 120 (
        echo ERROR: Servicios no se iniciaron a tiempo
        docker-compose -f %DOCKER_COMPOSE_FILE% ps
        pause
        exit /b 1
    )
    if !retries! equ 30 (
        echo  30 segundos... esperando
    )
    if !retries! equ 60 (
        echo  1 minuto... casi listo
    )
    timeout /t 1 /nobreak >nul
    goto wait_services
)
echo OK: Servicios iniciados
echo.

REM ═══════════════════════════════════════════════════════
REM Step 3: Verify Services
REM ═══════════════════════════════════════════════════════
echo [4/10] Estado de servicios:
docker-compose -f %DOCKER_COMPOSE_FILE% ps
echo.

echo [5/10] Verificando endpoints:
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NEXT_JS_URL%/api/health' -UseBasicParsing -TimeoutSec 5; Write-Host 'OK: Next.js health check' } catch { Write-Host 'ERROR: Next.js health check' }" >nul 2>&1

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NGINX_URL%/healthz' -UseBasicParsing -TimeoutSec 5; Write-Host 'OK: Nginx health check' } catch { Write-Host 'ERROR: Nginx health check' }" >nul 2>&1

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%ODOO_URL%' -UseBasicParsing -TimeoutSec 5; Write-Host 'OK: Odoo respondiendo' } catch { Write-Host 'ERROR: Odoo respondiendo' }" >nul 2>&1
echo.

REM ═══════════════════════════════════════════════════════
REM Step 4: Test Frontend
REM ═══════════════════════════════════════════════════════
echo [6/10] Probando frontend...
for %%P in (/ /collections /bridal /shop /admin/login /about) do (
    powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NGINX_URL%%%P' -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 5; Write-Host 'OK: Pagina %%P (HTTP !response.StatusCode!)' } catch { Write-Host 'ERROR: Pagina %%P' }" >nul 2>&1
)
echo.

REM ═══════════════════════════════════════════════════════
REM Step 5: Instructions for Manual Testing
REM ═══════════════════════════════════════════════════════
echo [7/10] FLUJO COMPLETO DE TESTING
echo.
echo Ahora los servicios estan corriendo.
echo Necesitas completar manualmente estos pasos:
echo.

echo PASO 1: CREAR PRODUCTOS
echo ========================
echo 1. Abre: %ODOO_URL%
echo 2. Login: admin / admin
echo 3. Menu - Productos - Productos
echo 4. Click "Crear"
echo 5. Llenar campos:
echo    - Nombre: "Engagement Ring 14K Gold"
echo    - Precio: 2499.00
echo    - Categoria: Anillos (crear si no existe)
echo    - Material: Oro
echo    - Imagen: (opcional)
echo 6. Marcar "Available on Website"
echo 7. Click "Guardar"
echo 8. Repetir para mas productos
echo.

echo PASO 2: VER PRODUCTOS EN LA TIENDA
echo ===================================
echo 1. Abre: %NGINX_URL%/shop
echo 2. Verifica que los productos aparecen
echo 3. Observa imagenes, precios, descripciones
echo.

echo PASO 3: CREAR PEDIDO
echo ====================
echo 1. Ve a: %ODOO_URL%
echo 2. Menu - Ventas - Pedidos
echo 3. Click "Crear"
echo 4. Seleccionar cliente (crear si no existe)
echo 5. En "Lineas de pedido", click "Agregar"
echo 6. Seleccionar producto y cantidad
echo 7. Click "Guardar"
echo.

echo PASO 4: CONFIRMAR PEDIDO
echo ========================
echo 1. En el pedido creado, click "Confirmar"
echo 2. Esto cambia el estado a "Confirmado"
echo.

echo PASO 5: CREAR FACTURA
echo ======================
echo 1. En el pedido, click "Crear factura"
echo 2. Seleccionar opciones de facturacion
echo 3. Click "Crear"
echo.

echo PASO 6: VALIDAR FACTURA
echo ========================
echo 1. En la factura, click "Registrar pago" o "Validar"
echo 2. Esto confirma la factura
echo.

echo PASO 7: CREAR ENVIO
echo ====================
echo 1. En el pedido, ir a pestaña "Envios"
echo 2. Click "Crear envio"
echo 3. Verificar productos y cantidades
echo 4. Click "Validar"
echo.

echo PASO 8: COMPLETAR ENVIO
echo ========================
echo 1. Si tienes carrier configurado, generar etiqueta
echo 2. Marcar como enviado
echo 3. El pedido debe mostrar status "Enviado"
echo.

echo ═══════════════════════════════════════════════════════
echo URLS IMPORTANTES
echo ═══════════════════════════════════════════════════════
echo Editorial Site: %NGINX_URL%
echo Shop: %NGINX_URL%/shop
echo Odoo Admin: %ODOO_URL%
echo Next.js Direct: %NEXT_JS_URL%
echo.

echo COMANDOS UTILES
echo ═══════════════════════════════════════════════════════
echo Ver logs: docker-compose -f %DOCKER_COMPOSE_FILE% logs -f
echo Restart: docker-compose -f %DOCKER_COMPOSE_FILE% restart
echo Detener: docker-compose -f %DOCKER_COMPOSE_FILE% down
echo Limpiar: docker-compose -f %DOCKER_COMPOSE_FILE% down -v
echo.

echo Abre el navegador y comienza con PASO 1!
echo.
pause
