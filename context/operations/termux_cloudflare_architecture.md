# Arquitectura de Producción y Contexto Operativo
**Proyecto**: Galante's Jewelry by the Sea
**Entorno Principal**: Android Edge Server (Termux) protegido por Cloudflare Zero Trust

Este documento preserva la memoria contextual vital y las decisiones de arquitectura implementadas durante el despliegue del ambiente, asegurando que futuros agentes o desarrolladores mantengan la integridad del sistema.

## 1. Topología del Servidor (Android Termux)
Actualmente, todo el tráfico público del dominio (`galantesjewelry.com`) es procesado desde un dispositivo de red celular utilizando Termux.
*   **App Node.js**: La aplicación Next.js estructurada se compila en formato `standalone` y es servida ejecutando Node en los puertos `3000` y `8000` paralelamente bajo la interfaz global (`HOSTNAME=0.0.0.0`).
*   **Conexión Perimetral (cloudflared)**: En vez de realizar aperturas en routers físicos (Port Forwarding), Termux ejecuta un daemon de fondo de Cloudflare Tunnel. Este proceso (`nohup cloudflared tunnel run --token ...`) forja un túnel QUIC hacia el Edge de Miami.

## 2. Resoluciones Críticas Previas y Diagnóstico (Reglas Operativas)

### A. Diagnóstico de Error 1016 (Origin DNS Error)
*   **Causa detectada**: El Dashboard de Zero Trust intentaba enviar las peticiones a un resolver inexistente del lado del cliente (como `nginx` o `web` remanente del stack Dockerizado de Windows).
*   **Solución Permanente**: Todo tráfico del túnel apuntando a la app *deberá* estar ruteado estrictamente a `http://127.0.0.1:3000` o en su defecto a la IP local del Android `http://192.168.12.193:3000` en la configuración web de Cloudflare. 

### B. Mapeo DNS y Carga WWW (Error NXDOMAIN)
*   **Problema**: Al escribir el dominio a secas, navegadores como Chrome forzaban silenciosamente redicción a `www.` o abortaban si no existía, tirando la red completa con NXDOMAIN.
*   **Solución**: Se estableció el concepto obligatorio de crear siempre *Public Hostnames* redundantes dentro del Zero Trust Dashboard. Uno para el *apex domain* (`galantesjewelry.com`) y otro idéntico para el *subdominio* (`www`), previniendo caídas locales.

### C. Restricción de Automatizaciones Autónomas IA (Cloudflare Anti-Bot)
Hemos documentado una estricta limitante criptográfica: un motor de Inteligencia Artificial (Selenium u otros) **no puede** entrar remotamente al *Cloudflare Dashboard* ni clonar credenciales en local para resolver ajustes de túneles debido a los CAPTCHAs y "Turnstiles" de seguridad avanzada (el *"Just a moment... verifying you are human"*).
*   Cualquier agente debe pedirle directamente al Administrador Humano que realice cualquier alta en la Web UI de Cloudflare de forma manual.

## 3. Pauta Estricta: Validación Funcional (Selenium Profile Inject)
A requerimiento explícito del proyecto, está **PROHIBIDO** crear sesiones web desechables de Selenium que parezcan actividad de bots al intentar probar la web (esto desata bloqueos HTTP y caídas prematuras).
1. Siempre se deberá apuntar la suite Selenium al Perfil Local real del Host (en este entorno: `Google/Chrome/User Data`, usando `Profile 6`).
2. Implementar capturas sólidas sobre `Session Not Created`, porque si el humano tiene la pestaña abierta de Chrome, su OS rechazará al bot. Si este es el caso, cancelar fluidamente con instrucciones sin dañar el flujo ni terminar en crashes hostiles (Ver referencia técnica: `testing_selenium_rules.md`).

## 4. Registro Histórico: Sesión Actual (Marzo 2026)
Durante la conversación que originó este documento, se consolidaron los siguientes hitos finales:
- **Pruebas de Bucle Local:** Se demostró mediante cURL desde SSH que Node.js en Termux levantó sanamente y devolvió HTTP 200 (payload > 26KB) tanto en el puerto `3000` como en el `8000`, amarrados a la interfaz `0.0.0.0`.
- **Interferencia Local Descartada:** Se descartó exitosamente que procesos paralelos de Docker Desktop en Windows, u otras instancias aisladas de `cloudflared` en la red local del usuario, estuvieran secuestrando el tráfico del túnel `08d437c9-56ad-4910-80f9-33cca283d727`. El monopolio del tráfico fue confirmado hacia Termux Android.
- **Veredicto del Bug 1016 y NXDOMAIN:** Tras intentar inyectar la solución remotamente clonando la sesión de Chrome del usuario (lo cual fue detenido infaliblemente por el Turnstile Anti-Bot de Cloudflare verificando la falta de iteración humana), se determinó inequívocamente que la única pieza faltante radicaba en que el administrador presionara de forma manual **"Save changes"** en el panel web, apuntando la ruta a `http://127.0.0.1:3000`, y creando proactivamente la regla del subdominio `www` para subsanar NXDOMAIN provocado por cachés o redirecciones automáticas de los navegadores.
