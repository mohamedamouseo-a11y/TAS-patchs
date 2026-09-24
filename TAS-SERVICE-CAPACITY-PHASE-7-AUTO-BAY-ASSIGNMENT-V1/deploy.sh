#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-7-AUTO-BAY-ASSIGNMENT-V1"
CURRENT="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
TMP="$(mktemp -d /tmp/tas-service-phase7.XXXXXX)"

EXISTING_TARGETS=(
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
)
NEW_TARGETS=(
  "scripts/verify-tas-auto-bay-assignment-v1.ts"
)
ALL_TARGETS=("${EXISTING_TARGETS[@]}" "${NEW_TARGETS[@]}")

LIVE_SUCCEEDED=0
ACTIVE_MUTATED=0
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
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "DEPLOY=FAIL"
    echo "ERROR=MISSING_COMMAND_$cmd"
    exit 2
  }
done

[ -n "$REPO" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$CURRENT" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

# Phase 6 must be present in live and canonical baseline.
for root in "$CURRENT" "$REPO"; do
  grep -q 'engineVersion: 2' "$root/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE6_ENGINE_NOT_PRESENT"; exit 3; }
  grep -q 'TASAvailabilityEngineV2Panel' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE6_UI_NOT_PRESENT"; exit 3; }
  grep -q 'bayId: int("bayId")' "$root/shared/schema.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE6_SCHEMA_NOT_PRESENT"; exit 3; }
done

mkdir -p "$TMP/payload/scripts" "$TMP/payload/snippets"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/snippets/tasDb-auto-bay.ts.txt" -o "$TMP/payload/snippets/tasDb-auto-bay.ts.txt"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-auto-bay-assignment-v1.ts" -o "$TMP/payload/scripts/verify-tas-auto-bay-assignment-v1.ts"

python3 -m py_compile "$TMP/source-transform.py"

for rel in "${EXISTING_TARGETS[@]}"; do
  [ -f "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$rel"; exit 3; }
  [ -f "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$rel"; exit 3; }
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE_$rel"; exit 3; }
done

for rel in "${NEW_TARGETS[@]}"; do
  [ ! -e "$CURRENT/$rel" ] && [ ! -L "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE7_ALREADY_PRESENT_ACTIVE_$rel"; exit 3; }
  [ ! -e "$REPO/$rel" ] && [ ! -L "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE7_ALREADY_PRESENT_CANONICAL_$rel"; exit 3; }
done

CANON_STATUS_BEFORE="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${ALL_TARGETS[@]}" || true)"
if [ -n "$CANON_STATUS_BEFORE" ]; then
  printf '%s\n' "$CANON_STATUS_BEFORE"
  echo "DEPLOY=FAIL"
  echo "ERROR=CANONICAL_PHASE7_TARGETS_DIRTY"
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
git -C "$PATCH_TREE" config user.email "phase7@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Phase 7"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm "baseline"

python3 "$TMP/source-transform.py" "$PATCH_TREE" "$TMP/payload" >/dev/null
git -C "$PATCH_TREE" add -N .
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/phase7.patch"

[ -s "$TMP/phase7.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PHASE7_PATCH"; exit 4; }
grep -q '^diff --git a/' "$TMP/phase7.patch" || { echo "DEPLOY=FAIL"; echo "ERROR=PATCH_NOT_GIT_STYLE"; exit 4; }

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 --dry-run -p1 < "$TMP/phase7.patch" >/dev/null
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
  patch --batch --forward --fuzz=0 -p1 < "$TMP/phase7.patch" >/dev/null
)
ACTIVE_MUTATED=1

grep -q 'selectTASAutoBayCandidateForLoad' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_ASSIGNMENT_PATCH_VERIFY_FAILED"; exit 5; }
grep -q 'FOR UPDATE' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_LOCKING_VERIFY_FAILED"; exit 5; }
grep -q 'createAppointment: tasPermissionProcedure.*createTASAppointment' "$CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_ROUTER_PATCH_VERIFY_FAILED"; exit 5; }
grep -q 'Bay / الكوريك' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_UI_PATCH_VERIFY_FAILED"; exit 5; }

echo "PATCH=PASS"

(
  cd "$CURRENT"
  NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
)
echo "BUILD=PASS"

(
  cd "$CURRENT"
  pnpm exec tsx scripts/verify-tas-auto-bay-assignment-v1.ts
)

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

grep -q 'selectTASAutoBayCandidateForLoad' "$REPO/server/tasDb.ts" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_ASSIGNMENT_SYNC_FAILED"; exit 8; }
grep -q 'Bay / الكوريك' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_SYNC=FAIL"; echo "ERROR=CANONICAL_UI_SYNC_FAILED"; exit 8; }

CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "AUTO_BAY_ASSIGNMENT=ACTIVE"
echo "LEGACY_NO_BAYS_FALLBACK=PRESERVED"
echo "CAPABILITY_GUESSING=NO"
echo "DB_UNCHANGED=YES"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
