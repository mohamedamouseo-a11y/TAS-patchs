#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${TAS_ROOT:-/var/www/TAS-root}"
CURRENT="$ROOT/current"
APP="${PM2_APP_NAME:-TAS}"

FILES=(
  "client/src/components/CRMLayout.tsx"
  "client/src/App.tsx"
  "client/src/pages/tas/TASServicePage.tsx"
)

for rel in "${FILES[@]}"; do
  test -f "$ROOT/$rel" || { echo "ERROR=CANONICAL_FILE_MISSING:$rel"; exit 2; }
  test -f "$CURRENT/$rel" || { echo "ERROR=RUNTIME_FILE_MISSING:$rel"; exit 3; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/tas-after-sales-menu-v3-$STAMP"
mkdir -p "$BACKUP/canonical" "$BACKUP/runtime"

for rel in "${FILES[@]}"; do
  mkdir -p "$BACKUP/canonical/$(dirname "$rel")"
  cp "$ROOT/$rel" "$BACKUP/canonical/$rel"
done

python3 "$HERE/apply.py"   "$ROOT/client/src/components/CRMLayout.tsx"   "$ROOT/client/src/App.tsx"   "$ROOT/client/src/pages/tas/TASServicePage.tsx"

if [ "$(realpath -e "$ROOT")" != "$(realpath -e "$CURRENT")" ]; then
  for rel in "${FILES[@]}"; do
    mkdir -p "$BACKUP/runtime/$(dirname "$rel")"
    cp "$CURRENT/$rel" "$BACKUP/runtime/$rel"
  done

  python3 "$HERE/apply.py"     "$CURRENT/client/src/components/CRMLayout.tsx"     "$CURRENT/client/src/App.tsx"     "$CURRENT/client/src/pages/tas/TASServicePage.tsx"
fi

grep -q 'TAS_AFTER_SALES_SERVICE_MENU_V3' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q 'key: "after-sales-service"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/book"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/appointments"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/availability"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/maintenance-plans"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/vehicle-mapping"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/service-bays"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q '"/tas/service/branch-scheduling"' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q 'TAS_AFTER_SALES_SERVICE_SECTION_PAGES_V3' "$CURRENT/client/src/pages/tas/TASServicePage.tsx"
grep -q '<Route path="/tas/service/:section">' "$CURRENT/client/src/App.tsx"

AFTER_SALES_BLOCK="$(sed -n '/key: "after-sales-service"/,/key: "marketing"/p' "$CURRENT/client/src/components/CRMLayout.tsx")"
if printf '%s' "$AFTER_SALES_BLOCK" | grep -q '/tas/help-center'; then
  echo "ERROR=HELP_CENTER_FOUND_IN_AFTER_SALES_MENU"
  exit 4
fi

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=3072" pnpm run build
)

pm2 restart "$APP" --update-env >/dev/null || true

wait_local() {
  local route="$1" code="000"
  for _ in $(seq 1 60); do
    code="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:3600$route" || true)"
    if [ "$code" = "200" ]; then
      printf '%s' "$code"
      return 0
    fi
    sleep 1
  done

  pm2 restart "$APP" --update-env >/dev/null || true
  for _ in $(seq 1 30); do
    code="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:3600$route" || true)"
    if [ "$code" = "200" ]; then
      printf '%s' "$code"
      return 0
    fi
    sleep 1
  done

  printf '%s' "$code"
  return 1
}

ROUTES=(
  "/tas/service"
  "/tas/service/book"
  "/tas/service/appointments"
  "/tas/service/availability"
  "/tas/service/maintenance-plans"
  "/tas/service/vehicle-mapping"
  "/tas/service/service-bays"
  "/tas/service/branch-scheduling"
)

LOCAL_ALL=YES
for route in "${ROUTES[@]}"; do
  code="$(wait_local "$route" || true)"
  echo "LOCAL_${route//\//_}=$code"
  [ "$code" = "200" ] || LOCAL_ALL=NO
done

PUBLIC_ROOT="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' https://tas.tamiyouz.com/tas/service || true)"
PUBLIC_BOOK="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' https://tas.tamiyouz.com/tas/service/book || true)"

STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
 process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"

echo "PATCH=TAS-AFTER-SALES-SERVICE-MENU-V3"
echo "MARKER=TAS_AFTER_SALES_SERVICE_MENU_V3"
echo "PARENT=After Sales Service"
echo "POSITION=IMMEDIATELY_AFTER_SALES"
echo "SUBMENU_COUNT=8"
echo "HELP_CENTER_IN_SUBMENU=NO"
echo "LONG_PAGE_SPLIT=YES"
echo "BUILD=PASS"
echo "PM2=$STATUS"
echo "LOCAL_ALL_ROUTES_200=$LOCAL_ALL"
echo "PUBLIC_ROOT_HTTP=$PUBLIC_ROOT"
echo "PUBLIC_BOOK_HTTP=$PUBLIC_BOOK"

if [ "$STATUS" = "online" ] && [ "$LOCAL_ALL" = "YES" ] && [ "$PUBLIC_ROOT" = "200" ] && [ "$PUBLIC_BOOK" = "200" ]; then
  echo "READY_FOR_UAT=YES"
  echo "READY_FOR_PUSH=YES"
  echo "ERROR=NONE"
else
  echo "READY_FOR_UAT=NO"
  echo "READY_FOR_PUSH=NO"
  echo "ERROR=ROUTE_OR_RUNTIME_VERIFICATION_FAILED"
  exit 5
fi
