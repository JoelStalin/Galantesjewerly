# Orca Inventory Orchestration Contract

Orca is the control plane for the Galantes inventory agent. n8n executes the
workflow graph, while the local script worker performs deterministic Drive,
image, clustering, review, and dry-run operations.

The blueprint is stored at
`workflows/orca/galantes-inventory-agent.blueprint.json` and is intended for
import into the Orca workflow UI. It must remain `draft` until every node has a
real execution result and evidence artifact.

## Control rules

- Orca starts, pauses, retries, and reports workflow execution.
- n8n invokes only allowlisted `nodes.mjs` commands or an isolated local worker.
- Local scripts run before any model call.
- Hermes/Ollama are preferred for reasoning and copy; Gemini/OpenAI are fallback
  providers only when the local provider cannot satisfy the node contract.
- Price, cost, stock, publication, cleanup, and ambiguous cluster decisions
  require human approval.
- A failed node enters `research_required`; it cannot retry until its error case
  and investigation record exist.
- Production completion requires real Selenium Profile 9 evidence.
