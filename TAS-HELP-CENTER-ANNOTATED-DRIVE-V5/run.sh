#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d /tmp/tas-help-v5.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
cat "$HERE"/payload/part-*.bin > "$TMP/patch.zip"
EXPECTED="cf9ba8fe23bd03e39892b67d59ccc0f11272959a22141bb6d471d406e44d2c1c"
ACTUAL="$(sha256sum "$TMP/patch.zip" | cut -d' ' -f1)"
if [ "$ACTUAL" != "$EXPECTED" ]; then echo "ERROR=BUNDLE_CHECKSUM_MISMATCH"; exit 2; fi
unzip -q "$TMP/patch.zip" -d "$TMP"
bash "$TMP/TAS-HELP-CENTER-ANNOTATED-DRIVE-V5-REPOZIP/run.sh"
