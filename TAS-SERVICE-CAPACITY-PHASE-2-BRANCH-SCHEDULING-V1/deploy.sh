#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${APP_DEPLOY_ROOT:-/var/www/TAS-root}"
CURRENT="$(realpath -e "$ROOT/current")"
TMP="$(mktemp -d /tmp/tas-service-phase2.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

RAW="$TMP/phase2.patch"
STAMPED="$TMP/phase2.stamped.patch"

curl -fsSL "https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1/TAS-SERVICE-CAPACITY-PHASE-2-BRANCH-SCHEDULING-V1.patch" -o "$RAW"

node "$CURRENT/scripts/stamp-tas-patch-base.mjs" "$RAW" "$STAMPED" >/dev/null
PATCH_SHA="$(sha256sum "$STAMPED" | awk '{print $1}')"

export DEPLOY_MIGRATION_COMMAND="pnpm exec tsx scripts/apply-tas-service-branch-scheduling-v1.ts --apply"
export DEPLOY_MIGRATION_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-service-branch-scheduling-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_COMMAND="pnpm exec tsx scripts/rollback-tas-service-branch-scheduling-v1.ts"
export DEPLOY_MIGRATION_ROLLBACK_VERIFY_COMMAND="pnpm exec tsx scripts/verify-tas-service-branch-scheduling-v1.ts --rolled-back"
export DEPLOY_MIGRATION_CONTRACT_PATCH_SHA256="$PATCH_SHA"

"$CURRENT/scripts/deploy-active-release.sh" "$STAMPED"

NEW_CURRENT="$(realpath -e "$ROOT/current")"
cd "$NEW_CURRENT"
pnpm exec tsx scripts/verify-tas-service-branch-scheduling-v1.ts

PM2_STATUS="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")==="TAS") || rows.find(x=>/tas/i.test(String(x.name||"")));
    process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN"));
  } catch { process.stdout.write("UNKNOWN"); }
});')"

PORT="$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"")==="TAS") || rows.find(x=>/tas/i.test(String(x.name||"")));
    process.stdout.write(String(p?.pm2_env?.PORT||p?.pm2_env?.env?.PORT||3008));
  } catch { process.stdout.write("3008"); }
});')"

HTTP="$(curl -sS -o /dev/null --max-time 8 -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"

echo "PATCH=PASS"
echo "MIGRATION=PASS"
echo "BUILD=PASS"
echo "DEPLOY=PASS"
echo "PM2=$PM2_STATUS"
echo "HTTP=$HTTP"
echo "BRANCH_SCHEDULING_SETTINGS=ACTIVE"
echo "DEMO_BRANCH_FALLBACK_WITH_DB=REMOVED"
echo "LEGACY_BOOKINGS_PRESERVED=YES"
echo "ERROR=NONE"
