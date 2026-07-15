#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_repo
ensure_prod_db

BASELINE_ROOT="${BASELINE_ROOT:-/home/yoeli/production-baselines}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$BASELINE_ROOT/galantes-production-baseline-$TS"
ARCHIVE="$OUT_DIR.tar.gz"
mkdir -p "$BASELINE_ROOT"

log "Exporting versionable production baseline to $OUT_DIR"
mkdir -p "$OUT_DIR"

rsync -a --delete \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude 'node_modules/' \
  --exclude 'backups/' \
  --exclude 'tmp/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude '*.dump' \
  --exclude '*.sql' \
  --exclude '*.tgz' \
  --exclude '*.tar' \
  --exclude '*.tar.gz' \
  --exclude '.env' \
  --exclude '.env.*' \
  --include 'AGENTS.md' \
  --include 'Dockerfile' \
  --include 'package.json' \
  --include 'package-lock.json' \
  --include 'next.config.ts' \
  --include 'tsconfig.json' \
  --include 'postcss.config.mjs' \
  --include 'eslint.config.mjs' \
  --include 'proxy.ts' \
  --include 'docker-compose*.yml' \
  --include 'app/***' \
  --include 'components/***' \
  --include 'context/***' \
  --include 'controllers/***' \
  --include 'docs/***' \
  --include 'infra/***' \
  --include 'integration-contracts/***' \
  --include 'lib/***' \
  --include 'odoo/***' \
  --include 'public/***' \
  --include 'scripts/***' \
  --include 'server/***' \
  --include 'src/***' \
  --include 'tests/***' \
  --exclude '*' \
  "$REPO_DIR/" "$OUT_DIR/"

tar -czf "$ARCHIVE" -C "$BASELINE_ROOT" "$(basename "$OUT_DIR")"

cat > "$OUT_DIR/BASELINE_README.md" <<EOF
# Galantes Production Baseline

- Exported: $TS
- Source: $REPO_DIR on production VM
- Purpose: renew https://github.com/JoelStalin/Galantesjewerly.git against production without secrets or runtime artifacts.

Review this baseline in a branch such as production-baseline-renewal before merging.
EOF

log "Baseline exported: $OUT_DIR"
log "Archive: $ARCHIVE"
