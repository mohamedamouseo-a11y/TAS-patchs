#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-4-MAINTENANCE-PLANS-V1"
CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
TMP="$(mktemp -d /tmp/tas-service-phase4.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

EXISTING_TARGETS=(
  "shared/schema.ts"
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
)
NEW_TARGETS=(
  "client/src/components/tas/TASMaintenancePlansSettings.tsx"
  "scripts/apply-tas-maintenance-plans-v1.ts"
  "scripts/verify-tas-maintenance-plans-v1.ts"
  "scripts/rollback-tas-maintenance-plans-v1.ts"
)
ALL_TARGETS=("${EXISTING_TARGETS[@]}" "${NEW_TARGETS[@]}")

for cmd in realpath git curl python3 node sha256sum pm2 cp cmp grep mkdir; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "DEPLOY=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$CURRENT" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

grep -q 'tasServiceBays' "$CURRENT/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE3_SCHEMA_NOT_PRESENT"; exit 3; }
grep -q 'listTASServiceBays' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE3_DB_NOT_PRESENT"; exit 3; }
grep -q 'TASServiceBaysSettings' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE3_UI_NOT_PRESENT"; exit 3; }

mkdir -p "$TMP/payload/client/src/components/tas" "$TMP/payload/scripts" "$TMP/payload/snippets"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASMaintenancePlansSettings.tsx" -o "$TMP/payload/client/src/components/tas/TASMaintenancePlansSettings.tsx"
curl -fsSL "$BASE_URL/payload/scripts/apply-tas-maintenance-plans-v1.ts" -o "$TMP/payload/scripts/apply-tas-maintenance-plans-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-maintenance-plans-v1.ts" -o "$TMP/payload/scripts/verify-tas-maintenance-plans-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/rollback-tas-maintenance-plans-v1.ts" -o "$TMP/payload/scripts/rollback-tas-maintenance-plans-v1.ts"
curl -fsSL "$BASE_URL/payload/snippets/schema.ts.txt" -o "$TMP/payload/snippets/schema.ts.txt"
curl -fsSL "$BASE_URL/payload/snippets/tasDb.ts.txt" -o "$TMP/payload/snippets/tasDb.ts.txt"
curl -fsSL "$BASE_URL/payload/snippets/router-import.txt" -o "$TMP/payload/snippets/router-import.txt"
curl -fsSL "$BASE_URL/payload/snippets/router-endpoints.txt" -o "$TMP/payload/snippets/router-endpoints.txt"

python3 -m py_compile "$TMP/source-transform.py"

for rel in "${EXISTING_TARGETS[@]}"; do
  [ -f "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$rel"; exit 3; }
  [ -f "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$rel"; exit 3; }
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_TARGET_DIVERGED_$rel"; exit 3; }
done

for rel in "${NEW_TARGETS[@]}"; do
  [ ! -e "$CURRENT/$rel" ] && [ ! -L "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE4_ALREADY_PRESENT_ACTIVE_$rel"; exit 3; }
  [ ! -e "$REPO/$rel" ] && [ ! -L "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE4_ALREADY_PRESENT_CANONICAL_$rel"; exit 3; }
done

TARGET_STATUS="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${ALL_TARGETS[@]}" || true)"
if [ -n "$TARGET_STATUS" ]; then
  printf '%s\n' "$TARGET_STATUS"
  echo "DEPLOY=FAIL"
  echo "ERROR=CANONICAL_PHASE4_TARGETS_DIRTY"
  exit 3
fi

echo "SOURCE_PREFLIGHT=PASS"
echo "THREE_WAY_PREFLIGHT=NOT_NEEDED_TARGETS_IDENTICAL"

PATCH_TREE="$TMP/patch-tree"
mkdir -p "$PATCH_TREE"
for rel in "${EXISTING_TARGETS[@]}"; do
  mkdir -p "$(dirname "$PATCH_TREE/$rel")"
  cp -a "$CURRENT/$rel" "$PATCH_TREE/$rel"
done

git -C "$PATCH_TREE" init -q
git -C "$PATCH_TREE" config user.email "phase4@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Phase 4"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm "baseline"

python3 "$TMP/source-transform.py" "$PATCH_TREE" "$TMP/payload" >/dev/null
git -C "$PATCH_TREE" add -N .
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/phase4.patch"

[ -s "$TMP/phase4.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PHASE4_PATCH"; exit 4; }
grep -q '^diff --git a/' "$TMP/phase4.patch" || { echo "DEPLOY=FAIL"; echo "ERROR=PATCH_NOT_GIT_STYLE"; exit 4; }

node "$CURRENT/scripts/stamp-tas-patch-base.mjs" "$TMP/phase4.patch" "$TMP/phase4.stamped.patch" >/dev/null
PATCH_SHA="$(sha256sum "$TMP/phase4.stamped.patch" | awk '{print $1}')"

INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
mkdir -p "$TMP/canonical-hashes"
for rel in "${EXISTING_TARGETS[@]}"; do
  sha256sum "$REPO/$rel" > "$TMP/canonical-hashes/$(printf '%s' "$rel" | tr '/' '_').sha"
done

export DEPLOY_MIGRATION_COMMAND="pnpm exec tsx scripts/apply-tas-maintenance-plans-v1.ts --apply"
export DEPLOY_MIGRATION_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-maintenance-plans-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_COMMAND="pnpm exec tsx scripts/rollback-tas-maintenance-plans-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-maintenance-plans-v1.ts --rolled-back"
export DEPLOY_MIGRATION_CONTRACT_PATCH_SHA256="$PATCH_SHA"

if ! "$CURRENT/scripts/deploy-active-release.sh" "$TMP/phase4.stamped.patch" >"$TMP/deploy.log" 2>&1; then
  tail -100 "$TMP/deploy.log" >&2
  echo "DEPLOY=FAIL"
  echo "ERROR=ATOMIC_DEPLOY_FAILED"
  exit 5
fi

NEW_CURRENT="$(realpath -e "$ROOT/current")"

grep -q 'tasMaintenancePlans' "$NEW_CURRENT/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=LIVE_SCHEMA_MARKER_MISSING"; exit 6; }
grep -q 'listTASMaintenancePlans' "$NEW_CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=LIVE_DB_MARKER_MISSING"; exit 6; }
grep -q 'listMaintenancePlans:' "$NEW_CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=LIVE_ROUTER_MARKER_MISSING"; exit 6; }
grep -q 'TASMaintenancePlansSettings' "$NEW_CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=LIVE_UI_MARKER_MISSING"; exit 6; }

PM2_STATUS="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")==="TAS") || rows.find(x=>/tas/i.test(String(x.name||"")));
    process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"));
  } catch { process.stdout.write("UNKNOWN"); }
});')"

PORT="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")==="TAS") || rows.find(x=>/tas/i.test(String(x.name||"")));
    process.stdout.write(String(p?.pm2_env?.PORT||p?.pm2_env?.env?.PORT||3008));
  } catch { process.stdout.write("3008"); }
});')"

HTTP="$(curl -sS -o /dev/null --max-time 8 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
[ "$PM2_STATUS" = "online" ] || { echo "DEPLOY=FAIL"; echo "PM2=$PM2_STATUS"; echo "ERROR=PM2_NOT_ONLINE"; exit 6; }
[ "$HTTP" = "200" ] || { echo "DEPLOY=FAIL"; echo "HTTP=$HTTP"; echo "ERROR=HTTP_HEALTH_FAILED"; exit 6; }

TARGET_STATUS="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${ALL_TARGETS[@]}" || true)"
[ -z "$TARGET_STATUS" ] || { printf '%s\n' "$TARGET_STATUS"; echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_TARGET_CHANGED_DURING_DEPLOY"; exit 7; }

for rel in "${EXISTING_TARGETS[@]}"; do
  sha256sum -c "$TMP/canonical-hashes/$(printf '%s' "$rel" | tr '/' '_').sha" >/dev/null || {
    echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_HASH_CHANGED_$rel"; exit 7;
  }
done

for rel in "${ALL_TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$NEW_CURRENT/$rel" "$REPO/$rel"
done

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED"; exit 8; }

grep -q 'tasMaintenancePlans' "$REPO/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SCHEMA_SYNC_FAILED"; exit 8; }
grep -q 'TASMaintenancePlansSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_UI_SYNC_FAILED"; exit 8; }

echo "PATCH=PASS"
echo "MIGRATION=PASS"
echo "BUILD=PASS"
echo "DEPLOY=PASS"
echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "MAINTENANCE_PLANS=ACTIVE"
echo "SEED_PLANS=0"
echo "SEED_INTERVALS=0"
echo "VEHICLE_MAPPING=NOT_ENABLED"
echo "PARTS_COSTS=NOT_ENABLED"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
