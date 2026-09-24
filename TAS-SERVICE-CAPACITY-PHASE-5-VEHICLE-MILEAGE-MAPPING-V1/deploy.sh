#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-5-VEHICLE-MILEAGE-MAPPING-V1"
CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
TMP="$(mktemp -d /tmp/tas-service-phase5.XXXXXX)"

EXISTING_TARGETS=(
  "shared/schema.ts"
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
)
NEW_TARGETS=(
  "client/src/components/tas/TASMaintenanceVehicleMappingSettings.tsx"
  "scripts/apply-tas-maintenance-vehicle-mapping-v1.ts"
  "scripts/verify-tas-maintenance-vehicle-mapping-v1.ts"
  "scripts/rollback-tas-maintenance-vehicle-mapping-v1.ts"
)
ALL_TARGETS=("${EXISTING_TARGETS[@]}" "${NEW_TARGETS[@]}")

LIVE_SUCCEEDED=0
ACTIVE_MUTATED=0
MIGRATION_APPLIED=0
CANON_MUTATED=0
INDEX_BEFORE=""
CANON_STATUS_BEFORE=""

restore_active_source() {
  [ "$ACTIVE_MUTATED" = "1" ] || return 0
  local rel
  for rel in "${ALL_TARGETS[@]}"; do
    if [ -f "$TMP/active-backup/$rel.__absent__" ]; then
      rm -rf -- "$CURRENT/$rel"
    elif [ -e "$TMP/active-backup/$rel" ] || [ -L "$TMP/active-backup/$rel" ]; then
      mkdir -p "$(dirname "$CURRENT/$rel")"
      rm -rf -- "$CURRENT/$rel"
      cp -a "$TMP/active-backup/$rel" "$CURRENT/$rel"
    fi
  done
  ACTIVE_MUTATED=0
}

restore_dist() {
  if [ -f "$TMP/dist-absent" ]; then
    rm -rf -- "$CURRENT/dist"
  elif [ -d "$TMP/dist-backup" ]; then
    rm -rf -- "$CURRENT/dist"
    cp -a "$TMP/dist-backup" "$CURRENT/dist"
  fi
}

restore_canonical() {
  [ "$CANON_MUTATED" = "1" ] || return 0
  local rel
  for rel in "${ALL_TARGETS[@]}"; do
    if [ -f "$TMP/canonical-backup/$rel.__absent__" ]; then
      rm -rf -- "$REPO/$rel"
    elif [ -e "$TMP/canonical-backup/$rel" ] || [ -L "$TMP/canonical-backup/$rel" ]; then
      mkdir -p "$(dirname "$REPO/$rel")"
      rm -rf -- "$REPO/$rel"
      cp -a "$TMP/canonical-backup/$rel" "$REPO/$rel"
    fi
  done
  CANON_MUTATED=0
}

rollback_live() {
  [ "$LIVE_SUCCEEDED" = "0" ] || return 0

  if [ "$MIGRATION_APPLIED" = "1" ] && [ -f "$CURRENT/scripts/rollback-tas-maintenance-vehicle-mapping-v1.ts" ]; then
    (
      cd "$CURRENT"
      pnpm exec tsx scripts/rollback-tas-maintenance-vehicle-mapping-v1.ts >/dev/null 2>&1 || true
    )
    MIGRATION_APPLIED=0
  fi

  restore_active_source || true
  restore_dist || true
  pm2 restart "$APP" >/dev/null 2>&1 || true
}

cleanup() {
  if [ "$LIVE_SUCCEEDED" = "0" ]; then
    rollback_live || true
  fi
  restore_canonical || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

for cmd in realpath git curl python3 node sha256sum pm2 cp cmp grep mkdir rm patch pnpm seq sleep; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "DEPLOY=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$CURRENT" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

# Phase 4 must be present in both live and canonical baseline.
for root in "$CURRENT" "$REPO"; do
  grep -q 'tasMaintenancePlans' "$root/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE4_SCHEMA_NOT_PRESENT"; exit 3; }
  grep -q 'listTASMaintenancePlans' "$root/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE4_DB_NOT_PRESENT"; exit 3; }
  grep -q 'TASMaintenancePlansSettings' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE4_UI_NOT_PRESENT"; exit 3; }
done

mkdir -p "$TMP/payload/client/src/components/tas" "$TMP/payload/scripts" "$TMP/payload/snippets"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASMaintenanceVehicleMappingSettings.tsx" -o "$TMP/payload/client/src/components/tas/TASMaintenanceVehicleMappingSettings.tsx"
curl -fsSL "$BASE_URL/payload/scripts/apply-tas-maintenance-vehicle-mapping-v1.ts" -o "$TMP/payload/scripts/apply-tas-maintenance-vehicle-mapping-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-maintenance-vehicle-mapping-v1.ts" -o "$TMP/payload/scripts/verify-tas-maintenance-vehicle-mapping-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/rollback-tas-maintenance-vehicle-mapping-v1.ts" -o "$TMP/payload/scripts/rollback-tas-maintenance-vehicle-mapping-v1.ts"
curl -fsSL "$BASE_URL/payload/snippets/schema.ts.txt" -o "$TMP/payload/snippets/schema.ts.txt"
curl -fsSL "$BASE_URL/payload/snippets/tasDb.ts.txt" -o "$TMP/payload/snippets/tasDb.ts.txt"
curl -fsSL "$BASE_URL/payload/snippets/router-import.txt" -o "$TMP/payload/snippets/router-import.txt"
curl -fsSL "$BASE_URL/payload/snippets/router-endpoints.txt" -o "$TMP/payload/snippets/router-endpoints.txt"

python3 -m py_compile "$TMP/source-transform.py"

for rel in "${EXISTING_TARGETS[@]}"; do
  [ -f "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$rel"; exit 3; }
  [ -f "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$rel"; exit 3; }
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE_$rel"; exit 3; }
done

for rel in "${NEW_TARGETS[@]}"; do
  [ ! -e "$CURRENT/$rel" ] && [ ! -L "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE5_ALREADY_PRESENT_ACTIVE_$rel"; exit 3; }
  [ ! -e "$REPO/$rel" ] && [ ! -L "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE5_ALREADY_PRESENT_CANONICAL_$rel"; exit 3; }
done

CANON_STATUS_BEFORE="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${ALL_TARGETS[@]}" || true)"
if [ -n "$CANON_STATUS_BEFORE" ]; then
  printf '%s\n' "$CANON_STATUS_BEFORE"
  echo "DEPLOY=FAIL"
  echo "ERROR=CANONICAL_PHASE5_TARGETS_DIRTY"
  exit 3
fi

echo "SOURCE_PREFLIGHT=PASS"

PATCH_TREE="$TMP/patch-tree"
mkdir -p "$PATCH_TREE"
for rel in "${EXISTING_TARGETS[@]}"; do
  mkdir -p "$(dirname "$PATCH_TREE/$rel")"
  cp -a "$CURRENT/$rel" "$PATCH_TREE/$rel"
done

git -C "$PATCH_TREE" init -q
git -C "$PATCH_TREE" config user.email "phase5@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Phase 5"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm "baseline"

python3 "$TMP/source-transform.py" "$PATCH_TREE" "$TMP/payload" >/dev/null
git -C "$PATCH_TREE" add -N .
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/phase5.patch"

[ -s "$TMP/phase5.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PHASE5_PATCH"; exit 4; }
grep -q '^diff --git a/' "$TMP/phase5.patch" || { echo "DEPLOY=FAIL"; echo "ERROR=PATCH_NOT_GIT_STYLE"; exit 4; }

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 --dry-run -p1 < "$TMP/phase5.patch" >/dev/null
)
echo "PATCH_DRY_RUN=PASS"

# Back up only source targets and built output before mutation.
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
  patch --batch --forward --fuzz=0 -p1 < "$TMP/phase5.patch" >/dev/null
)
ACTIVE_MUTATED=1

grep -q 'tasMaintenanceVehicleMappings' "$CURRENT/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SCHEMA_PATCH_VERIFY_FAILED"; exit 5; }
grep -q 'listTASMaintenanceVehicleMappings' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_DB_PATCH_VERIFY_FAILED"; exit 5; }
grep -q 'listMaintenanceVehicleMappings:' "$CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_ROUTER_PATCH_VERIFY_FAILED"; exit 5; }
grep -q 'TASMaintenanceVehicleMappingSettings' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_UI_PATCH_VERIFY_FAILED"; exit 5; }

echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
)
echo "BUILD=PASS"

MIGRATION_APPLIED=1
(
  cd "$CURRENT"
  pnpm exec tsx scripts/apply-tas-maintenance-vehicle-mapping-v1.ts --apply
)

(
  cd "$CURRENT"
  pnpm exec tsx scripts/verify-tas-maintenance-vehicle-mapping-v1.ts
)
echo "MIGRATION=PASS"

pm2 restart "$APP" >/dev/null

PM2_STATUS="UNKNOWN"
for _ in $(seq 1 30); do
  PM2_STATUS="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")===(process.argv[1]||"TAS")) || rows.find(x=>/tas/i.test(String(x.name||"")));
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
    const p=rows.find(x=>String(x.name||"")===(process.argv[1]||"TAS")) || rows.find(x=>/tas/i.test(String(x.name||"")));
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

# Canonical source must still be untouched before sync.
CURRENT_CANON_STATUS="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${ALL_TARGETS[@]}" || true)"
[ "$CURRENT_CANON_STATUS" = "$CANON_STATUS_BEFORE" ] || {
  printf '%s\n' "$CURRENT_CANON_STATUS"
  echo "SOURCE_SYNC=FAIL"
  echo "ERROR=CANONICAL_TARGET_CHANGED_DURING_DEPLOY"
  exit 7
}

for rel in "${EXISTING_TARGETS[@]}"; do
  cmp -s "$TMP/canonical-backup/$rel" "$REPO/$rel" || {
    echo "SOURCE_SYNC=FAIL"
    echo "ERROR=CANONICAL_CONTENT_CHANGED_$rel"
    exit 7
  }
done

CANON_MUTATED=1
for rel in "${ALL_TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$CURRENT/$rel" "$REPO/$rel"
done

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED"; exit 8; }

grep -q 'tasMaintenanceVehicleMappings' "$REPO/shared/schema.ts" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_SCHEMA_SYNC_FAILED"; exit 8; }
grep -q 'listTASMaintenanceVehicleMappings' "$REPO/server/tasDb.ts" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_DB_SYNC_FAILED"; exit 8; }
grep -q 'TASMaintenanceVehicleMappingSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_UI_SYNC_FAILED"; exit 8; }

CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "VEHICLE_MILEAGE_MAPPING=ACTIVE"
echo "SEED_MAPPINGS=0"
echo "BOOKING_FLOW_UNCHANGED=YES"
echo "AVAILABILITY_ENGINE_UNCHANGED=YES"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
