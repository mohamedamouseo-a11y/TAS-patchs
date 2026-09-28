#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-LIVE-QUERY-INVALIDATION-FIX-V1"
TMP="$(mktemp -d /tmp/tas-service-live-refresh-runner.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"
bash -n "$TMP/deploy.sh"
python3 -m py_compile "$TMP/source-transform.py"
grep -q 'TAS_SERVICE_LIVE_QUERY_INVALIDATION_FIX_V1' "$TMP/source-transform.py" || {
  echo "SCRIPT_PREFLIGHT=FAIL"
  echo "ERROR=STALE_SOURCE_TRANSFORM"
  exit 2
}
echo "SCRIPT_PREFLIGHT=PASS"
bash "$TMP/deploy.sh"
