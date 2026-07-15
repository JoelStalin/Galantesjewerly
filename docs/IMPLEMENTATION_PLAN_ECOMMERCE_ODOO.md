# Plan de Implementación y Pruebas: E-commerce Galante's Jewelry (Next.js + Odoo 19)

## 📌 1. Visión General del Proyecto y Ambientes
**Contexto Actual:**
- **Frontend:** Next.js 16.2.1 (App Router), React 19, Tailwind CSS v4.
- **Backend/ERP:** Odoo 19 (Dockerizado) con módulos de ventas, contabilidad, CRM, inventario y e-commerce empresarial listos.
- **Ambientes:** Desarrollo local con Docker (`docker-compose.dev.yml`) y Producción (`docker-compose.production.yml`) detrás de Nginx/Cloudflare.

**Objetivos de esta Fase:**
1. Sincronización 100% de productos Odoo ↔ Next.js (con 10 ejemplos tipo joya).
2. Parametrización total del Frontend (datos cargados desde la base de datos de Odoo, modelo `res.company`).
3. Portal de Cliente interactivo (Órdenes, Facturas, Ajustes).
4. Facturación automática "IRS-Compliant" al registrar pagos.
5. Autenticación con Google (vinculada a base de datos de usuarios en Odoo).

---

## 🛠️ Fase 1: Parametrización y Sincronización Base (Odoo como Headless CMS)

### 1.1 Configuración de Empresa (Layouts Altamente Parametrizables)
**Objetivo:** Todo el texto de la web (desde el teléfono hasta una coma en el footer) debe ser dinámico.
- **Implementación en Odoo:** 
  - Utilizar el modelo base de la compañía (`res.company`).
  - *Desarrollo de un módulo personalizado (en `galantes_jewelry`)* para añadir campos extra al modelo de la empresa si faltan: `x_favicon`, `x_footer_text_1`, `x_hero_subtitle`, `x_terms_conditions_snippet`, etc.
- **Implementación en Next.js:**
  - Crear un servicio `lib/odoo/company-service.ts` que haga un fetch vía XML-RPC o REST a los parámetros de `res.company`.
  - Cachear esta respuesta a nivel de aplicación (ej. `Next.js revalidate: 3600`) para no saturar Odoo.
  - Inyectar estos datos en los `layout.tsx` y `page.tsx` globales.

### 1.2 Sincronización de Productos (100% Real-Time)
**Objetivo:** Next.js debe reflejar exactamente lo que hay en el inventario/tienda de Odoo.
- **Modelo de Odoo:** `product.template` (con `is_published=True` y `sale_ok=True`).
- **Generación de Data de Ejemplo (Nano Banana / Mock):**
  - Crearemos un script automatizado (Ej. `scripts/seed_jewelry_products.py` usando `xmlrpc.client`) que inyecte 10 productos base:
    1. Anillo de Compromiso Diamante 1ct (Oro Blanco).
    2. Anillo Eternity (Platino).
    3. Collar de Perlas Cultivadas.
    4. Colgante Corazón de Rubí.
    5. Pulsera Tennis de Diamantes.
    6. Esclava de Oro 18k.
    7. Pendientes de Aro (Oro Rosa).
    8. Pendientes Solitario Diamante.
    9. Reloj Cronógrafo de Lujo.
    10. Alianza de Boda Clásica.
- **Integración Next.js:** 
  - Archivo `lib/odoo-sync.ts` actualizado para leer catálogo, variantes, precios e imágenes en Base64/URLs directamente de Odoo.

---

## 🔐 Fase 2: Autenticación (Google Auth → Odoo)

**Objetivo:** Permitir login con Google pero manteniendo a Odoo como la fuente de verdad.
- **Implementación (NextAuth.js / Auth.js):**
  1. Configurar `GoogleProvider` en `lib/auth.ts`.
  2. Interceptar el callback `signIn`:
     - Cuando el usuario entra con Google, buscar en Odoo el modelo `res.partner` (contacto) mediante su email.
     - Si **no existe**, se crea automáticamente un contacto en Odoo como tipo "Cliente" (Portal User).
     - Si **existe**, se vincula la sesión.
  3. Modificar la configuración de base de datos de Odoo para que Next.js tenga un token de API maestro con permisos para leer/crear clientes.

---

## 👤 Fase 3: Portal del Cliente (Dashboard)

**Objetivo:** Autogestión del cliente.
- **Rutas a Crear en Next.js (`app/account/`):**
  - `/account/orders`: Lista de órdenes leídas desde Odoo (`sale.order` donde el `partner_id` sea el del usuario actual).
  - `/account/invoices`: Lista de facturas (`account.move` tipo `out_invoice`), con botón para descargar PDF generado por Odoo.
  - `/account/settings`: Formulario de edición de perfil.
- **Actualización de Datos (Settings):**
  - Formulario conectado a una API Route de Next.js (`POST /api/account/update`) que envía un RPC Update al modelo `res.partner` de Odoo (Actualizar nombre, teléfono, dirección `street`, `city`, `zip`).
  - *Nota:* Las contraseñas de portal nativas de Odoo pueden resetearse enviando la solicitud al endpoint de recuperación de Odoo.

---

## 💳 Fase 4: Checkout, Pagos y Facturación Automática (IRS Compliant)

**Objetivo:** Del pago a la factura legal sin intervención humana.
- **Flujo de Pago:**
  - El carrito finaliza la compra. Se crea un `sale.order` en Odoo en estado *Presupuesto*.
  - El usuario paga (a través de Stripe integrado en Odoo, o Stripe en Next.js que notifica vía Webhook a Odoo).
- **Automatización en Odoo (Facturación):**
  - Configurar las "Acciones Automatizadas" en Odoo: *Cuando un `sale.order` cambie a Pagado/Confirmado → Generar Factura (`account.move`) → Publicar Factura → Registrar Pago.*
- **Requerimientos IRS (Tax Compliance):**
  - Configuración en el módulo `account_accountant` de Odoo:
    - Asegurar que la Compañía tiene el **TIN / EIN** configurado.
    - Las secuencias de facturas no deben tener saltos (Odoo lo hace por defecto).
    - Desglose de impuestos por línea (Sales Tax de cada estado según corresponda, usando el motor de impuestos de Odoo).
    - Mostrar fecha de emisión, fecha de vencimiento y términos de servicio claros en el PDF base de la factura de Odoo.

---

## 🧪 Fase 5: Plan de Pruebas (Testing Strategy)

Para asegurar la calidad, usaremos las herramientas ya configuradas (Playwright/Selenium, Pytest y Jest/Vitest).

### 1. Pruebas Unitarias y de Integración (Next.js & Odoo RPC)
- **Script:** Mock de conexión XML-RPC/REST a la API de Odoo.
- **Validar:** Que `lib/odoo/company-service.ts` extrae correctamente el texto de la empresa y sobreescribe el frontend.
- **Validar:** Que al hacer login con un email falso de Google, se crea el `res.partner` en la BD de Odoo local.

### 2. Pruebas End-to-End (E2E con Playwright/Selenium)
- **Flujo de Parametrización:** Cambiar una "coma" en el admin de Odoo (`res.company` config), y verificar que el test de Playwright encuentra ese texto en el Footer del Frontend de Next.js.
- **Flujo de Compra y Factura:**
  1. Simular un usuario logueándose con Google.
  2. Agregar el "Anillo de Compromiso Diamante 1ct" al carrito.
  3. Llenar dirección de envío.
  4. Pagar (usando tarjeta de prueba de Stripe).
  5. Consultar mediante API a Odoo si se generó la factura (estado `posted`) y si contiene el desglose de impuestos e ID de compañía.
- **Flujo de Portal:**
  1. Ir a la ruta `/account/settings`.
  2. Cambiar la calle a "123 New Ave".
  3. Verificar que el campo `street` en el modelo Odoo ha mutado.

### 3. Pruebas en Ambientes (Staging)
- Levantar el ambiente con `docker-compose.production.yml`.
- Correr el script de `nano banana` (Mock data) para poblar los 10 productos de joyería de prueba.
- Ejecutar suite de pruebas completa: `npm run test:e2e`.

---
## 🚀 Próximos Pasos Ejecutables

Si estás de acuerdo con este plan, los pasos inmediatos que ejecutaré (uno por uno) serán:
1. **Crear script generador de productos ("nano banana")** y conectarlo al contenedor de Odoo local.
2. **Actualizar modelo/vistas en Next.js** para leer el Layout (Navbar/Footer/Config) directamente de la API Odoo.
3. **Configurar NextAuth.js** para conectar login de Google con creación de usuarios en Odoo.
4. **Construir el Portal del Cliente** en `/account` (Frontend y llamadas API).
5. **Configurar las acciones automatizadas en Odoo** para la facturación IRS-compliant.
