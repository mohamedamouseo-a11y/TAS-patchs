#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_ROOT="$(cd "$HERE/.." && pwd)"
V5="$PATCH_ROOT/TAS-HELP-CENTER-ANNOTATED-DRIVE-V5"
ROOT="${TAS_CANONICAL_ROOT:-/var/www/TAS-root}"
TMP="$(mktemp -d /tmp/tas-help-v5-verify.XXXXXX)"
TMP_SCRIPT="$ROOT/scripts/.tmp-help-v5-verify-$$.ts"

cleanup() {
  rm -f "$TMP_SCRIPT" 2>/dev/null || true
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

cat "$V5"/payload/part-*.bin > "$TMP/patch.zip"
EXPECTED="cf9ba8fe23bd03e39892b67d59ccc0f11272959a22141bb6d471d406e44d2c1c"
ACTUAL="$(sha256sum "$TMP/patch.zip" | awk '{print $1}')"
[ "$ACTUAL" = "$EXPECTED" ] || { echo "ERROR=V5_BUNDLE_CHECKSUM_MISMATCH"; exit 2; }

unzip -q "$TMP/patch.zip" -d "$TMP/unpacked"
MANIFEST="$(find "$TMP/unpacked" -type f -name media-manifest.json -print -quit)"
[ -n "$MANIFEST" ] || { echo "ERROR=V5_MANIFEST_NOT_FOUND"; exit 3; }
MEDIA_PARENT="$(dirname "$MANIFEST")"

cp "$HERE/resume-v5-media.ts" "$TMP_SCRIPT"
(
  cd "$ROOT"
  TAS_HELP_V5_MANIFEST="$MANIFEST"   TAS_HELP_V5_MEDIA_ROOT="$MEDIA_PARENT/assets"   TAS_HELP_V5_VERIFY_ONLY=1   pnpm exec tsx "$TMP_SCRIPT"
)
