#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-HELP-CENTER-INSYSTEM-LUXURY-V2"
TMP="$(mktemp -d /tmp/tas-help-v2-run.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
bash "$TMP/deploy.sh"
