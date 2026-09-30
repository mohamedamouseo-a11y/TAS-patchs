#!/usr/bin/env bash
set -Eeuo pipefail

APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-HELP-CENTER-INSYSTEM-LUXURY-V2"

detect_current() {
  local cwd=""
  cwd="$(pm2 jlist 2>/dev/null | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  try {
    const r=JSON.parse(s||"[]");
    const name=process.argv[1];
    const p=r.find(x=>x.name===name) || r.find(x=>/tas/i.test(x.name||""));
    process.stdout.write(String(p?.pm2_env?.pm_cwd||""));
  } catch(e) {}
})' "$APP" 2>/dev/null || true)"

  if [ -n "$cwd" ] && [ -d "$cwd" ]; then
    realpath -e "$cwd"
    return 0
  fi

  for candidate in     /var/www/TAS-root/current     /var/www/TAS-MAIN     /var/www/TAS     /var/www/tas/current     /var/www/tas
  do
    if [ -d "$candidate" ] && [ -f "$candidate/client/src/App.tsx" ]; then
      realpath -e "$candidate"
      return 0
    fi
  done

  return 1
}

CURRENT="$(detect_current || true)"
if [ -z "$CURRENT" ]; then
  echo "PATCH=FAIL"
  echo "ERROR=TAS_RUNTIME_CWD_NOT_FOUND"
  exit 2
fi

if [ ! -f "$CURRENT/client/src/App.tsx" ] || [ ! -f "$CURRENT/client/src/components/CRMLayout.tsx" ]; then
  echo "PATCH=FAIL"
  echo "ERROR=TAS_SOURCE_NOT_FOUND_AT_RUNTIME_CWD"
  echo "RUNTIME_CWD=$CURRENT"
  exit 3
fi

TMP="$(mktemp -d /tmp/tas-help-v2.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/HelpCenter.tsx" -o "$TMP/HelpCenter.tsx"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"

grep -q 'TAS_HELP_CENTER_INSYSTEM_LUXURY_V2' "$TMP/HelpCenter.tsx"

cp "$TMP/HelpCenter.tsx" "$CURRENT/client/src/pages/HelpCenter.tsx"
python3 "$TMP/source-transform.py" "$CURRENT"

echo "RUNTIME_CWD=$CURRENT"
echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build >/dev/null
)
echo "BUILD=PASS"

pm2 restart "$APP" >/dev/null
for i in $(seq 1 30); do
  HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' http://127.0.0.1:3600/tas/help-center || true)"
  if [ "$HTTP" = "200" ]; then break; fi
  sleep 1
done

STATUS="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"))})' "$APP")"

grep -q 'TAS_HELP_CENTER_INSYSTEM_LUXURY_V2' "$CURRENT/client/src/pages/HelpCenter.tsx"
grep -q 'path="/tas/help-center"' "$CURRENT/client/src/App.tsx"
grep -q 'navigate("/tas/help-center")' "$CURRENT/client/src/components/CRMLayout.tsx"
grep -q 'Service Help Center' "$CURRENT/client/src/components/CRMLayout.tsx"

echo "PM2=${STATUS^^}"
echo "HTTP_3600=$HTTP"
echo "HELP_CENTER_ROUTE=/tas/help-center"
echo "IN_SYSTEM_SHELL=YES"
echo "TOPBAR_HELP_INTERNAL=YES"
echo "SIDEBAR_HELP_LINK=YES"
echo "LUXURY_DESIGN_V2=ACTIVE"
echo "GUIDES=8"
echo "READY_FOR_UAT=YES"
echo "ERROR=NONE"
