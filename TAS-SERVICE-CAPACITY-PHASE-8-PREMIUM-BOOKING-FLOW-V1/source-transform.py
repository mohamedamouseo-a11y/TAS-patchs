#!/usr/bin/env python3
import shutil
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: source-transform.py <source-root> <payload-root>")

root = Path(sys.argv[1]).resolve()
payload = Path(sys.argv[2]).resolve()

def read_file(base: Path, rel: str) -> str:
    p = base / rel
    if not p.is_file():
        raise RuntimeError("missing file: " + str(p))
    return p.read_text(encoding="utf-8")

def write(rel: str, text: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(label + " expected exactly one anchor, found " + str(count))
    return text.replace(old, new, 1)

def copy_payload(rel: str) -> None:
    src = payload / rel
    dst = root / rel
    if not src.is_file():
        raise RuntimeError("missing payload file: " + rel)
    incoming = src.read_bytes()
    if dst.exists():
        if not dst.is_file():
            raise RuntimeError("unsafe existing payload target: " + rel)
        if dst.read_bytes() == incoming:
            return
        raise RuntimeError("conflicting existing Phase 8 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if 'plannedDurationMinutes: int("plannedDurationMinutes")' not in schema:
    field_anchor = '  bayId: int("bayId"),\n'
    fields = (
        '  vehicleId: int("vehicleId"),\n'
        '  mileageKm: int("mileageKm"),\n'
        '  maintenanceMappingId: int("maintenanceMappingId"),\n'
        '  maintenancePlanId: int("maintenancePlanId"),\n'
        '  maintenanceIntervalId: int("maintenanceIntervalId"),\n'
        '  plannedDurationMinutes: int("plannedDurationMinutes"),\n'
    )
    schema = replace_once(schema, field_anchor, field_anchor + fields, "booking context fields")

    index_anchor = '  index("idx_service_bookings_bayId").on(table.bayId),\n'
    indexes = (
        '  index("idx_service_bookings_vehicleId").on(table.vehicleId),\n'
        '  index("idx_service_bookings_maintenanceIntervalId").on(table.maintenanceIntervalId),\n'
    )
    schema = replace_once(schema, index_anchor, index_anchor + indexes, "booking context indexes")
    write(schema_rel, schema)

db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)

availability_start = db.find("export const getAvailableTASSlots = async")
availability_end = db.find("\nexport const getTASSparePartRequests", availability_start)
if availability_start < 0 or availability_end < 0:
    raise RuntimeError("availability function anchors missing")
availability_snippet = read_file(payload, "snippets/tasDb-availability-v3.ts.txt").rstrip()
if 'durationSource = maintenanceInterval ? "maintenance_interval" : "service_type"' not in db[availability_start:availability_end]:
    db = db[:availability_start] + availability_snippet + "\n" + db[availability_end:]

appointments_start = db.find("export const getTASAppointments = async")
appointments_end = db.find("export const confirmTASAppointmentWorkflow = async", appointments_start)
if appointments_start < 0 or appointments_end < 0:
    raise RuntimeError("appointment backend anchors missing")
premium_snippet = read_file(payload, "snippets/tasDb-premium-booking.ts.txt").rstrip() + "\n\n"
if 'bookingMode === "premium_v1"' not in db[appointments_start:appointments_end]:
    db = db[:appointments_start] + premium_snippet + db[appointments_end:]

write(db_rel, db)

router_rel = "server/routers.ts"
router = read_file(root, router_rel)
old_slots = """    getAvailableSlots: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getAvailableTASSlots({
      day: input?.day ? new Date(input.day) : new Date(),
      branchId: input?.branchId,
      serviceTypeId: input?.serviceTypeId,
    })),
"""
new_slots = """    getAvailableSlots: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getAvailableTASSlots({
      day: input?.day ? new Date(input.day) : new Date(),
      branchId: input?.branchId,
      serviceTypeId: input?.serviceTypeId,
      maintenanceIntervalId: Number(input?.maintenanceIntervalId ?? 0) || undefined,
    })),
"""
if old_slots in router:
    count = router.count(old_slots)
    if count != 2:
        raise RuntimeError("availability router anchor expected twice, found " + str(count))
    router = router.replace(old_slots, new_slots)
elif new_slots not in router:
    raise RuntimeError("availability router anchor missing")
write(router_rel, router)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)

if "TASPremiumBookingFlow" not in page:
    import_anchor = "import TASAvailabilityEngineV2Panel from '@/components/tas/TASAvailabilityEngineV2Panel';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASPremiumBookingFlow from '@/components/tas/TASPremiumBookingFlow';\n",
        "premium booking import",
    )

    stats_end = """        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={<CalendarClock size={15} />} label={isRTL ? 'مواعيد مفتوحة' : 'Open appointments'} value={pendingCount} tone="gold" />
          <StatCard icon={<Clock size={15} />} label={isRTL ? 'مواعيد اليوم' : 'Today'} value={todayCount} tone="navy" />
          <StatCard icon={<CheckCircle2 size={15} />} label={isRTL ? 'مكتملة' : 'Completed'} value={completedCount} tone="green" />
        </div>
"""
    page = replace_once(
        page,
        stats_end,
        stats_end + "\n        <TASPremiumBookingFlow onCreated={() => appointmentsQ.refetch()} />\n",
        "premium booking placement",
    )

    grid_old = '        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.2fr]">\n'
    page = replace_once(page, grid_old, '        <div className="grid gap-6">\n', "appointments grid")

    first = page.find("          <SectionCard title={isRTL ? 'إنشاء موعد صيانة'")
    second = page.find("          <SectionCard title={isRTL ? 'مواعيد الصيانة'", first)
    if first < 0 or second < 0:
        raise RuntimeError("legacy booking card anchors missing")
    page = page[:first] + page[second:]

vehicle_cell_old = """                        <TableCell className="text-sm text-zinc-600">{[row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—'}</TableCell>
"""
vehicle_cell_new = """                        <TableCell className="text-sm text-zinc-600">
                          <div>{[row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—'}</div>
                          {row.mileageKm != null && <div className="mt-1 text-[11px] text-zinc-400">{Number(row.mileageKm).toLocaleString('en-US')} km</div>}
                          {row.maintenancePlanName && (
                            <div className="mt-1 text-[11px] text-[#9a6b12]">
                              {row.maintenancePlanName}{row.maintenanceMileageKm != null ? ` • ${Number(row.maintenanceMileageKm).toLocaleString('en-US')} km` : ''}
                            </div>
                          )}
                        </TableCell>
"""
if vehicle_cell_old in page:
    page = replace_once(page, vehicle_cell_old, vehicle_cell_new, "appointment maintenance context cell")
elif "row.maintenancePlanName" not in page:
    raise RuntimeError("appointment vehicle cell anchor missing")

write(page_rel, page)

for rel in [
    "client/src/components/tas/TASPremiumBookingFlow.tsx",
    "scripts/apply-tas-premium-booking-v1.ts",
    "scripts/verify-tas-premium-booking-v1.ts",
    "scripts/rollback-tas-premium-booking-v1.ts",
]:
    copy_payload(rel)

print("PHASE8_SOURCE_TRANSFORM=PASS")
