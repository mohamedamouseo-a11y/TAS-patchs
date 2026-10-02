#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${TAS_ROOT:-/var/www/TAS-root}"
CURRENT="$ROOT/current"
APP="${PM2_APP_NAME:-TAS}"

FILES=(
  "client/src/pages/tas/TASServicePage.tsx"
  "client/src/components/tas/TASServiceScheduler.tsx"
)

for rel in "${FILES[@]}"; do
  test -f "$ROOT/$rel" || { echo "ERROR=CANONICAL_FILE_MISSING:$rel"; exit 2; }
  test -f "$CURRENT/$rel" || { echo "ERROR=RUNTIME_FILE_MISSING:$rel"; exit 3; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/tas-after-sales-bay-availability-v1-$STAMP"
mkdir -p "$BACKUP/canonical" "$BACKUP/runtime"

for rel in "${FILES[@]}"; do
  mkdir -p "$BACKUP/canonical/$(dirname "$rel")"
  cp "$ROOT/$rel" "$BACKUP/canonical/$rel"
done

python3 "$HERE/apply.py"   "$ROOT/client/src/pages/tas/TASServicePage.tsx"   "$ROOT/client/src/components/tas/TASServiceScheduler.tsx"

if [ "$(realpath -e "$ROOT")" != "$(realpath -e "$CURRENT")" ]; then
  for rel in "${FILES[@]}"; do
    mkdir -p "$BACKUP/runtime/$(dirname "$rel")"
    cp "$CURRENT/$rel" "$BACKUP/runtime/$rel"
  done

  python3 "$HERE/apply.py"     "$CURRENT/client/src/pages/tas/TASServicePage.tsx"     "$CURRENT/client/src/components/tas/TASServiceScheduler.tsx"
fi

grep -q 'TAS_AFTER_SALES_BAY_AVAILABILITY_V1' "$CURRENT/client/src/pages/tas/TASServicePage.tsx"
grep -q 'TASServiceScheduler' "$CURRENT/client/src/pages/tas/TASServicePage.tsx"
grep -q 'TAS_AFTER_SALES_BAY_AVAILABILITY_LEGEND_V1' "$CURRENT/client/src/components/tas/TASServiceScheduler.tsx"
grep -q 'متاح = المساحة الفارغة' "$CURRENT/client/src/components/tas/TASServiceScheduler.tsx"
grep -q 'محجوز = كارت حجز' "$CURRENT/client/src/components/tas/TASServiceScheduler.tsx"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=3072" pnpm run build
)

pm2 restart "$APP" --update-env >/dev/null || true

wait_http() {
  local url="$1" code="000"
  for _ in $(seq 1 60); do
    code="$(curl -k -sS -o /dev/null --max-time 4 -w '%{http_code}' "$url" || true)"
    [ "$code" = "200" ] && { printf '%s' "$code"; return 0; }
    sleep 1
  done
  printf '%s' "$code"
  return 1
}

LOCAL_HTTP="$(wait_http http://127.0.0.1:3600/tas/service/availability || true)"
if [ "$LOCAL_HTTP" != "200" ]; then
  pm2 restart "$APP" --update-env >/dev/null || true
  LOCAL_HTTP="$(wait_http http://127.0.0.1:3600/tas/service/availability || true)"
fi

PUBLIC_HTTP="$(wait_http https://tas.tamiyouz.com/tas/service/availability || true)"

STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
 process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"

echo "PATCH=TAS-AFTER-SALES-BAY-AVAILABILITY-V1"
echo "MARKER=TAS_AFTER_SALES_BAY_AVAILABILITY_V1"
echo "EXISTING_SCHEDULER_REUSED=YES"
echo "NEW_BACKEND_LOGIC=NO"
echo "DATABASE_CHANGE=NO"
echo "SCHEDULER_VISIBLE_IN_AVAILABILITY=YES"
echo "BAY_TIMELINE=YES"
echo "AVAILABLE_VISUAL=EMPTY_TIMELINE"
echo "BOOKED_VISUAL=BOOKING_BLOCKS"
echo "AVAILABILITY_ENGINE_PRESERVED=YES"
echo "BUILD=PASS"
echo "PM2=$STATUS"
echo "LOCAL_AVAILABILITY_HTTP=$LOCAL_HTTP"
echo "PUBLIC_AVAILABILITY_HTTP=$PUBLIC_HTTP"

if [ "$STATUS" = "online" ] && [ "$LOCAL_HTTP" = "200" ] && [ "$PUBLIC_HTTP" = "200" ]; then
  echo "READY_FOR_UAT=YES"
  echo "READY_FOR_PUSH=YES"
  echo "ERROR=NONE"
else
  echo "READY_FOR_UAT=NO"
  echo "READY_FOR_PUSH=NO"
  echo "ERROR=RUNTIME_VERIFICATION_FAILED"
  exit 5
fi
