#!/bin/bash
# Gracefully shut down Firebase emulators, Vite dev servers, and Vitest.
# Firebase receives SIGINT (not SIGTERM) so --export-on-exit triggers correctly.

# ── Helper ────────────────────────────────────────────────────────────────────
# graceful_stop <label> <signal> <timeout_seconds> [pid ...]
# Sends <signal> to each PID, waits up to <timeout> seconds for clean exit,
# then force-kills any survivors with SIGKILL.
graceful_stop() {
  local label=$1
  local signal=$2
  local timeout=$3
  shift 3

  if [[ $# -eq 0 ]]; then
    echo "  $label: not running"
    return 0
  fi

  local pids=("$@")
  echo "  $label: sending SIG${signal} to PID(s) ${pids[*]}"
  kill -"${signal}" "${pids[@]}" 2>/dev/null || true

  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    local alive=()
    for pid in "${pids[@]}"; do
      kill -0 "$pid" 2>/dev/null && alive+=("$pid")
    done
    [[ ${#alive[@]} -eq 0 ]] && break
    sleep 1
    (( elapsed++ )) || true
  done

  local survivors=()
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null && survivors+=("$pid")
  done

  if [[ ${#survivors[@]} -gt 0 ]]; then
    echo "  $label: still alive after ${timeout}s — force killing"
    kill -9 "${survivors[@]}" 2>/dev/null || true
  fi

  echo "  ✅ $label: done"
}

# ── 1. Firebase emulators ─────────────────────────────────────────────────────
echo "🔴 Stopping Firebase emulators (waiting for data export)..."

# Send SIGINT to the firebase CLI node process — this is what triggers
# --export-on-exit. SIGTERM does not trigger the export handler.
cli_pids=()
while IFS= read -r pid; do [[ -n "$pid" ]] && cli_pids+=("$pid"); done \
  < <(pgrep -f "emulators:start" 2>/dev/null || true)

graceful_stop "firebase CLI" INT 60 "${cli_pids[@]}"

# Also kill any Java emulator subprocesses that survived or were orphaned
# (these cannot do an export — the CLI already handled that above).
java_pids=()
while IFS= read -r pid; do [[ -n "$pid" ]] && java_pids+=("$pid"); done \
  < <(pgrep -f "firebase/emulators" 2>/dev/null || true)

graceful_stop "firebase java processes" TERM 10 "${java_pids[@]}"

# ── 2. Vitest ─────────────────────────────────────────────────────────────────
echo "🔴 Stopping Vitest..."
vitest_pids=()
while IFS= read -r pid; do [[ -n "$pid" ]] && vitest_pids+=("$pid"); done \
  < <(pgrep -f "vitest" 2>/dev/null || true)

graceful_stop "vitest" TERM 10 "${vitest_pids[@]}"

# ── 3. Vite dev server ────────────────────────────────────────────────────────
echo "🔴 Stopping Vite..."
vite_pids=()
while IFS= read -r pid; do [[ -n "$pid" ]] && vite_pids+=("$pid"); done \
  < <(pgrep -f "vite" 2>/dev/null | grep -v vitest || true)

graceful_stop "vite" TERM 10 "${vite_pids[@]}"

echo "✅ All done."
