#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
CURRENT="$(realpath -e "$ROOT/current")"
BASE="https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-PHASE11-SNAPSHOT-ID-DIAGNOSTIC-V1"
TMP="$(mktemp -d /tmp/tas-p11-id-diagnostic.XXXXXX)"
trap 'rm -rf "$TMP"; rm -f "$CURRENT/.tas-phase11-snapshot-id-diagnostic.ts"' EXIT
curl -fsSL "$BASE/diagnose.ts" -o "$CURRENT/.tas-phase11-snapshot-id-diagnostic.ts"
cd "$CURRENT"
pnpm exec tsx .tas-phase11-snapshot-id-diagnostic.ts
