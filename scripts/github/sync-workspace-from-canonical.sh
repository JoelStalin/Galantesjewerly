#!/usr/bin/env bash

set -Eeuo pipefail

CANONICAL_URL="${CANONICAL_URL:-https://github.com/JoelStalin/Galantesjewerly.git}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/Documents/GetUpSoft_Workspace/06_E_Commerce_Lux/Galantesjewelry}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$WORKSPACE_DIR/.git" ]; then
  echo "Workspace checkout is not a git repo: $WORKSPACE_DIR" >&2
  exit 1
fi

cd "$WORKSPACE_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Workspace has uncommitted changes. Commit or stash before syncing." >&2
  git status --short
  exit 1
fi

git remote set-url origin "$CANONICAL_URL"
git fetch origin "$BRANCH" --tags
git switch "$BRANCH"
git merge --ff-only "origin/$BRANCH"

if [ -f "$WORKSPACE_DIR/../../scripts/update_repo_map.py" ]; then
  (cd "$WORKSPACE_DIR/../.." && PYTHONIOENCODING=utf-8 python scripts/update_repo_map.py)
fi

echo "Workspace synced from $CANONICAL_URL#$BRANCH"
