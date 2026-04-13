# Prueba de Flujo Completo - Galante's Jewelry

## 📊 Flujo Completo: Producto → Venta → Envío

Este documento te guía a través de **TODO el proceso** desde agregar un producto hasta enviar un pedido a un cliente.

---

## 🚀 INICIO RÁPIDO

### 1. Asegúrate que Docker Desktop esté corriendo

```powershell
# Verifica Docker
docker ps

# Si muestra error, inicia Docker Desktop desde Start Menu
```

### 2. Inicia todos los servicios

```powershell
cd C:\Users\yoeli\Documents\Galantesjewerly

# Windows - Script automático
scripts\full-flow-test.bat

# O manual
docker-compose -f docker-compose.production.yml up -d --build

# Espera 2-3 minutos
```

### 3. Verifica que todos los servicios están sanos

```powershell
docker-compose -f docker-compose.production.yml ps

# Esperado:
# galantes_db     Up (healthy)
# galantes_odoo   Up (healthy)
# galantes_web    Up (healthy)
# galantes_nginx  Up (healthy)
```

---

## 📝 FLUJO PASO A PASO

---

## PASO 1️⃣: CREAR PRODUCTOS

### Objetivo
Agregar 3 productos de prueba en Odoo con imágenes, precios y detalles.

### Instrucciones

**1. Abre Odoo Admin**
- URL: http://localhost:8069
- Username: `admin`
- Password: `admin`
- Click "Log in"

**2. Navega a Productos**
- Menu principal (esquina superior izquierda)
- Busca "Productos" o "Products"
- Click "Productos" → "Productos"

**3. Crea Producto #1: Anillo de Diamante**

- Click botón azul **"+ Crear"**
- **Nombre**: `Engagement Ring - 14K Gold`
- **Código/SKU**: `RING-001`
- **Categoría**: Crear "Anillos" (o seleccionar si existe)
- **Material**: Click en campo "Material" → Seleccionar "Oro" o crear
- **Precio de venta**: `2499.00`
- **Imagen**: (Opcional) Click en zona de imagen para subir foto
- **Descripción**: 
  ```
  Hermoso anillo de compromiso en oro de 14 quilates.
  Incluye certificado de autenticidad.
  Disponible en varias tallas.
  ```
- Scroll abajo hasta encontrar **"Available on Website"** ✓ Marcar
- Click botón **"Guardar"** (arriba a la izquierda)

**Resultado esperado**: Producto aparece en lista

**4. Crea Producto #2: Pulsera de Plata**

- Click **"+ Crear"**
- **Nombre**: `Nautical Silver Bracelet`
- **Código/SKU**: `BRAC-001`
- **Categoría**: Crear "Pulseras"
- **Material**: Seleccionar "Plata"
- **Precio de venta**: `349.00`
- **Descripción**: 
  ```
  Pulsera de plata con motivos náuticos.
  Fabricada a mano por artesanos locales.
  Resistente al agua.
  ```
- Marcar **"Available on Website"** ✓
- Click **"Guardar"**

**5. Crea Producto #3: Collar de Diamantes**

- Click **"+ Crear"**
- **Nombre**: `Diamond Platinum Necklace`
- **Código/SKU**: `NECK-001`
- **Categoría**: Crear "Collares"
- **Material**: Crear "Platino"
- **Precio de venta**: `4999.00`
- **Descripción**: 
  ```
  Collar de platino con diamantes naturales.
  Diseño exclusivo, limitado a 5 unidades.
  Viene con caja de lujo.
  ```
- Marcar **"Available on Website"** ✓
- Click **"Guardar"**

### ✅ Verificación
- [ ] 3 productos creados
- [ ] Todos marcados "Available on Website"
- [ ] Todos tienen precio > 0
- [ ] Todos tienen SKU único

---

## PASO 2️⃣: VERIFICAR PRODUCTOS EN LA TIENDA

### Objetivo
Confirmar que los productos creados aparecen en el catálogo público.

### Instrucciones

**1. Abre la Tienda**
- URL: http://localhost:8080/shop
- O: http://localhost:8069/shop (desde Odoo)

**2. Observa lo que ves**
- Verás un grid de productos
- Cada tarjeta muestra:
  - Imagen (si existe)
  - Nombre del producto
  - Precio
  - Disponibilidad
  - Botón "View Details" o "Add to Cart"

**3. Verifica cada producto**
- [ ] "Engagement Ring - 14K Gold" visible con precio $2,499.00
- [ ] "Nautical Silver Bracelet" visible con precio $349.00
- [ ] "Diamond Platinum Necklace" visible con precio $4,999.00

**4. Prueba responsive**
- Abre DevTools (F12)
- Cambia a vista móvil (Ctrl+Shift+M)
- Verifica que los productos se ven bien en móvil

### ✅ Verificación
- [ ] Todos los productos aparecen en /shop
- [ ] Precios correctos
- [ ] Imágenes cargan (si las subiste)
- [ ] Responsive en móvil

---

## PASO 3️⃣: CREAR UN CLIENTE

### Objetivo
Crear un cliente de prueba para hacer el pedido.

### Instrucciones

**1. En Odoo, ve a Contactos**
- Menu → Contactos (o CRM → Contactos)

**2. Click "+ Crear"**

**3. Llena los datos**
- **Nombre**: `Juan Pérez`
- **Email**: `juan@example.com`
- **Teléfono**: `555-0123`
- **Dirección**: `Calle Principal 123, Miami, FL 33101`
- **País**: United States (o tu país)
- **Ciudad**: `Miami`
- **Código Postal**: `33101`

**4. Marca como Cliente**
- Scroll abajo
- Busca "Is a customer" o similar
- Marcar ✓

**5. Click "Guardar"**

### ✅ Verificación
- [ ] Cliente creado exitosamente
- [ ] Se puede acceder desde Ventas → Clientes

---

## PASO 4️⃣: CREAR UN PEDIDO

### Objetivo
Crear un pedido de compra para el cliente.

### Instrucciones

**1. Navega a Pedidos**
- Menu → Ventas (Sales) → Pedidos (Orders)

**2. Click "+ Crear"**

**3. Selecciona el Cliente**
- Click en campo "Cliente"
- Busca y selecciona "Juan Pérez"

**4. Agrega Líneas de Pedido**
- Scroll abajo a "Líneas de pedido" (Order Lines)
- Click botón "Agregar una línea"
- Se abrirá un modal o nueva fila

**5. Línea #1: Anillo de Diamante**
- **Producto**: Busca y selecciona "Engagement Ring - 14K Gold"
- **Cantidad**: `1`
- **Precio unitario**: Debería auto-llenar $2,499.00
- Click ✓ o Enter

**6. Línea #2: Pulsera de Plata**
- Click "Agregar una línea" de nuevo
- **Producto**: "Nautical Silver Bracelet"
- **Cantidad**: `2`
- Click ✓

**7. Línea #3: Collar de Diamantes**
- Click "Agregar una línea"
- **Producto**: "Diamond Platinum Necklace"
- **Cantidad**: `1`
- Click ✓

**8. Verifica el pedido**
- Total debería ser: (1 × $2,499) + (2 × $349) + (1 × $4,999) = $8,195.00

**9. Click "Guardar"**

### ✅ Verificación
- [ ] Pedido creado con número (ej: SO001, SO002, etc)
- [ ] 3 líneas visibles
- [ ] Total correcto
- [ ] Estado: "Presupuesto" (Draft) o similar

---

## PASO 5️⃣: CONFIRMAR PEDIDO

### Objetivo
Cambiar el estado del pedido a "Confirmado".

### Instrucciones

**1. En el pedido creado, busca el botón "Confirmar"**
- Debería estar en la barra superior de acciones
- O en dropdown de acciones

**2. Click "Confirmar"**

**3. Se abrirá un diálogo**
- Confirma los detalles
- Click "Confirmar" en el diálogo

**4. Observa el cambio**
- El estado del pedido cambia a "Confirmado" (Confirmed)
- Ahora muestra opciones para facturación y envío

### ✅ Verificación
- [ ] Botón "Confirmar" procesado
- [ ] Estado cambiado a "Confirmado"
- [ ] Aparecen opciones de "Crear Factura"

---

## PASO 6️⃣: CREAR FACTURA

### Objetivo
Generar una factura para el pedido.

### Instrucciones

**1. En el pedido confirmado, busca "Crear Factura"**
- Debería ser un botón o opción de acción

**2. Click "Crear Factura"**

**3. Se abrirá formulario**
- **Tipo de Factura**: "Factura" (Invoice)
- **Líneas**: Debería mostrar las líneas del pedido
- **Cantidad de facturación**: Debería ser igual a cantidad de pedido
- Leave defaults, click "Crear"

**4. Se creará la factura**
- Ahora ves la factura con número (ej: INV/2026/0001)
- Estado: "Borrador" (Draft)

### ✅ Verificación
- [ ] Factura creada con número
- [ ] Todas las líneas en la factura
- [ ] Total correcto
- [ ] Estado: "Borrador"

---

## PASO 7️⃣: VALIDAR FACTURA

### Objetivo
Finalizar la factura (cambiar a estado "Publicada" o "Validada").

### Instrucciones

**1. En la factura, busca el botón "Registrar"**
- O "Validar" o "Confirmar"
- Odoo puede variar según versión

**2. Click para validar la factura**

**3. Se abrirá diálogo**
- Confirma detalles
- Click "Registrar" o "Validar"

**4. La factura ahora está publicada**
- No se puede editar
- Muestra número de factura final
- Estado: "Publicada" (Posted)

### ✅ Verificación
- [ ] Factura en estado "Publicada"
- [ ] No se puede editar
- [ ] Aparecen opciones de pago/envío

---

## PASO 8️⃣: CREAR ENVÍO

### Objetivo
Crear un envío de mercancía para el pedido.

### Instrucciones

**1. Vuelve al pedido original**
- Menu → Ventas → Pedidos
- Abre el mismo pedido (debería estar confirmado)

**2. Scroll abajo y busca pestaña "Envíos" (Shipments/Pickings)**
- O "Entrega" (Delivery)
- Click en esa pestaña

**3. Si no hay envío, click "Crear Envío"**
- O "Crear recepción"
- Odoo puede mostrar botón en pantalla

**4. En el formulario de envío**
- **Dirección de destino**: Debería estar pre-llenada con dirección del cliente
- **Líneas de envío**: Muestra productos a enviar
- **Cantidad**: Debería ser igual a cantidad pedida

**Ejemplo esperado:**
```
Producto                    | Cantidad | Paquete
Engagement Ring - 14K Gold  |    1     |  1
Nautical Silver Bracelet    |    2     |  1
Diamond Platinum Necklace   |    1     |  1
```

**5. Verifica las cantidades**
- Todos los campos "Hecho" (Done) deben tener cantidad > 0

**6. Click "Validar" o "Confirmar"**

### ✅ Verificación
- [ ] Envío creado
- [ ] Dirección correcta
- [ ] Todas las líneas presentes
- [ ] Cantidades correctas

---

## PASO 9️⃣: VALIDAR ENVÍO

### Objetivo
Finalizar el envío (confirmar que mercancía fue despachada).

### Instrucciones

**1. En el envío creado, busca botón "Validar"**
- O "Confirmar Envío"
- O "Procesar Envío"

**2. Click "Validar"**

**3. Confirmación**
- Se abrirá diálogo
- Confirma que mercancía está lista
- Click "Validar" o "Confirmar"

**4. Envío completado**
- Estado cambia a "Hecho" (Done) o "Enviado" (Shipped)
- Se genera referencia de envío

### ✅ Verificación
- [ ] Envío en estado "Hecho" o "Enviado"
- [ ] Tiene número de referencia
- [ ] Puedes descargar etiqueta (si hay carrier configurado)

---

## PASO 1️⃣0️⃣: CICLO COMPLETO

### Objetivo
Verificar que el flujo completo está finalizado.

### Checklist Final

- [ ] **Productos creados**: 3 productos con precios y disponibilidad
- [ ] **Cliente creado**: Juan Pérez con dirección completa
- [ ] **Pedido creado**: 3 líneas con productos
- [ ] **Pedido confirmado**: Estado = Confirmado
- [ ] **Factura creada**: Número de factura generado
- [ ] **Factura validada**: Estado = Publicada
- [ ] **Envío creado**: Dirección correcta, líneas completas
- [ ] **Envío validado**: Estado = Hecho/Enviado

### Resultado Final
**CICLO COMPLETO EXITOSO** ✓

```
Producto: Engagement Ring - 14K Gold
Cliente: Juan Pérez (juan@example.com)
Pedido: SO001
Factura: INV/2026/0001
Envío: PICK001
Estado: ✓ Completado
Total: $8,195.00
```

---

## 🧪 PRUEBAS ADICIONALES (Opcional)

### Test de Portal de Cliente (si está habilitado)
```
URL: http://localhost:8069/my/orders
Login como cliente (si existe la funcionalidad)
Ver pedidos desde perspectiva del cliente
```

### Test de Reportes
```
Menu → Ventas → Reportes
Ver análisis de ventas
Verificar que el pedido aparece en estadísticas
```

### Test de Respuesta de Correo (si está configurado)
```
Odoo debería enviar correos por:
- Confirmación de pedido
- Factura generada
- Confirmación de envío
Revisar bandeja (si SMTP está configurado)
```

---

## 📊 MÉTRICAS DE TESTING

| Métrica | Esperado | Actual |
|---------|----------|--------|
| Servicios activos | 4/4 | ☐ |
| Productos creados | 3/3 | ☐ |
| Cliente creado | 1/1 | ☐ |
| Pedido creado | 1/1 | ☐ |
| Pedido confirmado | ✓ | ☐ |
| Factura creada | 1/1 | ☐ |
| Factura publicada | ✓ | ☐ |
| Envío creado | 1/1 | ☐ |
| Envío validado | ✓ | ☐ |
| **Total**: Ciclo completo | ✓ | ☐ |

---

## 🛠️ COMANDOS ÚTILES DURANTE TESTING

```powershell
# Ver logs en tiempo real
docker-compose -f docker-compose.production.yml logs -f

# Ver solo logs de Odoo
docker-compose -f docker-compose.production.yml logs -f odoo

# Reiniciar Odoo si falla algo
docker-compose -f docker-compose.production.yml restart odoo

# Reiniciar todos los servicios
docker-compose -f docker-compose.production.yml restart

# Detener servicios
docker-compose -f docker-compose.production.yml down

# Borrar todo y empezar de cero (CUIDADO: borra datos)
docker-compose -f docker-compose.production.yml down -v
docker-compose -f docker-compose.production.yml up -d --build
```

---

## 📞 PROBLEMAS COMUNES

### Problema: "No puedo encontrar el botón Confirmar"
**Solución**: 
- Asegúrate que el pedido está en estado "Presupuesto" (Draft)
- Scroll a la parte superior de la página
- Busca en el dropdown de acciones (esquina superior)

### Problema: "No aparecen los productos en /shop"
**Solución**:
- Asegúrate de marcar "Available on Website" ✓
- Espera 1-2 minutos para que Odoo sincronice
- Recarga la página (Ctrl+Shift+R en navegador)

### Problema: "No puedo crear factura"
**Solución**:
- El pedido debe estar "Confirmado" primero
- Si ya está confirmado, busca botón "Crear factura" en la pestaña de facturación

### Problema: "Envío no aparece"
**Solución**:
- El pedido debe estar confirmado
- Busca pestaña "Envíos" o "Entregas" en el pedido
- Puede que ya exista automáticamente, solo necesita validarse

### Problema: "Odoo muestra error al guardar"
**Solución**:
- Verifica que todos los campos requeridos estén llenos
- Revisa los logs: `docker-compose logs odoo`
- Intenta guardar nuevamente

---

## ✅ ÉXITO

Cuando completes TODOS los pasos, tendrás:

✓ **3 productos** en el catálogo  
✓ **1 cliente** con información completa  
✓ **1 pedido** confirmado  
✓ **1 factura** publicada  
✓ **1 envío** validado  

**Flujo completo: Producto → Venta → Envío** 🎉

---

## 📖 Siguientes Pasos

1. **Repetir el flujo** con más productos y clientes
2. **Probar descuentos** (si está configurado)
3. **Probar pagos** (si está configurado)
4. **Agregar Odoo API routes** para que shop cargue productos automáticamente
5. **Configurar Meta integration** para sincronizar a Facebook/Instagram
6. **Deploy a producción** (ver `docs/deployment-checklist.md`)

---

## 💬 Documentación Relacionada

- `START_HERE.md` - Inicio rápido
- `TESTING.md` - Guía de testing completa
- `QUICKSTART.md` - 5-minuto summary
- `docs/deployment-checklist.md` - Pre-deployment
- `docs/deployment-notes.md` - Infraestructura y SSL

---

**¡Bienvenido al testing end-to-end!** 🚀
