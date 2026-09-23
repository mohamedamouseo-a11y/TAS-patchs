#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-$ROOT/.atomic-deploy.lock}"
PATCH_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1.patch"

TARGETS=(
  "client/src/pages/tas/TASServicePage.tsx"
  "client/src/components/tas/TASBranchSchedulingSettings.tsx"
  "server/tasDb.ts"
  "server/routers.ts"
  "shared/schema.ts"
  "scripts/apply-tas-service-branch-scheduling-v1.ts"
  "scripts/verify-tas-service-branch-scheduling-v1.ts"
  "scripts/rollback-tas-service-branch-scheduling-v1.ts"
)
RUNTIME_PATHS=("uploads" "downloads" "backups" "wa_sessions" "public/downloads")

ACTIVE=""
REPO=""
HEAD_BEFORE=""
PORT="3008"
TMP=""
BASE_TREE=""
PHASE_TREE=""
MERGED_DIR=""
SOURCE_BACKUP=""
INDEX_BEFORE=""
INDEX_AFTER=""
PLAN=""
RUNTIME_BACKUP=""
RUNTIME_MUTATED=0
SOURCE_MUTATED=0
SUCCESS=0
ACTIVE_MANIFEST_BEFORE=""
ACTIVE_MANIFEST_AFTER=""

fail() {
  echo "FINALIZE=FAIL"
  echo "ERROR=$1"
  return 1
}

cleanup() {
  [ -n "$TMP" ] && rm -rf "$TMP" || true
  [ -n "$PLAN" ] && rm -f "$PLAN" || true
}
trap cleanup EXIT

restore_source() {
  [ "$SOURCE_MUTATED" = "1" ] || return 0
  local p marker
  for p in "${TARGETS[@]}"; do
    marker="$SOURCE_BACKUP/$p.__absent__"
    if [ -f "$marker" ]; then
      rm -rf -- "$REPO/$p"
    elif [ -e "$SOURCE_BACKUP/$p" ] || [ -L "$SOURCE_BACKUP/$p" ]; then
      mkdir -p "$(dirname "$REPO/$p")"
      rm -rf -- "$REPO/$p"
      cp -a "$SOURCE_BACKUP/$p" "$REPO/$p"
    fi
  done
  SOURCE_MUTATED=0
}

rollback_runtime() {
  [ "$RUNTIME_MUTATED" = "1" ] || return 0
  pm2 stop "$APP" >/dev/null 2>&1 || true
  local rel state src backup
  while IFS='|' read -r rel state; do
    [ "$state" = "LOCAL_EQUIVALENT" ] || continue
    src="$ACTIVE/$rel"
    backup="$RUNTIME_BACKUP/$rel"
    if [ -e "$backup" ] || [ -L "$backup" ]; then
      rm -rf -- "$src"
      mkdir -p "$(dirname "$src")"
      mv "$backup" "$src" || true
    fi
  done < "$PLAN"

  if [ -e "$RUNTIME_BACKUP/.env" ] || [ -L "$RUNTIME_BACKUP/.env" ]; then
    rm -rf -- "$ACTIVE/.env"
    mv "$RUNTIME_BACKUP/.env" "$ACTIVE/.env" || true
  fi

  pm2 restart "$APP" >/dev/null 2>&1 || true
  RUNTIME_MUTATED=0
}

on_error() {
  local rc=$?
  if [ "$SUCCESS" != "1" ]; then
    restore_source || true
    rollback_runtime || true
  fi
  exit "$rc"
}
trap on_error ERR INT TERM

for cmd in realpath git curl rsync flock pm2 node python3 sha256sum mktemp grep awk tr mv ln mkdir rm cmp seq tar patch cp; do
  command -v "$cmd" >/dev/null 2>&1 || { fail "MISSING_COMMAND_$cmd"; exit 2; }
done

ROOT="$(realpath -e "$ROOT")"
ACTIVE="$(realpath -e "$ROOT/current")"
RELEASES="$(realpath -e "$ROOT/releases")"
case "$ACTIVE" in "$RELEASES"/*) ;; *) fail "ACTIVE_RELEASE_OUTSIDE_RELEASES"; exit 2 ;; esac
[ "$(dirname "$ACTIVE")" = "$RELEASES" ] || { fail "ACTIVE_RELEASE_NOT_DIRECT_CHILD"; exit 2; }

[ -d "$SHARED" ] && [ ! -L "$SHARED" ] || { fail "SHARED_RUNTIME_UNSAFE"; exit 2; }
[ -f "$SHARED/.initialized" ] && [ ! -L "$SHARED/.initialized" ] || { fail "SHARED_RUNTIME_MARKER_MISSING"; exit 2; }

REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { fail "CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$REPO" != "$ACTIVE" ] || { fail "CANONICAL_REPO_EQUALS_ACTIVE_RELEASE"; exit 2; }
[ -d "$REPO/.git" ] && [ ! -L "$REPO/.git" ] || { fail "CANONICAL_GIT_METADATA_UNSAFE"; exit 2; }

HEAD_BEFORE="$(git -C "$REPO" rev-parse HEAD)"

exec 9>"$LOCK_FILE"
flock -n 9 || { fail "DEPLOY_LOCK_BUSY"; exit 3; }

if [ -e "$SHARED/storage/.tas-operation.lock" ] || [ -L "$SHARED/storage/.tas-operation.lock" ]; then
  fail "TAS_OPERATION_LOCK_PRESENT"
  exit 3
fi

[ -L "$ACTIVE/storage" ] || { fail "STORAGE_NOT_BOUND"; exit 3; }
[ "$(realpath -e "$ACTIVE/storage")" = "$(realpath -e "$SHARED/storage")" ] || { fail "STORAGE_BOUND_TO_WRONG_TARGET"; exit 3; }

PM2_META="$(pm2 jlist | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  const rows=JSON.parse(s||"[]");
  const p=rows.find(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
  if(!p) process.exit(2);
  const e=p.pm2_env||{};
  process.stdout.write([e.status||"",e.pm_cwd||"",e.PORT||e?.env?.PORT||"3008"].join("|"));
});' "$APP")" || { fail "PM2_DISCOVERY_FAILED"; exit 3; }

PM2_STATUS="${PM2_META%%|*}"
REST="${PM2_META#*|}"
PM2_CWD="${REST%%|*}"
PORT="${REST#*|}"
[ "$PM2_STATUS" = "online" ] || { fail "PM2_NOT_ONLINE"; exit 3; }
[ "$(realpath -e "$PM2_CWD")" = "$ACTIVE" ] || { fail "PM2_CWD_NOT_ACTIVE_RELEASE"; exit 3; }

TMP="$(mktemp -d /tmp/tas-phase2-finalize-v3.XXXXXX)"
BASE_TREE="$TMP/base"
PHASE_TREE="$TMP/phase"
MERGED_DIR="$TMP/merged"
SOURCE_BACKUP="$TMP/source-backup"
INDEX_BEFORE="$TMP/index-before.txt"
INDEX_AFTER="$TMP/index-after.txt"
RAW="$TMP/phase2.patch"
mkdir -p "$BASE_TREE" "$PHASE_TREE" "$MERGED_DIR" "$SOURCE_BACKUP"

git -C "$REPO" archive HEAD | tar -x -C "$BASE_TREE"
rsync -a "$BASE_TREE/" "$PHASE_TREE/"
curl -fsSL "$PATCH_URL" -o "$RAW"

(
  cd "$PHASE_TREE"
  patch --batch --forward --strip=1 --ignore-whitespace --dry-run < "$RAW" >/dev/null
  patch --batch --forward --strip=1 --ignore-whitespace < "$RAW" >/dev/null
) || { fail "PHASE2_PATCH_PRISTINE_APPLY_FAILED"; exit 4; }

git -C "$REPO" ls-files -s -- "${TARGETS[@]}" > "$INDEX_BEFORE"

echo "THREE_WAY_PREFLIGHT=START"
for p in "${TARGETS[@]}"; do
  base="$BASE_TREE/$p"
  ours="$REPO/$p"
  theirs="$PHASE_TREE/$p"
  merged="$MERGED_DIR/$p"
  mkdir -p "$(dirname "$merged")"

  base_exists=0
  ours_exists=0
  theirs_exists=0
  [ -f "$base" ] && base_exists=1
  [ -f "$ours" ] && ours_exists=1
  [ -f "$theirs" ] && theirs_exists=1

  if [ "$base_exists" = "0" ]; then
    [ "$theirs_exists" = "1" ] || { fail "PHASE2_NEW_TARGET_MISSING_$p"; exit 4; }
    if [ "$ours_exists" = "0" ]; then
      cp -a "$theirs" "$merged"
      echo "MERGE_$p=ADD"
    elif cmp -s "$ours" "$theirs"; then
      cp -a "$ours" "$merged"
      echo "MERGE_$p=ALREADY_PRESENT"
    else
      fail "PHASE2_NEW_TARGET_CONFLICT_$p"
      exit 4
    fi
    continue
  fi

  [ "$ours_exists" = "1" ] || { fail "CANONICAL_TARGET_DELETED_$p"; exit 4; }
  [ "$theirs_exists" = "1" ] || { fail "PHASE2_TARGET_UNEXPECTEDLY_DELETED_$p"; exit 4; }

  if cmp -s "$ours" "$theirs"; then
    cp -a "$ours" "$merged"
    echo "MERGE_$p=ALREADY_PRESENT"
  elif cmp -s "$ours" "$base"; then
    cp -a "$theirs" "$merged"
    echo "MERGE_$p=PHASE2_ONLY"
  else
    set +e
    git merge-file -p "$ours" "$base" "$theirs" > "$merged"
    merge_rc=$?
    set -e
    if [ "$merge_rc" -ne 0 ]; then
      rm -f "$merged"
      fail "THREE_WAY_CONFLICT_$p"
      exit 4
    fi
    if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$merged"; then
      fail "THREE_WAY_CONFLICT_MARKERS_$p"
      exit 4
    fi
    echo "MERGE_$p=CLEAN_THREE_WAY"
  fi
done

grep -q 'TASBranchSchedulingSettings' "$MERGED_DIR/client/src/pages/tas/TASServicePage.tsx" || { fail "MERGED_UI_MARKER_MISSING"; exit 4; }
grep -q 'updateTASBranch' "$MERGED_DIR/server/tasDb.ts" || { fail "MERGED_DB_MARKER_MISSING"; exit 4; }
grep -q 'workingDaysJson' "$MERGED_DIR/shared/schema.ts" || { fail "MERGED_SCHEMA_MARKER_MISSING"; exit 4; }
grep -q 'getAvailableSlots' "$MERGED_DIR/server/routers.ts" || { fail "MERGED_ROUTER_MARKER_MISSING"; exit 4; }
[ -f "$MERGED_DIR/client/src/components/tas/TASBranchSchedulingSettings.tsx" ] || { fail "MERGED_COMPONENT_MISSING"; exit 4; }
[ -f "$MERGED_DIR/scripts/apply-tas-service-branch-scheduling-v1.ts" ] || { fail "MERGED_APPLY_SCRIPT_MISSING"; exit 4; }
[ -f "$MERGED_DIR/scripts/verify-tas-service-branch-scheduling-v1.ts" ] || { fail "MERGED_VERIFY_SCRIPT_MISSING"; exit 4; }
[ -f "$MERGED_DIR/scripts/rollback-tas-service-branch-scheduling-v1.ts" ] || { fail "MERGED_ROLLBACK_SCRIPT_MISSING"; exit 4; }

echo "THREE_WAY_PREFLIGHT=PASS"

tree_equal_content() {
  local a="$1" b="$2" diff
  diff="$(rsync -rcn --delete --itemize-changes "$a/" "$b/" 2>/dev/null || return 2)"
  [ -z "$diff" ]
}

PLAN="$(mktemp /tmp/tas-phase2-finalize-v3-plan.XXXXXX)"
: > "$PLAN"

echo "RUNTIME_BINDING_AUDIT=START"
needs_rebind=0
for rel in "${RUNTIME_PATHS[@]}"; do
  src="$ACTIVE/$rel"
  dst="$SHARED/$rel"
  key="$(printf '%s' "$rel" | tr '/' '_')"

  [ -d "$dst" ] && [ ! -L "$dst" ] || { fail "SHARED_RUNTIME_TARGET_UNSAFE_$key"; exit 5; }

  if [ -L "$src" ]; then
    [ "$(realpath -e "$src")" = "$(realpath -e "$dst")" ] || { fail "RUNTIME_LINK_WRONG_TARGET_$key"; exit 5; }
    echo "$rel|BOUND" >> "$PLAN"
    echo "RUNTIME_$key=BOUND"
  elif [ -d "$src" ]; then
    if tree_equal_content "$src" "$dst"; then
      echo "$rel|LOCAL_EQUIVALENT" >> "$PLAN"
      echo "RUNTIME_$key=LOCAL_EQUIVALENT"
      needs_rebind=1
    else
      fail "RUNTIME_CONTENT_DIVERGENCE_$key"
      exit 5
    fi
  else
    fail "ACTIVE_RUNTIME_MISSING_OR_UNSAFE_$key"
    exit 5
  fi
done

if [ -f "$SHARED/.env" ] && [ ! -L "$SHARED/.env" ]; then
  if [ -L "$ACTIVE/.env" ]; then
    [ "$(realpath -e "$ACTIVE/.env")" = "$(realpath -e "$SHARED/.env")" ] || { fail "ENV_LINK_WRONG_TARGET"; exit 5; }
    echo "ENV_BINDING=BOUND"
  elif [ -f "$ACTIVE/.env" ] && [ ! -L "$ACTIVE/.env" ]; then
    cmp -s "$ACTIVE/.env" "$SHARED/.env" || { fail "ENV_CONTENT_DIVERGENCE"; exit 5; }
    echo "ENV_BINDING=LOCAL_EQUIVALENT"
    needs_rebind=1
  else
    fail "ACTIVE_ENV_MISSING_OR_UNSAFE"
    exit 5
  fi
elif [ ! -e "$SHARED/.env" ] && [ ! -L "$SHARED/.env" ]; then
  [ ! -e "$ACTIVE/.env" ] && [ ! -L "$ACTIVE/.env" ] || { fail "ACTIVE_ENV_EXISTS_WITHOUT_SHARED_ENV"; exit 5; }
  echo "ENV_BINDING=NOT_CONFIGURED"
else
  fail "SHARED_ENV_UNSAFE"
  exit 5
fi
echo "RUNTIME_BINDING_AUDIT=PASS"

ACTIVE_MANIFEST_BEFORE="$(python3 "$ACTIVE/scripts/release-tree-integrity.py" manifest "$ACTIVE" | sha256sum | awk '{print $1}')"

if [ "$needs_rebind" = "1" ]; then
  pm2 stop "$APP" >/dev/null

  for rel in "${RUNTIME_PATHS[@]}"; do
    state="$(awk -F'|' -v r="$rel" '$1==r{print $2}' "$PLAN")"
    [ "$state" = "LOCAL_EQUIVALENT" ] || continue
    tree_equal_content "$ACTIVE/$rel" "$SHARED/$rel" || { fail "RUNTIME_CHANGED_DURING_REBIND_$rel"; false; }
  done
  if [ -f "$ACTIVE/.env" ] && [ ! -L "$ACTIVE/.env" ] && [ -f "$SHARED/.env" ]; then
    cmp -s "$ACTIVE/.env" "$SHARED/.env" || { fail "ENV_CHANGED_DURING_REBIND"; false; }
  fi

  STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  RUNTIME_BACKUP="$ROOT/.atomic-release/runtime-finalize-backups/$STAMP"
  mkdir -m 700 -p "$RUNTIME_BACKUP"

  while IFS='|' read -r rel state; do
    [ "$state" = "LOCAL_EQUIVALENT" ] || continue
    src="$ACTIVE/$rel"
    dst="$SHARED/$rel"
    backup="$RUNTIME_BACKUP/$rel"
    mkdir -p "$(dirname "$backup")"
    mv "$src" "$backup"
    mkdir -p "$(dirname "$src")"
    ln -s "$dst" "$src"
    RUNTIME_MUTATED=1
  done < "$PLAN"

  if [ -f "$ACTIVE/.env" ] && [ ! -L "$ACTIVE/.env" ] && [ -f "$SHARED/.env" ]; then
    mv "$ACTIVE/.env" "$RUNTIME_BACKUP/.env"
    ln -s "$SHARED/.env" "$ACTIVE/.env"
    RUNTIME_MUTATED=1
  fi

  for rel in "${RUNTIME_PATHS[@]}"; do
    [ -L "$ACTIVE/$rel" ] || { fail "RUNTIME_REBIND_VERIFY_FAILED_$rel"; false; }
    [ "$(realpath -e "$ACTIVE/$rel")" = "$(realpath -e "$SHARED/$rel")" ] || { fail "RUNTIME_REBIND_TARGET_FAILED_$rel"; false; }
  done

  pm2 restart "$APP" >/dev/null

  ready=0
  for _ in $(seq 1 30); do
    st="$(pm2 jlist | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
 const rows=JSON.parse(s||"[]");
 const p=rows.find(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
 process.stdout.write(String(p?.pm2_env?.status||""));
});' "$APP" 2>/dev/null || true)"
    if [ "$st" = "online" ]; then ready=1; break; fi
    sleep 1
  done
  [ "$ready" = "1" ] || { fail "PM2_RESTART_FAILED"; false; }

  http="000"
  for _ in $(seq 1 20); do
    http="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
    [ "$http" = "200" ] && break
    sleep 1
  done
  [ "$http" = "200" ] || { fail "HTTP_HEALTH_FAILED_AFTER_RUNTIME_REBIND"; false; }
  echo "RUNTIME_BACKUP=$RUNTIME_BACKUP"
else
  echo "RUNTIME_BACKUP=NOT_NEEDED"
fi

# Snapshot current working bytes only; index remains untouched throughout.
for p in "${TARGETS[@]}"; do
  if [ -e "$REPO/$p" ] || [ -L "$REPO/$p" ]; then
    mkdir -p "$(dirname "$SOURCE_BACKUP/$p")"
    cp -a "$REPO/$p" "$SOURCE_BACKUP/$p"
  else
    mkdir -p "$(dirname "$SOURCE_BACKUP/$p.__absent__")"
    : > "$SOURCE_BACKUP/$p.__absent__"
  fi
done

for p in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$p")"
  cp -a "$MERGED_DIR/$p" "$REPO/$p"
done
SOURCE_MUTATED=1

git -C "$REPO" ls-files -s -- "${TARGETS[@]}" > "$INDEX_AFTER"
cmp -s "$INDEX_BEFORE" "$INDEX_AFTER" || { fail "INDEX_CHANGED_DURING_SOURCE_SYNC"; false; }

grep -q 'TASBranchSchedulingSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" || { fail "SOURCE_UI_MARKER_MISSING"; false; }
grep -q 'updateTASBranch' "$REPO/server/tasDb.ts" || { fail "SOURCE_DB_MARKER_MISSING"; false; }
grep -q 'workingDaysJson' "$REPO/shared/schema.ts" || { fail "SOURCE_SCHEMA_MARKER_MISSING"; false; }
grep -q 'getAvailableSlots' "$REPO/server/routers.ts" || { fail "SOURCE_ROUTER_MARKER_MISSING"; false; }

ACTIVE_MANIFEST_AFTER="$(python3 "$ACTIVE/scripts/release-tree-integrity.py" manifest "$ACTIVE" | sha256sum | awk '{print $1}')"
[ "$ACTIVE_MANIFEST_BEFORE" = "$ACTIVE_MANIFEST_AFTER" ] || { fail "ACTIVE_SOURCE_CHANGED_DURING_FINALIZE"; false; }

SUCCESS=1
trap - ERR INT TERM

echo "SOURCE_SYNC=PASS"
echo "RUNTIME_BINDING=PASS"
echo "INDEX_PRESERVED=YES"
echo "UNRELATED_WORKTREE_PRESERVED=YES"
echo "ACTIVE_SOURCE_UNCHANGED=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "CANONICAL_HEAD=$HEAD_BEFORE"
echo "ERROR=NONE"
