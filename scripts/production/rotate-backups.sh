#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(safe_backup_root)"
now_epoch="$(date +%s)"
keep_seconds="$((KEEP_BACKUP_HOURS * 3600))"

mapfile -t backups < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | awk '{print $2}')

index=0
for backup in "${backups[@]}"; do
  index="$((index + 1))"
  resolved="$(realpath "$backup")"
  case "$resolved" in
    "$ROOT"/*) ;;
    *) fail "Unsafe backup path: $resolved" ;;
  esac

  mtime="$(stat -c %Y "$resolved")"
  age="$((now_epoch - mtime))"
  if [ "$index" -le "$KEEP_BACKUPS" ] || [ "$age" -le "$keep_seconds" ]; then
    log "Keeping backup: $resolved"
    continue
  fi

  log "Removing rotated backup: $resolved"
  rm -rf -- "$resolved"
done

log "Backup rotation complete"
