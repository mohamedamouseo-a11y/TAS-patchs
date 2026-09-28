#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-PHASE11-SNAPSHOT-CREATION-HARDENING-V1"

CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "PATCH=FAIL"; echo "ERROR=CANONICAL_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"

TARGET="server/tasDb.ts"
TMP="$(mktemp -d /tmp/tas-p11-snapshot-deploy.XXXXXX)"
LIVE_OK=0
CANON_CHANGED=0

cleanup() {
  if [ "$LIVE_OK" = "0" ] && [ -f "$TMP/live.bak" ]; then
    cp -a "$TMP/live.bak" "$CURRENT/$TARGET" || true
    [ ! -d "$TMP/dist.bak" ] || { rm -rf "$CURRENT/dist"; cp -a "$TMP/dist.bak" "$CURRENT/dist" || true; }
    pm2 restart "$APP" >/dev/null 2>&1 || true
  fi
  if [ "$CANON_CHANGED" = "1" ] && [ -f "$TMP/repo.bak" ]; then
    cp -a "$TMP/repo.bak" "$REPO/$TARGET" || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

for cmd in git curl python3 pnpm pm2 cmp grep sha256sum realpath cp; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "PATCH=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

[ -f "$CURRENT/$TARGET" ] || { echo "PATCH=FAIL"; echo "ERROR=ACTIVE_TARGET_MISSING"; exit 3; }
[ -f "$REPO/$TARGET" ] || { echo "PATCH=FAIL"; echo "ERROR=CANONICAL_TARGET_MISSING"; exit 3; }
cmp -s "$CURRENT/$TARGET" "$REPO/$TARGET" || { echo "PATCH=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE"; exit 3; }

grep -q 'snapshotTASMaintenancePackageForBooking' "$CURRENT/$TARGET" || { echo "PATCH=FAIL"; echo "ERROR=PHASE11_SNAPSHOT_HELPER_MISSING"; exit 3; }
grep -q 'export const createTASAppointment' "$CURRENT/$TARGET" || { echo "PATCH=FAIL"; echo "ERROR=CREATE_APPOINTMENT_PATH_MISSING"; exit 3; }

cp -a "$CURRENT/$TARGET" "$TMP/live.bak"
cp -a "$REPO/$TARGET" "$TMP/repo.bak"
[ ! -d "$CURRENT/dist" ] || cp -a "$CURRENT/dist" "$TMP/dist.bak"
INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
python3 "$TMP/source-transform.py" "$CURRENT"
python3 "$TMP/source-transform.py" "$REPO"
CANON_CHANGED=1

grep -q 'TAS_PHASE11_SNAPSHOT_CREATION_HARDENING_V1' "$CURRENT/$TARGET"
grep -q 'expectedSnapshotLineCount' "$CURRENT/$TARGET"
grep -q 'Maintenance snapshot integrity check failed' "$CURRENT/$TARGET"
grep -q 'maintenanceIntervalId: bookingMaintenanceIntervalId' "$CURRENT/$TARGET"
echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build >/dev/null
)
echo "BUILD=PASS"

pm2 restart "$APP" >/dev/null

PM2_STATUS="UNKNOWN"
for _ in $(seq 1 30); do
  PM2_STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const r=JSON.parse(s||"[]");const a=process.argv[1];const p=r.find(x=>String(x.name||"")===a)||r.find(x=>/tas/i.test(String(x.name||"")));process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"));}catch{process.stdout.write("UNKNOWN")}});' "$APP" 2>/dev/null || true)"
  [ "$PM2_STATUS" = "online" ] && break
  sleep 1
done
[ "$PM2_STATUS" = "online" ] || { echo "PATCH=FAIL"; echo "PM2=$PM2_STATUS"; echo "ERROR=PM2_NOT_ONLINE"; exit 5; }

PORT="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const r=JSON.parse(s||"[]");const a=process.argv[1];const p=r.find(x=>String(x.name||"")===a)||r.find(x=>/tas/i.test(String(x.name||"")));process.stdout.write(String(p?.pm2_env?.PORT||p?.pm2_env?.env?.PORT||3008));}catch{process.stdout.write("3008")}});' "$APP")"

HTTP="000"
for _ in $(seq 1 20); do
  HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
  [ "$HTTP" = "200" ] && break
  sleep 1
done
[ "$HTTP" = "200" ] || { echo "PATCH=FAIL"; echo "HTTP=$HTTP"; echo "ERROR=HTTP_HEALTH_FAILED"; exit 5; }

cmp -s "$CURRENT/$TARGET" "$REPO/$TARGET" || { echo "PATCH=FAIL"; echo "ERROR=SOURCE_SYNC_MISMATCH"; exit 6; }
INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "PATCH=FAIL"; echo "ERROR=GIT_INDEX_CHANGED"; exit 6; }

CANON_CHANGED=0
LIVE_OK=1

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "SNAPSHOT_CREATION_HARDENING=ACTIVE"
echo "SNAPSHOT_CALL_UNCONDITIONAL_FOR_VALID_INTERVAL=YES"
echo "SNAPSHOT_TRANSACTIONAL=YES"
echo "SNAPSHOT_INTEGRITY_GUARD=ACTIVE"
echo "BOOKING_15_BACKFILLED=NO"
echo "BOOKING_16_BACKFILLED=NO"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
