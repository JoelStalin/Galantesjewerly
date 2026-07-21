# Memoria operativa: equivalencia n8n para el agente de inventario

Fecha de auditoría: 2026-07-21
Ámbito: Galantes Jewelry, Orca central multiempresa, agente de inventario desde Google Drive.

## Estado comprobado en el repositorio

- `data/inventory-agent/manifests/drive-scan.json`: 1298 archivos del folder de Drive, todos omitidos por estar ya procesados.
- `data/inventory-agent/manifests/image-features.json`: 1298 imágenes procesadas, 0 errores.
- `data/inventory-agent/manifests/ml-product-clusters.json`: 1102 clusters base.
- `data/inventory-agent/manifests/ml-product-clusters-reviewed.json`: 1151 clusters revisados por el flujo actual.
- `data/inventory-agent/manifests/approved-products.json`: 1033 candidatos importados, 0 rechazados.
- El flujo de publicación local permanece protegido: el worker solo permite `odoo:dry-run`; la publicación de producción requiere el workflow protegido de GitHub Actions.

## Nodos y capacidades de n8n relevantes

La documentación oficial de n8n enumera como nodos core disponibles: Code, Edit Image, Error Trigger, Execute Sub-workflow, Execute Sub-workflow Trigger, Extract From File, HTTP Request, Loop Over Items, Merge, Read/Write Files from Disk, Remove Duplicates, Split Out, Stop And Error, Switch, Wait y Webhook. La página oficial del HTTP Request confirma que es el adaptador general para APIs; el índice oficial también documenta Google Drive, sus operaciones de archivos/carpetas y problemas comunes.

Referencias oficiales consultadas:

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- https://docs.n8n.io/integrations/builtin/core-nodes/
- https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googledrive/
- https://docs.n8n.io/flow-logic/error-handling/
- https://docs.n8n.io/flow-logic/looping/
- https://github.com/n8n-io/n8n/tree/master/packages/nodes-base/nodes

## Matriz de equivalencia para Orca

| Capacidad | n8n | Orca actual | Estado | Requisito de automatización |
|---|---|---|---|---|
| Inicio manual/programado | Manual Trigger/Schedule Trigger | blueprint + worker | Parcial | exponer trigger y ejecución idempotente en UI |
| Detección de Drive | Google Drive Trigger | `drive:scan` local | Parcial | OAuth/credencial por tenant, paginación y cursor |
| Descarga binaria | Google Drive Download | `drive:download` local | Parcial | streaming, checksum, MIME y límite de tamaño |
| Conversión/edición | Edit Image + Execute Command | `image:convert`, `image:enhance` | Parcial | contrato binario estable y fallback determinista |
| Clasificación/agrupación | Code/HTTP Request/AI | ML + Gemini local | Parcial | score, evidencia, revisión ambigua y reproducibilidad |
| Iteración | Loop Over Items | worker loop | Parcial | batch size, checkpoint y reanudación por item |
| Ramificación | If/Switch | decisiones del worker | Parcial | resultados visibles y rutas de error en Orca |
| Correlación | Merge/Item Linking | manifiestos | Parcial | conservar `driveFileId`, `clusterId` y `productId` |
| Descripciones | HTTP/AI nodes | proveedores configurados | Parcial | schema JSON, validación y fallback de proveedor |
| Reintento/autocorrección | Error Trigger/Stop And Error/Wait | monitor-loop | Parcial | error -> caso de uso -> investigación -> parche -> replay |
| Sub-workflows | Execute Sub-workflow | blueprint único | Pendiente | nodos reutilizables por tenant |
| Revisión humana | Wait / approval nodes | aprobación protegida | Parcial | UI Orca debe mostrar pausa, decisión y auditoría |
| Odoo | HTTP Request | `odoo:dry-run` | Parcial | JSON-2, idempotencia, backup y gate GitHub Actions |
| QA navegador | no es nodo nativo obligatorio | Selenium Profile 9 | Parcial | evidencia de shop/PDP, `naturalWidth > 0`, consola limpia |
| Reporte/evidencia | Execution Data/Code | live-status + manifests | Parcial | correlación de cada evidencia con taskId |

## Hallazgos de investigación

1. El workflow actual usa muchos `n8n-nodes-base.executeCommand`; eso permite operar los scripts locales, pero no equivale a exponer en Orca las funciones nativas de n8n.
2. Google Drive debe usar OAuth o Shared Drive/OAuth delegation según el tipo de cuenta. La autenticación de service account puede fallar por falta de cuota; no se debe ocultar ese error ni tratarlo como clasificación exitosa.
3. Un límite de listado no puede confundirse con el total del folder: el conector usado para inspección devuelve como máximo 1000 por llamada, mientras el manifiesto local conserva 1298. El adaptador debe paginar o validar el total antes de cerrar la ingesta.
4. La publicación no puede ser parte del loop automático sin aprobación: el diseño correcto es dry-run, backup, gate protegido, publicación idempotente y Selenium posterior.
5. Las galerías deben transportar todos los IDs de imágenes del cluster; una sola imagen representativa no es una galería completa.

## Casos de uso de autocorrección obligatorios

- `DRIVE_PAGE_TOKEN_MISSING`: guardar cursor, reanudar y comparar conteo total.
- `DRIVE_AUTH_OR_QUOTA`: clasificar como bloqueado, conservar evidencia y no borrar archivos.
- `BINARY_MIME_OR_SIZE`: convertir o aislar el archivo, nunca descartarlo silenciosamente.
- `CLUSTER_AMBIGUOUS`: enviar a revisión humana con pares de imágenes y scores.
- `CLUSTER_ID_DRIFT`: resolver siempre contra el cluster base estable y registrar el mapeo.
- `GALLERY_INCOMPLETE`: detener publicación del producto y reejecutar asociación de imágenes.
- `PROVIDER_QUOTA_OR_TIMEOUT`: cambiar al siguiente proveedor permitido, manteniendo taskId.
- `ODOO_DRY_RUN_MISMATCH`: detener gate y generar payload reproducible.
- `SELENIUM_IMAGE_BROKEN`: detener entrega, guardar screenshot/HTML/consola y activar fallback.

## Definición de terminado

El workflow solo se considera completo cuando Orca puede mostrar y ejecutar, por tenant, la secuencia Drive -> paginación -> descarga -> conversión -> features -> clustering -> revisión -> galería -> descripción -> precio/stock -> dry-run Odoo -> aprobación protegida -> publicación -> Selenium y evidencia, con reanudación por checkpoint y sin perder el `taskId`.

