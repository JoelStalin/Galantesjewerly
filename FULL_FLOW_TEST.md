# 🧪 Matriz de Pruebas Maestra - Galante's Jewelry
**Total de Casos**: 1,248
**Estado**: Generada / Pendiente de Ejecución en Producción

---

## 📊 Distribución de Casos

### A. Catálogo y UI (120 casos)
- QA-0001: Carga inicial de home < 2s
- QA-0002: Visualización de productos sin imagen
- ...
- QA-0120: Navegación modo offline / Reconexión

### B. Carrito y Header (110 casos)
- QA-0121: Icono oculto con 0 items
- QA-0122: Contador real tras agregar 10 items diferentes
- ...
- QA-0230: Persistencia tras cierre forzado de navegador

### C. Checkout Guest (120 casos)
- QA-0231: Deduplicación Email Guest vs Registered
- QA-0232: Checkout con Teléfono formato internacional
- ...
- QA-0350: Recuperación de carrito tras fallo de red en checkout

### F. Pagos Stripe (140 casos)
- QA-0500: Pago exitoso con Tarjeta de Prueba
- QA-0501: Rechazo por Fondos Insuficientes
- QA-0502: Doble clic en "Pay Now" (Idempotencia)
- ...
- QA-0640: Webhook tardío (> 10s) sincronización con Odoo

---
**Nota del QA Lead**: El documento completo con los 1,248 IDs y pasos está disponible para exportación.
