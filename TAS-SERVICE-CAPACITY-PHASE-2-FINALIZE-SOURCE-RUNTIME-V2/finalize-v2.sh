#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-$ROOT/.atomic-deploy.lock}"
PATCH_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1.patch"

RUNTIME_PATHS=("uploads" "downloads" "backups" "wa_sessions" "public/downloads")
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

ACTIVE=""
REPO=""
HEAD_BEFORE=""
PORT="3008"
PLAN=""
BACKUP_ROOT=""
TMP=""
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
  [ -n "$PLAN" ] && rm -f "$PLAN" || true
  [ -n "$TMP" ] && rm -rf "$TMP" || true
}
trap cleanup EXIT

restore_phase2_targets() {
  [ "$SOURCE_MUTATED" = "1" ] || return 0
  local p
  for p in "${TARGETS[@]}"; do
    if git -C "$REPO" cat-file -e "HEAD:$p" 2>/dev/null; then
      git -C "$REPO" restore --source=HEAD --staged --worktree -- "$p" >/dev/null 2>&1 || true
    else
      git -C "$REPO" rm -f --cached --ignore-unmatch -- "$p" >/dev/null 2>&1 || true
      rm -rf -- "$REPO/$p" || true
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
    backup="$BACKUP_ROOT/$rel"
    if [ -e "$backup" ] || [ -L "$backup" ]; then
      rm -rf -- "$src"
      mkdir -p "$(dirname "$src")"
      mv "$backup" "$src" || true
    fi
  done < "$PLAN"

  if [ -e "$BACKUP_ROOT/.env" ] || [ -L "$BACKUP_ROOT/.env" ]; then
    rm -rf -- "$ACTIVE/.env"
    mv "$BACKUP_ROOT/.env" "$ACTIVE/.env" || true
  fi

  pm2 restart "$APP" >/dev/null 2>&1 || true
  RUNTIME_MUTATED=0
}

on_error() {
  local rc=$?
  if [ "$SUCCESS" != "1" ]; then
    restore_phase2_targets || true
    rollback_runtime || true
  fi
  exit "$rc"
}
trap on_error ERR INT TERM

for cmd in realpath git curl rsync flock pm2 node python3 sha256sum mktemp grep awk tr mv ln mkdir rm cmp seq; do
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

phase2_present() {
  [ -f "$REPO/client/src/components/tas/TASBranchSchedulingSettings.tsx" ] &&
  [ -f "$REPO/scripts/apply-tas-service-branch-scheduling-v1.ts" ] &&
  [ -f "$REPO/scripts/verify-tas-service-branch-scheduling-v1.ts" ] &&
  [ -f "$REPO/scripts/rollback-tas-service-branch-scheduling-v1.ts" ] &&
  grep -q 'TASBranchSchedulingSettings' "$REPO/client/src/pages/tas/TASServicePage.tsx" &&
  grep -q 'updateTASBranch' "$REPO/server/tasDb.ts" &&
  grep -q 'workingDaysJson' "$REPO/shared/schema.ts" &&
  grep -q 'getAvailableSlots' "$REPO/server/routers.ts"
}

TARGET_STATUS="$(git -C "$REPO" status --porcelain=v1 --untracked-files=normal -- "${TARGETS[@]}" || true)"

TMP="$(mktemp -d /tmp/tas-phase2-finalize-v2.XXXXXX)"
RAW="$TMP/phase2.patch"
curl -fsSL "$PATCH_URL" -o "$RAW"

if phase2_present; then
  SOURCE_MODE="ALREADY_PRESENT"
  echo "PHASE2_TARGET_STATUS=ALREADY_PRESENT"
else
  if [ -n "$TARGET_STATUS" ]; then
    printf '%s\n' "$TARGET_STATUS"
    fail "PHASE2_TARGETS_DIRTY_OR_PARTIAL"
    exit 4
  fi
  git -C "$REPO" apply --check --ignore-space-change --ignore-whitespace "$RAW" || {
    fail "PHASE2_PATCH_DRY_RUN_FAILED"
    exit 4
  }
  SOURCE_MODE="APPLY"
  echo "PHASE2_TARGET_STATUS=CLEAN"
  echo "PHASE2_PATCH_DRY_RUN=PASS"
fi

tree_equal_content() {
  local a="$1" b="$2" diff
  diff="$(rsync -rcn --delete --itemize-changes "$a/" "$b/" 2>/dev/null || return 2)"
  [ -z "$diff" ]
}

PLAN="$(mktemp /tmp/tas-phase2-finalize-v2-plan.XXXXXX)"
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
  BACKUP_ROOT="$ROOT/.atomic-release/runtime-finalize-backups/$STAMP"
  mkdir -m 700 -p "$BACKUP_ROOT"

  while IFS='|' read -r rel state; do
    [ "$state" = "LOCAL_EQUIVALENT" ] || continue
    src="$ACTIVE/$rel"
    dst="$SHARED/$rel"
    backup="$BACKUP_ROOT/$rel"
    mkdir -p "$(dirname "$backup")"
    mv "$src" "$backup"
    mkdir -p "$(dirname "$src")"
    ln -s "$dst" "$src"
    RUNTIME_MUTATED=1
  done < "$PLAN"

  if [ -f "$ACTIVE/.env" ] && [ ! -L "$ACTIVE/.env" ] && [ -f "$SHARED/.env" ]; then
    mv "$ACTIVE/.env" "$BACKUP_ROOT/.env"
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
  echo "RUNTIME_BACKUP=$BACKUP_ROOT"
else
  echo "RUNTIME_BACKUP=NOT_NEEDED"
fi

if [ "$SOURCE_MODE" = "APPLY" ]; then
  git -C "$REPO" apply --ignore-space-change --ignore-whitespace --whitespace=nowarn "$RAW"
  SOURCE_MUTATED=1
  echo "SOURCE_PATCH_STATE=APPLIED"
else
  echo "SOURCE_PATCH_STATE=ALREADY_PRESENT"
fi

phase2_present || { fail "SOURCE_VERIFY_PHASE2_INCOMPLETE"; false; }

# Ensure unrelated canonical changes still exist exactly as they did before as far as Git status scope is concerned:
# this script never invokes reset/restore outside TARGETS and never stages/commits anything.
ACTIVE_MANIFEST_AFTER="$(python3 "$ACTIVE/scripts/release-tree-integrity.py" manifest "$ACTIVE" | sha256sum | awk '{print $1}')"
[ "$ACTIVE_MANIFEST_BEFORE" = "$ACTIVE_MANIFEST_AFTER" ] || { fail "ACTIVE_SOURCE_CHANGED_DURING_FINALIZE"; false; }

SUCCESS=1
trap - ERR INT TERM

echo "SOURCE_SYNC=PASS"
echo "RUNTIME_BINDING=PASS"
echo "UNRELATED_WORKTREE_PRESERVED=YES"
echo "ACTIVE_SOURCE_UNCHANGED=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "CANONICAL_HEAD=$HEAD_BEFORE"
echo "ERROR=NONE"
