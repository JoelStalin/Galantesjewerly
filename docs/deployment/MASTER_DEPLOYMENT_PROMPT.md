# MASTER PROMPT: AUTONOMOUS PRODUCTION DEPLOYMENT LOOP (Galantes Jewelry)

## 🎯 MISSION
Execute the full production deployment strategy for Galantes Jewelry, transitioning from manual/fragmented deployments to a professional, secure, and automated GitHub Actions pipeline. 

**INFRASTRUCTURE MANDATE:** Use **Google Cloud Platform (GCP)** for all environments. **VERCEL IS STRICTLY FORBIDDEN.** 
- **Local:** Docker Compose matching production topology.
- **Staging:** GCP VM / Container environment acting as the primary testbed for both local and remote validation.
- **Production:** GCP VM `galantes-prod-vm`.

**YOU ARE IN AUTONOMOUS MODE.** Your goal is to reach the Definition of Done (DoD) without requesting user intervention unless a decision requires a business preference or a critical security credential you cannot access.

---

## 🔄 THE AUTONOMOUS LOOP LOGIC
For every task in the backlog (DPL-1 to DPL-11), apply the following loop:

1. **PLAN:** Analyze the current state and define the exact steps to complete the task.
2. **EXECUTE:** Perform the actions (commands, file edits, configurations).
3. **VALIDATE:** Verify the result against the task's specific success criteria.
4. **HANDLE BLOCKERS (The Auto-Heal Phase):**
   - If a command fails, an error occurs, or a blocker is found:
     - **DO NOT STOP.**
     - **RESEARCH:** Use `google_web_search` and `web_fetch` to investigate the exact error message, logs, and documentation.
     - **HYPOTHESIZE:** Formulate 2-3 possible solutions based on the research.
     - **TEST & FIX:** Apply the best solution and re-validate.
     - **REPEAT:** Loop until the blocker is resolved or the task is successfully completed.
5. **DOCUMENT:** Record the result and evidence in the appropriate logs/docs.
6. **NEXT:** Move to the next DPL item.

---

## 🚫 MANDATORY CONSTRAINTS (ZERO TOLERANCE)
You MUST adhere to these rules during the entire loop. Any violation is a failure.

- **Cloudflare Tunnel:** NEVER stop, restart, or recreate `cloudflared` unless explicitly required by a specific infra change and approved.
- **Backups:** NO "non-blocking" backups. Every deploy MUST start with a blocking, verified backup. If the backup fails, the deploy ABORTS.
- **Direct Access:** NO direct `scp`, `git reset --hard`, or SQL edits in production as a normal deploy mechanism. Everything goes through PR -> CI -> Staging -> GitHub Actions.
- **Data Integrity:** NEVER delete or overwrite images, galleries, or Odoo data without a verified backup.
- **Environment Separation:** Staging MUST NOT touch `galantes_prod` database.

---

## 📋 EXECUTION BACKLOG (DPL)

### Phase 1: Baseline & Alignment
- **DPL-1: Productive Inventory:** Create `docs/deployment/inventory.md` with all paths, ports, domains, volumes, and services.
- **DPL-2: Agent Rules:** Update `AGENTS.md` with the "Galantes Production Deployment Policy".
- **DPL-3: Repo Renewal:** Reconcile `Galantesjewerly.git` against the production VM state (files only, no secrets).
- **DPL-4: Git Strategy:** Set `Galantesjewerly.git` as canonical. Configure `GetUpSoft_Workspace` as a controlled mirror/subtree.

### Phase 2: Pipeline Architecture
- **DPL-5: CI Workflow:** Setup lint, typecheck, and build checks for PRs.
- **DPL-6: Staging Workflow:** Automate deploy from `develop` branch to Staging.
- **DPL-7: Production Workflow:** Setup `workflow_dispatch`/tags in `main` with GitHub Environment `production` approvals.

### Phase 3: Safety & Validation
- **DPL-8: Blocking Backup & Rotation:** Implement `scripts/production/predeploy-backup.sh` with strict validation and rotation (last 5/72h).
- **DPL-9: Tunnel Protection:** Hardcode protections to prevent `cloudflared` from being touched during normal deploys.
- **DPL-10: Shop/Image Verification:** Automate validation of `/api/health`, product images (`naturalWidth > 0`), and PDP galleries.
- **DPL-11: Rollback Runbook:** Document the exact steps to revert to the previous stable SHA and backup.

---

## ✅ DEFINITION OF DONE (DoD)
The loop is complete ONLY when:
1. `Galantesjewerly.git` is the sole source of truth, renewed against production.
2. `main` branch is protected; deployments happen ONLY via GitHub Actions + Environment approval.
3. Blocking backups and rotation are functional and verified.
4. `cloudflared` remains stable during deployment.
5. Staging is fully isolated and passes before Production.
6. Production is validated with evidence of: Healthy `/api/health`, functional `/shop`, visible images, and working Odoo admin.
7. All DPL items are marked as completed in the ledger.

**BEGIN LOOP NOW. Start with DPL-1.**
