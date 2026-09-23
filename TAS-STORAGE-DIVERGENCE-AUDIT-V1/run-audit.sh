#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
ACTIVE="$(realpath -e "$ROOT/current")"
SHARED="${DEPLOY_SHARED_RUNTIME_ROOT:-$ROOT/shared-runtime}"
A="$ACTIVE/storage"
S="$SHARED/storage"

echo "PATCH=TAS-STORAGE-DIVERGENCE-AUDIT-V1"
echo "MODE=READ_ONLY"
echo "ACTIVE_STORAGE=$A"
echo "SHARED_STORAGE=$S"

[ -d "$A" ] && [ ! -L "$A" ] || { echo "AUDIT=FAIL"; echo "ERROR=ACTIVE_STORAGE_NOT_LOCAL_DIR"; exit 2; }
[ -d "$S" ] && [ ! -L "$S" ] || { echo "AUDIT=FAIL"; echo "ERROR=SHARED_STORAGE_UNSAFE"; exit 2; }

TMP="$(mktemp -d /tmp/tas-storage-audit.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
AM="$TMP/active.tsv"
SM="$TMP/shared.tsv"

manifest() {
  local root="$1" out="$2"
  (
    cd "$root"
    find . -xdev       -path './.tas-operation.lock' -prune -o       -path './.tas-operation.lock/*' -prune -o       -type f -print0
  ) | while IFS= read -r -d '' rel; do
    rel="${rel#./}"
    size="$(stat -c '%s' "$root/$rel")"
    mtime="$(stat -c '%Y' "$root/$rel")"
    sha="$(sha256sum "$root/$rel" | awk '{print $1}')"
    printf '%s\t%s\t%s\t%s\n' "$rel" "$size" "$mtime" "$sha"
  done | sort > "$out"
}

manifest "$A" "$AM"
manifest "$S" "$SM"

ACTIVE_FILES="$(wc -l < "$AM" | tr -d ' ')"
SHARED_FILES="$(wc -l < "$SM" | tr -d ' ')"
ACTIVE_BYTES="$(awk -F '\t' '{s+=$2} END{print s+0}' "$AM")"
SHARED_BYTES="$(awk -F '\t' '{s+=$2} END{print s+0}' "$SM")"

echo "ACTIVE_FILES=$ACTIVE_FILES"
echo "ACTIVE_BYTES=$ACTIVE_BYTES"
echo "SHARED_FILES=$SHARED_FILES"
echo "SHARED_BYTES=$SHARED_BYTES"

python3 - "$AM" "$SM" <<'PY'
import sys
from pathlib import Path

def load(path):
    out={}
    for line in Path(path).read_text().splitlines():
        if not line:
            continue
        rel,size,mtime,sha=line.split("\t")
        out[rel]={"size":int(size),"mtime":int(mtime),"sha":sha}
    return out

a=load(sys.argv[1]); s=load(sys.argv[2])
same=[]; only_a=[]; only_s=[]; diff=[]
for p in sorted(set(a)|set(s)):
    av=a.get(p); sv=s.get(p)
    if av and sv:
        if av["sha"]==sv["sha"]:
            same.append((p,av,sv))
        else:
            diff.append((p,av,sv))
    elif av:
        only_a.append((p,av))
    else:
        only_s.append((p,sv))

print(f"SAME_COUNT={len(same)}")
print(f"ONLY_ACTIVE_COUNT={len(only_a)}")
print(f"ONLY_SHARED_COUNT={len(only_s)}")
print(f"DIFFERENT_SAME_PATH_COUNT={len(diff)}")
print("ACTIVE_IS_SUBSET_OF_SHARED=" + ("YES" if not only_a and not diff else "NO"))
print("SAFE_REBIND_CANDIDATE=" + ("YES" if not only_a and not diff else "NO"))
print("SAFE_UNION_CANDIDATE=" + ("YES" if only_a and not diff else "NO"))

def emit(label, rows, mode):
    print(label + "_START")
    for row in rows:
        if mode=="single":
            p,m=row
            print(f"{p}\tsize={m['size']}\tmtime={m['mtime']}\tsha256={m['sha']}")
        else:
            p,av,sv=row
            newer="ACTIVE" if av["mtime"]>sv["mtime"] else "SHARED" if sv["mtime"]>av["mtime"] else "SAME_MTIME"
            print(f"{p}\tactive_size={av['size']}\tshared_size={sv['size']}\tactive_mtime={av['mtime']}\tshared_mtime={sv['mtime']}\tnewer={newer}\tactive_sha256={av['sha']}\tshared_sha256={sv['sha']}")
    print(label + "_END")

emit("ONLY_ACTIVE", only_a, "single")
emit("ONLY_SHARED", only_s, "single")
emit("DIFFERENT_SAME_PATH", diff, "diff")
PY

echo "AUDIT=PASS"
echo "ERROR=NONE"
