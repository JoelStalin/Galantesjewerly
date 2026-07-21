# Aislamiento de compañías en Orca

Cada compañía debe operar como un tenant independiente. No se deben compartir entre tenants workflows, memoria, logs, evidencias, credenciales, conexiones Odoo, archivos de Drive ni colas de ejecución.

Galantes Jewelry está registrado como tenant `galantesjewelry`, con proyecto del mismo nombre y usuario propietario `galantesjewelry-ceo`.

Reglas obligatorias:

- Toda lectura o escritura debe resolver primero `tenant_id` desde la sesión autenticada.
- Un usuario solo puede listar o ejecutar workflows incluidos en su tenant.
- Las rutas de memoria, logs y evidencias deben derivarse del tenant; nunca usar un directorio global.
- Las credenciales se leen por nombre desde el entorno del tenant y nunca desde JSON de workflows.
- Las llamadas a Odoo deben usar la conexión del tenant y su propia idempotencia.
- Un workflow de una compañía no puede ser visible ni ejecutable desde otra compañía.

Configuración fuente: `config/orca-tenants.json`.
