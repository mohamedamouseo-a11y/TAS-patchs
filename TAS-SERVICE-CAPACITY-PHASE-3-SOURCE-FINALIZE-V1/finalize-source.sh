#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-3-BAYS-MANAGEMENT-V1"

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

for cmd in realpath git curl rsync python3 tar cp cmp grep sha256sum mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

ACTIVE="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$ACTIVE" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }

# Confirm Phase 3 is already live before synchronizing source.
grep -q 'tasServiceBays' "$ACTIVE/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE3_SCHEMA_MISSING"; exit 3; }
grep -q 'listTASServiceBays' "$ACTIVE/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE3_DB_MISSING"; exit 3; }
grep -q 'listBays:' "$ACTIVE/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE3_ROUTER_MISSING"; exit 3; }
grep -q 'TASServiceBaysSettings' "$ACTIVE/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=LIVE_PHASE3_UI_MISSING"; exit 3; }

TMP="$(mktemp -d /tmp/tas-phase3-source-finalize.XXXXXX)"
BASE="$TMP/base"
THEIRS="$TMP/theirs"
MERGED="$TMP/merged"
BACKUP="$TMP/backup"
PAYLOAD="$TMP/payload"
TRANSFORM="$TMP/source-transform.py"
INDEX_BEFORE="$TMP/index-before"
INDEX_AFTER="$TMP/index-after"
SUCCESS=0
MUTATED=0

cleanup() {
  if [ "$SUCCESS" != "1" ] && [ "$MUTATED" = "1" ]; then
    for rel in "${TARGETS[@]}"; do
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

mkdir -p "$BASE" "$THEIRS" "$MERGED" "$BACKUP" "$PAYLOAD/client/src/components/tas" "$PAYLOAD/scripts"

git -C "$REPO" archive HEAD | tar -x -C "$BASE"
rsync -a "$BASE/" "$THEIRS/"

curl -fsSL "$BASE_URL/source-transform-v2.py" -o "$TRANSFORM"
curl -fsSL "$BASE_URL/payload/client/src/components/tas/TASServiceBaysSettings.tsx" -o "$PAYLOAD/client/src/components/tas/TASServiceBaysSettings.tsx"
curl -fsSL "$BASE_URL/payload/scripts/apply-tas-service-bays-v1.ts" -o "$PAYLOAD/scripts/apply-tas-service-bays-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/verify-tas-service-bays-v1.ts" -o "$PAYLOAD/scripts/verify-tas-service-bays-v1.ts"
curl -fsSL "$BASE_URL/payload/scripts/rollback-tas-service-bays-v1.ts" -o "$PAYLOAD/scripts/rollback-tas-service-bays-v1.ts"

python3 "$TRANSFORM" "$THEIRS" "$PAYLOAD" >/dev/null

git -C "$REPO" ls-files -s > "$INDEX_BEFORE"

echo "THREE_WAY_PREFLIGHT=START"
for rel in "${TARGETS[@]}"; do
  base="$BASE/$rel"
  ours="$REPO/$rel"
  theirs="$THEIRS/$rel"
  merged="$MERGED/$rel"
  mkdir -p "$(dirname "$merged")"

  if [ ! -e "$base" ]; then
    [ -f "$theirs" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=THEIRS_NEW_FILE_MISSING_$rel"; exit 4; }
    if [ ! -e "$ours" ]; then
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
    continue
  fi

  [ -f "$ours" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=CANONICAL_TARGET_MISSING_$rel"; exit 4; }
  [ -f "$theirs" ] || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=THEIRS_TARGET_MISSING_$rel"; exit 4; }

  if cmp -s "$ours" "$theirs"; then
    cp -a "$ours" "$merged"
    echo "MERGE_$rel=ALREADY_PRESENT"
  elif cmp -s "$ours" "$base"; then
    cp -a "$theirs" "$merged"
    echo "MERGE_$rel=PHASE3_ONLY"
  else
    set +e
    git merge-file -p "$ours" "$base" "$theirs" > "$merged"
    rc=$?
    set -e
    if [ "$rc" -ne 0 ] || grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$merged"; then
      echo "SOURCE_FINALIZE=FAIL"
      echo "ERROR=THREE_WAY_CONFLICT_$rel"
      exit 4
    fi
    echo "MERGE_$rel=CLEAN_THREE_WAY"
  fi
done

grep -q 'tasServiceBays' "$MERGED/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_SCHEMA_MARKER_MISSING"; exit 4; }
grep -q 'listTASServiceBays' "$MERGED/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_DB_MARKER_MISSING"; exit 4; }
grep -q 'listBays:' "$MERGED/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_ROUTER_MARKER_MISSING"; exit 4; }
grep -q 'TASServiceBaysSettings' "$MERGED/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=MERGED_UI_MARKER_MISSING"; exit 4; }

echo "THREE_WAY_PREFLIGHT=PASS"

# Backup only Phase 3 targets; unrelated working-tree state is untouched.
for rel in "${TARGETS[@]}"; do
  if [ -e "$REPO/$rel" ] || [ -L "$REPO/$rel" ]; then
    mkdir -p "$(dirname "$BACKUP/$rel")"
    cp -a "$REPO/$rel" "$BACKUP/$rel"
  else
    mkdir -p "$(dirname "$BACKUP/$rel.__absent__")"
    : > "$BACKUP/$rel.__absent__"
  fi
done

for rel in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$MERGED/$rel" "$REPO/$rel"
done
MUTATED=1

git -C "$REPO" ls-files -s > "$INDEX_AFTER"
cmp -s "$INDEX_BEFORE" "$INDEX_AFTER" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=INDEX_CHANGED"; exit 5; }

grep -q 'tasServiceBays' "$REPO/shared/schema.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_SCHEMA_VERIFY_FAILED"; exit 5; }
grep -q 'listTASServiceBays' "$REPO/server/tasDb.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_DB_VERIFY_FAILED"; exit 5; }
grep -q 'listBays:' "$REPO/server/routers.ts" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_ROUTER_VERIFY_FAILED"; exit 5; }
grep -q 'TASServiceBaysSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { echo "SOURCE_FINALIZE=FAIL"; echo "ERROR=SOURCE_UI_VERIFY_FAILED"; exit 5; }

SUCCESS=1
MUTATED=0

echo "SOURCE_SYNC=PASS"
echo "INDEX_PRESERVED=YES"
echo "UNRELATED_WORKTREE_PRESERVED=YES"
echo "LIVE_PHASE3_CONFIRMED=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
