#!/usr/bin/env bash
set -euo pipefail

echo "PATCH=TAS-SERVICE-CAPACITY-PHASE-1-FOUNDATION-RECONCILIATION-V1"

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
  echo "MIGRATION=FAIL"
  echo "ERROR=DATABASE_URL_NOT_FOUND_IN_PM2"
  exit 2
fi

DATABASE_URL="$DB_URL" node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
let conn;
let lock = 0;

const requiredColumns = {
  tas_service_types: [
    "id","name","category","durationMinutes","slotCapacity","description",
    "isActive","createdAt","updatedAt"
  ],
  tas_service_bookings: [
    "id","leadId","customerName","phone","vehicleBrand","vehicleModel","vehicleYear",
    "branchId","serviceTypeId","preferredDate","preferredTime","startAt","endAt",
    "sourceChannel","notes","status","assignedTo","feedbackDueAt","feedbackStatus",
    "feedbackSentAt","createdAt","updatedAt"
  ],
};

async function tableExists(name) {
  const [rows] = await conn.execute(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [name],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function columns(name) {
  const [rows] = await conn.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
    [name],
  );
  return rows.map(r => String(r.COLUMN_NAME));
}

async function verifyColumns(name) {
  const actual = await columns(name);
  const expected = requiredColumns[name];
  const missing = expected.filter(c => !actual.includes(c));
  if (missing.length) throw new Error(name + " missing columns: " + missing.join(","));
}

try {
  conn = await mysql.createConnection(url);

  const [dbRows] = await conn.query("SELECT DATABASE() AS db");
  const dbName = String(dbRows?.[0]?.db ?? "");
  if (!dbName) throw new Error("No database selected");

  for (const guard of ["users","leads","tas_branches"]) {
    if (!(await tableExists(guard))) {
      throw new Error("Safety guard failed: required TAS table missing: " + guard);
    }
  }

  const [lockRows] = await conn.query("SELECT GET_LOCK('tas-service-foundation-reconcile-v1', 10) AS acquired");
  lock = Number(lockRows?.[0]?.acquired ?? 0);
  if (lock !== 1) throw new Error("Could not acquire schema reconciliation lock");

  const beforeTypes = await tableExists("tas_service_types");
  const beforeBookings = await tableExists("tas_service_bookings");

  if (!beforeTypes) {
    await conn.query(`
      CREATE TABLE tas_service_types (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        category ENUM('PeriodicMaintenance','Mechanical','Electrical','BodyShop','Inspection','Other') NOT NULL DEFAULT 'Other',
        durationMinutes INT NOT NULL DEFAULT 60,
        slotCapacity INT NOT NULL DEFAULT 1,
        description TEXT NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT tas_service_types_id PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  if (!beforeBookings) {
    await conn.query(`
      CREATE TABLE tas_service_bookings (
        id INT NOT NULL AUTO_INCREMENT,
        leadId INT NULL,
        customerName VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        vehicleBrand VARCHAR(120) NULL,
        vehicleModel VARCHAR(120) NULL,
        vehicleYear INT NULL,
        branchId INT NULL,
        serviceTypeId INT NULL,
        preferredDate VARCHAR(20) NULL,
        preferredTime VARCHAR(20) NULL,
        startAt TIMESTAMP NULL,
        endAt TIMESTAMP NULL,
        sourceChannel ENUM('AI','CRM','WhatsApp','Phone','WalkIn','Website') NULL DEFAULT 'CRM',
        notes TEXT NULL,
        status ENUM('Pending','PendingConfirmation','Confirmed','Completed','Cancelled','NoShow') NOT NULL DEFAULT 'Pending',
        assignedTo INT NULL,
        feedbackDueAt TIMESTAMP NULL,
        feedbackStatus ENUM('Pending','Queued','Sent','Responded','Closed') NOT NULL DEFAULT 'Pending',
        feedbackSentAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT tas_service_bookings_id PRIMARY KEY (id),
        INDEX idx_service_bookings_assignedTo (assignedTo),
        INDEX idx_service_bookings_leadId (leadId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  await verifyColumns("tas_service_types");
  await verifyColumns("tas_service_bookings");

  const [countTypes] = await conn.query("SELECT COUNT(*) AS c FROM tas_service_types");
  const [countBookings] = await conn.query("SELECT COUNT(*) AS c FROM tas_service_bookings");

  console.log("DB_CONNECT=PASS");
  console.log("TABLE_TAS_SERVICE_TYPES=" + ((await tableExists("tas_service_types")) ? "YES" : "NO"));
  console.log("TABLE_TAS_SERVICE_BOOKINGS=" + ((await tableExists("tas_service_bookings")) ? "YES" : "NO"));
  console.log("CREATED_TAS_SERVICE_TYPES=" + (!beforeTypes ? "YES" : "NO"));
  console.log("CREATED_TAS_SERVICE_BOOKINGS=" + (!beforeBookings ? "YES" : "NO"));
  console.log("SERVICE_TYPE_ROWS=" + Number(countTypes?.[0]?.c ?? 0));
  console.log("BOOKING_ROWS=" + Number(countBookings?.[0]?.c ?? 0));
  console.log("SEED_DATA_ADDED=NO");
  console.log("MIGRATION=PASS");
  console.log("ERROR=NONE");
} catch (error) {
  console.log("MIGRATION=FAIL");
  console.log("ERROR=" + String(error?.message || error).replace(/[\r\n]+/g, " "));
  process.exitCode = 1;
} finally {
  if (conn && lock === 1) {
    try { await conn.query("SELECT RELEASE_LOCK('tas-service-foundation-reconcile-v1')"); } catch {}
  }
  if (conn) {
    try { await conn.end(); } catch {}
  }
}
NODE

echo "POST_AUDIT_START"
curl -fsSL "https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-1-FOUNDATION-AUDIT-V2/run-audit-v2.sh" | bash
echo "POST_AUDIT_END"
