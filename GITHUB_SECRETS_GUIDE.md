# 🛡️ Guía de Secretos: Galante's Jewelry (GitHub Actions)

Este documento contiene la lista de secretos que deben configurarse en GitHub para habilitar el despliegue automático hacia Google Cloud y la réplica en Android.

## 📍 Ubicación en GitHub
`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

## 🔑 Lista de Secretos

| Name | Secret Value |
| :--- | :--- |
| `CF_EMAIL` | [TU_EMAIL_DE_CLOUDFLARE] |
| `CF_API_KEY` | [TU_LLAVE_GLOBAL_CLOUDFLARE]
| `CF_ACCOUNT_ID` | 8cbbddeadb7b99052dcc0844332ed93d3 |
| `CF_TUNNEL_TOKEN` | [TU_TOKEN_TUNEL_CLOUDFLARE]
| `GCP_PROJECT_ID` | deft-haven-493016-m4 |
| `GCP_VM_IP` | 136.114.48.210 |
| `ADMIN_PASSWORD` | REDACTED_ROTATE_IMMEDIATELY |
| `POSTGRES_PASSWORD` | REDACTED_ROTATE_IMMEDIATELY |
| `ADMIN_SECRET_KEY` | REDACTED_ROTATE_IMMEDIATELY |
| `META_SYNC_TOKEN` | GalantesjewelryMetaSync2026 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_test_51TNE6m8l0sMsruBLKIQTmhzKM66zOiMJyqJ8h2XHCJA9PpEg7WeIzIKwab3bnxl3UbltOOMnUYN2OoimdFqE7KqU00CaqsXxsW |
| `STRIPE_SECRET_KEY` | [TU_LLAVE_SECRETA_STRIPE]
| `STRIPE_WEBHOOK_SECRET` | [Obtén esto ejecutando stripe listen o en el dashboard] |
| `INTEGRATIONS_SECRET_KEY` | GalantesjewelryIntegrations2026 |

---
**Nota**: Una vez configurados, estos valores estarán encriptados y solo podrán ser leídos por los flujos de trabajo de GitHub.
