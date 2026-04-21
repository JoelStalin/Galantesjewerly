# Topología de Red - Galante's Jewelry

Este documento detalla la infraestructura unificada y la separación de entornos entre Producción y Staging.

## 1. Entorno de PRODUCCIÓN (Main Branch)
*   **Servidor:** Google Cloud VM (`136.114.48.210`)
*   **Dueño Cloudflare:** `ceo@galantesjewelry.com`
*   **Dominio Principal:** [galantesjewelry.com](https://galantesjewelry.com)
*   **Puertos Expuestos (Túnel):**
    *   Web (Next.js): `localhost:3000`
    *   Odoo ERP: `localhost:8069`
*   **Base de Datos:** Docker Postgres (Volumen: `postgres-data`)

## 2. Entorno de STAGING / TEST (Develop Branch)
*   **Servidor:** ssg Getupsoft (`192.168.1.233` - Local)
*   **Dueño Cloudflare:** `joelstalin2105@gmail.com`
*   **Dominios de Prueba:**
    *   **SSH/Entry:** [stg.getupsoft.com.do](https://stg.getupsoft.com.do)
    *   **Web:** [galantes.getupsoft.com.do](https://galantes.getupsoft.com.do) (Puerto local: `3030`)
    *   **Odoo:** [galantes-odoo.getupsoft.com.do](https://galantes-odoo.getupsoft.com.do) (Puerto local: `8070`)
*   **Proyecto Docker:** `galantes-staging` (Aislado de otros proyectos)
*   **Base de Datos:** Docker Postgres (Volumen: `db-staging-data`)

## 3. Flujo de Despliegue (GitHub Actions)
1.  **Push a `develop`:** Despliegue quirúrgico a Getupsoft. Actualiza solo los contenedores afectados. Mapea puertos 3030/8070.
2.  **Push a `main`:** Despliegue quirúrgico a GCP. Mapea puertos 3000/8069.

---
*Última actualización: 21 de Abril, 2026*

# Retry staging deploy v2
