#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-$ROOT/.atomic-deploy.lock}"
NEXT_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SHARED-RUNTIME-REBIND-REPAIR-V1/repair-and-retry-phase2.sh"

ACTIVE=""
A=""
S=""
BACKUP_ROOT=""
STOPPED=0
MUTATED=0
SUCCESS=0
PORT="3008"

say_fail() {
  echo "STORAGE_RECONCILIATION=FAIL"
  echo "ERROR=$1"
}

rollback() {
  local rc="${1:-1}"
  [ "$MUTATED" = "1" ] || return 0

  pm2 stop "$APP" >/dev/null 2>&1 || true

  if [ -n "$BACKUP_ROOT" ] && [ -d "$BACKUP_ROOT/active-storage" ]; then
    rm -rf -- "$A"
    mkdir -p "$A"
    rsync -aAX --delete "$BACKUP_ROOT/active-storage/" "$A/" || true
  fi

  if [ -n "$BACKUP_ROOT" ] && [ -d "$BACKUP_ROOT/shared-storage" ]; then
    rm -rf -- "$S"
    mkdir -p "$S"
    rsync -aAX --delete "$BACKUP_ROOT/shared-storage/" "$S/" || true
  fi

  pm2 restart "$APP" >/dev/null 2>&1 || true
  STOPPED=0
  return "$rc"
}

on_error() {
  local rc=$?
  if [ "$SUCCESS" != "1" ]; then
    rollback "$rc" || true
  fi
  exit "$rc"
}
trap on_error ERR INT TERM

for cmd in realpath rsync flock pm2 node curl python3 sha256sum mktemp find; do
  command -v "$cmd" >/dev/null 2>&1 || { say_fail "MISSING_COMMAND_$cmd"; exit 2; }
done

ROOT="$(realpath -e "$ROOT")"
ACTIVE="$(realpath -e "$ROOT/current")"
RELEASES="$(realpath -e "$ROOT/releases")"
case "$ACTIVE" in "$RELEASES"/*) ;; *) say_fail "ACTIVE_RELEASE_OUTSIDE_RELEASES"; exit 2 ;; esac
[ "$(dirname "$ACTIVE")" = "$RELEASES" ] || { say_fail "ACTIVE_RELEASE_NOT_DIRECT_CHILD"; exit 2; }

A="$ACTIVE/storage"
S="$SHARED/storage"
[ -d "$A" ] && [ ! -L "$A" ] || { say_fail "ACTIVE_STORAGE_NOT_LOCAL_DIR"; exit 2; }
[ -d "$S" ] && [ ! -L "$S" ] || { say_fail "SHARED_STORAGE_UNSAFE"; exit 2; }
[ -f "$SHARED/.initialized" ] && [ ! -L "$SHARED/.initialized" ] || { say_fail "SHARED_RUNTIME_MARKER_MISSING"; exit 2; }

mkdir -p "$ROOT/.atomic-release/storage-reconciliation-backups"
[ ! -L "$ROOT/.atomic-release" ] || { say_fail "ATOMIC_RELEASE_ROOT_UNSAFE"; exit 2; }

exec 9>"$LOCK_FILE"
flock -n 9 || { say_fail "DEPLOY_LOCK_BUSY"; exit 2; }

for lock in "$A/.tas-operation.lock" "$S/.tas-operation.lock"; do
  if [ -e "$lock" ] || [ -L "$lock" ]; then
    say_fail "TAS_OPERATION_LOCK_PRESENT"
    exit 2
  fi
done

PM2_META="$(pm2 jlist | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  const rows=JSON.parse(s||"[]");
  const matches=rows.filter(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
  if(matches.length!==1) process.exit(3);
  const p=matches[0], e=p.pm2_env||{};
  process.stdout.write([e.status||"",e.pm_cwd||"",e.PORT||e?.env?.PORT||"3008"].join("|"));
});' "$APP")" || { say_fail "PM2_DISCOVERY_FAILED"; exit 2; }

STATUS="${PM2_META%%|*}"
REST="${PM2_META#*|}"
PM2_CWD="${REST%%|*}"
PORT="${REST#*|}"
[ "$STATUS" = "online" ] || { say_fail "PM2_NOT_ONLINE"; exit 2; }
[ "$(realpath -e "$PM2_CWD")" = "$ACTIVE" ] || { say_fail "PM2_CWD_NOT_ACTIVE_RELEASE"; exit 2; }

audit_ready() {
  python3 - "$A" "$S" <<'PY'
import hashlib, json, sys
from pathlib import Path

A=Path(sys.argv[1]); S=Path(sys.argv[2])
ALLOWED_ACTIVE_PREFIXES=(
    "developer-hub",
    ".developer-hub.key",
    "ai-context/",
    "source-code-exports/",
    "migrations/",
)
ALLOWED_DIFF={"developer-hub.json","developer-hub-github-audit.jsonl"}

def ignored(rel):
    return rel == ".tas-operation.lock" or rel.startswith(".tas-operation.lock/")

def files(root):
    out={}
    for p in root.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel=p.relative_to(root).as_posix()
        if ignored(rel):
            continue
        h=hashlib.sha256(p.read_bytes()).hexdigest()
        out[rel]=h
    return out

a=files(A); s=files(S)
only_a=sorted(set(a)-set(s))
diff=sorted(p for p in set(a)&set(s) if a[p]!=s[p])

unknown=[p for p in only_a if not p.startswith(ALLOWED_ACTIVE_PREFIXES)]
unexpected=[p for p in diff if p not in ALLOWED_DIFF]
if unknown:
    print("READY=NO"); print("REASON=UNKNOWN_ONLY_ACTIVE:" + ",".join(unknown)); sys.exit(10)
if unexpected:
    print("READY=NO"); print("REASON=UNEXPECTED_DIFF:" + ",".join(unexpected)); sys.exit(11)

ak=A/".developer-hub.key"; sk=S/".developer-hub.key"
if not ak.is_file() or ak.is_symlink() or not sk.is_file() or sk.is_symlink():
    print("READY=NO"); print("REASON=KEY_MISSING_OR_UNSAFE"); sys.exit(12)
if ak.read_bytes()!=sk.read_bytes():
    print("READY=NO"); print("REASON=KEY_MISMATCH"); sys.exit(13)

def state(root):
    p=root/"developer-hub.json"
    try:
        obj=json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
    return obj
ast=state(A); sst=state(S)
if ast is None or sst is None:
    print("READY=NO"); print("REASON=STATE_INVALID"); sys.exit(14)
au=str(ast.get("updatedAt") or "")
su=str(sst.get("updatedAt") or "")
if not au or au < su:
    print("READY=NO"); print("REASON=ACTIVE_STATE_NOT_NEWER"); sys.exit(15)

def audit(root):
    p=root/"developer-hub-github-audit.jsonl"
    if not p.exists():
        return []
    lines=[]
    for raw in p.read_text(encoding="utf-8",errors="strict").splitlines():
        if not raw.strip(): continue
        json.loads(raw)
        lines.append(raw)
    return lines
try:
    aa=audit(A); sa=audit(S)
except Exception:
    print("READY=NO"); print("REASON=AUDIT_JSONL_INVALID"); sys.exit(16)

print("READY=YES")
print("ONLY_ACTIVE_COUNT=" + str(len(only_a)))
print("DIFF_COUNT=" + str(len(diff)))
print("AUDIT_ONLY_ACTIVE_LINES=" + str(len(set(aa)-set(sa))))
print("AUDIT_ONLY_SHARED_LINES=" + str(len(set(sa)-set(aa))))
PY
}

echo "STORAGE_RECONCILIATION_PREFLIGHT=START"
PREFLIGHT="$(audit_ready)" || { printf '%s\n' "$PREFLIGHT"; say_fail "PREFLIGHT_NOT_SAFE"; exit 3; }
printf '%s\n' "$PREFLIGHT"
printf '%s\n' "$PREFLIGHT" | grep -q '^READY=YES$' || { say_fail "PREFLIGHT_NOT_READY"; exit 3; }
echo "STORAGE_RECONCILIATION_PREFLIGHT=PASS"

pm2 stop "$APP" >/dev/null
STOPPED=1

# No application writer may race the merge after this point.
for lock in "$A/.tas-operation.lock" "$S/.tas-operation.lock"; do
  if [ -e "$lock" ] || [ -L "$lock" ]; then
    say_fail "TAS_OPERATION_LOCK_APPEARED_AFTER_STOP"
    false
  fi
done

STOPPED_CHECK="$(audit_ready)" || { printf '%s\n' "$STOPPED_CHECK"; say_fail "STOPPED_RECHECK_NOT_SAFE"; false; }
printf '%s\n' "$STOPPED_CHECK"
printf '%s\n' "$STOPPED_CHECK" | grep -q '^READY=YES$' || { say_fail "STOPPED_RECHECK_NOT_READY"; false; }
echo "STORAGE_RECONCILIATION_STOPPED_RECHECK=PASS"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP_ROOT="$ROOT/.atomic-release/storage-reconciliation-backups/$STAMP"
mkdir -m 700 "$BACKUP_ROOT"
rsync -aAX "$A/" "$BACKUP_ROOT/active-storage/"
rsync -aAX "$S/" "$BACKUP_ROOT/shared-storage/"
echo "BACKUP_ROOT=$BACKUP_ROOT"
MUTATED=1

python3 - "$A" "$S" <<'PY'
import hashlib, json, os, shutil, sys, tempfile
from pathlib import Path

A=Path(sys.argv[1]); S=Path(sys.argv[2])
ALLOWED_PREFIXES=(
    "developer-hub",
    ".developer-hub.key",
    "ai-context/",
    "source-code-exports/",
    "migrations/",
)

def hash_file(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def regular_files(root):
    out={}
    for p in root.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel=p.relative_to(root).as_posix()
        if rel==".tas-operation.lock" or rel.startswith(".tas-operation.lock/"):
            continue
        out[rel]=hash_file(p)
    return out

a=regular_files(A); s=regular_files(S)
only_a=sorted(set(a)-set(s))
unknown=[p for p in only_a if not p.startswith(ALLOWED_PREFIXES)]
if unknown:
    raise SystemExit("unknown active-only paths appeared: " + ",".join(unknown))

# Preserve every active-only known runtime artifact in shared storage.
for rel in only_a:
    src=A/rel
    dst=S/rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src,dst)

# Active Developer Hub state is the audited logically newer state.
active_state=A/"developer-hub.json"
shared_state=S/"developer-hub.json"
json.loads(active_state.read_text(encoding="utf-8"))
tmp_state=shared_state.with_name(shared_state.name + f".reconcile.{os.getpid()}.tmp")
shutil.copy2(active_state,tmp_state)
os.replace(tmp_state,shared_state)

# Merge append-only audit histories: exact-line dedupe, chronological by "at".
def load_audit(p):
    rows=[]
    if not p.exists():
        return rows
    for idx,line in enumerate(p.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        obj=json.loads(line)
        rows.append((line,str(obj.get("at") or ""),idx))
    return rows

shared_rows=load_audit(S/"developer-hub-github-audit.jsonl")
active_rows=load_audit(A/"developer-hub-github-audit.jsonl")
seen=set()
merged=[]
seq=0
for line,at,idx in shared_rows + active_rows:
    if line in seen:
        continue
    seen.add(line)
    merged.append((at,seq,line))
    seq+=1
merged.sort(key=lambda x:(x[0],x[1]))

audit_path=S/"developer-hub-github-audit.jsonl"
tmp_audit=audit_path.with_name(audit_path.name + f".reconcile.{os.getpid()}.tmp")
with tmp_audit.open("w",encoding="utf-8") as f:
    for _,_,line in merged:
        f.write(line+"\n")
    f.flush()
    os.fsync(f.fileno())
os.chmod(tmp_audit,0o600)
os.replace(tmp_audit,audit_path)

# Safety verification without exposing any secret.
if (A/".developer-hub.key").read_bytes() != (S/".developer-hub.key").read_bytes():
    raise SystemExit("developer hub key changed during merge")
if hash_file(active_state) != hash_file(shared_state):
    raise SystemExit("shared developer-hub state does not match audited active state")
merged_lines=set(x[2] for x in merged)
if not set(x[0] for x in shared_rows).issubset(merged_lines):
    raise SystemExit("shared audit history lost during merge")
if not set(x[0] for x in active_rows).issubset(merged_lines):
    raise SystemExit("active audit history lost during merge")

print("ACTIVE_ONLY_COPIED=" + str(len(only_a)))
print("DEVELOPER_HUB_STATE_SOURCE=ACTIVE")
print("AUDIT_UNION_LINES=" + str(len(merged)))
print("AUDIT_DEDUPE=PASS")
print("MERGE_VERIFY=PASS")
PY

# Rebind only storage here. The next safe repair handles remaining runtime paths.
rm -rf -- "$A"
ln -s "$S" "$A"
[ -L "$A" ] || { say_fail "STORAGE_REBIND_NOT_SYMLINK"; false; }
[ "$(realpath -e "$A")" = "$(realpath -e "$S")" ] || { say_fail "STORAGE_REBIND_WRONG_TARGET"; false; }

echo "STORAGE_REBIND=PASS"

pm2 restart "$APP" >/dev/null
STOPPED=0

READY=0
for _ in $(seq 1 30); do
  STATUS="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{
 const rows=JSON.parse(s||"[]"); const p=rows.find(x=>String(x.name||x?.pm2_env?.name||"")===(process.argv[1]||"TAS"));
 process.stdout.write(String(p?.pm2_env?.status||""));
});' "$APP" 2>/dev/null || true)"
  if [ "$STATUS" = "online" ]; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] || { say_fail "PM2_RESTART_FAILED"; false; }

HTTP="000"
if [[ "$PORT" =~ ^[0-9]+$ ]]; then
  for _ in $(seq 1 20); do
    HTTP="$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:$PORT/tas/service" || true)"
    [ "$HTTP" = "200" ] && break
    sleep 1
  done
fi
[ "$HTTP" = "200" ] || { say_fail "HTTP_HEALTH_FAILED"; false; }

SUCCESS=1
trap - ERR INT TERM

echo "STORAGE_RECONCILIATION=PASS"
echo "DEVELOPER_HUB_KEY_MATCH=YES"
echo "DEVELOPER_HUB_STATE=PRESERVED_ACTIVE_NEWER"
echo "DEVELOPER_HUB_AUDIT=UNION_PRESERVED"
echo "PM2_AFTER_STORAGE_REPAIR=online"
echo "HTTP_AFTER_STORAGE_REPAIR=200"
echo "RETRY_SHARED_RUNTIME_REBIND=YES"

flock -u 9
exec 9>&-

curl -fsSL "$NEXT_URL" | bash
