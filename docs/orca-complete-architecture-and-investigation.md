# Orca Complete Architecture, Node Debugger & AI Feedback Loop Investigation

This document provides a comprehensive research, architecture, and operational specification for the Orca multi-tenant automation engine, its n8n-compatible workflow execution debugger with node breakpoints, and the human-in-the-loop Vision AI classification feedback loop.

---

## 1. Executive Summary & Ecosystem Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                GetUpSoft Ecosystem                                     │
│   Mother Company: GetUpSoft | Client Tenant: Galantes Jewelry (galantesjewelry)        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Multi-Tenant Isolation Policy
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                       Orca Core Engine (apps/orca)                                     │
│   - Port: 4173 | Host Gateway Nginx: 80 / 443 (orca.dev)                                │
│   - Node Execution Debugger & Breakpoint State Machine                                  │
│   - Vision AI Classification Feedback & Few-Shot Prompt Generator                      │
└───────────────────────┬────────────────────────────────────────┬───────────────────────┘
                        │ HTTP APIs                              │
┌───────────────────────▼────────────────┐      ┌────────────────▼───────────────────────┐
│  Galantes Jewelry Admin Dashboard      │      │    Local LM / Reasoning Engine         │
│  (app/admin/orca-debug)                │      │    (Hermes / Ollama / Gemini Vision)   │
│  - Breakpoints Toggle & Step Debugger  │      │    - Enriched by Few-Shot Prompt Context│
│  - Vision AI Label Correction Panel    │      │    - High-Confidence Automated Output   │
└────────────────────────────────────────┘      └────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Architecture & Client Isolation

Orca operates under a **Strict Tenant Isolation Policy** (`config/orca-tenants.json`):

- **Mother Company:** GetUpSoft (`getupsoft`)
- **Client Tenant:** Galantes Jewelry (`galantesjewelry`)
- **Tenant Scope Enforcement:**
  - Workspace Root: `C:/Users/yoeli/Documents/GetUpSoft_Workspace/06_E_Commerce_Lux/Galantesjewelry`
  - Logs Directory: `data/orca/tenants/galantesjewelry/logs/orca-classification-feedback.json`
  - Memory Root: `data/orca/tenants/galantesjewelry/memory`
  - Evidence Root: `data/orca/tenants/galantesjewelry/evidence`
- **HTTP Header Scoping:** All client-side requests from Galantes Jewelry pass `x-orca-tenant: galantesjewelry` and `x-orca-project: galantesjewelry`.

---

## 3. n8n Feature Parity & Workflow Debugger Engine

Orca provides full n8n-compatible workflow orchestration across **14 Modular Workflows**:

1. **Intake Orchestrator:** Idempotent batch trigger and execution context setup.
2. **Incremental Drive Scan:** pHash and MD5 diff check skipping previously processed photos.
3. **Photo Download:** Local caching with checksum verification.
4. **Image Feature Extraction:** Deterministic aspect, contrast, and feature hashing.
5. **Product Clustering:** `scikit-learn` DBSCAN / k-NN visual embeddings grouping.
6. **Cluster Review Reasoning:** Vision LLM invocation only for low-confidence clusters.
7. **Image Enhancement:** Catalog image normalization and cropping.
8. **Human Review Export:** Exporting candidates to CSV / Google Sheets / Orca UI.
9. **Human Review Import:** Importing admin approvals and price/cost/stock boundaries.
10. **Odoo DTO Field Export:** Pre-flight schema validation against Odoo `product.template`.
11. **Description Generation:** Automated sales copy generation via Hermes / Gemini QA.
12. **Odoo Dry Run:** Zero-write payload validation and diff preview.
13. **Odoo Publication:** Write execution gated by explicit human approval token.
14. **Post-Publish Browser QA:** Selenium Profile 9 E2E validation (`naturalWidth > 0`).

### Interactive Node Breakpoints & Step Debugger
- **Node States:** `idle`, `running`, `paused_at_breakpoint`, `completed`, `failed`.
- **Breakpoint Controls:** Admin can toggle `● STOP BREAKPOINT` on any node.
- **Actions:**
  - `start`: Begins execution at the first node.
  - `step`: Executes the current node and moves to the next.
  - `resume`: Continues execution until the next breakpoint.
  - `override`: Allows manual modification of node payload before downstream execution.

---

## 4. Vision AI Classification & LM Feedback Loop

To continually improve model accuracy without manual retraining:

1. **Classification Logging:** Every image analyzed records predicted category, tags, and confidence score.
2. **Admin Feedback Interface:** The Galantes Jewelry admin reviews the prediction in `/admin/orca-debug` and clicks **Approve** or **Edit / Correct**.
3. **Few-Shot Prompt Injection:** Approved and corrected classifications are stored in `data/orca/tenants/galantesjewelry/logs/orca-classification-feedback.json`.
4. **Prompt Generator (`generateFewShotPromptContext`):** Automatically formats human corrections into structured system prompt context for subsequent model invocations:

```text
--- TENANT (galantesjewelry) HUMAN-VERIFIED FEW-SHOT EXAMPLES FOR LM ACCURACY ---
[Verified Example] Image File: cluster-1002-1.jpg | Cluster: GAL-1002 -> Category: "Necklaces" | Tags: [Layered Gold, 18K Gold, Necklace]
----------------------------------------------------------------------------------
```

---

## 5. Verification & Testing

- **Unit Testing Suite:** `tests/unit/orca-feedback.test.ts` (Vitest) verified 100% passing.
- **Local Server Test:** `node apps/orca/scripts/serve-orca-local.mjs` listening on port `4173` / `http://orca.dev`.
- **Production VM Sync:** Deployed and pulled on GCP VM `galantes-prod-vm`.
