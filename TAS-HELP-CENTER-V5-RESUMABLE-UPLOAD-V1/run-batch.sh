#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_ROOT="$(cd "$HERE/.." && pwd)"
V5="$PATCH_ROOT/TAS-HELP-CENTER-ANNOTATED-DRIVE-V5"
ROOT="${TAS_CANONICAL_ROOT:-/var/www/TAS-root}"
APP="${PM2_APP_NAME:-TAS}"
START="${1:-0}"
LIMIT="${2:-8}"
TMP="$(mktemp -d /tmp/tas-help-v5-resume.XXXXXX)"
TMP_SCRIPT="$ROOT/scripts/.tmp-help-v5-resume-$$.ts"

cleanup() {
  rm -f "$TMP_SCRIPT" 2>/dev/null || true
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

test -d "$V5/payload"
test -f "$ROOT/package.json"
test -f "$ROOT/server/storage.ts"
grep -q 'TAS_STORAGE_DB_CLOCK_LEASE_FIX_V1' "$ROOT/server/storage.ts" || {
  echo "PATCH=FAIL"
  echo "ERROR=LEASE_FIX_MARKER_MISSING"
  exit 2
}

PM2_BEFORE="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"
[ "$PM2_BEFORE" = "online" ] || {
  echo "PATCH=FAIL"
  echo "ERROR=TAS_PM2_NOT_ONLINE_BEFORE_BATCH"
  exit 3
}

cat "$V5"/payload/part-*.bin > "$TMP/patch.zip"
EXPECTED="cf9ba8fe23bd03e39892b67d59ccc0f11272959a22141bb6d471d406e44d2c1c"
ACTUAL="$(sha256sum "$TMP/patch.zip" | awk '{print $1}')"
[ "$ACTUAL" = "$EXPECTED" ] || {
  echo "PATCH=FAIL"
  echo "ERROR=V5_BUNDLE_CHECKSUM_MISMATCH"
  exit 4
}

unzip -q "$TMP/patch.zip" -d "$TMP/unpacked"
MANIFEST="$(find "$TMP/unpacked" -type f -name media-manifest.json -print -quit)"
[ -n "$MANIFEST" ] || {
  echo "PATCH=FAIL"
  echo "ERROR=V5_MANIFEST_NOT_FOUND"
  exit 5
}
MEDIA_PARENT="$(dirname "$MANIFEST")"
[ -d "$MEDIA_PARENT/assets/ar" ] && [ -d "$MEDIA_PARENT/assets/en" ] || {
  echo "PATCH=FAIL"
  echo "ERROR=V5_ASSETS_NOT_FOUND"
  exit 6
}

cp "$HERE/resume-v5-media.ts" "$TMP_SCRIPT"

(
  cd "$ROOT"
  TAS_HELP_V5_MANIFEST="$MANIFEST"   TAS_HELP_V5_MEDIA_ROOT="$MEDIA_PARENT/assets"   TAS_HELP_V5_START_INDEX="$START"   TAS_HELP_V5_LIMIT="$LIMIT"   pnpm exec tsx "$TMP_SCRIPT"
)

PM2_AFTER="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const a=JSON.parse(s||"[]").find(x=>x&&x.name===process.argv[1]);
  process.stdout.write(String(a?.pm2_env?.status||"absent"));
})' "$APP")"

echo "PATCH=TAS-HELP-CENTER-V5-RESUMABLE-UPLOAD-V1"
echo "PM2_BEFORE=$PM2_BEFORE"
echo "PM2_AFTER=$PM2_AFTER"
echo "PRODUCTION_DOWNTIME=NO"
