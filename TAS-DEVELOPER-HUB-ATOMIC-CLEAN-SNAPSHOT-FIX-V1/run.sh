#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-ATOMIC-CLEAN-SNAPSHOT-FIX-V1"
TMP="$(mktemp -d /tmp/tas-devhub-snapshot-run.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/apply.sh" -o "$TMP/apply.sh"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"

bash -n "$TMP/apply.sh"
python3 -m py_compile "$TMP/source-transform.py"

echo "SCRIPT_PREFLIGHT=PASS"
bash "$TMP/apply.sh"
