#!/usr/bin/env bash
set -u
set -o pipefail

echo "PATCH=TAS-SERVICE-CAPACITY-PHASE-1-FOUNDATION-AUDIT-V2"
echo "MODE=READ_ONLY"

DB_URL="$(pm2 jlist 2>/dev/null | node -e '
let s="";
process.stdin.on("data",d=>s+=d);
process.stdin.on("end",()=>{
  try {
    const rows=JSON.parse(s||"[]");
    const p=rows.find(x=>String(x.name||"").toLowerCase()==="tas") || rows.find(x=>/tas/i.test(String(x.name||"")));
    const e=p?.pm2_env||{};
    const v=e.DATABASE_URL || e.env?.DATABASE_URL || "";
    if(v) process.stdout.write(v);
  } catch {}
});
' 2>/dev/null || true)"

if [ -z "$DB_URL" ]; then
  echo "PM2_DATABASE_ENV=NOT_FOUND"
  echo "PHASE1_AUDIT=PARTIAL"
  echo "ERROR=DATABASE_URL_NOT_FOUND_IN_PM2"
  exit 2
fi

echo "PM2_DATABASE_ENV=FOUND"

TMP="$(mktemp /tmp/tas-service-phase1-v2.XXXXXX.sh)"
trap 'rm -f "$TMP"' EXIT

curl -fsSL "https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-1-FOUNDATION-AUDIT-V1/run-audit.sh" -o "$TMP"

DATABASE_URL="$DB_URL" bash "$TMP"
RC=$?

exit "$RC"
