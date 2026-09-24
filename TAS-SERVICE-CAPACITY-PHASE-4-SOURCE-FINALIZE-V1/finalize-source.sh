#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"

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

for cmd in realpath git tar cp cmp grep sha256sum mktemp mkdir rm chmod curl node pm2; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "SOURCE_FINALIZE=FAIL"
    echo "ERROR=MISSING_COMMAND_$cmd"
    exit 2
  }
done

ACTIVE="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$ACTIVE" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

# Verify Phase 4 is complete in the currently active release.
grep -q 'tasMaintenancePlans' "$ACTIVE/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE4_SCHEMA_MISSING"; exit 3; }
grep -q 'tasMaintenanceIntervals' "$ACTIVE/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE4_INTERVAL_SCHEMA_MISSING"; exit 3; }
grep -q 'listTASMaintenancePlans' "$ACTIVE/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE4_DB_MISSING"; exit 3; }
grep -q 'listMaintenancePlans:' "$ACTIVE/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE4_ROUTER_MISSING"; exit 3; }
grep -q 'TASMaintenancePlansSettings' "$ACTIVE/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE4_UI_MISSING"; exit 3; }
for rel in "${NEW_TARGETS[@]}"; do
  [ -f "$ACTIVE/$rel" ] && [ ! -L "$ACTIVE/$rel" ] || {
    echo "SOURCE_FINALIZE=FAIL"
    echo "ERROR=LIVE_PHASE4_FILE_MISSING_$rel"
    exit 3
  }
done

PM2_META="$(pm2 jlist | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")===(process.argv[1]||"TAS")) || rows.find(x=>/tas/i.test(String(x.name||"")));
    const e=p?.pm2_env||{};
    process.stdout.write([e.status||"UNKNOWN",e.pm_cwd||"",e.PORT||e?.env?.PORT||"3008"].join("|"));
  } catch {
    process.stdout.write("UNKNOWN||3008");
  }
});' "$APP")"

PM2_STATUS="${PM2_META%%|*}"
REST="${PM2_META#*|}"
PM2_CWD="${REST%%|*}"
PORT="${REST#*|}"
[ "$PM2_STATUS" = "online" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=PM2_NOT_ONLINE"; exit 3; }
[ "$(realpath -e "$PM2_CWD")" = "$ACTIVE" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=PM2_CWD_NOT_ACTIVE"; exit 3; }

HTTP="$(curl -sS -o /dev/null --max-time 8 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
[ "$HTTP" = "200" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_HTTP_NOT_200"; exit 3; }

TMP="$(mktemp -d /tmp/tas-phase4-source-finalize.XXXXXX)"
BASE="$TMP/base"
MERGED="$TMP/merged"
BACKUP="$TMP/backup"
INDEX_BEFORE="$TMP/index-before"
INDEX_AFTER="$TMP/index-after"
ACTIVE_HASHES="$TMP/active-hashes"
SUCCESS=0
MUTATED=0

cleanup() {
  if [ "$SUCCESS" != "1" ] && [ "$MUTATED" = "1" ]; then
    for rel in "${ALL_TARGETS[@]}"; do
      if [ -f "$BACKUP/$rel.__absent__" ]; then
        rm -rf -- "$REPO/$rel"
      elif [ -e "$BACKUP/$rel" ] || [ -L "$BACKUP/$rel" ]; then
        mkdir -p "$(dirname "$REPO/$rel")"
        rm -rf -- "$REPO/$rel"
        cp -a "$BACKUP/$rel" "$REPO/$rel"
      fi
    done
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

mkdir -p "$BASE" "$MERGED" "$BACKUP" "$ACTIVE_HASHES"
git -C "$REPO" archive HEAD | tar -x -C "$BASE"
git -C "$REPO" ls-files -s > "$INDEX_BEFORE"

# Snapshot active target hashes so we can prove the live source did not move.
for rel in "${ALL_TARGETS[@]}"; do
  sha256sum "$ACTIVE/$rel" > "$ACTIVE_HASHES/$(printf '%s' "$rel" | tr '/' '_').sha"
done

echo "THREE_WAY_PREFLIGHT=START"

for rel in "${EXISTING_TARGETS[@]}"; do
  base="$BASE/$rel"
  ours="$REPO/$rel"
  theirs="$ACTIVE/$rel"
  merged="$MERGED/$rel"

  [ -f "$base" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=HEAD_TARGET_MISSING_$rel"; exit 4; }
  [ -f "$ours" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_TARGET_MISSING_$rel"; exit 4; }
  [ -f "$theirs" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=ACTIVE_TARGET_MISSING_$rel"; exit 4; }
  mkdir -p "$(dirname "$merged")"

  if cmp -s "$ours" "$theirs"; then
    cp -a "$ours" "$merged"
    echo "MERGE_$rel=ALREADY_PRESENT"
  elif cmp -s "$ours" "$base"; then
    cp -a "$theirs" "$merged"
    echo "MERGE_$rel=PHASE4_ONLY"
  else
    set +e
    git merge-file -p "$ours" "$base" "$theirs" > "$merged"
    rc=$?
    set -e
    chmod --reference="$ours" "$merged"
    if [ "$rc" -ne 0 ] || grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$merged"; then
      echo "SOURCE_FINALIZE=FAIL"
      echo "ERROR=THREE_WAY_CONFLICT_$rel"
      exit 4
    fi
    echo "MERGE_$rel=CLEAN_THREE_WAY"
  fi
done

for rel in "${NEW_TARGETS[@]}"; do
  ours="$REPO/$rel"
  theirs="$ACTIVE/$rel"
  merged="$MERGED/$rel"
  mkdir -p "$(dirname "$merged")"

  if [ ! -e "$ours" ] && [ ! -L "$ours" ]; then
    cp -a "$theirs" "$merged"
    echo "MERGE_$rel=ADD"
  elif [ -f "$ours" ] && cmp -s "$ours" "$theirs"; then
    cp -a "$ours" "$merged"
    echo "MERGE_$rel=ALREADY_PRESENT"
  else
    echo "SOURCE_FINALIZE=FAIL"
    echo "ERROR=NEW_FILE_CONFLICT_$rel"
    exit 4
  fi
done

grep -q 'tasMaintenancePlans' "$MERGED/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_SCHEMA_MARKER_MISSING"; exit 4; }
grep -q 'listTASMaintenancePlans' "$MERGED/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_DB_MARKER_MISSING"; exit 4; }
grep -q 'listMaintenancePlans:' "$MERGED/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_ROUTER_MARKER_MISSING"; exit 4; }
grep -q 'TASMaintenancePlansSettings' "$MERGED/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_UI_MARKER_MISSING"; exit 4; }

echo "THREE_WAY_PREFLIGHT=PASS"

# Backup target working bytes only. Index is never modified.
for rel in "${ALL_TARGETS[@]}"; do
  if [ -e "$REPO/$rel" ] || [ -L "$REPO/$rel" ]; then
    mkdir -p "$(dirname "$BACKUP/$rel")"
    cp -a "$REPO/$rel" "$BACKUP/$rel"
  else
    mkdir -p "$(dirname "$BACKUP/$rel.__absent__")"
    : > "$BACKUP/$rel.__absent__"
  fi
done

for rel in "${ALL_TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$MERGED/$rel" "$REPO/$rel"
done
MUTATED=1

git -C "$REPO" ls-files -s > "$INDEX_AFTER"
cmp -s "$INDEX_BEFORE" "$INDEX_AFTER" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=INDEX_CHANGED"; exit 5; }

grep -q 'tasMaintenancePlans' "$REPO/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_SCHEMA_VERIFY_FAILED"; exit 5; }
grep -q 'listTASMaintenancePlans' "$REPO/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_DB_VERIFY_FAILED"; exit 5; }
grep -q 'listMaintenancePlans:' "$REPO/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_ROUTER_VERIFY_FAILED"; exit 5; }
grep -q 'TASMaintenancePlansSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_UI_VERIFY_FAILED"; exit 5; }

# Active/live source must remain byte-identical throughout this source-only operation.
for rel in "${ALL_TARGETS[@]}"; do
  sha256sum -c "$ACTIVE_HASHES/$(printf '%s' "$rel" | tr '/' '_').sha" >/dev/null || {
    echo "SOURCE_FINALIZE=FAIL"
    echo "ERROR=ACTIVE_SOURCE_CHANGED_$rel"
    exit 5
  }
done

SUCCESS=1
MUTATED=0

echo "SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "UNRELATED_WORKTREE_PRESERVED=YES"
echo "LIVE_PHASE4_CONFIRMED=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
