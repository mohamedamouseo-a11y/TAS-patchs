#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-PREMIUM-BOOKING-LIVE-REFRESH-FIX-V1_1"
TMP="$(mktemp -d /tmp/tas-premium-live-refresh-v1_1-runner.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
curl -fsSL "$BASE/source-transform.py" -o "$TMP/source-transform.py"

bash -n "$TMP/deploy.sh"
python3 -m py_compile "$TMP/source-transform.py"
grep -q 'TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1' "$TMP/source-transform.py" || {
  echo "SCRIPT_PREFLIGHT=FAIL"
  echo "ERROR=STALE_SOURCE_TRANSFORM"
  exit 2
}

echo "SCRIPT_PREFLIGHT=PASS"
bash "$TMP/deploy.sh"
