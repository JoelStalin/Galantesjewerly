FROM node:22-alpine

WORKDIR /app
COPY 06_E_Commerce_Lux/Galantesjewelry/scripts/serve-orca-local.mjs /app/serve-orca-local.mjs
COPY apps/orca/workflow-editor/dist /app/orca/workflow-editor/dist
COPY apps/orca/data/workflow_blueprints.json /app/orca/data/workflow_blueprints.json
COPY 06_E_Commerce_Lux/Galantesjewelry/config/orca-tenants.json /app/orca/data/orca-tenants.json

ENV ORCA_UI_PORT=4173
ENV ORCA_UI_HOST=0.0.0.0
ENV ORCA_RUNTIME_ROOT=/app/orca
EXPOSE 4173
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4173/api/n8n/workflows || exit 1
CMD ["node", "/app/serve-orca-local.mjs"]
