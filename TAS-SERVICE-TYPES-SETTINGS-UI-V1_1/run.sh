#!/usr/bin/env bash
set -Eeuo pipefail

TMP="$(mktemp -d /tmp/tas-service-types-settings-v1_1.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

DEPLOY_REF="d99b1513a2c5f8ba12434a7e3d3d7e509ae1c031"
OLD_RAW="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/$DEPLOY_REF/TAS-SERVICE-TYPES-SETTINGS-UI-V1/deploy.sh"
NEW_BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-TYPES-SETTINGS-UI-V1_1"

curl -fsSL "$OLD_RAW" -o "$TMP/deploy.sh"

python3 - "$TMP/deploy.sh" "$NEW_BASE" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
base = sys.argv[2]
text = p.read_text()
old = 'BASE_URL="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-TYPES-SETTINGS-UI-V1"'
if old not in text:
    raise SystemExit("RUNNER_PATCH_BASE_ANCHOR_MISSING")
text = text.replace(old, f'BASE_URL="{base}"', 1)
p.write_text(text)
PY

bash -n "$TMP/deploy.sh"

curl -fsSL "$NEW_BASE/source-transform.py" -o "$TMP/source-transform.py"
python3 -m py_compile "$TMP/source-transform.py"
grep -q 'expected 2 mirrored anchors' "$TMP/source-transform.py" || {
  echo "SCRIPT_PREFLIGHT=FAIL"
  echo "ERROR=STALE_SOURCE_TRANSFORM"
  exit 2
}

echo "SCRIPT_PREFLIGHT=PASS"
echo "SOURCE_TRANSFORM_CACHE_SAFE=PASS"
bash "$TMP/deploy.sh"
