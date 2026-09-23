#!/usr/bin/env bash
set -u
set -o pipefail

PATCH="TAS-SERVICE-CAPACITY-PHASE-1-FOUNDATION-AUDIT-V1"
BASE_SHA="94e81d20ed53b03763daf144e1429813252cea83"

echo "PATCH=$PATCH"
echo "MODE=READ_ONLY"

ROOT=""

if [ -f "./package.json" ] && grep -q '"name"[[:space:]]*:[[:space:]]*"tamiyouz_crm"' "./package.json" 2>/dev/null; then
  ROOT="$PWD"
fi

if [ -z "$ROOT" ] && command -v pm2 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  ROOT="$(pm2 jlist 2>/dev/null | node -e '
    let s="";
    process.stdin.on("data",d=>s+=d);
    process.stdin.on("end",()=>{
      try {
        const fs=require("fs");
        const rows=JSON.parse(s||"[]");
        const good=rows.filter(p=>{
          const cwd=p?.pm2_env?.pm_cwd;
          if(!cwd) return false;
          try {
            const pkg=JSON.parse(fs.readFileSync(cwd+"/package.json","utf8"));
            return pkg?.name==="tamiyouz_crm";
          } catch { return false; }
        });
        const preferred=good.find(p=>/^(tas|tamiyouz.*tas)$/i.test(String(p.name||""))) || good[0];
        if(preferred?.pm2_env?.pm_cwd) process.stdout.write(preferred.pm2_env.pm_cwd);
      } catch {}
    });
  ' 2>/dev/null || true)"
fi

if [ -z "$ROOT" ]; then
  for d in /var/www/TAS /var/www/tas /opt/apps/TAS /opt/apps/tas /srv/TAS /srv/tas; do
    if [ -f "$d/package.json" ] && grep -q '"name"[[:space:]]*:[[:space:]]*"tamiyouz_crm"' "$d/package.json" 2>/dev/null; then
      ROOT="$d"
      break
    fi
  done
fi

if [ -z "$ROOT" ]; then
  echo "PROJECT_ROOT=NOT_FOUND"
  echo "PHASE1_AUDIT=FAIL"
  echo "ERROR=PROJECT_ROOT_NOT_FOUND"
  exit 2
fi

cd "$ROOT" || exit 2
echo "PROJECT_ROOT=$ROOT"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  RUNTIME_HEAD="$(git rev-parse HEAD 2>/dev/null || echo UNKNOWN)"
  DIRTY_COUNT="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
else
  RUNTIME_HEAD="UNKNOWN"
  DIRTY_COUNT="UNKNOWN"
fi

echo "AUDIT_BASE_SHA=$BASE_SHA"
echo "RUNTIME_HEAD=$RUNTIME_HEAD"
echo "WORKTREE_DIRTY_COUNT=$DIRTY_COUNT"

if [ "$RUNTIME_HEAD" = "$BASE_SHA" ]; then
  echo "BASE_MATCH=YES"
elif [ "$RUNTIME_HEAD" = "UNKNOWN" ]; then
  echo "BASE_MATCH=UNKNOWN"
else
  echo "BASE_MATCH=NO"
fi

for f in client/src/pages/tas/TASServicePage.tsx server/tasDb.ts server/routers.ts shared/schema.ts; do
  if [ -f "$f" ]; then
    echo "SOURCE_FILE_${f//[^A-Za-z0-9]/_}=YES"
  else
    echo "SOURCE_FILE_${f//[^A-Za-z0-9]/_}=NO"
  fi
done

if grep -q 'type="date"' client/src/pages/tas/TASServicePage.tsx 2>/dev/null && grep -q 'type="time"' client/src/pages/tas/TASServicePage.tsx 2>/dev/null; then
  echo "SERVICE_UI_MANUAL_DATETIME=YES"
else
  echo "SERVICE_UI_MANUAL_DATETIME=NO"
fi

if grep -q 'getAvailableSlots' client/src/pages/tas/TASServicePage.tsx 2>/dev/null; then
  echo "SERVICE_UI_USES_AVAILABLE_SLOTS=YES"
else
  echo "SERVICE_UI_USES_AVAILABLE_SLOTS=NO"
fi

if grep -q 'getAvailableTASSlots' server/tasDb.ts 2>/dev/null; then
  echo "BACKEND_AVAILABLE_SLOT_ENGINE=YES"
else
  echo "BACKEND_AVAILABLE_SLOT_ENGINE=NO"
fi

if grep -Eq 'tas_service_bays|tas_bays|serviceBay|bayId' shared/schema.ts 2>/dev/null; then
  echo "SOURCE_BAY_ENTITY=YES"
else
  echo "SOURCE_BAY_ENTITY=NO"
fi

if grep -Eq 'tas_maintenance_plans|tas_maintenance_intervals|maintenancePlanId|maintenanceIntervalId' shared/schema.ts 2>/dev/null; then
  echo "SOURCE_MAINTENANCE_PLAN_ENTITY=YES"
else
  echo "SOURCE_MAINTENANCE_PLAN_ENTITY=NO"
fi

if command -v pnpm >/dev/null 2>&1; then
  TMPLOG="/tmp/tas-service-phase1-typecheck-$$.log"
  if pnpm -s exec tsc --noEmit --pretty false >"$TMPLOG" 2>&1; then
    echo "TYPECHECK_BASELINE=PASS"
    echo "TYPECHECK_ERROR_LINES=0"
  else
    LINES="$(wc -l < "$TMPLOG" 2>/dev/null | tr -d ' ' || echo UNKNOWN)"
    echo "TYPECHECK_BASELINE=FAIL"
    echo "TYPECHECK_ERROR_LINES=$LINES"
  fi
  rm -f "$TMPLOG"
else
  echo "TYPECHECK_BASELINE=SKIP_PNPM_NOT_FOUND"
  echo "TYPECHECK_ERROR_LINES=UNKNOWN"
fi

PM2_STATUS="UNKNOWN"
LOCAL_PORT=""
if command -v pm2 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  PM2_INFO="$(pm2 jlist 2>/dev/null | node -e '
    let s="";
    process.stdin.on("data",d=>s+=d);
    process.stdin.on("end",()=>{
      try {
        const rows=JSON.parse(s||"[]");
        const root=process.argv[1];
        const p=rows.find(x=>x?.pm2_env?.pm_cwd===root) || rows.find(x=>/tas/i.test(String(x.name||"")));
        if(p) process.stdout.write(String(p?.pm2_env?.status||"UNKNOWN")+"|"+String(p?.pm2_env?.PORT||p?.pm2_env?.env?.PORT||""));
      } catch {}
    });
  ' "$ROOT" 2>/dev/null || true)"
  if [ -n "$PM2_INFO" ]; then
    PM2_STATUS="${PM2_INFO%%|*}"
    LOCAL_PORT="${PM2_INFO#*|}"
  fi
fi

echo "PM2_STATUS=$PM2_STATUS"

if [[ "$LOCAL_PORT" =~ ^[0-9]+$ ]] && command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl -sS -o /dev/null --max-time 8 -w '%{http_code}' "http://127.0.0.1:$LOCAL_PORT/" 2>/dev/null || echo 000)"
  echo "LOCAL_HTTP=$HTTP_CODE"
else
  echo "LOCAL_HTTP=UNKNOWN"
fi

DB_RESULT="$(node --input-type=module <<'NODE' 2>/dev/null
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DB_CONNECT=NO_DATABASE_URL");
  process.exitCode = 3;
} else {
  let conn;
  try {
    conn = await mysql.createConnection(url);
    console.log("DB_CONNECT=PASS");
    console.log("DB_READ_ONLY=YES");

    const tableExists = async (name) => {
      const [rows] = await conn.execute(
        "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [name],
      );
      return Number(rows?.[0]?.c ?? 0) > 0;
    };

    const columns = async (name) => {
      const [rows] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        [name],
      );
      return rows.map((r) => String(r.COLUMN_NAME));
    };

    const scalar = async (sql) => {
      const [rows] = await conn.query(sql);
      const row = rows?.[0] ?? {};
      return Object.values(row)[0] ?? 0;
    };

    const required = {
      tas_branches: ["id","name","capacityPerSlot","slotIntervalMinutes","workdayStartHour","workdayEndHour","isActive"],
      tas_service_types: ["id","name","category","durationMinutes","slotCapacity","isActive"],
      tas_service_bookings: ["id","branchId","serviceTypeId","preferredDate","preferredTime","startAt","endAt","status","sourceChannel"],
    };

    let schemaOk = true;
    for (const [table, cols] of Object.entries(required)) {
      const exists = await tableExists(table);
      console.log("TABLE_" + table.toUpperCase() + "=" + (exists ? "YES" : "NO"));
      if (!exists) {
        schemaOk = false;
        console.log("MISSING_COLUMNS_" + table.toUpperCase() + "=" + cols.join(","));
        continue;
      }
      const actual = await columns(table);
      const missing = cols.filter((c) => !actual.includes(c));
      if (missing.length) schemaOk = false;
      console.log("MISSING_COLUMNS_" + table.toUpperCase() + "=" + (missing.length ? missing.join(",") : "NONE"));
    }

    const bayTables = ["tas_service_bays","tas_bays"];
    const maintenanceTables = ["tas_maintenance_plans","tas_maintenance_intervals","tas_maintenance_packages"];
    console.log("DB_BAY_ENTITY=" + ((await Promise.all(bayTables.map(tableExists))).some(Boolean) ? "YES" : "NO"));
    console.log("DB_MAINTENANCE_PLAN_ENTITY=" + ((await Promise.all(maintenanceTables.map(tableExists))).some(Boolean) ? "YES" : "NO"));

    if (await tableExists("tas_branches")) {
      console.log("BRANCH_ROWS=" + await scalar("SELECT COUNT(*) AS c FROM tas_branches"));
      const [r] = await conn.query("SELECT MIN(capacityPerSlot) AS cmin, MAX(capacityPerSlot) AS cmax, MIN(slotIntervalMinutes) AS imin, MAX(slotIntervalMinutes) AS imax, MIN(workdayStartHour) AS smin, MAX(workdayStartHour) AS smax, MIN(workdayEndHour) AS emin, MAX(workdayEndHour) AS emax FROM tas_branches");
      const x = r?.[0] ?? {};
      console.log("BRANCH_CAPACITY_RANGE=" + (x.cmin ?? "NULL") + ".." + (x.cmax ?? "NULL"));
      console.log("BRANCH_SLOT_INTERVAL_RANGE=" + (x.imin ?? "NULL") + ".." + (x.imax ?? "NULL"));
      console.log("BRANCH_START_HOUR_RANGE=" + (x.smin ?? "NULL") + ".." + (x.smax ?? "NULL"));
      console.log("BRANCH_END_HOUR_RANGE=" + (x.emin ?? "NULL") + ".." + (x.emax ?? "NULL"));
    }

    if (await tableExists("tas_service_types")) {
      console.log("SERVICE_TYPE_ROWS=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_types"));
      const [r] = await conn.query("SELECT MIN(durationMinutes) AS dmin, MAX(durationMinutes) AS dmax, MIN(slotCapacity) AS cmin, MAX(slotCapacity) AS cmax FROM tas_service_types");
      const x = r?.[0] ?? {};
      console.log("SERVICE_DURATION_RANGE_MIN=" + (x.dmin ?? "NULL") + ".." + (x.dmax ?? "NULL"));
      console.log("SERVICE_SLOT_CAPACITY_RANGE=" + (x.cmin ?? "NULL") + ".." + (x.cmax ?? "NULL"));
    }

    if (await tableExists("tas_service_bookings")) {
      console.log("BOOKING_ROWS=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings"));
      console.log("ACTIVE_BOOKING_ROWS=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings WHERE status NOT IN ('Completed','Cancelled','NoShow')"));
      console.log("BOOKING_WITHOUT_STARTAT=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings WHERE startAt IS NULL"));
      console.log("BOOKING_WITHOUT_ENDAT=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings WHERE endAt IS NULL"));

      if (await tableExists("tas_branches")) {
        console.log("ORPHAN_BRANCH_REFS=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings b LEFT JOIN tas_branches x ON x.id=b.branchId WHERE b.branchId IS NOT NULL AND x.id IS NULL"));
      } else {
        console.log("ORPHAN_BRANCH_REFS=UNVERIFIABLE");
      }

      if (await tableExists("tas_service_types")) {
        console.log("ORPHAN_SERVICE_TYPE_REFS=" + await scalar("SELECT COUNT(*) AS c FROM tas_service_bookings b LEFT JOIN tas_service_types x ON x.id=b.serviceTypeId WHERE b.serviceTypeId IS NOT NULL AND x.id IS NULL"));
      } else {
        console.log("ORPHAN_SERVICE_TYPE_REFS=UNVERIFIABLE");
      }

      const [statusRows] = await conn.query("SELECT status, COUNT(*) AS c FROM tas_service_bookings GROUP BY status ORDER BY status");
      console.log("BOOKING_STATUS_DISTRIBUTION=" + statusRows.map((r) => String(r.status) + ":" + String(r.c)).join(","));
    }

    console.log("SCHEMA_BASELINE=" + (schemaOk ? "PASS" : "FAIL"));
    await conn.end();
  } catch {
    console.log("DB_CONNECT=FAIL");
    console.log("DB_READ_ONLY=YES");
    process.exitCode = 4;
    try { if (conn) await conn.end(); } catch {}
  }
}
NODE
)"
DB_EXIT=$?
printf '%s\n' "$DB_RESULT"

if printf '%s\n' "$DB_RESULT" | grep -q '^DB_CONNECT=PASS$' && printf '%s\n' "$DB_RESULT" | grep -q '^SCHEMA_BASELINE=PASS$'; then
  echo "PHASE1_AUDIT=PASS"
  if [ "$RUNTIME_HEAD" = "$BASE_SHA" ]; then
    echo "PROCEED_PHASE2=YES"
  else
    echo "PROCEED_PHASE2=REVIEW_RUNTIME_HEAD"
  fi
  echo "ERROR=NONE"
  exit 0
fi

echo "PHASE1_AUDIT=PARTIAL"
echo "PROCEED_PHASE2=NO"
echo "ERROR=DB_OR_SCHEMA_BASELINE_INCOMPLETE"
exit "${DB_EXIT:-1}"
