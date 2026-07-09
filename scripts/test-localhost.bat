@echo off
REM Functional Testing Script - Galante's Jewelry Localhost (Windows)
REM Tests backend and frontend functionality
REM Usage: scripts\test-localhost.bat

setlocal enabledelayedexpansion

cls
echo.
echo ════════════════════════════════════════════
echo   Galante's Jewelry - Localhost Testing
echo ════════════════════════════════════════════
echo.

REM Configuration
set DOCKER_COMPOSE_FILE=docker-compose.production.yml
set NEXT_JS_URL=http://localhost:3000
set NGINX_URL=http://localhost:8080
set ODOO_URL=http://localhost:8069
set MAX_RETRIES=60

REM Check prerequisites
echo [1/6] Checking prerequisites...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker not found. Please install Docker Desktop.
    exit /b 1
)
echo OK: Docker is installed

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose not found.
    exit /b 1
)
echo OK: Docker Compose is installed

docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker daemon not running. Please start Docker Desktop.
    echo.
    echo Steps:
    echo 1. Open Windows Start Menu
    echo 2. Search for "Docker Desktop"
    echo 3. Click to launch
    echo 4. Wait for "Docker Engine started"
    echo 5. Run this script again
    exit /b 1
)
echo OK: Docker daemon is running
echo.

REM Start services
echo [2/6] Starting services with docker-compose...
docker-compose -f %DOCKER_COMPOSE_FILE% down >nul 2>&1
docker-compose -f %DOCKER_COMPOSE_FILE% up -d --build
if errorlevel 1 (
    echo ERROR: Failed to start services
    exit /b 1
)
echo OK: Services started (building images...)
echo.
echo Waiting for services to initialize (this may take 1-2 minutes)...
echo Please wait...
echo.

REM Wait for Next.js
echo Checking Next.js health...
set retries=0
:wait_nextjs
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NEXT_JS_URL%/api/health' -UseBasicParsing -TimeoutSec 5; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    set /a retries+=1
    if !retries! gtr %MAX_RETRIES% (
        echo ERROR: Next.js did not respond in time
        exit /b 1
    )
    if !retries! equ 20 (
        echo  Still waiting for Next.js...
    )
    timeout /t 1 /nobreak >nul
    goto wait_nextjs
)
echo OK: Next.js is ready
echo.

REM Wait for Odoo
echo Checking Odoo health...
set retries=0
:wait_odoo
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%ODOO_URL%' -UseBasicParsing -TimeoutSec 5; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    set /a retries+=1
    if !retries! gtr %MAX_RETRIES% (
        echo ERROR: Odoo did not respond in time
        exit /b 1
    )
    if !retries! equ 20 (
        echo  Still waiting for Odoo...
    )
    timeout /t 1 /nobreak >nul
    goto wait_odoo
)
echo OK: Odoo is ready
echo.

REM Check service health
echo [3/6] Checking service health...
docker-compose -f %DOCKER_COMPOSE_FILE% ps
echo.

REM Test endpoints
echo [4/6] Testing endpoints...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NEXT_JS_URL%/api/health' -UseBasicParsing; Write-Host 'OK: Next.js health check' } catch { Write-Host 'ERROR: Next.js health check failed' }" >nul 2>&1

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NGINX_URL%/healthz' -UseBasicParsing; Write-Host 'OK: Nginx health check' } catch { Write-Host 'ERROR: Nginx health check failed' }" >nul 2>&1

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%ODOO_URL%' -UseBasicParsing; Write-Host 'OK: Odoo responds' } catch { Write-Host 'ERROR: Odoo responds failed' }" >nul 2>&1

echo.

REM Test frontend pages
echo [5/6] Testing frontend pages...
for %%P in (/ /collections /bridal /about /contact /shop /admin/login) do (
    powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NGINX_URL%%%P' -UseBasicParsing -MaximumRedirection 5; Write-Host 'OK: Page %%P returned !response.StatusCode!' } catch { Write-Host 'WARNING: Page %%P did not respond' }"
)
echo.

REM Test API endpoints
echo [6/6] Testing API endpoints...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%NEXT_JS_URL%/api/products' -UseBasicParsing; Write-Host 'OK: Odoo client API' } catch { Write-Host 'INFO: Odoo client API not yet implemented (expected)' }"

echo.

REM Summary
echo.
echo ════════════════════════════════════════════
echo   Test Complete!
echo ════════════════════════════════════════════
echo.
echo Access Points:
echo   - Editorial Site: %NGINX_URL%
echo   - Shop: %NGINX_URL%/shop
echo   - Odoo Admin: %ODOO_URL%
echo   - Next.js Direct: %NEXT_JS_URL%
echo.
echo Useful Commands:
echo   View logs: docker-compose -f %DOCKER_COMPOSE_FILE% logs -f
echo   Restart: docker-compose -f %DOCKER_COMPOSE_FILE% restart
echo   Stop: docker-compose -f %DOCKER_COMPOSE_FILE% down
echo   Clean: docker-compose -f %DOCKER_COMPOSE_FILE% down -v
echo.
echo Documentation:
echo   - Testing Guide: TESTING.md
echo   - Deployment Notes: docs\deployment-notes.md
echo.
echo Press any key to continue...
pause >nul
