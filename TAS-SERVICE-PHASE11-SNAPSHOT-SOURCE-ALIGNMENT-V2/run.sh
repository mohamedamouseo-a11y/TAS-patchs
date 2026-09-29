#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-PHASE11-SNAPSHOT-SOURCE-ALIGNMENT-V2"
TMP="$(mktemp -d /tmp/tas-p11-snapshot-v2.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
bash -n "$TMP/deploy.sh"
python3 -m py_compile "$TMP/source-transform.py"
bash "$TMP/deploy.sh"
