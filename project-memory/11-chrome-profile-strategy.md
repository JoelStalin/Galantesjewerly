# Chrome Profile Strategy

## Final Model

- Source user-data root:
  - `%LOCALAPPDATA%\\Google\\Chrome\\User Data`
- Runtime clone root:
  - `tests/e2e/.runtime/chrome-user-data`
- Default profile under test:
  - `Default`

## Flow

1. `profile_manager.py` asks for a Chrome profile name.
2. `profile_runtime.py` ensures the source profile exists.
3. If the runtime clone does not exist, it copies the host profile and `Local State` into the test directory.
4. Lock artifacts are removed from the runtime clone before launch.
5. Selenium starts Chrome with:
   - `user-data-dir=<runtime clone>`
   - `profile-directory=<profile name>`
   - `--start-maximized`
   - automation-reduction options
6. The same runtime clone is reused across runs, so cookies persist between executions.

## Why the Live Profile Is Not Used Directly

- avoids corrupting or hijacking the operator's live profile
- avoids direct lock conflicts while the operator is browsing
- still preserves cookies and browser state after the initial clone

## Friendly Lock Handling

- if the source profile is locked during the first clone, the scripts exit cleanly
- the operator is told to close Chrome manually
- no aggressive `taskkill` or forced profile deletion is used

## Ignored During Clone

- transient lock files
- devtools ports
- selected caches and ephemeral directories

## Known Limits

- first clone still depends on access to the host Chrome profile
- profile contents can age or drift over time
- if the runtime clone becomes corrupted, it must be recreated deliberately

## Evidence

- preparation output indexed in `project-memory/evidence/test-runs-index.md`
- successful reused-profile session persistence proved in `03_session_after_browser_restart.png`
