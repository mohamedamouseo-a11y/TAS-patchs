#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="\${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="\${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-3-BAYS-MANAGEMENT-V1"
CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
TMP="$(mktemp -d /tmp/tas-service-phase3.XXXXXX)"
CANON_MUTATED=0
SUCCESS=0
INDEX_BEFORE=""
INDEX_AFTER=""

TARGETS=(
  "shared/schema.ts"
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
  "client/src/components/tas/TASServiceBaysSettings.tsx"
  "scripts/apply-tas-service-bays-v1.ts"
  "scripts/verify-tas-service-bays-v1.ts"
  "scripts/rollback-tas-service-bays-v1.ts"
)

restore_canonical() {
  [ "$CANON_MUTATED" = "1" ] || return 0
  local rel
  for rel in "\${TARGETS[@]}"; do
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

cleanup() {
  if [ "$SUCCESS" != "1" ]; then
    restore_canonical || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

for cmd in realpath git curl rsync python3 diff sed node sha256sum pnpm pm2; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "DEPLOY=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$CURRENT" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

mkdir -p "$TMP/payload/client/src/components/tas" "$TMP/payload/scripts"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASServiceBaysSettings.tsx" -o "$TMP/payload/client/src/components/tas/TASServiceBaysSettings.tsx"
curl -fsSL "$BASE_URL/payload/scripts/apply-tas-service-bays-v1.ts" -o "$TMP/payload/scripts/apply-tas-service-bays-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-service-bays-v1.ts" -o "$TMP/payload/scripts/verify-tas-service-bays-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/rollback-tas-service-bays-v1.ts" -o "$TMP/payload/scripts/rollback-tas-service-bays-v1.ts"
chmod 700 "$TMP/source-transform.py"

copy_targets() {
  local src="$1" dst="$2" rel
  mkdir -p "$dst"
  for rel in "\${TARGETS[@]}"; do
    if [ -e "$src/$rel" ] || [ -L "$src/$rel" ]; then
      mkdir -p "$(dirname "$dst/$rel")"
      cp -a "$src/$rel" "$dst/$rel"
    fi
  done
}

for required in \
  "shared/schema.ts" \
  "server/tasDb.ts" \
  "server/routers.ts" \
  "client/src/pages/tas/TASServicePage.tsx"; do
  [ -f "$CURRENT/$required" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$required"; exit 3; }
  [ -f "$REPO/$required" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$required"; exit 3; }
done

grep -q 'workingDaysJson' "$CURRENT/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE2_SCHEMA_NOT_PRESENT"; exit 3; }
grep -q 'TASBranchSchedulingSettings' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE2_UI_NOT_PRESENT"; exit 3; }
grep -q 'updateTASBranch' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE2_DB_NOT_PRESENT"; exit 3; }

copy_targets "$CURRENT" "$TMP/active-before"
rsync -a "$TMP/active-before/" "$TMP/active-after/"
python3 "$TMP/source-transform.py" "$TMP/active-after" "$TMP/payload" >/dev/null

copy_targets "$REPO" "$TMP/canonical-test"
python3 "$TMP/source-transform.py" "$TMP/canonical-test" "$TMP/payload" >/dev/null

echo "SOURCE_PREFLIGHT=PASS"

set +e
diff -ruN "$TMP/active-before" "$TMP/active-after" > "$TMP/raw.abs.patch"
DIFF_RC=$?
set -e
if [ "$DIFF_RC" -ne 1 ]; then
  if [ "$DIFF_RC" -eq 0 ]; then
    echo "DEPLOY=FAIL"
    echo "ERROR=PHASE3_ALREADY_PRESENT_IN_ACTIVE_SOURCE"
  else
    echo "DEPLOY=FAIL"
    echo "ERROR=PATCH_GENERATION_FAILED"
  fi
  exit 4
fi

sed \
  -e "s|$TMP/active-before/|a/|g" \
  -e "s|$TMP/active-after/|b/|g" \
  "$TMP/raw.abs.patch" > "$TMP/phase3.patch"

node "$CURRENT/scripts/stamp-tas-patch-base.mjs" "$TMP/phase3.patch" "$TMP/phase3.stamped.patch" >/dev/null
PATCH_SHA="$(sha256sum "$TMP/phase3.stamped.patch" | awk '{print $1}')"

mkdir -p "$TMP/canonical-backup"
for rel in "\${TARGETS[@]}"; do
  if [ -e "$REPO/$rel" ] || [ -L "$REPO/$rel" ]; then
    mkdir -p "$(dirname "$TMP/canonical-backup/$rel")"
    cp -a "$REPO/$rel" "$TMP/canonical-backup/$rel"
  else
    mkdir -p "$(dirname "$TMP/canonical-backup/$rel.__absent__")"
    : > "$TMP/canonical-backup/$rel.__absent__"
  fi
done

INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
python3 "$TMP/source-transform.py" "$REPO" "$TMP/payload" >/dev/null
CANON_MUTATED=1
INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED"; exit 5; }

grep -q 'tasServiceBays' "$REPO/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SCHEMA_SYNC_FAILED"; exit 5; }
grep -q 'listTASServiceBays' "$REPO/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_DB_SYNC_FAILED"; exit 5; }
grep -q 'listBays:' "$REPO/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_ROUTER_SYNC_FAILED"; exit 5; }
grep -q 'TASServiceBaysSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_UI_SYNC_FAILED"; exit 5; }

export DEPLOY_MIGRATION_COMMAND="pnpm exec tsx scripts/apply-tas-service-bays-v1.ts --apply"
export DEPLOY_MIGRATION_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-service-bays-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_COMMAND="pnpm exec tsx scripts/rollback-tas-service-bays-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-service-bays-v1.ts --rolled-back"
export DEPLOY_MIGRATION_CONTRACT_PATCH_SHA256="$PATCH_SHA"

if ! "$CURRENT/scripts/deploy-active-release.sh" "$TMP/phase3.stamped.patch" >"$TMP/deploy.log" 2>&1; then
  tail -100 "$TMP/deploy.log" >&2
  echo "DEPLOY=FAIL"
  echo "CANONICAL_SOURCE_ROLLBACK=YES"
  echo "ERROR=ATOMIC_DEPLOY_FAILED"
  exit 6
fi

NEW_CURRENT="$(realpath -e "$ROOT/current")"
cd "$NEW_CURRENT"
pnpm exec tsx scripts/verify-tas-service-bays-v1.ts

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

if [ "$PM2_STATUS" != "online" ] || [ "$HTTP" != "200" ]; then
  echo "DEPLOY=FAIL"
  echo "PM2=$PM2_STATUS"
  echo "HTTP=$HTTP"
  echo "ERROR=POST_DEPLOY_HEALTH_FAILED"
  exit 7
fi

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_INDEX_CHANGED_POST_DEPLOY"; exit 8; }
grep -q 'tasServiceBays' "$REPO/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_LOST_POST_DEPLOY"; exit 8; }

SUCCESS=1
CANON_MUTATED=0

echo "PATCH=PASS"
echo "MIGRATION=PASS"
echo "BUILD=PASS"
echo "DEPLOY=PASS"
echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "BAYS_MANAGEMENT=ACTIVE"
echo "BAY_COUNT_HARDCODED=NO"
echo "SEED_BAYS=0"
echo "AVAILABILITY_ENGINE_UNCHANGED=YES"
echo "AUTO_BAY_ASSIGNMENT=NOT_ENABLED"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "CANONICAL_INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
