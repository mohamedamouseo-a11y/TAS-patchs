#!/usr/bin/env python3
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: source-transform.py <source-root>")

root = Path(sys.argv[1]).resolve()
rel = "server/tasDb.ts"
p = root / rel
if not p.is_file():
    raise RuntimeError("missing source file: " + rel)

text = p.read_text(encoding="utf-8")
marker = "TAS_PREMIUM_MAINTENANCE_AVAILABILITY_FIX_V1"
if marker in text:
    print("PREMIUM_MAINTENANCE_AVAILABILITY_SOURCE_TRANSFORM=PASS")
    raise SystemExit(0)

old = '''  let maintenanceInterval: AnyRow | null = null;
  const maintenanceIntervalId = Number(input.maintenanceIntervalId ?? 0);
  if (maintenanceIntervalId > 0) {
    const intervals = await listTASMaintenanceIntervals({ includeInactive: false });
    maintenanceInterval = intervals.find((row: AnyRow) => Number(row.id) === maintenanceIntervalId) ?? null;
    if (!maintenanceInterval) throw new Error("Maintenance interval not found or inactive");
  }
'''
new = '''  let maintenanceInterval: AnyRow | null = null;
  const maintenanceIntervalId = Number(input.maintenanceIntervalId ?? 0);
  if (maintenanceIntervalId > 0) {
    // TAS_PREMIUM_MAINTENANCE_AVAILABILITY_FIX_V1
    if (!db) throw new Error("Database unavailable");
    const intervalRows = await db.execute(sql`
      SELECT *
      FROM tas_maintenance_intervals
      WHERE id=${maintenanceIntervalId}
        AND isActive=1
      LIMIT 1
    `);
    maintenanceInterval = ((((intervalRows as any)[0] ?? []) as AnyRow[])[0]) ?? null;
    if (!maintenanceInterval) throw new Error("Maintenance interval not found or inactive");
  }
'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f"maintenance availability anchor: expected 1, found {count}")

p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("PREMIUM_MAINTENANCE_AVAILABILITY_SOURCE_TRANSFORM=PASS")
