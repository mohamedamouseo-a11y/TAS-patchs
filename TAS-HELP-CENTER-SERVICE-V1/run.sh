#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-HELP-CENTER-SERVICE-V1"
TMP="$(mktemp -d /tmp/tas-help-center-service-v1-run.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BASE/deploy.sh" -o "$TMP/deploy.sh"
bash "$TMP/deploy.sh"
