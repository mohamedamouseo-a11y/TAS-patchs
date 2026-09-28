#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
path = root / "server/tasDb.ts"
text = path.read_text(encoding="utf-8")

marker = "TAS_PHASE11_SNAPSHOT_CREATION_HARDENING_V1"
if marker in text:
    print("SOURCE_TRANSFORM=ALREADY_APPLIED")
    raise SystemExit(0)

old = '''    const maintenancePackage = await snapshotTASMaintenancePackageForBooking(tx, {
      bookingId: id,
      maintenanceIntervalId: maintenanceInterval ? Number(maintenanceInterval.id) : null,
    });
'''

new = '''    // TAS_PHASE11_SNAPSHOT_CREATION_HARDENING_V1
    // Use the exact validated interval requested by Premium Booking and make
    // snapshot creation fail-closed when active package lines exist.
    const bookingMaintenanceIntervalId = maintenanceIntervalId > 0 ? maintenanceIntervalId : null;
    let expectedSnapshotLineCount = 0;

    if (bookingMaintenanceIntervalId) {
      const sourceCountRows = await tx.execute(sql`
        SELECT COUNT(*) AS lineCount
        FROM tas_maintenance_interval_items li
        JOIN tas_maintenance_items mi ON mi.id = li.itemId
        WHERE li.intervalId = ${bookingMaintenanceIntervalId}
          AND li.isActive = 1
          AND mi.isActive = 1
      `);
      expectedSnapshotLineCount = Number(
        (((sourceCountRows as any)[0] ?? []) as AnyRow[])[0]?.lineCount ?? 0,
      );
    }

    const maintenancePackage = await snapshotTASMaintenancePackageForBooking(tx, {
      bookingId: id,
      maintenanceIntervalId: bookingMaintenanceIntervalId,
    });

    if (bookingMaintenanceIntervalId && expectedSnapshotLineCount > 0) {
      const snapshotCountRows = await tx.execute(sql`
        SELECT COUNT(*) AS lineCount
        FROM tas_service_booking_items
        WHERE bookingId = ${id}
      `);
      const actualSnapshotLineCount = Number(
        (((snapshotCountRows as any)[0] ?? []) as AnyRow[])[0]?.lineCount ?? 0,
      );

      if (actualSnapshotLineCount !== expectedSnapshotLineCount) {
        throw new Error(
          `Maintenance snapshot integrity check failed: expected ${expectedSnapshotLineCount} booking item(s), found ${actualSnapshotLineCount}`,
        );
      }
    }
'''

if old not in text:
    raise SystemExit("ERROR=SNAPSHOT_CALL_ANCHOR_NOT_FOUND")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("SOURCE_TRANSFORM=PASS")
