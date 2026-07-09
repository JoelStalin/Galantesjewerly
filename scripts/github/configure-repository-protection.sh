#!/usr/bin/env bash

set -Eeuo pipefail

REPO="${REPO:-JoelStalin/Galantesjewerly}"

command -v gh >/dev/null 2>&1 || {
  echo "gh CLI is required." >&2
  exit 1
}

gh auth status >/dev/null

echo "Configuring GitHub repository settings for $REPO"

gh api \
  --method PUT \
  "repos/$REPO/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / test"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

gh api \
  --method PUT \
  "repos/$REPO/environments/production" \
  --input - <<'JSON'
{
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
JSON

gh api \
  --method PUT \
  "repos/$REPO/environments/staging" \
  --input - <<'JSON'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON

echo "Repository protection baseline configured. Add required production reviewers in GitHub UI if the API plan does not expose reviewer configuration."
