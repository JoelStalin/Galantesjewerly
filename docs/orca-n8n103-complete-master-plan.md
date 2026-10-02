# Orca Engine Plan & Implementation Blueprint
Based on n8n Academy N8N103 Course: *In Practice: AI, Testing & Best Practices*

This document translates the complete syllabus, strategies, testing paradigms, and AI agent architectures from the **n8n N8N103 Advanced Course** into native features for **Orca Engine** (`apps/orca` and `06_E_Commerce_Lux/Galantesjewelry`).

---

## 1. Executive Summary & Capabilities Alignment

| n8n 103 Core Pillar | n8n Concept | Orca Native Feature Implementation | Status |
|---|---|---|---|
| **AI-Powered Workflows** | AI Agent, Memory (Window/Summary), Vector Tools | Hermes Agent / Ollama / Gemini Vision integration, Few-Shot Prompt Generator (`lib/orca/classification-feedback.ts`), RAG / Parquet visual vector search. | **READY** |
| **Testing & Debugging** | Execution Logs, Node Breakpoints, Try/Catch, Error Trigger | Interactive Node Step Debugger (`serve-orca-local.mjs`), Live Payload Overrides, Error Use-Case Registry (`inventory-agent-error-use-cases.md`). | **READY** |
| **Workflow Organization** | Sub-workflows, Folder Scoping, Env Variables | 14 Idempotent Modular Workflows (`inventory-agent-n8n-node-inventory.md`), Tenant Isolation (`config/orca-tenants.json`). | **READY** |
| **Stock & Valuation Gates** | Conditional Branching, Human-in-the-loop Approval | High-Value ($\ge \$500$) Human Approval Gate (`evaluateStockReorderStrategy`), Automated Low-Value Reordering. | **READY** |

---

## 2. Plan & Actionable Implementation Steps

```
[ Phase 1: AI Agent & Memory Layer ]
  ├── 1.1 Hermes / Ollama / Gemini Vision Multi-Provider Fallback
  ├── 1.2 Conversation & Classification Memory Store (Tenant Isolated)
  └── 1.3 Few-Shot Dynamic System Prompt Enrichment

[ Phase 2: Production Testing & Debugger State Engine ]
  ├── 2.1 Interactive Breakpoint Control Panel (/admin/orca-debug)
  ├── 2.2 Live Node Payload Overrides (Step Next, Resume)
  └── 2.3 Comprehensive Unit & Selenium E2E Regression Testing Suite

[ Phase 3: Stock Governance & Valuation Strategy ]
  ├── 3.1 Min-Threshold Stock Monitoring (default: 5 units)
  ├── 3.2 Low-Value Automatic Draft Purchase Orders (< $500)
  └── 3.3 High-Value Human Sign-Off Gate (>= $500)
```

---

## 3. Verification Plan

1. **Unit Testing:** Execute Vitest suite `npm test` verifying 100% pass rate.
2. **Local Debugger API:** Verify `http://orca.dev:4173/api/orca/execution/state` returns active breakpoint status.
3. **Production VM Sync:** Deploy updates to canonical GCP VM `galantes-prod-vm`.
