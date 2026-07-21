# Workflow: facturación Odoo desde el chat de Orca

Este workflow es independiente de `galantes-inventory-agent` y de todos los workflows anteriores.

## Contrato

El chat recibe una solicitud de factura, extrae cliente y líneas, valida los datos y crea únicamente un borrador en Odoo. Orca muestra la vista previa y exige aprobación humana antes de confirmar (`account.move`, `move_type=out_invoice`). Nunca publica automáticamente una factura.

## Controles

- Odoo se integra únicamente mediante JSON-2 y credenciales de `process.env`.
- Se exige una clave de idempotencia para impedir facturas duplicadas.
- Cliente, producto, cantidad, precio, moneda e impuestos deben estar completos antes del borrador.
- Los errores se registran para reintento seguro; no se reenvía una confirmación ya aceptada.
- El workflow queda en `ready_to_run` hasta probar el gateway local y Odoo con una base de staging.

## Ejemplo de conversación

`Crea una factura para cliente@example.com por 2 unidades de SKU-001 a 50 USD, impuesto 0%`.

La respuesta esperada antes de confirmar es una vista previa con cliente, líneas, subtotal, impuestos, total y el identificador del borrador. La confirmación requiere una acción explícita del usuario en Orca.
