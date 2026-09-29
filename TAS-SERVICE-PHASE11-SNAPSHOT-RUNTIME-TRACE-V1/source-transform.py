#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
path = root / "server/tasDb.ts"
text = path.read_text(encoding="utf-8")

marker = "TAS_PHASE11_SNAPSHOT_RUNTIME_TRACE_V1"
if marker in text:
    print("SOURCE_TRANSFORM=ALREADY_APPLIED")
    raise SystemExit(0)

anchor = "    const maintenancePackage = await snapshotTASMaintenancePackageForBooking(tx, {"
idx = text.find(anchor)
if idx < 0:
    raise SystemExit("ERROR=SNAPSHOT_CALL_ANCHOR_NOT_FOUND")

insert = '''    // TAS_PHASE11_SNAPSHOT_RUNTIME_TRACE_V1
    const snapshotTraceIntervalId = maintenanceInterval ? Number(maintenanceInterval.id) : null;
    let snapshotTraceSourceRows: any[] = [];
    if (snapshotTraceIntervalId) {
      const traceRows = await tx.execute(sql\`
        SELECT li.id intervalItemId, li.itemId, li.isActive lineActive,
               mi.code itemCode, mi.name itemName, mi.isActive itemActive
        FROM tas_maintenance_interval_items li
        JOIN tas_maintenance_items mi ON mi.id=li.itemId
        WHERE li.intervalId=\${snapshotTraceIntervalId}
        ORDER BY li.id ASC
      \`);
      snapshotTraceSourceRows = ((traceRows as any)[0] ?? []) as any[];
    }

'''
text = text[:idx] + insert + text[idx:]

after = '''      maintenanceIntervalId: maintenanceInterval ? Number(maintenanceInterval.id) : null,
    });
'''
after_idx = text.find(after, idx + len(insert))
if after_idx < 0:
    raise SystemExit("ERROR=SNAPSHOT_CALL_END_NOT_FOUND")
after_end = after_idx + len(after)

post = '''
    const snapshotTraceRows = await tx.execute(sql\`
      SELECT id, intervalItemId, itemId, itemCode, itemName
      FROM tas_service_booking_items
      WHERE bookingId=\${id}
      ORDER BY id ASC
    \`);
    const snapshotTraceSnapshotRows = ((snapshotTraceRows as any)[0] ?? []) as any[];
    console.info("[TAS_PHASE11_SNAPSHOT_TRACE_V1]", JSON.stringify({
      bookingId: id,
      maintenancePlanId,
      maintenanceIntervalId: snapshotTraceIntervalId,
      sourceRowCount: snapshotTraceSourceRows.length,
      activeSourceRowCount: snapshotTraceSourceRows.filter((row: any) => Number(row.lineActive) === 1).length,
      sourceRows: snapshotTraceSourceRows,
      insertedSnapshotRowCount: snapshotTraceSnapshotRows.length,
      snapshotRows: snapshotTraceSnapshotRows,
    }));
'''
text = text[:after_end] + post + text[after_end:]

path.write_text(text, encoding="utf-8")
print("SOURCE_TRANSFORM=PASS")
