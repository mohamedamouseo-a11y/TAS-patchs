#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-PHASE11-SNAPSHOT-RUNTIME-TRACE-V1"
TARGET="server/tasDb.ts"
CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "PATCH=FAIL"; echo "ERROR=CANONICAL_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
cmp -s "$CURRENT/$TARGET" "$REPO/$TARGET" || { echo "PATCH=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE"; exit 3; }
TMP="$(mktemp -d /tmp/tas-p11-runtime-trace-deploy.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
python3 "$TMP/source-transform.py" "$CURRENT"
python3 "$TMP/source-transform.py" "$REPO"
grep -q 'TAS_PHASE11_SNAPSHOT_RUNTIME_TRACE_V1' "$CURRENT/$TARGET"
echo "PATCH=PASS"
(cd "$CURRENT" && NODE_OPTIONS="--max-old-space-size=2048" pnpm run build >/dev/null)
echo "BUILD=PASS"
pm2 restart "$APP" >/dev/null
sleep 2
STATUS="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"))})' "$APP")"
echo "PM2=${STATUS^^}"
PORT="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.PORT||3008))})' "$APP")"
HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
echo "HTTP=$HTTP"
INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "ERROR=GIT_INDEX_CHANGED"; exit 6; }
echo "SNAPSHOT_RUNTIME_TRACE=ACTIVE"
echo "TRACE_MARKER=TAS_PHASE11_SNAPSHOT_TRACE_V1"
echo "INDEX_PRESERVED=YES"
echo "ERROR=NONE"
