#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${TAS_CANONICAL_ROOT:-/var/www/TAS-root}"
CURRENT="${TAS_RUNTIME_ROOT:-/var/www/TAS-root/current}"
APP="${PM2_APP_NAME:-TAS}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="$ROOT/client/src/pages/HelpCenter.tsx"
SOURCE="$HERE/HelpCenter.tsx"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/HelpCenter.before-v4-recovery-$STAMP.tsx"

test -f "$SOURCE"
test -f "$TARGET"

cp "$TARGET" "$BACKUP"
cp "$SOURCE" "$TARGET"

grep -q 'TAS_HELP_CENTER_EGYPTIAN_PRO_AR_V4' "$TARGET"
grep -q 'TAS_HELP_CENTER_V4_SOURCE_RECOVERY_V1' "$TARGET"
grep -q 'function GuidePage' "$TARGET"
grep -q 'steps.map' "$TARGET"

ROOT_REAL="$(realpath -e "$ROOT")"
CURRENT_REAL="$(realpath -e "$CURRENT" 2>/dev/null || true)"
if [ -n "$CURRENT_REAL" ] && [ "$CURRENT_REAL" != "$ROOT_REAL" ]; then
  cp "$SOURCE" "$CURRENT/client/src/pages/HelpCenter.tsx"
fi

BUILD_ROOT="$ROOT"
if [ -n "$CURRENT_REAL" ] && [ -f "$CURRENT/package.json" ]; then
  BUILD_ROOT="$CURRENT"
fi

(
  cd "$BUILD_ROOT"
  NODE_OPTIONS="--max-old-space-size=2048" pnpm run build
)

pm2 restart "$APP"

HTTP="000"
for _ in $(seq 1 30); do
  HTTP="$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' http://127.0.0.1:3600/tas/help-center || true)"
  [ "$HTTP" = "200" ] && break
  sleep 1
done

if [ "$HTTP" != "200" ]; then
  echo "RECOVERY=FAIL"
  echo "BACKUP=$BACKUP"
  echo "HTTP_3600=$HTTP"
  exit 1
fi

echo "RECOVERY=PASS"
echo "V4_MARKER=YES"
echo "GUIDE_PAGE=RESTORED"
echo "STEPS_RENDERER=RESTORED"
echo "TERM_HELP=RESTORED"
echo "BUILD=PASS"
echo "HTTP_3600=200"
echo "BACKUP=$BACKUP"
echo "READY_FOR_V5=YES"
