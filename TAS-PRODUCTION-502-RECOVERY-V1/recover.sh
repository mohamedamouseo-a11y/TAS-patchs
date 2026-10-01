#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${TAS_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
CURRENT="$ROOT/current"
CONFIG="$CURRENT/deploy/ecosystem.current.config.cjs"
PORT="${TAS_PORT:-3600}"

fail() {
  echo "PATCH=FAIL"
  echo "TAS_RESTORED=NO"
  echo "ERROR=$*"
  exit 1
}

command -v pm2 >/dev/null 2>&1 || fail "PM2_NOT_FOUND"
command -v curl >/dev/null 2>&1 || fail "CURL_NOT_FOUND"

test -L "$CURRENT" -o -d "$CURRENT" || fail "CURRENT_RUNTIME_NOT_FOUND"
CURRENT_REAL="$(realpath -e "$CURRENT" 2>/dev/null || true)"
test -n "$CURRENT_REAL" || fail "CURRENT_RUNTIME_UNRESOLVED"
test -f "$CURRENT_REAL/dist/index.js" || fail "CURRENT_DIST_INDEX_MISSING"

PM2_PRESENT=NO
PM2_STATUS_BEFORE=ABSENT
PM2_STATUS_AFTER=UNKNOWN
PM2_CWD=""
PM2_SCRIPT=""

if pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]");
  process.exit(a.some(x=>x&&x.name===process.argv[1])?0:1)
})' "$APP"; then
  PM2_PRESENT=YES
  PM2_STATUS_BEFORE="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.status||"unknown"));
})' "$APP")"
  pm2 restart "$APP" --update-env >/dev/null
else
  test -f "$CONFIG" || fail "PM2_CONFIG_NOT_FOUND"
  APP_DEPLOY_ROOT="$ROOT" PM2_APP_NAME="$APP" pm2 start "$CONFIG" --only "$APP" --update-env >/dev/null
fi

for _ in $(seq 1 30); do
  PM2_STATUS_AFTER="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"
  [ "$PM2_STATUS_AFTER" = "online" ] && break
  sleep 1
done

[ "$PM2_STATUS_AFTER" = "online" ] || fail "PM2_NOT_ONLINE"

PM2_CWD="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.pm_cwd||""));
})' "$APP")"
PM2_SCRIPT="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.pm_exec_path||""));
})' "$APP")"

LOCAL_ROOT_HTTP="000"
LOCAL_SETTINGS_HTTP="000"
LOCAL_HELP_CENTER_HTTP="000"

for _ in $(seq 1 30); do
  LOCAL_ROOT_HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"
  [ "$LOCAL_ROOT_HTTP" != "000" ] && [ "$LOCAL_ROOT_HTTP" != "502" ] && break
  sleep 1
done

LOCAL_SETTINGS_HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:$PORT/settings" || true)"
LOCAL_HELP_CENTER_HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/help-center" || true)"

if [ "$LOCAL_ROOT_HTTP" = "000" ] || [ "$LOCAL_ROOT_HTTP" = "502" ]; then
  fail "LOCAL_UPSTREAM_UNAVAILABLE"
fi

pm2 save >/dev/null || true

PUBLIC_SETTINGS_HTTP="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' "https://tas.tamiyouz.com/settings" || true)"
PUBLIC_HELP_CENTER_HTTP="$(curl -k -sS -o /dev/null --max-time 8 -w '%{http_code}' "https://tas.tamiyouz.com/tas/help-center" || true)"

echo "PATCH=TAS-PRODUCTION-502-RECOVERY-V1"
echo "PM2_PRESENT=$PM2_PRESENT"
echo "PM2_STATUS_BEFORE=$PM2_STATUS_BEFORE"
echo "PM2_STATUS_AFTER=$PM2_STATUS_AFTER"
echo "PM2_CWD=$PM2_CWD"
echo "PM2_SCRIPT=$PM2_SCRIPT"
echo "PORT_3600=$LOCAL_ROOT_HTTP"
echo "LOCAL_SETTINGS_HTTP=$LOCAL_SETTINGS_HTTP"
echo "LOCAL_HELP_CENTER_HTTP=$LOCAL_HELP_CENTER_HTTP"
echo "PUBLIC_SETTINGS_HTTP=$PUBLIC_SETTINGS_HTTP"
echo "PUBLIC_HELP_CENTER_HTTP=$PUBLIC_HELP_CENTER_HTTP"
echo "TAS_RESTORED=YES"
echo "ERROR=NONE"
