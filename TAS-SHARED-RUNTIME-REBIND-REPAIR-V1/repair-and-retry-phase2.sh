#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-$ROOT/.atomic-deploy.lock}"
PHASE2_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1/deploy.sh"
RUNTIME_PATHS=("storage" "uploads" "downloads" "backups" "wa_sessions" "public/downloads")

STOPPED=0
MUTATED=0
SUCCESS=0
BACKUP_ROOT=""
PLAN_FILE=""
PM2_PORT=""

fail() {
  echo "RUNTIME_REBIND=FAIL"
  echo "ERROR=$1"
  return 1
}

for cmd in realpath rsync flock pm2 node curl find awk mv ln mkdir rm; do
  command -v "$cmd" >/dev/null 2>&1 || fail "MISSING_COMMAND_$cmd"
done

ROOT="$(realpath -e "$ROOT")"
ACTIVE="$(realpath -e "$ROOT/current")"
RELEASES="$(realpath -e "$ROOT/releases")"
case "$ACTIVE" in "$RELEASES"/*) ;; *) fail "ACTIVE_RELEASE_OUTSIDE_RELEASES" ;; esac
[ "$(dirname "$ACTIVE")" = "$RELEASES" ] || fail "ACTIVE_RELEASE_NOT_DIRECT_CHILD"
[ -d "$SHARED" ] && [ ! -L "$SHARED" ] || fail "SHARED_RUNTIME_MISSING_OR_UNSAFE"
[ -f "$SHARED/.initialized" ] && [ ! -L "$SHARED/.initialized" ] || fail "SHARED_RUNTIME_MARKER_MISSING"

mkdir -p "$ROOT/.atomic-release/runtime-rebind-backups"
[ ! -L "$ROOT/.atomic-release" ] || fail "ATOMIC_RELEASE_ROOT_UNSAFE"

exec 9>"$LOCK_FILE"
flock -n 9 || fail "DEPLOY_LOCK_BUSY"

OP_LOCK="$SHARED/storage/.tas-operation.lock"
if [ -e "$OP_LOCK" ] || [ -L "$OP_LOCK" ]; then
  fail "TAS_OPERATION_LOCK_PRESENT"
fi

PM2_META="$(pm2 jlist | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  const rows=JSON.parse(s||"[]");
  const matches=rows.filter(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
  if(matches.length!==1) process.exit(3);
  const p=matches[0], e=p.pm2_env||{};
  process.stdout.write([e.status||"",e.pm_cwd||"",e.PORT||e?.env?.PORT||"3008"].join("|"));
});' "$APP")" || fail "PM2_DISCOVERY_FAILED"

PM2_STATUS="${PM2_META%%|*}"
REST="${PM2_META#*|}"
PM2_CWD="${REST%%|*}"
PM2_PORT="${REST#*|}"
[ "$PM2_STATUS" = "online" ] || fail "PM2_NOT_ONLINE"
[ "$(realpath -e "$PM2_CWD")" = "$ACTIVE" ] || fail "PM2_CWD_NOT_ACTIVE_RELEASE"

PLAN_FILE="$(mktemp /tmp/tas-runtime-rebind-plan.XXXXXX)"
trap 'rm -f "$PLAN_FILE"' EXIT

sanitize_key() {
  printf '%s' "$1" | tr '/-' '__'
}

tree_stats() {
  local p="$1"
  local files bytes
  files="$(find "$p" -xdev -type f 2>/dev/null | wc -l | tr -d ' ')"
  bytes="$(find "$p" -xdev -type f -printf '%s\n' 2>/dev/null | awk '{s+=$1} END{print s+0}')"
  printf '%s|%s' "$files" "$bytes"
}

tree_empty() {
  [ -z "$(find "$1" -mindepth 1 -print -quit 2>/dev/null)" ]
}

tree_equal() {
  local source="$1" target="$2" diff
  diff="$(rsync -aAXnc --delete --itemize-changes "$source/" "$target/" 2>/dev/null || return 2)"
  [ -z "$diff" ]
}

build_plan() {
  : > "$PLAN_FILE"
  local rel source target key status aStats sStats
  for rel in "${RUNTIME_PATHS[@]}"; do
    source="$ACTIVE/$rel"
    target="$SHARED/$rel"
    key="$(sanitize_key "$rel")"

    [ -d "$target" ] && [ ! -L "$target" ] || fail "SHARED_TARGET_UNSAFE_$key"

    if [ -L "$source" ]; then
      [ "$(realpath -e "$source")" = "$(realpath -e "$target")" ] || fail "WRONG_RUNTIME_LINK_$key"
      status="BOUND"
    elif [ -d "$source" ]; then
      if tree_equal "$source" "$target"; then
        status="EQUIVALENT"
      elif tree_empty "$target"; then
        status="COPY_ACTIVE"
      else
        aStats="$(tree_stats "$source")"
        sStats="$(tree_stats "$target")"
        echo "RUNTIME_DIFF_$key=YES"
        echo "ACTIVE_STATS_$key=$aStats"
        echo "SHARED_STATS_$key=$sStats"
        fail "DATA_DIFF_$key"
      fi
    elif [ ! -e "$source" ]; then
      status="MISSING_ACTIVE"
    else
      fail "ACTIVE_RUNTIME_WRONG_TYPE_$key"
    fi

    printf '%s|%s\n' "$rel" "$status" >> "$PLAN_FILE"
    echo "PLAN_$key=$status"
  done
}

rollback() {
  local rel status source backup
  [ "$MUTATED" = "1" ] || return 0
  pm2 stop "$APP" >/dev/null 2>&1 || true
  while IFS='|' read -r rel status; do
    source="$ACTIVE/$rel"
    backup="$BACKUP_ROOT/$rel"
    if [ -e "$backup" ] || [ -L "$backup" ]; then
      rm -rf -- "$source"
      mkdir -p "$(dirname "$source")"
      mv "$backup" "$source" || true
    elif [ "$status" = "MISSING_ACTIVE" ]; then
      rm -rf -- "$source"
    fi
  done < "$PLAN_FILE"
  pm2 restart "$APP" >/dev/null 2>&1 || true
}

on_error() {
  local code=$?
  if [ "$SUCCESS" != "1" ]; then
    rollback || true
  fi
  exit "$code"
}
trap on_error ERR INT TERM

echo "RUNTIME_REBIND_PREFLIGHT=START"
build_plan
echo "RUNTIME_REBIND_PREFLIGHT=PASS"

pm2 stop "$APP" >/dev/null
STOPPED=1

# Repeat the entire comparison after TAS is stopped so no runtime write can race the rebind.
build_plan
echo "RUNTIME_REBIND_STOPPED_RECHECK=PASS"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP_ROOT="$ROOT/.atomic-release/runtime-rebind-backups/$STAMP"
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

while IFS='|' read -r rel status; do
  source="$ACTIVE/$rel"
  target="$SHARED/$rel"
  backup="$BACKUP_ROOT/$rel"

  case "$status" in
    BOUND)
      ;;
    COPY_ACTIVE)
      rsync -aAX --delete "$source/" "$target/"
      tree_equal "$source" "$target" || fail "COPY_VERIFY_FAILED_$(sanitize_key "$rel")"
      mkdir -p "$(dirname "$backup")"
      mv "$source" "$backup"
      mkdir -p "$(dirname "$source")"
      ln -s "$target" "$source"
      MUTATED=1
      ;;
    EQUIVALENT)
      mkdir -p "$(dirname "$backup")"
      mv "$source" "$backup"
      mkdir -p "$(dirname "$source")"
      ln -s "$target" "$source"
      MUTATED=1
      ;;
    MISSING_ACTIVE)
      mkdir -p "$(dirname "$source")"
      ln -s "$target" "$source"
      MUTATED=1
      ;;
    *)
      fail "UNEXPECTED_PLAN_STATE"
      ;;
  esac
done < "$PLAN_FILE"

for rel in "${RUNTIME_PATHS[@]}"; do
  [ -L "$ACTIVE/$rel" ] || fail "REBIND_VERIFY_NOT_SYMLINK_$(sanitize_key "$rel")"
  [ "$(realpath -e "$ACTIVE/$rel")" = "$(realpath -e "$SHARED/$rel")" ] || fail "REBIND_VERIFY_WRONG_TARGET_$(sanitize_key "$rel")"
done

pm2 restart "$APP" >/dev/null
STOPPED=0

READY=0
for _ in $(seq 1 30); do
  STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{
  const rows=JSON.parse(s||"[]");const p=rows.find(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
  process.stdout.write(String(p?.pm2_env?.status||""));
});' "$APP" 2>/dev/null || true)"
  if [ "$STATUS" = "online" ]; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] || fail "PM2_RESTART_FAILED_AFTER_REBIND"

HTTP="000"
if [[ "$PM2_PORT" =~ ^[0-9]+$ ]]; then
  for _ in $(seq 1 20); do
    HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PM2_PORT/tas/service" || true)"
    [ "$HTTP" = "200" ] && break
    sleep 1
  done
fi
[ "$HTTP" = "200" ] || fail "HTTP_HEALTH_FAILED_AFTER_REBIND"

SUCCESS=1
trap - ERR INT TERM

echo "RUNTIME_REBIND=PASS"
echo "RUNTIME_PATHS_BOUND=YES"
echo "BACKUP_ROOT=$BACKUP_ROOT"
echo "PM2_AFTER_REBIND=online"
echo "HTTP_AFTER_REBIND=200"

flock -u 9
exec 9>&-

echo "RETRY_PHASE2=YES"
curl -fsSL "$PHASE2_URL" | bash
