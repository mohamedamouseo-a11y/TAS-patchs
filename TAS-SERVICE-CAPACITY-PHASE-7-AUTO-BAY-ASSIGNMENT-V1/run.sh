#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-7-AUTO-BAY-ASSIGNMENT-V1"
TMP="$(mktemp -d /tmp/tas-phase7-runner.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"

bash -n "$TMP/deploy.sh"
python3 -m py_compile "$TMP/source-transform.py"

echo "SCRIPT_PREFLIGHT=PASS"
bash "$TMP/deploy.sh"
