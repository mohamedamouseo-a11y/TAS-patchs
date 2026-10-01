#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${TAS_ROOT:-/var/www/TAS-root}"
CURRENT="$ROOT/current"
APP="${PM2_APP_NAME:-TAS}"

test -f "$CURRENT/package.json" || { echo "ERROR=RUNTIME_NOT_FOUND"; exit 2; }
test -f "$CURRENT/server/storage.ts" || { echo "ERROR=RUNTIME_STORAGE_NOT_FOUND"; exit 3; }

grep -q 'TAS_STORAGE_CLEANUP_LEASE_FIX_V1' "$CURRENT/server/storage.ts" || {
  echo "ERROR=CLEANUP_LEASE_FIX_V1_NOT_APPLIED"
  exit 4
}

STATUS_BEFORE="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
 process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"

[ "$STATUS_BEFORE" = "online" ] || {
  echo "ERROR=TAS_PM2_NOT_ONLINE"
  exit 5
}

TMP_SCRIPT="$CURRENT/scripts/.tmp-storage-cleanup-canary-v2-$$.ts"
LOG="/tmp/tas-storage-cleanup-canary-v2-$$.log"
trap 'rm -f "$TMP_SCRIPT"' EXIT INT TERM HUP
cp "$HERE/canary-v2.ts" "$TMP_SCRIPT"

echo "PATCH=TAS-STORAGE-CLEANUP-CANARY-V2"
echo "PM2_BEFORE=$STATUS_BEFORE"
echo "CANARY_LOG=$LOG"

set +e
(
  cd "$CURRENT"
  timeout --signal=TERM --kill-after=10s 330s     pnpm exec tsx "$TMP_SCRIPT"
) 2>&1 | tee "$LOG"
CANARY_RC=${PIPESTATUS[0]}
set -e

if [ "$CANARY_RC" -eq 124 ] || [ "$CANARY_RC" -eq 137 ]; then
  echo "CANARY_RESULT=TIMEOUT"
  echo "CANARY_RC=$CANARY_RC"
  echo "ERROR=CANARY_PROCESS_TIMEOUT"
  exit 6
fi

echo "CANARY_RC=$CANARY_RC"

STATUS_AFTER="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
 process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"

LOCAL_HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' http://127.0.0.1:3600/tas/help-center || true)"
PUBLIC_HTTP="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' https://tas.tamiyouz.com/tas/help-center || true)"

echo "PM2_AFTER=$STATUS_AFTER"
echo "LOCAL_HELP_CENTER_HTTP=$LOCAL_HTTP"
echo "PUBLIC_HELP_CENTER_HTTP=$PUBLIC_HTTP"

if grep -q '^CANARY_STAGE=UPLOAD_DONE$' "$LOG" &&    grep -q '^CANARY_DRIVE_VERIFIED=YES$' "$LOG" &&    grep -q '^CANARY_LOCAL_COPY=ABSENT$' "$LOG"; then
  echo "CANARY_RESULT=PASS"
  echo "READY_FOR_REVIEW=YES"
  echo "ERROR=NONE"
  exit 0
fi

echo "CANARY_RESULT=FAIL"
echo "READY_FOR_REVIEW=NO"
echo "ERROR=CLEANUP_CANARY_NOT_PASSED"
exit 7
