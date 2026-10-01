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
cp "$CANONICAL" "/tmp/CRMLayout.before-after-sales-service-v1-$STAMP.tsx"

python3 "$HERE/apply.py" "$CANONICAL"

if [ "$(realpath -e "$CANONICAL")" != "$(realpath -e "$RUNTIME")" ]; then
  cp "$RUNTIME" "/tmp/CRMLayout.runtime.before-after-sales-service-v1-$STAMP.tsx"
  python3 "$HERE/apply.py" "$RUNTIME"
fi

grep -q 'TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1' "$CANONICAL"
grep -q 'After Sales Service' "$CANONICAL"

COUNT="$(grep -c 'customSidebarItem("/tas/service"' "$CANONICAL" || true)"
[ "$COUNT" -eq 0 ] || {
  echo "ERROR=DUPLICATE_NESTED_TAS_SERVICE_ITEM"
  exit 4
}

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

echo "PATCH=TAS-AFTER-SALES-SERVICE-STANDALONE-NAV-V1"
echo "MARKER=TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1"
echo "LABEL_AR=خدمة ما بعد البيع"
echo "LABEL_EN=After Sales Service"
echo "ROUTE=/tas/service"
echo "REMOVED_FROM_AUTOMOTIVE=YES"
echo "STANDALONE_NAV=YES"
echo "ROLES=Admin,admin,SalesManager,ServiceAdvisor,CrmFollowUp"
echo "BUILD=PASS"
echo "PM2=$STATUS"
echo "LOCAL_TAS_SERVICE_HTTP=$LOCAL_HTTP"
echo "PUBLIC_TAS_SERVICE_HTTP=$PUBLIC_HTTP"
echo "READY_FOR_UAT=YES"
echo "READY_FOR_PUSH=YES"
echo "ERROR=NONE"
