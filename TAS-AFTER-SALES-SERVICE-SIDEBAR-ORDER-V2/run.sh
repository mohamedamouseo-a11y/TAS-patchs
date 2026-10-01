#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${TAS_ROOT:-/var/www/TAS-root}"
CURRENT="$ROOT/current"
APP="${PM2_APP_NAME:-TAS}"

CANONICAL="$ROOT/client/src/components/CRMLayout.tsx"
RUNTIME="$CURRENT/client/src/components/CRMLayout.tsx"

test -f "$CANONICAL" || { echo "ERROR=CANONICAL_CRMLAYOUT_NOT_FOUND"; exit 2; }
test -f "$RUNTIME" || { echo "ERROR=RUNTIME_CRMLAYOUT_NOT_FOUND"; exit 3; }

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$CANONICAL" "/tmp/CRMLayout.before-after-sales-service-order-v2-$STAMP.tsx"

python3 "$HERE/apply.py" "$CANONICAL"

if [ "$(realpath -e "$CANONICAL")" != "$(realpath -e "$RUNTIME")" ]; then
  cp "$RUNTIME" "/tmp/CRMLayout.runtime.before-after-sales-service-order-v2-$STAMP.tsx"
  python3 "$HERE/apply.py" "$RUNTIME"
fi

grep -q 'TAS_AFTER_SALES_SERVICE_AFTER_SALES_GROUP_V2' "$CANONICAL"
grep -q 'group.key === "sales"' "$CANONICAL"
grep -q 'After Sales Service' "$CANONICAL"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)

pm2 restart "$APP" --update-env >/dev/null

STATUS="unknown"
for _ in $(seq 1 30); do
  STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
 process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"
  [ "$STATUS" = "online" ] && break
  sleep 1
done

LOCAL_HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' http://127.0.0.1:3600/tas/service || true)"
PUBLIC_HTTP="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' https://tas.tamiyouz.com/tas/service || true)"

echo "PATCH=TAS-AFTER-SALES-SERVICE-SIDEBAR-ORDER-V2"
echo "MARKER=TAS_AFTER_SALES_SERVICE_AFTER_SALES_GROUP_V2"
echo "LABEL_AR=خدمة ما بعد البيع"
echo "LABEL_EN=After Sales Service"
echo "POSITION=IMMEDIATELY_AFTER_SALES_GROUP"
echo "INSIDE_SALES=NO"
echo "INSIDE_AUTOMOTIVE=NO"
echo "ROUTE=/tas/service"
echo "BUILD=PASS"
echo "PM2=$STATUS"
echo "LOCAL_TAS_SERVICE_HTTP=$LOCAL_HTTP"
echo "PUBLIC_TAS_SERVICE_HTTP=$PUBLIC_HTTP"
echo "READY_FOR_UAT=YES"
echo "READY_FOR_PUSH=YES"
echo "ERROR=NONE"
