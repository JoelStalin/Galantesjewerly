<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:selenium-testing-rules -->
# Selenium & E2E Testing Mandatory Context
Cuando el asistente (tú) deba escribir, modificar o ejecutar un script de pruebas utilizando Selenium (Python), ES OBLIGATORIO que los scripts se escriban adhiriéndose al patrón de uso de perfiles locales (revisar `context/operations/testing_selenium_rules.md`). Nunca utilices una sesión vacía a menos que se te indique explícitamente y asegúrate siempre de inyectar el manejo de errores `try catch` amigable solicitando cerrar Chrome si el perfil está bloqueado ("already in use").

Además, como regla estricta: **SIEMPRE debes realizar pruebas funcionales** proactivamente después de cada implementación, cambio de infraestructura o despliegue. Asimismo, debes **aplicar todos los ajustes (settings) requeridos** de forma autónoma en el repositorio para asegurar que el ambiente quede funcionando de extremo a extremo antes de dar por concluida cualquier misión.

> 📚 **Contexto Global de Arquitectura**: Para comprender a fondo las decisiones técnicas sobre cómo opera Node.js en Termux (Android) y los fallos de configuración de red documentados con Cloudflare Zero Trust Tunnels, lee el archivo `context/operations/termux_cloudflare_architecture.md`. NUNCA modifiques esa base arquitectónica sin una justificación de red.
<!-- END:selenium-testing-rules -->
