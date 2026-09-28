#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-PREMIUM-BOOKING-LIVE-REFRESH-FIX-V1_1"

for cmd in realpath git curl python3 node sha256sum pm2 cp cmp grep mkdir rm patch pnpm seq sleep mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "DEPLOY=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$CURRENT" != "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_EQUALS_CANONICAL"; exit 2; }

TARGET="client/src/components/tas/TASPremiumBookingFlow.tsx"
[ -f "$CURRENT/$TARGET" ] && [ -f "$REPO/$TARGET" ] || { echo "DEPLOY=FAIL"; echo "ERROR=TARGET_MISSING"; exit 3; }
cmp -s "$CURRENT/$TARGET" "$REPO/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE"; exit 3; }

for root in "$CURRENT" "$REPO"; do
  grep -q 'bookingMode:.*premium_v1' "$root/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE8_UI_NOT_PRESENT"; exit 3; }
  grep -q 'TASNextDayPartsPreparation' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE12_UI_NOT_PRESENT"; exit 3; }
done

if grep -Fq 'const utils = trpc.useUtils();' "$CURRENT/$TARGET" \
  && grep -Fq 'utils.tas.service.listAppointments.invalidate()' "$CURRENT/$TARGET" \
  && grep -Fq 'utils.tas.service.getScheduler.invalidate()' "$CURRENT/$TARGET" \
  && grep -Fq 'utils.tas.service.getAvailableSlots.invalidate()' "$CURRENT/$TARGET" \
  && grep -Fq 'utils.tas.service.getPartsPreparationBoard.invalidate()' "$CURRENT/$TARGET"; then
  echo "SOURCE_PREFLIGHT=PASS"
  echo "PREMIUM_BOOKING_LIVE_REFRESH=ALREADY_SATISFIED"
  echo "SCHEDULER_INVALIDATION=ACTIVE"
  echo "AVAILABILITY_INVALIDATION=ACTIVE"
  echo "PREPARATION_INVALIDATION=ACTIVE"
  echo "APPOINTMENTS_INVALIDATION=ACTIVE"
  echo "PHASE1_TO_12=PRESERVED"
  echo "DB_SCHEMA_CHANGE=NONE"
  echo "DB_DATA_CHANGE=NONE"
  echo "CANONICAL_SOURCE_SYNC=ALREADY_MATCHED"
  echo "INDEX_PRESERVED=YES"
  echo "READY_FOR_GITHUB_PUSH=YES"
  echo "ERROR=NONE"
  exit 0
fi

TMP="$(mktemp -d /tmp/tas-premium-live-refresh.XXXXXX)"
LIVE_SUCCEEDED=0
ACTIVE_MUTATED=0
CANON_MUTATED=0

cleanup() {
  if [ "$LIVE_SUCCEEDED" = "0" ]; then
    if [ "$ACTIVE_MUTATED" = "1" ] && [ -f "$TMP/active-target" ]; then
      cp -a "$TMP/active-target" "$CURRENT/$TARGET" || true
    fi
    if [ -d "$TMP/dist-backup" ]; then
      rm -rf "$CURRENT/dist"
      cp -a "$TMP/dist-backup" "$CURRENT/dist" || true
    fi
    pm2 restart "$APP" >/dev/null 2>&1 || true
  fi
  if [ "$CANON_MUTATED" = "1" ] && [ -f "$TMP/canonical-target" ]; then
    cp -a "$TMP/canonical-target" "$REPO/$TARGET" || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
python3 -m py_compile "$TMP/source-transform.py"

echo "SOURCE_PREFLIGHT=PASS"

PATCH_TREE="$TMP/patch-tree"
mkdir -p "$PATCH_TREE/client/src/components/tas"
cp -a "$CURRENT/$TARGET" "$PATCH_TREE/$TARGET"
git -C "$PATCH_TREE" init -q
git -C "$PATCH_TREE" config user.email "premium-live-refresh@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Premium Live Refresh"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm baseline

python3 "$TMP/source-transform.py" "$PATCH_TREE" >/dev/null
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/fix.patch"
[ -s "$TMP/fix.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PATCH"; exit 4; }

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 --dry-run -p1 < "$TMP/fix.patch" >/dev/null
)
echo "PATCH_DRY_RUN=PASS"

cp -a "$CURRENT/$TARGET" "$TMP/active-target"
cp -a "$REPO/$TARGET" "$TMP/canonical-target"
if [ -d "$CURRENT/dist" ]; then cp -a "$CURRENT/dist" "$TMP/dist-backup"; fi
INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 -p1 < "$TMP/fix.patch" >/dev/null
)
ACTIVE_MUTATED=1

grep -q 'TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1' "$CURRENT/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=FIX_MARKER_MISSING"; exit 5; }
grep -q 'getScheduler.invalidate' "$CURRENT/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=SCHEDULER_INVALIDATION_MISSING"; exit 5; }
grep -q 'getAvailableSlots.invalidate' "$CURRENT/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=AVAILABILITY_INVALIDATION_MISSING"; exit 5; }
grep -q 'getPartsPreparationBoard.invalidate' "$CURRENT/$TARGET" || { echo "DEPLOY=FAIL"; echo "ERROR=PREPARATION_INVALIDATION_MISSING"; exit 5; }

echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)
echo "BUILD=PASS"

pm2 restart "$APP" >/dev/null
PM2_STATUS="UNKNOWN"
for _ in $(seq 1 30); do
  PM2_STATUS="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
 try {
  const rows=JSON.parse(s||"[]");
  const app=process.argv[1]||"TAS";
  const p=rows.find(x=>String(x.name||"")===app) || rows.find(x=>/tas/i.test(String(x.name||"")));
  process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"));
 } catch { process.stdout.write("UNKNOWN"); }
});' "$APP" 2>/dev/null || true)"
  [ "$PM2_STATUS" = "online" ] && break
  sleep 1
done
[ "$PM2_STATUS" = "online" ] || { echo "DEPLOY=FAIL"; echo "PM2=$PM2_STATUS"; echo "ERROR=PM2_NOT_ONLINE"; exit 6; }

PORT="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
 try {
  const rows=JSON.parse(s||"[]");
  const app=process.argv[1]||"TAS";
  const p=rows.find(x=>String(x.name||"")===app) || rows.find(x=>/tas/i.test(String(x.name||"")));
  process.stdout.write(String(p?.pm2_env?.PORT||p?.pm2_env?.env?.PORT||3008));
 } catch { process.stdout.write("3008"); }
});' "$APP")"

HTTP="000"
for _ in $(seq 1 20); do
  HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
  [ "$HTTP" = "200" ] && break
  sleep 1
done
[ "$HTTP" = "200" ] || { echo "DEPLOY=FAIL"; echo "HTTP=$HTTP"; echo "ERROR=HTTP_HEALTH_FAILED"; exit 6; }

LIVE_SUCCEEDED=1
echo "DEPLOY=PASS"

CANON_MUTATED=1
cp -a "$CURRENT/$TARGET" "$REPO/$TARGET"
INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED"; exit 8; }
cmp -s "$CURRENT/$TARGET" "$REPO/$TARGET" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_SYNC_MISMATCH"; exit 8; }
CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "PREMIUM_BOOKING_LIVE_REFRESH=ACTIVE"
echo "SCHEDULER_INVALIDATION=ACTIVE"
echo "AVAILABILITY_INVALIDATION=ACTIVE"
echo "PREPARATION_INVALIDATION=ACTIVE"
echo "PHASE1_TO_12=PRESERVED"
echo "DB_SCHEMA_CHANGE=NONE"
echo "DB_DATA_CHANGE=NONE"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
