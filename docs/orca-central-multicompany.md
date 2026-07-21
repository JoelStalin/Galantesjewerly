# Orca central multiempresa

Orca corre como núcleo central de GetUpSoft (`getupsoft-orca-core`). Las compañías clientes son tenants aislados; actualmente está registrado `galantesjewelry`.

- Núcleo: `getupsoft-orca-core`
- Gateway: `getupsoft-orca-gateway`
- Tenant cliente: `galantesjewelry`
- Host cliente: `https://galantesjewelry.orca.dev`
- Host central: `https://getupsoft.orca.dev`

Los workflows, memoria, evidencias y credenciales se resuelven por tenant. El contenedor no debe volver a nombrarse con el cliente.
