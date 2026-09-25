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
        raise RuntimeError("conflicting existing Phase 10 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

# shared/schema.ts
schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if 'tas_service_booking_status_history' not in schema:
    anchor = "export type InsertTASServiceBooking = typeof tasServiceBookings.$inferInsert;\n\n"
    block = """export const tasServiceBookingStatusHistory = mysqlTable("tas_service_booking_status_history", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  fromStatus: varchar("fromStatus", { length: 40 }).notNull(),
  toStatus: varchar("toStatus", { length: 40 }).notNull(),
  reason: text("reason"),
  actorUserId: int("actorUserId"),
  actorRole: varchar("actorRole", { length: 120 }),
  source: varchar("source", { length: 80 }).notNull().default("ServiceUI"),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_tas_booking_status_history_booking").on(table.bookingId, table.createdAt, table.id),
  index("idx_tas_booking_status_history_actor").on(table.actorUserId, table.createdAt),
]);
export type TASServiceBookingStatusHistory = typeof tasServiceBookingStatusHistory.$inferSelect;
export type InsertTASServiceBookingStatusHistory = typeof tasServiceBookingStatusHistory.$inferInsert;

"""
    schema = replace_once(schema, anchor, anchor + block, "status history schema")
    write(schema_rel, schema)

# server/tasDb.ts — preserve true PendingConfirmation lifecycle status.
db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
old_status = '  status: row.status === "PendingConfirmation" ? "Pending" : row.status,\n'
new_status = '  status: row.status,\n'
if old_status in db:
    db = replace_once(db, old_status, new_status, "appointment status normalization")
elif new_status not in db:
    raise RuntimeError("appointment status mapping anchor missing")
write(db_rel, db)

# server/routers.ts
router_rel = "server/routers.ts"
router = read_file(root, router_rel)
if 'from "./services/tasBookingLifecycle";' not in router:
    anchor = 'import { createTASVehicleBrand, listTASVehicleBrands, requireActiveTASVehicleBrand, updateTASVehicleBrand } from "./services/tasVehicleBrands";\n'
    insert = anchor + 'import { getTASBookingLifecycle, transitionTASBookingStatus } from "./services/tasBookingLifecycle";\n'
    router = replace_once(router, anchor, insert, "lifecycle service import")

list_anchor = '    listAppointments: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getTASAppointments(input ?? {})),\n'
lifecycle_routes = """    getBookingLifecycle: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) =>
      getTASBookingLifecycle(Number(input?.bookingId ?? input?.appointmentId ?? input?.id ?? 0))),
    transitionBookingStatus: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ ctx, input }) =>
      transitionTASBookingStatus({
        bookingId: Number(input?.bookingId ?? input?.appointmentId ?? input?.id ?? 0),
        toStatus: String(input?.toStatus ?? input?.status ?? ""),
        reason: input?.reason ?? null,
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        source: input?.source ?? "ServiceUI",
      })),
"""
if "    getBookingLifecycle: tasPermissionProcedure" not in router:
    count = router.count(list_anchor)
    if count != 2:
        raise RuntimeError("service lifecycle route anchor expected twice, found " + str(count))
    router = router.replace(list_anchor, list_anchor + lifecycle_routes)

old_confirm = "    confirmAppointment: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => confirmTASAppointmentWorkflow(input ?? {})),\n"
new_confirm = """    confirmAppointment: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ ctx, input }) =>
      confirmTASAppointmentWorkflow({
        ...(input ?? {}),
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
      })),
"""
if old_confirm in router:
    router = router.replace(old_confirm, new_confirm)
elif new_confirm.strip() not in router:
    raise RuntimeError("confirm appointment workflow route anchor missing")
write(router_rel, router)

# server/tasPhase2.ts — route legacy confirmation through lifecycle engine.
phase2_rel = "server/tasPhase2.ts"
phase2 = read_file(root, phase2_rel)
phase2 = phase2.replace("  updateTASServiceBooking,\n", "")
if 'from "./services/tasBookingLifecycle";' not in phase2:
    import_anchor = 'import { ensureTASSalesLeadForConversation } from "./tasSales";\n'
    phase2 = replace_once(
        phase2,
        import_anchor,
        import_anchor + 'import { transitionTASBookingStatus } from "./services/tasBookingLifecycle";\n',
        "phase2 lifecycle import",
    )

old_fn = """export const confirmTASAppointmentWorkflow = async (input: AnyRow) => {
  await updateTASServiceBooking(input.appointmentId, {
    status: "Confirmed",
  });
  if (input.conversationId) {
    await sendTASManualMessage({
      conversationId: input.conversationId,
      senderType: "CRM",
      messageType: "BookingConfirmation",
      body: "تم تأكيد موعد خدمة السيارة بنجاح.",
    }).catch(() => undefined);
  }
  return { success: true };
};
"""
new_fn = """export const confirmTASAppointmentWorkflow = async (input: AnyRow) => {
  const transition = await transitionTASBookingStatus({
    bookingId: Number(input.appointmentId ?? input.bookingId ?? input.id ?? 0),
    toStatus: "Confirmed",
    reason: input.reason ?? null,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    source: "LegacyConfirmWorkflow",
  });
  if (input.conversationId) {
    await sendTASManualMessage({
      conversationId: input.conversationId,
      senderType: "CRM",
      messageType: "BookingConfirmation",
      body: "تم تأكيد موعد خدمة السيارة بنجاح.",
    }).catch(() => undefined);
  }
  return { success: true, transition };
};
"""
if old_fn in phase2:
    phase2 = replace_once(phase2, old_fn, new_fn, "legacy confirm workflow")
elif "source: \"LegacyConfirmWorkflow\"" not in phase2:
    raise RuntimeError("legacy confirm function anchor missing")
write(phase2_rel, phase2)

# Service appointments table lifecycle button.
page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)
if "TASBookingLifecycleActions" not in page:
    import_anchor = "import TASServiceScheduler from '@/components/tas/TASServiceScheduler';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASBookingLifecycleActions from '@/components/tas/TASBookingLifecycleActions';\n",
        "appointment lifecycle UI import",
    )

status_cell = "<TableCell><StatusBadge status={row.status} /></TableCell>"
status_cell_new = """<TableCell>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={row.status} />
                            <TASBookingLifecycleActions booking={row} compact />
                          </div>
                        </TableCell>"""
if status_cell in page:
    page = replace_once(page, status_cell, status_cell_new, "appointment lifecycle action cell")
elif "<TASBookingLifecycleActions booking={row} compact />" not in page:
    raise RuntimeError("appointment status cell anchor missing")
write(page_rel, page)

# Scheduler lifecycle action.
scheduler_rel = "client/src/components/tas/TASServiceScheduler.tsx"
scheduler = read_file(root, scheduler_rel)
if "TASBookingLifecycleActions" not in scheduler:
    import_anchor = "import { FieldGroup, FieldLabel, SectionCard, StatusBadge } from '@/components/tas/TASShared';\n"
    scheduler = replace_once(
        scheduler,
        import_anchor,
        import_anchor + "import TASBookingLifecycleActions from '@/components/tas/TASBookingLifecycleActions';\n",
        "scheduler lifecycle import",
    )

old_badge = '<StatusBadge status={booking.status} className="max-w-[76px] truncate px-1.5 py-0.5 text-[9px]" />'
new_badge = """<div className="flex items-center gap-1">
                                <StatusBadge status={booking.status} className="max-w-[70px] truncate px-1.5 py-0.5 text-[9px]" />
                                <TASBookingLifecycleActions booking={booking} compact />
                              </div>"""
if old_badge in scheduler:
    scheduler = replace_once(scheduler, old_badge, new_badge, "scheduler lifecycle action")
elif "<TASBookingLifecycleActions booking={booking} compact />" not in scheduler:
    raise RuntimeError("scheduler status badge anchor missing")

old_note = "Phase 9 is visibility-only: legacy unassigned bookings are never auto-placed, and status/rescheduling actions arrive in Phase 10."
new_note = "Phase 10 lifecycle actions are active. Legacy unassigned bookings are still never auto-placed, and drag/drop rescheduling remains disabled."
scheduler = scheduler.replace(old_note, new_note)
old_note_ar = "Phase 9 عرض تشغيلي فقط: الحجوزات القديمة غير المعيّنة لا يتم توزيعها تلقائيًا، وتغيير الحالة أو إعادة الجدولة سيأتي في Phase 10."
new_note_ar = "Phase 10 فعّلت دورة الحالة وسجل المراجعة. الحجوزات القديمة غير المعيّنة لا يتم توزيعها تلقائيًا، وإعادة الجدولة بالسحب ما زالت معطلة."
scheduler = scheduler.replace(old_note_ar, new_note_ar)
write(scheduler_rel, scheduler)

for rel in [
    "server/services/tasBookingLifecycle.ts",
    "client/src/components/tas/TASBookingLifecycleActions.tsx",
    "scripts/apply-tas-booking-lifecycle-v1.ts",
    "scripts/verify-tas-booking-lifecycle-v1.ts",
    "scripts/rollback-tas-booking-lifecycle-v1.ts",
]:
    copy_payload(rel)

print("PHASE10_SOURCE_TRANSFORM=PASS")
