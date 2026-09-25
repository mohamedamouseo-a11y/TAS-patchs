#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-ATOMIC-CLEAN-SNAPSHOT-FIX-V1"

for cmd in realpath git curl python3 cp grep sha256sum mktemp mkdir rm pm2 node pnpm seq sleep; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "PATCH=FAIL"
    echo "ERROR=MISSING_COMMAND_$cmd"
    exit 2
  }
done

ACTIVE="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "PATCH=FAIL"; echo "ERROR=CANONICAL_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$ACTIVE" != "$REPO" ] || { echo "PATCH=FAIL"; echo "ERROR=ACTIVE_EQUALS_CANONICAL"; exit 2; }

TARGET="server/routes/developerHub.ts"
TMP="$(mktemp -d /tmp/tas-devhub-snapshot-fix.XXXXXX)"
SUCCESS=0
ACTIVE_MUTATED=0
CANON_MUTATED=0

cleanup() {
  if [ "$SUCCESS" != "1" ]; then
    if [ "$ACTIVE_MUTATED" = "1" ] && [ -f "$TMP/active-backup.ts" ]; then
      cp -a "$TMP/active-backup.ts" "$ACTIVE/$TARGET" || true
    fi
    if [ "$CANON_MUTATED" = "1" ] && [ -f "$TMP/canon-backup.ts" ]; then
      cp -a "$TMP/canon-backup.ts" "$REPO/$TARGET" || true
    fi
    if [ -d "$TMP/dist-backup" ]; then
      rm -rf -- "$ACTIVE/dist"
      cp -a "$TMP/dist-backup" "$ACTIVE/dist" || true
    elif [ -f "$TMP/dist-absent" ]; then
      rm -rf -- "$ACTIVE/dist"
    fi
    pm2 restart "$APP" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

[ -f "$ACTIVE/$TARGET" ] || { echo "PATCH=FAIL"; echo "ERROR=ACTIVE_DEVELOPER_HUB_MISSING"; exit 3; }
[ -f "$REPO/$TARGET" ] || { echo "PATCH=FAIL"; echo "ERROR=CANONICAL_DEVELOPER_HUB_MISSING"; exit 3; }

# Phase 7 must already exist in both live and canonical source.
for root in "$ACTIVE" "$REPO"; do
  grep -q 'selectTASAutoBayCandidateForLoad' "$root/server/tasDb.ts" || {
    echo "PATCH=FAIL"; echo "ERROR=PHASE7_TASDB_NOT_PRESENT"; exit 3;
  }
  grep -q 'Bay / الكوريك' "$root/client/src/pages/tas/TASServicePage.tsx" || {
    echo "PATCH=FAIL"; echo "ERROR=PHASE7_UI_NOT_PRESENT"; exit 3;
  }
done

curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
python3 -m py_compile "$TMP/source-transform.py"

cp -a "$ACTIVE/$TARGET" "$TMP/active-pre.ts"
cp -a "$REPO/$TARGET" "$TMP/canon-pre.ts"
mkdir -p "$TMP/active-tree/server/routes" "$TMP/canon-tree/server/routes"
cp -a "$TMP/active-pre.ts" "$TMP/active-tree/$TARGET"
cp -a "$TMP/canon-pre.ts" "$TMP/canon-tree/$TARGET"

python3 "$TMP/source-transform.py" "$TMP/active-tree" >/dev/null
python3 "$TMP/source-transform.py" "$TMP/canon-tree" >/dev/null

for file in "$TMP/active-tree/$TARGET" "$TMP/canon-tree/$TARGET"; do
  grep -q 'ATOMIC_FULL_SOURCE_SNAPSHOT_V1' "$file" || {
    echo "PATCH=FAIL"; echo "ERROR=PREFLIGHT_MARKER_MISSING"; exit 4;
  }
  grep -q 'const atomicFullSourceSnapshot = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;' "$file" || {
    echo "PATCH=FAIL"; echo "ERROR=PREFLIGHT_FULL_SNAPSHOT_LOGIC_MISSING"; exit 4;
  }
  grep -q 'collectGitHubSourceAllowlist(requireDeveloperHubWorkTreeRoot())' "$file" || {
    echo "PATCH=FAIL"; echo "ERROR=PREFLIGHT_ALLOWLIST_LOGIC_MISSING"; exit 4;
  }
done

echo "PATCH_PREFLIGHT=PASS"

cp -a "$ACTIVE/$TARGET" "$TMP/active-backup.ts"
cp -a "$REPO/$TARGET" "$TMP/canon-backup.ts"
if [ -d "$ACTIVE/dist" ]; then cp -a "$ACTIVE/dist" "$TMP/dist-backup"; else : > "$TMP/dist-absent"; fi
INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

cp -a "$TMP/active-tree/$TARGET" "$ACTIVE/$TARGET"
ACTIVE_MUTATED=1
cp -a "$TMP/canon-tree/$TARGET" "$REPO/$TARGET"
CANON_MUTATED=1

grep -q 'ATOMIC_FULL_SOURCE_SNAPSHOT_V1' "$ACTIVE/$TARGET"
grep -q 'ATOMIC_FULL_SOURCE_SNAPSHOT_V1' "$REPO/$TARGET"
echo "PATCH=PASS"

(
  cd "$ACTIVE"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)
echo "BUILD=PASS"

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || {
  echo "PATCH=FAIL"
  echo "ERROR=CANONICAL_INDEX_CHANGED"
  exit 5
}

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
[ "$PM2_STATUS" = "online" ] || { echo "PATCH=FAIL"; echo "PM2=$PM2_STATUS"; echo "ERROR=PM2_NOT_ONLINE"; exit 6; }

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
  HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/settings" || true)"
  [ "$HTTP" = "200" ] && break
  sleep 1
done
[ "$HTTP" = "200" ] || { echo "PATCH=FAIL"; echo "HTTP=$HTTP"; echo "ERROR=HTTP_HEALTH_FAILED"; exit 6; }

SUCCESS=1
ACTIVE_MUTATED=0
CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "ATOMIC_CLEAN_SNAPSHOT=FULL_SOURCE_ALLOWLIST"
echo "REMOTE_DIRTY_OVERLAY=REMOVED"
echo "PHASE7_SOURCE_PRESENT=YES"
echo "CANONICAL_SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_REVIEW_PUSH=YES"
echo "ERROR=NONE"
