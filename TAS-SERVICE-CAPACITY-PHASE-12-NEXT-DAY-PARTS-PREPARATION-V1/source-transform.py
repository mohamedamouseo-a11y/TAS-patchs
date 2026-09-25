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
        raise RuntimeError("conflicting existing Phase 12 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

# shared/schema.ts
schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if 'mysqlTable("tas_service_booking_item_preparation"' not in schema:
    anchor = "export type InsertTASServiceBookingItem = typeof tasServiceBookingItems.$inferInsert;\n\n"
    block = """export const tasServiceBookingItemPreparation = mysqlTable("tas_service_booking_item_preparation", {
  id: int("id").autoincrement().primaryKey(),
  bookingItemId: int("bookingItemId").notNull(),
  bookingId: int("bookingId").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Pending"),
  preparedQuantity: decimal("preparedQuantity", { precision: 10, scale: 3 }).notNull().default("0.000"),
  notes: text("notes"),
  updatedByUserId: int("updatedByUserId"),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ux_tas_booking_item_preparation_item").on(table.bookingItemId),
  index("idx_tas_booking_item_preparation_booking").on(table.bookingId, table.status, table.bookingItemId),
  index("idx_tas_booking_item_preparation_status").on(table.status, table.updatedAt),
]);
export type TASServiceBookingItemPreparation = typeof tasServiceBookingItemPreparation.$inferSelect;
export type InsertTASServiceBookingItemPreparation = typeof tasServiceBookingItemPreparation.$inferInsert;

"""
    schema = replace_once(schema, anchor, anchor + block, "parts preparation schema")
    write(schema_rel, schema)

# server/tasDb.ts
db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
if "export const getTASPartsPreparationBoard = async" not in db:
    anchor = "const snapshotTASMaintenancePackageForBooking = async"
    idx = db.find(anchor)
    if idx < 0:
        raise RuntimeError("booking snapshot anchor missing")
    snippet = read_file(payload, "snippets/tasDb-parts-preparation-v1.ts.txt").rstrip() + "\n\n"
    db = db[:idx] + snippet + db[idx:]
write(db_rel, db)

# server/routers.ts
router_rel = "server/routers.ts"
router = read_file(root, router_rel)

import_anchor = "  listTASBookingMaintenanceItems,\n"
import_insert = """  listTASBookingMaintenanceItems,
  getTASPartsPreparationBoard,
  updateTASBookingItemPreparation,
"""
if "  getTASPartsPreparationBoard,\n" not in router:
    router = replace_once(router, import_anchor, import_insert, "parts preparation backend imports")

route_anchor = "    listBookingMaintenanceItems: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => listTASBookingMaintenanceItems(Number(input?.bookingId ?? input?.appointmentId ?? input?.id ?? 0))),\n"
route_insert = route_anchor + """    getPartsPreparationBoard: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getTASPartsPreparationBoard({
      day: input?.day ?? new Date(),
      branchId: Number(input?.branchId ?? 0) || undefined,
    })),
    updateBookingItemPreparation: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ ctx, input }) => updateTASBookingItemPreparation({
      bookingItemId: Number(input?.bookingItemId ?? input?.id ?? 0),
      status: String(input?.status ?? ""),
      preparedQuantity: input?.preparedQuantity == null || input?.preparedQuantity === "" ? undefined : Number(input.preparedQuantity),
      notes: input?.notes ?? null,
      updatedByUserId: ctx.user.id,
    })),
"""
if "    getPartsPreparationBoard: tasPermissionProcedure" not in router:
    count = router.count(route_anchor)
    if count != 2:
        raise RuntimeError("booking maintenance items route anchor expected twice, found " + str(count))
    router = router.replace(route_anchor, route_insert)
write(router_rel, router)

# client service page
page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)

if "TASNextDayPartsPreparation" not in page:
    import_anchor = "import TASServiceScheduler from '@/components/tas/TASServiceScheduler';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASNextDayPartsPreparation from '@/components/tas/TASNextDayPartsPreparation';\n",
        "parts preparation UI import",
    )

placement_anchor = "        <TASServiceScheduler />\n"
if "        <TASNextDayPartsPreparation />\n" not in page:
    page = replace_once(
        page,
        placement_anchor,
        placement_anchor + "\n        <TASNextDayPartsPreparation />\n",
        "parts preparation UI placement",
    )
write(page_rel, page)

for rel in [
    "client/src/components/tas/TASNextDayPartsPreparation.tsx",
    "scripts/apply-tas-parts-preparation-v1.ts",
    "scripts/verify-tas-parts-preparation-v1.ts",
    "scripts/rollback-tas-parts-preparation-v1.ts",
]:
    copy_payload(rel)

print("PHASE12_SOURCE_TRANSFORM=PASS")
