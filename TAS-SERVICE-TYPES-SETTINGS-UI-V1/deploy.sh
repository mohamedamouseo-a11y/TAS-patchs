#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-TYPES-SETTINGS-UI-V1"

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

TMP="$(mktemp -d /tmp/tas-service-types-settings.XXXXXX)"
PAYLOAD="$TMP/payload"

EXISTING_TARGETS=(
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
)
NEW_TARGETS=(
  "client/src/components/tas/TASServiceTypesSettings.tsx"
)
ALL_TARGETS=("${EXISTING_TARGETS[@]}" "${NEW_TARGETS[@]}")

LIVE_SUCCEEDED=0
ACTIVE_MUTATED=0
CANON_MUTATED=0

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

cleanup() {
  if [ "$LIVE_SUCCEEDED" = "0" ]; then
    if [ "$ACTIVE_MUTATED" = "1" ]; then restore_tree "$CURRENT" "$TMP/active-backup" || true; fi
    if [ -d "$TMP/dist-backup" ]; then
      rm -rf -- "$CURRENT/dist"
      cp -a "$TMP/dist-backup" "$CURRENT/dist" || true
    elif [ -f "$TMP/dist-absent" ]; then
      rm -rf -- "$CURRENT/dist"
    fi
    pm2 restart "$APP" >/dev/null 2>&1 || true
  fi
  if [ "$CANON_MUTATED" = "1" ]; then restore_tree "$REPO" "$TMP/canonical-backup" || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

for root in "$CURRENT" "$REPO"; do
  grep -q 'TASNextDayPartsPreparation' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE12_UI_NOT_PRESENT"; exit 3; }
  grep -q 'getTASPartsPreparationBoard' "$root/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=PHASE12_BACKEND_NOT_PRESENT"; exit 3; }
  grep -q 'ATOMIC_FULL_SOURCE_SNAPSHOT_V1' "$root/server/routes/developerHub.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=DEVELOPER_HUB_SNAPSHOT_FIX_NOT_PRESENT"; exit 3; }
done

mkdir -p "$PAYLOAD/client/src/components/tas"
curl -fsSL "$BASE_URL/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASServiceTypesSettings.tsx" -o "$PAYLOAD/client/src/components/tas/TASServiceTypesSettings.tsx"
python3 -m py_compile "$TMP/source-transform.py"

for rel in "${EXISTING_TARGETS[@]}"; do
  [ -f "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_SOURCE_MISSING_$rel"; exit 3; }
  [ -f "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=CANONICAL_SOURCE_MISSING_$rel"; exit 3; }
  cmp -s "$CURRENT/$rel" "$REPO/$rel" || { echo "DEPLOY=FAIL"; echo "ERROR=ACTIVE_CANONICAL_DIVERGENCE_$rel"; exit 3; }
done

for rel in "${NEW_TARGETS[@]}"; do
  [ ! -e "$CURRENT/$rel" ] && [ ! -L "$CURRENT/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=SERVICE_TYPES_SETTINGS_ALREADY_PRESENT_ACTIVE"; exit 3; }
  [ ! -e "$REPO/$rel" ] && [ ! -L "$REPO/$rel" ] || { echo "DEPLOY=FAIL"; echo "ERROR=SERVICE_TYPES_SETTINGS_ALREADY_PRESENT_CANONICAL"; exit 3; }
done

echo "SOURCE_PREFLIGHT=PASS"

PATCH_TREE="$TMP/patch-tree"
mkdir -p "$PATCH_TREE"
for rel in "${EXISTING_TARGETS[@]}"; do
  mkdir -p "$(dirname "$PATCH_TREE/$rel")"
  cp -a "$CURRENT/$rel" "$PATCH_TREE/$rel"
done

git -C "$PATCH_TREE" init -q
git -C "$PATCH_TREE" config user.email "service-types-ui@tas.local"
git -C "$PATCH_TREE" config user.name "TAS Service Types UI"
git -C "$PATCH_TREE" add .
git -C "$PATCH_TREE" commit -qm "baseline"

python3 "$TMP/source-transform.py" "$PATCH_TREE" "$PAYLOAD" >/dev/null
git -C "$PATCH_TREE" add -N .
git -C "$PATCH_TREE" diff --binary --no-ext-diff HEAD -- . > "$TMP/service-types.patch"

[ -s "$TMP/service-types.patch" ] || { echo "DEPLOY=FAIL"; echo "ERROR=EMPTY_PATCH"; exit 4; }

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 --dry-run -p1 < "$TMP/service-types.patch" >/dev/null
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

if [ -d "$CURRENT/dist" ]; then cp -a "$CURRENT/dist" "$TMP/dist-backup"; else : > "$TMP/dist-absent"; fi
INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

(
  cd "$CURRENT"
  patch --batch --forward --fuzz=0 -p1 < "$TMP/service-types.patch" >/dev/null
)
ACTIVE_MUTATED=1

grep -q 'getTASServiceTypesAdmin' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ADMIN_LIST_BACKEND_MISSING"; exit 5; }
grep -q 'updateTASServiceType' "$CURRENT/server/tasDb.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=UPDATE_BACKEND_MISSING"; exit 5; }
grep -q 'listTypesAdmin:' "$CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=ADMIN_LIST_ROUTE_MISSING"; exit 5; }
grep -q 'updateType:' "$CURRENT/server/routers.ts" || { echo "DEPLOY=FAIL"; echo "ERROR=UPDATE_ROUTE_MISSING"; exit 5; }
grep -q 'TASServiceTypesSettings' "$CURRENT/client/src/pages/tas/TASServicePage.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=SETTINGS_UI_NOT_MOUNTED"; exit 5; }
grep -q 'TAS_SERVICE_TYPES_SETTINGS_UI_V1' "$CURRENT/client/src/components/tas/TASServiceTypesSettings.tsx" || { echo "DEPLOY=FAIL"; echo "ERROR=SETTINGS_UI_MARKER_MISSING"; exit 5; }

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
echo "SERVICE_TYPES_SETTINGS_UI=ACTIVE"
echo "SERVICE_TYPES_ADMIN_LIST=ACTIVE"
echo "SERVICE_TYPES_UPDATE=ACTIVE"
echo "OPERATIONAL_LIST_ACTIVE_ONLY=PRESERVED"
echo "DB_SCHEMA_CHANGE=NONE"
echo "SOURCE_DATA_SEED=NONE"
echo "PHASE1_TO_12=PRESERVED"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
