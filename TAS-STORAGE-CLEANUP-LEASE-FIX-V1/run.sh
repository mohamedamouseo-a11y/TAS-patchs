#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${TAS_ROOT:-/var/www/TAS-root}"
CURRENT="$ROOT/current"
APP="${PM2_APP_NAME:-TAS}"

test -f "$ROOT/server/storage.ts" || { echo "ERROR=CANONICAL_STORAGE_NOT_FOUND"; exit 2; }
test -f "$CURRENT/server/storage.ts" || { echo "ERROR=RUNTIME_STORAGE_NOT_FOUND"; exit 3; }

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$ROOT/server/storage.ts" "/tmp/storage.before-cleanup-lease-fix-$STAMP.ts"
if [ "$(realpath -e "$ROOT/server/storage.ts")" != "$(realpath -e "$CURRENT/server/storage.ts")" ]; then
  cp "$CURRENT/server/storage.ts" "/tmp/storage.runtime.before-cleanup-lease-fix-$STAMP.ts"
fi

python3 "$HERE/apply.py" "$ROOT/server/storage.ts"

if [ "$(realpath -e "$ROOT/server/storage.ts")" != "$(realpath -e "$CURRENT/server/storage.ts")" ]; then
  python3 "$HERE/apply.py" "$CURRENT/server/storage.ts"
fi

grep -q 'TAS_STORAGE_CLEANUP_LEASE_FIX_V1' "$ROOT/server/storage.ts"
grep -q 'DATE_ADD(NOW(), INTERVAL 15 MINUTE)' "$ROOT/server/storage.ts"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)

pm2 restart "$APP" --update-env >/dev/null

for _ in $(seq 1 30); do
  STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"
  [ "$STATUS" = "online" ] && break
  sleep 1
done

[ "${STATUS:-}" = "online" ] || { echo "ERROR=PM2_NOT_ONLINE"; exit 4; }

TMP_SCRIPT="$CURRENT/scripts/.tmp-storage-cleanup-canary-$$.ts"
trap 'rm -f "$TMP_SCRIPT"' EXIT
cp "$HERE/canary.ts" "$TMP_SCRIPT"

CANARY_OUTPUT="$(
  cd "$CURRENT"
  pnpm exec tsx "$TMP_SCRIPT"
)"
printf '%s\n' "$CANARY_OUTPUT"

echo "$CANARY_OUTPUT" | grep -q 'CANARY_UPLOAD_STATUS=uploaded'
echo "$CANARY_OUTPUT" | grep -q 'CANARY_DRIVE_VERIFIED=YES'
echo "$CANARY_OUTPUT" | grep -q 'CANARY_LOCAL_COPY=ABSENT'

LOCAL_HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' http://127.0.0.1:3600/tas/help-center || true)"
PUBLIC_HTTP="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' https://tas.tamiyouz.com/tas/help-center || true)"

echo "PATCH=TAS-STORAGE-CLEANUP-LEASE-FIX-V1"
echo "SOURCE_MARKER=TAS_STORAGE_CLEANUP_LEASE_FIX_V1"
echo "BUILD=PASS"
echo "PM2=ONLINE"
echo "LOCAL_HELP_CENTER_HTTP=$LOCAL_HTTP"
echo "PUBLIC_HELP_CENTER_HTTP=$PUBLIC_HTTP"
echo "READY_FOR_REVIEW=YES"
echo "ERROR=NONE"
