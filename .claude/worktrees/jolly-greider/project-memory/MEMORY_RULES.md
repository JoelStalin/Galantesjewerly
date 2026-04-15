# Memory Rules

## Purpose

This directory is the durable engineering memory for the repository. It must stay internally consistent, timestamped, evidence-linked, and safe for future agents to extend without rewriting history.

## Naming Convention

- Overview and indexed memory files use `NN-title.md`.
- Decisions use `DEC-###-slug.md`.
- Conversations use `YYYY-MM-DD_agent-session_NNN.md`.
- Evidence indexes use stable names under `project-memory/evidence/`.
- Templates live under `project-memory/templates/`.

## Date and Time Format

- Use ISO 8601 with explicit offset for timestamps, for example `2026-03-25T20:10:10-04:00`.
- Use `YYYY-MM-DD` for date-only fields.
- Artifact directories keep the runtime format `YYYY-MM-DD_HH-mm-ss` only because the Selenium suite already emits that structure.

## Fixed Section Order

Each durable document must keep a stable top-to-bottom order appropriate for its type:

- Overview files:
  - Status
  - Scope
  - Findings or architecture
  - Evidence
  - Sources
- Decisions:
  - ID
  - Status
  - Date
  - Context
  - Decision
  - Consequences
  - Evidence
  - Sources
- Conversations:
  - Objective
  - Prompt received
  - Operational interpretation
  - Audit performed
  - Decisions
  - Actions executed
  - Errors found
  - Corrections applied
  - Validations executed
  - Pending items
- Test runs:
  - Metadata
  - Commands
  - Environment
  - Results
  - Evidence
  - Notes

## Change Log Format

Every entry in `05-change-log.md` must contain all of the following fields in this order:

- Timestamp
- File
- Function or block
- Previous state
- Change applied
- Reason
- Expected impact
- Possible risk
- Validation performed
- Evidence
- Related decision
- Related test

Generic summaries are forbidden in the change log.

## Decision Format

Every decision file must:

- declare a unique `DEC-###` id
- state whether it is `accepted`, `superseded`, or `rejected`
- link to evidence and source material
- name the operational consequence, not just the preference

## Conversation Format

Conversation files are structured transcripts, not raw dumps. They must preserve:

- the objective of the session
- what was actually executed
- what failed
- what was fixed
- what evidence was produced

## Test Linking Rules

- Every meaningful test run must be indexed in `evidence/test-runs-index.md`.
- Screenshots used as proof must be indexed in `evidence/screenshots-index.md`.
- Change-log entries must point to decisions and tests when those links exist.
- Decisions must cite the evidence that validated the decision in practice.

## Update Rules

- Never silently rewrite a previous conclusion. Add a new statement that supersedes or narrows it.
- If a document becomes obsolete, mark it as superseded inside the file before replacing it elsewhere.
- When a file path changes, update every affected index and cross-reference in the same edit session.
- Do not leave duplicate documents with conflicting names for the same topic.

## Prohibited Inconsistencies

- mixed timestamp formats
- duplicate decision ids
- changelog entries without evidence
- screenshots that are not indexed
- undocumented architecture changes
- contradictory route or service names across documents
