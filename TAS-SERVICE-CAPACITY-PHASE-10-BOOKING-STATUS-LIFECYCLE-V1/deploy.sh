#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-10-BOOKING-STATUS-LIFECYCLE-V1"

for cmd in realpath git curl python3 node sha256sum pm2 cp cmp grep mkdir rm patch pnpm seq sleep; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "DEPLOY=FAIL"
    echo "ERROR=MISSING_COMMAND_$cmd"
    exit 2
  }
done

CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$CURRENT" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }

TMP="$(mktemp -d /tmp/tas-service-phase10.XXXXXX)"
PAYLOAD="$TMP/payload"

EXISTING_TARGETS=(
  "shared/schema.ts"
  "server/tasDb.ts"
  "server/routers.ts"
  "server/tasPhase2.ts"
  "client/src/pages/tas/TASServicePage.tsx"
  "client/src/components/tas/TASServiceScheduler.tsx"
)
NEW_TARGETS=(
  "server/services/tasBookingLifecycle.ts"
  "client/src/components/tas/TASBookingLifecycleActions.tsx"
  "scripts/apply-tas-booking-lifecycle-v1.ts"
  "scripts/verify-tas-booking-lifecycle-v1.ts"
  "scripts/rollback-tas-booking-lifecycle-v1.ts"
)
ALL_TARGETS=("${EXISTING_TARGETS[@]}" "${NEW_TARGETS[@]}")

LIVE_SUCCEEDED=0
ACTIVE_MUTATED=0
CANON_MUTATED=0
MIGRATION_ATTEMPTED=0

restore_tree() {
  local base="$1"
  local backup="$2"
  local rel
  for rel in "${ALL_TARGETS[@]}"; do
    if [ -f "$backup/$rel.__absent__" ]; then
      rm -rf -- "$base/$rel"
    elif [ -e "$backup/$rel" ] || [ -L "$backup/$rel" ]; then
      mkdir -p "$(dirname "$base/$rel")"
      rm -rf -- "$base/$rel"
      cp -a "$backup/$rel" "$base/$rel"
    fi
  done
}

rollback_live() {
  [ "$LIVE_SUCCEEDED" = "0" ] || return 0
  if [ "$MIGRATION_ATTEMPTED" = "1" ] && [ -f "$CURRENT/scripts/rollback-tas-booking-lifecycle-v1.ts" ]; then
    (
      cd "$CURRENT"
      pnpm exec tsx scripts/rollback-tas-booking-lifecycle-v1.ts
    ) >/dev/null 2>&1 || true
  fi
  if [ "$ACTIVE_MUTATED" = "1" ]; then
    restore_tree "$CURRENT" "$TMP/active-backup" || true
  fi
  if [ -d "$TMP/dist-backup" ]; then
    rm -rf -- "$CURRENT/dist"
    cp -a "$TMP/dist-backup" "$CURRENT/dist" || true
  elif [ -f "$TMP/dist-absent" ]; then
    rm -rf -- "$CURRENT/dist"
  fi
  pm2 restart "$APP" >/dev/null 2>&1 || true
}

restore_canonical() {
  [ "$CANON_MUTATED" = "1" ] || return 0
  restore_tree "$REPO" "$TMP/canonical-backup" || true
  CANON_MUTATED=0
}

cleanup() {
  if [ "$LIVE_SUCCEEDED" = "0" ]; then rollback_live || true; fi
  restore_canonical || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

# Prerequisites: Phase 9 and fixed Developer Hub snapshot logic.
for root in "$CURRENT" "$REPO"; do
  grep -q 'schedulerVersion: 1' "$root/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE9_BACKEND_NOT_PRESENT"; exit 3; }
  grep -q '<TASServiceScheduler />' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE9_UI_NOT_PRESENT"; exit 3; }
  grep -q 'ATOMIC_FULL_SOURCE_SNAPSHOT_V1' "$root/server/routes/developerHub.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=DEVELOPER_HUB_SNAPSHOT_FIX_NOT_PRESENT"; exit 3; }
done

mkdir -p "$PAYLOAD/server/services" "$PAYLOAD/client/src/components/tas" "$PAYLOAD/scripts"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/server/services/tasBookingLifecycle.ts" -o "$PAYLOAD/server/services/tasBookingLifecycle.ts"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASBookingLifecycleActions.tsx" -o "$PAYLOAD/client/src/components/tas/TASBookingLifecycleActions.tsx"
curl -fsSL "$BASE_URL/payload/scripts/apply-tas-booking-lifecycle-v1.ts" -o "$PAYLOAD/scripts/apply-tas-booking-lifecycle-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-booking-lifecycle-v1.ts" -o "$PAYLOAD/scripts/verify-tas-booking-lifecycle-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/rollback-tas-booking-lifecycle-v1.ts" -o "$PAYLOAD/scripts/rollback-tas-booking-lifecycle-v1.ts"
python3 -m py_compile "$TMP/source-transform.py"

# Existing source must be the same content in active and canonical.
# Do not require a clean Git worktree; Developer Hub owns commit/push.
for rel in "${EXISTING_TARGETS[@]}"; do
  [ -f "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$rel"; exit 3; }
  [ -f "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$rel"; exit 3; }
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE_$rel"; exit 3; }
done

for rel in "${NEW_TARGETS[@]}"; do
  [ ! -e "$CURRENT/$rel" ] && [ ! -L "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE10_ALREADY_PRESENT_ACTIVE_$rel"; exit 3; }
  [ ! -e "$REPO/$rel" ] && [ ! -L "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE10_ALREADY_PRESENT_CANONICAL_$rel"; exit 3; }
done

echo "SOURCE_PREFLIGHT=PASS"

PATCH_TREE="$TMP/patch-tree"
mkdir -p "$PATCH_TREE"
for rel in "${EXISTING_TARGETS[@]}"; do
  mkdir -p "$(dirname "$PATCH_TREE/$rel")"
  cp -a "$CURRENT/$rel" "$PATCH_TREE/$rel"
done

git -C "$PATCH_TREE" init -q
git -C "$PATCH_TREE" config user.email "phase10@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Phase 10"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm "baseline"

python3 "$TMP/source-transform.py" "$PATCH_TREE" "$PAYLOAD" >/dev/null
git -C "$PATCH_TREE" add -N .
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/phase10.patch"

[ -s "$TMP/phase10.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PHASE10_PATCH"; exit 4; }
grep -q '^diff --git a/' "$TMP/phase10.patch" || { echo "DEPLOY=FAIL"; echo "ERROR=PATCH_NOT_GIT_STYLE"; exit 4; }

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 --dry-run -p1 < "$TMP/phase10.patch" >/dev/null
)
echo "PATCH_DRY_RUN=PASS"

mkdir -p "$TMP/active-backup" "$TMP/canonical-backup"
for rel in "${ALL_TARGETS[@]}"; do
  if [ -e "$CURRENT/$rel" ] || [ -L "$CURRENT/$rel" ]; then
    mkdir -p "$(dirname "$TMP/active-backup/$rel")"
    cp -a "$CURRENT/$rel" "$TMP/active-backup/$rel"
  else
    mkdir -p "$(dirname "$TMP/active-backup/$rel.__absent__")"
    : > "$TMP/active-backup/$rel.__absent__"
  fi

  if [ -e "$REPO/$rel" ] || [ -L "$REPO/$rel" ]; then
    mkdir -p "$(dirname "$TMP/canonical-backup/$rel")"
    cp -a "$REPO/$rel" "$TMP/canonical-backup/$rel"
  else
    mkdir -p "$(dirname "$TMP/canonical-backup/$rel.__absent__")"
    : > "$TMP/canonical-backup/$rel.__absent__"
  fi
done

if [ -d "$CURRENT/dist" ]; then
  cp -a "$CURRENT/dist" "$TMP/dist-backup"
else
  : > "$TMP/dist-absent"
fi

INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 -p1 < "$TMP/phase10.patch" >/dev/null
)
ACTIVE_MUTATED=1

grep -q 'tas_service_booking_status_history' "$CURRENT/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_HISTORY_SCHEMA_MISSING"; exit 5; }
grep -q 'ALLOWED_TRANSITIONS' "$CURRENT/server/services/tasBookingLifecycle.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_LIFECYCLE_ENGINE_MISSING"; exit 5; }
grep -q 'transitionBookingStatus' "$CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_LIFECYCLE_ROUTE_MISSING"; exit 5; }
grep -q 'source: "LegacyConfirmWorkflow"' "$CURRENT/server/tasPhase2.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=LEGACY_CONFIRM_NOT_ROUTED"; exit 5; }
grep -q 'TASBookingLifecycleActions' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=APPOINTMENT_LIFECYCLE_UI_MISSING"; exit 5; }
grep -q 'TASBookingLifecycleActions' "$CURRENT/client/src/components/tas/TASServiceScheduler.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=SCHEDULER_LIFECYCLE_UI_MISSING"; exit 5; }

echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)
echo "BUILD=PASS"

MIGRATION_ATTEMPTED=1
(
  cd "$CURRENT"
  pnpm exec tsx scripts/apply-tas-booking-lifecycle-v1.ts --apply
  pnpm exec tsx scripts/verify-tas-booking-lifecycle-v1.ts
)
echo "MIGRATION=PASS"

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

# Sync source to canonical without touching the Git index.
CANON_MUTATED=1
for rel in "${ALL_TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$CURRENT/$rel" "$REPO/$rel"
done

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED"; exit 8; }

for rel in "${ALL_TARGETS[@]}"; do
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_SYNC_MISMATCH_$rel"; exit 8; }
done

CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "LIFECYCLE_ENGINE=ACTIVE"
echo "STATUS_HISTORY=ACTIVE"
echo "REASON_GUARD=ACTIVE"
echo "TERMINAL_STATE_GUARD=ACTIVE"
echo "LEGACY_CONFIRM_WORKFLOW=ROUTED_THROUGH_LIFECYCLE"
echo "PHASE7_AUTO_BAY=PRESERVED"
echo "PHASE8_PREMIUM_BOOKING=PRESERVED"
echo "PHASE9_SCHEDULER=PRESERVED"
echo "DB_SCHEMA=STATUS_HISTORY_TABLE_ONLY"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
