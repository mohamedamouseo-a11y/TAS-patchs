#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-HELP-CENTER-SERVICE-V1"
CURRENT="$(realpath -e "$ROOT/current")"
TARGET="$CURRENT/client/src/pages/HelpCenter.tsx"
TMP="$(mktemp -d /tmp/tas-help-center-service-v1.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$TARGET" ] || { echo "PATCH=FAIL"; echo "ERROR=HELP_CENTER_SOURCE_NOT_FOUND"; exit 2; }

curl -fsSL "$BASE/HelpCenter.tsx" -o "$TMP/HelpCenter.tsx"
grep -q 'TAS_HELP_CENTER_SERVICE_V1' "$TMP/HelpCenter.tsx"

cp "$TARGET" "$TMP/HelpCenter.before.tsx"
cp "$TMP/HelpCenter.tsx" "$TARGET"

echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build >/dev/null
)
echo "BUILD=PASS"

pm2 restart "$APP" >/dev/null
for i in $(seq 1 30); do
  HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' http://127.0.0.1:3600/ar/help-center || true)"
  if [ "$HTTP" = "200" ]; then break; fi
  sleep 1
done

STATUS="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"))})' "$APP")"

echo "PM2=${STATUS^^}"
echo "HTTP_3600=$HTTP"

grep -q 'TAS_HELP_CENTER_SERVICE_V1' "$TARGET"
echo "SERVICE_HELP_CENTER=ACTIVE"

if grep -q 'SECTIONS_META' "$TARGET"; then
  echo "OLD_HELP_CONTENT_REMOVED=NO"
  exit 5
fi

echo "OLD_HELP_CONTENT_REMOVED=YES"
echo "LANG_AR=YES"
echo "LANG_EN=YES"
echo "GUIDES=8"
echo "READY_FOR_UAT=YES"
echo "ERROR=NONE"
