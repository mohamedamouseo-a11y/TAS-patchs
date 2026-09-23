#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
ACTIVE="$(realpath -e "$ROOT/current")"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
A="$ACTIVE/storage"
S="$SHARED/storage"

echo "PATCH=TAS-STORAGE-RECONCILIATION-PLAN-AUDIT-V2"
echo "MODE=READ_ONLY"

[ -d "$A" ] && [ ! -L "$A" ] || { echo "AUDIT=FAIL"; echo "ERROR=ACTIVE_STORAGE_NOT_LOCAL_DIR"; exit 2; }
[ -d "$S" ] && [ ! -L "$S" ] || { echo "AUDIT=FAIL"; echo "ERROR=SHARED_STORAGE_UNSAFE"; exit 2; }

TMP="$(mktemp -d /tmp/tas-storage-plan-v2.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

python3 - "$A" "$S" <<'PY'
import hashlib, json, os, sys
from pathlib import Path
from collections import Counter, defaultdict

A=Path(sys.argv[1])
S=Path(sys.argv[2])

IGNORE_PREFIXES={".tas-operation.lock"}
SENSITIVE_STATE_KEYS={"webhookSecret","aiAccessToken","githubTokenEncrypted","githubToken"}

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
        st=p.stat()
        h=hashlib.sha256()
        with p.open("rb") as f:
            for chunk in iter(lambda:f.read(1024*1024),b""):
                h.update(chunk)
        out[rel]={"size":st.st_size,"mtime":int(st.st_mtime),"sha":h.hexdigest()}
    return out

a=files(A); s=files(S)
only_a=sorted(set(a)-set(s))
only_s=sorted(set(s)-set(a))
diff=sorted(p for p in set(a)&set(s) if a[p]["sha"]!=s[p]["sha"])

print(f"ONLY_ACTIVE_COUNT={len(only_a)}")
for p in only_a:
    m=a[p]
    print(f"ONLY_ACTIVE={p}|size={m['size']}|mtime={m['mtime']}|sha256={m['sha']}")

groups=Counter()
for p in only_s:
    top=p.split("/",1)[0]
    groups[top]+=1
print(f"ONLY_SHARED_COUNT={len(only_s)}")
for top,count in sorted(groups.items()):
    print(f"ONLY_SHARED_GROUP={top}|count={count}")

print(f"DIFFERENT_SAME_PATH_COUNT={len(diff)}")
for p in diff:
    av=a[p]; sv=s[p]
    newer="ACTIVE" if av["mtime"]>sv["mtime"] else "SHARED" if sv["mtime"]>av["mtime"] else "SAME_MTIME"
    print(f"DIFF={p}|newer={newer}|active_size={av['size']}|shared_size={sv['size']}|active_sha256={av['sha']}|shared_sha256={sv['sha']}")

def key_info(root,label):
    p=root/".developer-hub.key"
    if not p.exists():
        print(f"{label}_KEY_PRESENT=NO")
        return None
    if not p.is_file() or p.is_symlink():
        print(f"{label}_KEY_PRESENT=UNSAFE")
        return None
    data=p.read_bytes()
    print(f"{label}_KEY_PRESENT=YES")
    print(f"{label}_KEY_SIZE={len(data)}")
    print(f"{label}_KEY_SHA256={hashlib.sha256(data).hexdigest()}")
    print(f"{label}_KEY_MODE={oct(p.stat().st_mode & 0o777)[2:]}")
    return data

ak=key_info(A,"ACTIVE")
sk=key_info(S,"SHARED")
if ak is not None and sk is not None:
    print("DEVELOPER_HUB_KEY_MATCH=" + ("YES" if ak==sk else "NO"))
else:
    print("DEVELOPER_HUB_KEY_MATCH=UNKNOWN")

def state_meta(root,label):
    p=root/"developer-hub.json"
    if not p.exists():
        print(f"{label}_STATE_PRESENT=NO")
        return None
    try:
        raw=p.read_text(encoding="utf-8")
        obj=json.loads(raw)
    except Exception:
        print(f"{label}_STATE_PRESENT=YES")
        print(f"{label}_STATE_JSON_VALID=NO")
        return None
    print(f"{label}_STATE_PRESENT=YES")
    print(f"{label}_STATE_JSON_VALID=YES")
    print(f"{label}_STATE_UPDATED_AT={obj.get('updatedAt') or 'NULL'}")
    print(f"{label}_STATE_LAST_SYNC_AT={obj.get('githubLastSyncAt') or 'NULL'}")
    print(f"{label}_STATE_LAST_SYNC_COMMIT={obj.get('githubLastSyncCommit') or 'NULL'}")
    print(f"{label}_STATE_VERIFIED_AT={obj.get('githubVerifiedAt') or 'NULL'}")
    print(f"{label}_STATE_TOKEN_PRESENT={'YES' if bool(obj.get('githubTokenEncrypted')) else 'NO'}")
    print(f"{label}_STATE_MCP_ENABLED={'YES' if bool(obj.get('mcpEnabled')) else 'NO'}")
    safe_shape=sorted(k for k in obj.keys() if k not in SENSITIVE_STATE_KEYS)
    print(f"{label}_STATE_NONSECRET_KEYS={','.join(safe_shape)}")
    return obj

ast=state_meta(A,"ACTIVE")
sst=state_meta(S,"SHARED")
if ast is not None and sst is not None:
    au=str(ast.get("updatedAt") or "")
    su=str(sst.get("updatedAt") or "")
    print("STATE_LOGICAL_NEWER=" + ("ACTIVE" if au>su else "SHARED" if su>au else "SAME_OR_UNKNOWN"))

def audit_info(root,label):
    p=root/"developer-hub-github-audit.jsonl"
    if not p.exists():
        print(f"{label}_AUDIT_PRESENT=NO")
        return []
    raw=p.read_text(encoding="utf-8",errors="replace").splitlines()
    valid=[]
    invalid=0
    max_at=""
    hashes=[]
    for line in raw:
        if not line.strip():
            continue
        try:
            obj=json.loads(line)
            valid.append(line)
            at=str(obj.get("at") or "")
            if at>max_at: max_at=at
            hashes.append(hashlib.sha256(line.encode()).hexdigest())
        except Exception:
            invalid+=1
    print(f"{label}_AUDIT_PRESENT=YES")
    print(f"{label}_AUDIT_LINES={len(raw)}")
    print(f"{label}_AUDIT_VALID_JSON_LINES={len(valid)}")
    print(f"{label}_AUDIT_INVALID_LINES={invalid}")
    print(f"{label}_AUDIT_LATEST_AT={max_at or 'NULL'}")
    print(f"{label}_AUDIT_UNIQUE_LINES={len(set(hashes))}")
    return valid

aa=audit_info(A,"ACTIVE")
sa=audit_info(S,"SHARED")
aset=set(aa); sset=set(sa)
print(f"AUDIT_INTERSECTION_LINES={len(aset&sset)}")
print(f"AUDIT_ONLY_ACTIVE_LINES={len(aset-sset)}")
print(f"AUDIT_ONLY_SHARED_LINES={len(sset-aset)}")
print(f"AUDIT_UNION_LINES={len(aset|sset)}")
print("AUDIT_ACTIVE_SUBSET_OF_SHARED=" + ("YES" if aset<=sset else "NO"))
print("AUDIT_SHARED_SUBSET_OF_ACTIVE=" + ("YES" if sset<=aset else "NO"))
print("AUDIT_SAFE_EXACT_LINE_UNION=" + ("YES" if aa is not None and sa is not None else "NO"))

known_prefixes=(
    "developer-hub",
    ".developer-hub.key",
    "ai-context/",
    "source-code-exports/",
    "migrations/",
)
unknown_active=[p for p in only_a if not p.startswith(known_prefixes)]
print(f"UNKNOWN_ONLY_ACTIVE_COUNT={len(unknown_active)}")
for p in unknown_active:
    print(f"UNKNOWN_ONLY_ACTIVE={p}")

decision=[]
if ak is not None and sk is not None and ak!=sk:
    decision.append("KEY_MISMATCH")
if ast is None or sst is None:
    decision.append("STATE_INVALID_OR_MISSING")
if any(p not in {"developer-hub.json","developer-hub-github-audit.jsonl"} for p in diff):
    decision.append("UNEXPECTED_DIFF_PATH")
if unknown_active:
    decision.append("UNKNOWN_ACTIVE_ONLY_PATHS")
if decision:
    print("AUTOMATED_RECONCILIATION_READY=NO")
    print("REASON=" + ",".join(decision))
else:
    print("AUTOMATED_RECONCILIATION_READY=YES")
    print("REASON=KNOWN_DEVELOPER_HUB_DIVERGENCE_ONLY")
print("AUDIT=PASS")
print("ERROR=NONE")
PY
