#!/usr/bin/env bash
set -euo pipefail

EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}"
PROJECT_ID="${FIREBASE_PROJECT_ID:-gen-lang-client-0015061880}"
DATABASE_ID="${FIRESTORE_DATABASE_ID:-saltstore}"
MAX_ATTEMPTS="${EMULATOR_WAIT_MAX_ATTEMPTS:-60}"
SLEEP_SECONDS="${EMULATOR_WAIT_SLEEP_SECONDS:-2}"

npm run emulators >/tmp/salt-emulators.log 2>&1 &
EMULATORS_PID=$!

echo "Started emulators (pid: ${EMULATORS_PID})"

echo "Waiting for Firestore emulator at ${EMULATOR_HOST}..."
ATTEMPT=1
while [ "${ATTEMPT}" -le "${MAX_ATTEMPTS}" ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer owner" \
    "http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents?pageSize=1" \
    || true)

  if [ "${STATUS}" = "200" ]; then
    echo "Firestore emulator is ready (HTTP ${STATUS})."
    break
  fi

  echo "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: emulator not ready (HTTP ${STATUS})."
  ATTEMPT=$((ATTEMPT + 1))
  sleep "${SLEEP_SECONDS}"
done

if [ "${STATUS}" != "200" ]; then
  echo "Firestore emulator did not become ready after ${MAX_ATTEMPTS} attempts."
  exit 1
fi

echo "Creating test auth user..."
node scripts/create-auth-user.mjs

node scripts/import-test-data.mjs

echo "Import complete. Emulators are still running."
