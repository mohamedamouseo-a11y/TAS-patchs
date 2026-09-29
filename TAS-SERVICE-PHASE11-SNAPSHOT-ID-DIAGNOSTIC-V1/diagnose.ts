import {
  getTASAppointments,
  listTASMaintenanceIntervals,
  listTASMaintenanceIntervalItems,
  listTASBookingMaintenanceItems,
} from "./server/tasDb";

async function main() {
  const bookings: any[] = await getTASAppointments({});
  const booking = bookings.find((row: any) => Number(row.id) === 18);
  if (!booking) throw new Error("Booking #18 not found");

  const planId = Number(booking.maintenancePlanId ?? 0);
  const intervalId = Number(booking.maintenanceIntervalId ?? 0);
  const intervals: any[] = await listTASMaintenanceIntervals({ planId, includeInactive: true });
  const tenK = intervals.filter((row: any) => Number(row.mileageKm) === 10000);

  const oilRows: any[] = [];
  for (const interval of intervals) {
    const lines: any[] = await listTASMaintenanceIntervalItems({
      intervalId: Number(interval.id),
      includeInactive: true,
    });
    for (const line of lines) {
      if (String(line.itemName ?? "") === "UAT Oil Filter" || String(line.itemCode ?? "") === "UAT-FILTER-01") {
        oilRows.push({
          intervalItemId: line.id,
          intervalId: interval.id,
          planId: interval.planId,
          mileageKm: interval.mileageKm,
          label: interval.label,
          durationMinutes: interval.durationMinutes,
          intervalActive: interval.isActive,
          lineActive: line.isActive,
          itemActive: line.itemIsActive,
          quantity: line.quantity,
          unitCostEgp: line.unitCostEgp,
          unitPriceEgp: line.unitPriceEgp,
        });
      }
    }
  }

  const activePackage: any[] = intervalId > 0
    ? await listTASMaintenanceIntervalItems({ intervalId, includeInactive: false })
    : [];
  const snapshot: any = await listTASBookingMaintenanceItems(18);
  const snapshotLines: any[] = Array.isArray(snapshot?.lines) ? snapshot.lines : [];

  console.log("BOOKING_18_PLAN_ID=" + String(planId || "NULL"));
  console.log("BOOKING_18_INTERVAL_ID=" + String(intervalId || "NULL"));
  console.log("BOOKING_18_INTERVAL=" + JSON.stringify(intervals.find((row: any) => Number(row.id) === intervalId) ?? null));
  console.log("PLAN_10K_INTERVALS=" + JSON.stringify(tenK));
  console.log("UAT_OIL_FILTER_ROWS=" + JSON.stringify(oilRows));
  console.log("BOOKING_18_ACTIVE_PACKAGE_LINES=" + String(activePackage.length));
  console.log("BOOKING_18_SNAPSHOT_ROWS=" + String(snapshotLines.length));
  console.log("INTERVAL_MATCH=" + (oilRows.some((row: any) => Number(row.intervalId) === intervalId) ? "YES" : "NO"));
  console.log("ERROR=NONE");
}

main().catch((error) => {
  console.log("ERROR=" + String(error?.message ?? error));
  process.exit(1);
});
