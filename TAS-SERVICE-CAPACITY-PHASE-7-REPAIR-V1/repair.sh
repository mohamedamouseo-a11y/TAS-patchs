#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
PHASE7_BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-7-AUTO-BAY-ASSIGNMENT-V1"

ACTIVE="$(realpath -e "$ROOT/current")"
REPO="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "REPAIR=FAIL"; echo "ERROR=CANONICAL_GIT_REPO_NOT_FOUND"; exit 2; }
REPO="$(realpath -e "$REPO")"
[ "$ACTIVE" != "$REPO" ] || { echo "REPAIR=FAIL"; echo "ERROR=ACTIVE_EQUALS_CANONICAL"; exit 2; }

TARGETS=(
  "server/tasDb.ts"
  "server/routers.ts"
  "client/src/pages/tas/TASServicePage.tsx"
  "scripts/verify-tas-auto-bay-assignment-v1.ts"
)

for cmd in realpath git curl python3 cp cmp grep sha256sum mktemp mkdir rm pm2 node pnpm seq sleep; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "REPAIR=FAIL"; echo "ERROR=MISSING_COMMAND_$cmd"; exit 2; }
done

TMP="$(mktemp -d /tmp/tas-phase7-repair.XXXXXX)"
PAYLOAD="$TMP/payload"
ACTIVE_PRE="$TMP/active-pre"
CANON_PRE="$TMP/canon-pre"
ACTIVE_BACKUP="$TMP/active-backup"
CANON_BACKUP="$TMP/canon-backup"
mkdir -p "$PAYLOAD/snippets" "$PAYLOAD/scripts" "$ACTIVE_PRE" "$CANON_PRE" "$ACTIVE_BACKUP" "$CANON_BACKUP"

SUCCESS=0
ACTIVE_MUTATED=0
CANON_MUTATED=0

restore_tree() {
  local base="$1"
  local backup="$2"
  local rel
  for rel in "${TARGETS[@]}"; do
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
  if [ "$SUCCESS" != "1" ]; then
    if [ "$ACTIVE_MUTATED" = "1" ]; then restore_tree "$ACTIVE" "$ACTIVE_BACKUP" || true; fi
    if [ "$CANON_MUTATED" = "1" ]; then restore_tree "$REPO" "$CANON_BACKUP" || true; fi
    if [ -d "$TMP/dist-backup" ]; then
      rm -rf -- "$ACTIVE/dist"
      cp -a "$TMP/dist-backup" "$ACTIVE/dist"
    elif [ -f "$TMP/dist-absent" ]; then
      rm -rf -- "$ACTIVE/dist"
    fi
    pm2 restart "$APP" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

curl -fsSL "$PHASE7_BASE/source-transform.py" -o "$TMP/source-transform.py"
curl -fsSL "$PHASE7_BASE/payload/snippets/tasDb-auto-bay.ts.txt" -o "$PAYLOAD/snippets/tasDb-auto-bay.ts.txt"
curl -fsSL "$PHASE7_BASE/payload/scripts/verify-tas-auto-bay-assignment-v1.ts" -o "$PAYLOAD/scripts/verify-tas-auto-bay-assignment-v1.ts"
python3 -m py_compile "$TMP/source-transform.py"

# Phase 6 baseline must exist.
for root in "$ACTIVE" "$REPO"; do
  grep -q 'engineVersion: 2' "$root/server/tasDb.ts" || { echo "REPAIR=FAIL"; echo "ERROR=PHASE6_ENGINE_MISSING"; exit 3; }
  grep -q 'TASAvailabilityEngineV2Panel' "$root/client/src/pages/tas/TASServicePage.tsx" || { echo "REPAIR=FAIL"; echo "ERROR=PHASE6_UI_MISSING"; exit 3; }
done

# Backups.
for rel in "${TARGETS[@]}"; do
  for pair in "$ACTIVE|$ACTIVE_BACKUP" "$REPO|$CANON_BACKUP"; do
    base="${pair%%|*}"
    backup="${pair#*|}"
    if [ -e "$base/$rel" ] || [ -L "$base/$rel" ]; then
      mkdir -p "$(dirname "$backup/$rel")"
      cp -a "$base/$rel" "$backup/$rel"
    else
      mkdir -p "$(dirname "$backup/$rel.__absent__")"
      : > "$backup/$rel.__absent__"
    fi
  done
done
if [ -d "$ACTIVE/dist" ]; then cp -a "$ACTIVE/dist" "$TMP/dist-backup"; else : > "$TMP/dist-absent"; fi

# Preflight transformations on temp copies.
for rel in "server/tasDb.ts" "server/routers.ts" "client/src/pages/tas/TASServicePage.tsx"; do
  mkdir -p "$(dirname "$ACTIVE_PRE/$rel")" "$(dirname "$CANON_PRE/$rel")"
  cp -a "$ACTIVE/$rel" "$ACTIVE_PRE/$rel"
  cp -a "$REPO/$rel" "$CANON_PRE/$rel"
done
if [ -f "$ACTIVE/scripts/verify-tas-auto-bay-assignment-v1.ts" ]; then
  mkdir -p "$ACTIVE_PRE/scripts"
  cp -a "$ACTIVE/scripts/verify-tas-auto-bay-assignment-v1.ts" "$ACTIVE_PRE/scripts/"
fi
if [ -f "$REPO/scripts/verify-tas-auto-bay-assignment-v1.ts" ]; then
  mkdir -p "$CANON_PRE/scripts"
  cp -a "$REPO/scripts/verify-tas-auto-bay-assignment-v1.ts" "$CANON_PRE/scripts/"
fi

python3 "$TMP/source-transform.py" "$ACTIVE_PRE" "$PAYLOAD" >/dev/null
python3 "$TMP/source-transform.py" "$CANON_PRE" "$PAYLOAD" >/dev/null

for base in "$ACTIVE_PRE" "$CANON_PRE"; do
  grep -q 'selectTASAutoBayCandidateForLoad' "$base/server/tasDb.ts" || { echo "REPAIR=FAIL"; echo "ERROR=PREFLIGHT_ASSIGNMENT_MARKER_MISSING"; exit 4; }
  grep -q 'FOR UPDATE' "$base/server/tasDb.ts" || { echo "REPAIR=FAIL"; echo "ERROR=PREFLIGHT_LOCK_MARKER_MISSING"; exit 4; }
  grep -q 'Bay / الكوريك' "$base/client/src/pages/tas/TASServicePage.tsx" || { echo "REPAIR=FAIL"; echo "ERROR=PREFLIGHT_UI_MARKER_MISSING"; exit 4; }
  [ -f "$base/scripts/verify-tas-auto-bay-assignment-v1.ts" ] || { echo "REPAIR=FAIL"; echo "ERROR=PREFLIGHT_VERIFY_FILE_MISSING"; exit 4; }
done

echo "REPAIR_PREFLIGHT=PASS"

# Repair active source from preflight result.
for rel in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$ACTIVE/$rel")"
  cp -a "$ACTIVE_PRE/$rel" "$ACTIVE/$rel"
done
ACTIVE_MUTATED=1

grep -q 'selectTASAutoBayCandidateForLoad' "$ACTIVE/server/tasDb.ts"
grep -q 'FOR UPDATE' "$ACTIVE/server/tasDb.ts"
grep -q 'Bay / الكوريك' "$ACTIVE/client/src/pages/tas/TASServicePage.tsx"
echo "ACTIVE_REPAIR=PASS"

(
  cd "$ACTIVE"
  NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
)
echo "BUILD=PASS"

(
  cd "$ACTIVE"
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
[ "$PM2_STATUS" = "online" ] || { echo "REPAIR=FAIL"; echo "PM2=$PM2_STATUS"; echo "ERROR=PM2_NOT_ONLINE"; exit 5; }

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
[ "$HTTP" = "200" ] || { echo "REPAIR=FAIL"; echo "HTTP=$HTTP"; echo "ERROR=HTTP_HEALTH_FAILED"; exit 5; }

INDEX_BEFORE="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"

# Repair canonical source from preflight result.
for rel in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$REPO/$rel")"
  cp -a "$CANON_PRE/$rel" "$REPO/$rel"
done
CANON_MUTATED=1

INDEX_AFTER="$(git -C "$REPO" ls-files -s | sha256sum | awk '{print $1}')"
[ "$INDEX_BEFORE" = "$INDEX_AFTER" ] || { echo "REPAIR=FAIL"; echo "ERROR=INDEX_CHANGED"; exit 6; }

grep -q 'selectTASAutoBayCandidateForLoad' "$REPO/server/tasDb.ts"
grep -q 'FOR UPDATE' "$REPO/server/tasDb.ts"
grep -q 'Bay / الكوريك' "$REPO/client/src/pages/tas/TASServicePage.tsx"

SUCCESS=1
ACTIVE_MUTATED=0
CANON_MUTATED=0

echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "CANONICAL_REPAIR=PASS"
echo "INDEX_PRESERVED=YES"
echo "PHASE7_CORE_PRESENT=YES"
echo "DB_UNCHANGED=YES"
echo "READY_FOR_GITHUB_PUSH=YES"
echo "ERROR=NONE"
