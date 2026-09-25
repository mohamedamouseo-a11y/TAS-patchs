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
        raise RuntimeError("conflicting existing Phase 11 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

# shared/schema.ts
schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if 'mysqlTable("tas_maintenance_items"' not in schema:
    anchor = "export type InsertTASMaintenanceInterval = typeof tasMaintenanceIntervals.$inferInsert;\n\n"
    block = """export const tasMaintenanceItems = mysqlTable("tas_maintenance_items", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 80 }),
  name: varchar("name", { length: 180 }).notNull(),
  itemType: varchar("itemType", { length: 40 }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull().default("unit"),
  partNumber: varchar("partNumber", { length: 120 }),
  defaultUnitCostEgp: decimal("defaultUnitCostEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  defaultUnitPriceEgp: decimal("defaultUnitPriceEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  defaultVatRatePct: decimal("defaultVatRatePct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  preparationRequired: tinyint("preparationRequired").notNull().default(0),
  notes: text("notes"),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: tinyint("isActive").notNull().default(1),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ux_tas_maintenance_items_code").on(table.code),
  index("idx_tas_maintenance_items_active").on(table.isActive, table.sortOrder, table.id),
  index("idx_tas_maintenance_items_type").on(table.itemType, table.isActive, table.id),
]);
export type TASMaintenanceItem = typeof tasMaintenanceItems.$inferSelect;
export type InsertTASMaintenanceItem = typeof tasMaintenanceItems.$inferInsert;

export const tasMaintenanceIntervalItems = mysqlTable("tas_maintenance_interval_items", {
  id: int("id").autoincrement().primaryKey(),
  intervalId: int("intervalId").notNull(),
  itemId: int("itemId").notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1.000"),
  unitCostEgp: decimal("unitCostEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  unitPriceEgp: decimal("unitPriceEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  vatRatePct: decimal("vatRatePct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  preparationRequired: tinyint("preparationRequired").notNull().default(0),
  notes: text("notes"),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: tinyint("isActive").notNull().default(1),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_tas_maintenance_interval_items_interval").on(table.intervalId, table.isActive, table.sortOrder, table.id),
  index("idx_tas_maintenance_interval_items_item").on(table.itemId, table.isActive, table.id),
  index("idx_tas_maintenance_interval_items_prep").on(table.preparationRequired, table.isActive, table.intervalId),
]);
export type TASMaintenanceIntervalItem = typeof tasMaintenanceIntervalItems.$inferSelect;
export type InsertTASMaintenanceIntervalItem = typeof tasMaintenanceIntervalItems.$inferInsert;

export const tasServiceBookingItems = mysqlTable("tas_service_booking_items", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  intervalItemId: int("intervalItemId"),
  itemId: int("itemId"),
  itemCode: varchar("itemCode", { length: 80 }),
  itemName: varchar("itemName", { length: 180 }).notNull(),
  itemType: varchar("itemType", { length: 40 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull().default("unit"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1.000"),
  unitCostEgp: decimal("unitCostEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  unitPriceEgp: decimal("unitPriceEgp", { precision: 12, scale: 2 }).notNull().default("0.00"),
  vatRatePct: decimal("vatRatePct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  preparationRequired: tinyint("preparationRequired").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_tas_service_booking_items_booking").on(table.bookingId, table.id),
  index("idx_tas_service_booking_items_prep").on(table.preparationRequired, table.bookingId, table.itemId),
  index("idx_tas_service_booking_items_item").on(table.itemId, table.bookingId),
]);
export type TASServiceBookingItem = typeof tasServiceBookingItems.$inferSelect;
export type InsertTASServiceBookingItem = typeof tasServiceBookingItems.$inferInsert;

"""
    schema = replace_once(schema, anchor, anchor + block, "maintenance item schemas")
    write(schema_rel, schema)

# server/tasDb.ts
db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
if "export const listTASMaintenanceItems = async" not in db:
    anchor = "const normalizeMaintenanceMappingText = (value: unknown, max = 120) => {"
    idx = db.find(anchor)
    if idx < 0:
        raise RuntimeError("maintenance mapping anchor missing")
    snippet = read_file(payload, "snippets/tasDb-maintenance-items-costs-v1.ts.txt").rstrip() + "\n\n"
    db = db[:idx] + snippet + db[idx:]

snapshot_anchor = """    const id = Number((result as any)[0]?.insertId ?? 0);
    if (!id) throw new Error("Failed to create service appointment");

    return {
"""
snapshot_replacement = """    const id = Number((result as any)[0]?.insertId ?? 0);
    if (!id) throw new Error("Failed to create service appointment");

    const maintenancePackage = await snapshotTASMaintenancePackageForBooking(tx, {
      bookingId: id,
      maintenanceIntervalId: maintenanceInterval ? Number(maintenanceInterval.id) : null,
    });

    return {
"""
if "const maintenancePackage = await snapshotTASMaintenancePackageForBooking" not in db:
    db = replace_once(db, snapshot_anchor, snapshot_replacement, "booking package snapshot")

return_anchor = """      maintenanceIntervalId: maintenanceInterval ? Number(maintenanceInterval.id) : null,
      startAt: start.toISOString(),
"""
return_replacement = """      maintenanceIntervalId: maintenanceInterval ? Number(maintenanceInterval.id) : null,
      maintenancePackage,
      startAt: start.toISOString(),
"""
if "      maintenancePackage,\n      startAt:" not in db:
    db = replace_once(db, return_anchor, return_replacement, "booking package response")

write(db_rel, db)

# server/routers.ts
router_rel = "server/routers.ts"
router = read_file(root, router_rel)

import_anchor = "  updateTASMaintenanceInterval,\n"
import_insert = """  updateTASMaintenanceInterval,
  listTASMaintenanceItems,
  createTASMaintenanceItem,
  updateTASMaintenanceItem,
  listTASMaintenanceIntervalItems,
  createTASMaintenanceIntervalItem,
  updateTASMaintenanceIntervalItem,
  getTASMaintenanceIntervalPackage,
  listTASBookingMaintenanceItems,
"""
if "  listTASMaintenanceItems,\n" not in router:
    router = replace_once(router, import_anchor, import_insert, "maintenance item backend imports")

route_anchor = "    updateMaintenanceInterval: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASMaintenanceInterval(Number(input?.id ?? input?.intervalId), input ?? {})),\n"
route_insert = route_anchor + """    listMaintenanceItems: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => listTASMaintenanceItems({
      includeInactive: Boolean(input?.includeInactive),
      itemType: input?.itemType ?? null,
    })),
    createMaintenanceItem: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASMaintenanceItem(input ?? {}) })),
    updateMaintenanceItem: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASMaintenanceItem(Number(input?.id ?? input?.itemId), input ?? {})),
    listMaintenanceIntervalItems: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => listTASMaintenanceIntervalItems({
      intervalId: Number(input?.intervalId ?? 0),
      includeInactive: Boolean(input?.includeInactive),
    })),
    createMaintenanceIntervalItem: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASMaintenanceIntervalItem(input ?? {}) })),
    updateMaintenanceIntervalItem: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASMaintenanceIntervalItem(Number(input?.id ?? input?.lineId), input ?? {})),
    getMaintenanceIntervalPackage: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getTASMaintenanceIntervalPackage(Number(input?.intervalId ?? 0))),
    listBookingMaintenanceItems: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => listTASBookingMaintenanceItems(Number(input?.bookingId ?? input?.appointmentId ?? input?.id ?? 0))),
"""
if "    listMaintenanceItems: tasPermissionProcedure" not in router:
    count = router.count(route_anchor)
    if count != 2:
        raise RuntimeError("maintenance interval route anchor expected twice, found " + str(count))
    router = router.replace(route_anchor, route_insert)

write(router_rel, router)

# TAS service page
page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)
if "TASMaintenanceItemsCostsSettings" not in page:
    import_anchor = "import TASMaintenancePlansSettings from '@/components/tas/TASMaintenancePlansSettings';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASMaintenanceItemsCostsSettings from '@/components/tas/TASMaintenanceItemsCostsSettings';\n",
        "maintenance costs UI import",
    )

placement_anchor = "        <TASMaintenancePlansSettings />\n"
if "        <TASMaintenanceItemsCostsSettings />\n" not in page:
    page = replace_once(
        page,
        placement_anchor,
        placement_anchor + "        <TASMaintenanceItemsCostsSettings />\n",
        "maintenance costs UI placement",
    )
write(page_rel, page)

for rel in [
    "client/src/components/tas/TASMaintenanceItemsCostsSettings.tsx",
    "scripts/apply-tas-maintenance-items-costs-v1.ts",
    "scripts/verify-tas-maintenance-items-costs-v1.ts",
    "scripts/rollback-tas-maintenance-items-costs-v1.ts",
]:
    copy_payload(rel)

print("PHASE11_SOURCE_TRANSFORM=PASS")
