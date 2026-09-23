#!/usr/bin/env python3
import shutil
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: source-transform-v2.py <source-root> <payload-root>")

root = Path(sys.argv[1]).resolve()
payload = Path(sys.argv[2]).resolve()

def read(rel: str) -> str:
    p = root / rel
    if not p.is_file():
        raise RuntimeError("missing source file: " + rel)
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
        raise RuntimeError("conflicting existing Phase 3 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

schema_rel = "shared/schema.ts"
schema = read(schema_rel)
if "export const tasServiceBays = mysqlTable(" not in schema:
    anchor = """export type TASBranch = typeof tasBranches.$inferSelect;
export type InsertTASBranch = typeof tasBranches.$inferInsert;

"""
    addition = """export type TASBranch = typeof tasBranches.$inferSelect;
export type InsertTASBranch = typeof tasBranches.$inferInsert;

export const tasServiceBays = mysqlTable("tas_service_bays", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 64 }),
  bayType: varchar("bayType", { length: 64 }).notNull().default("General"),
  capabilitiesJson: json("capabilitiesJson"),
  notes: text("notes"),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: tinyint("isActive").notNull().default(1),
  createdAt: timestamp("createdAt", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_tas_service_bays_branch").on(table.branchId),
  index("idx_tas_service_bays_active").on(table.branchId, table.isActive),
  index("idx_tas_service_bays_sort").on(table.branchId, table.sortOrder, table.id),
]);
export type TASServiceBay = typeof tasServiceBays.$inferSelect;
export type InsertTASServiceBay = typeof tasServiceBays.$inferInsert;

"""
    schema = replace_once(schema, anchor, addition, "shared/schema.ts branch types")
    write(schema_rel, schema)

db_rel = "server/tasDb.ts"
db = read(db_rel)
if "export const listTASServiceBays" not in db:
    anchor = "export const getAvailableTASSlots = async (input: { day: Date; branchId?: number; serviceTypeId?: number }) => {"
    addition = """const TAS_SERVICE_BAY_TYPES = new Set(["General", "QuickLube", "Mechanical", "Electrical", "Inspection", "BodyPaint", "Other"]);

const normalizeBayCapabilities = (value: unknown) => {
  let raw = value;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = raw.split(","); }
  }
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((item) => String(item ?? "").trim()).filter(Boolean))).slice(0, 30);
};

const normalizeBayType = (value: unknown) => {
  const candidate = String(value ?? "General").trim();
  return TAS_SERVICE_BAY_TYPES.has(candidate) ? candidate : "Other";
};

export const listTASServiceBays = async (input?: { branchId?: number; includeInactive?: boolean }) => {
  const db = await getDb();
  if (!db) return [];
  const branchId = Number(input?.branchId ?? 0);
  if (branchId > 0) {
    const result = input?.includeInactive
      ? await db.execute(sql`SELECT * FROM tas_service_bays WHERE branchId = ${branchId} ORDER BY isActive DESC, sortOrder ASC, name ASC, id ASC`)
      : await db.execute(sql`SELECT * FROM tas_service_bays WHERE branchId = ${branchId} AND isActive = 1 ORDER BY sortOrder ASC, name ASC, id ASC`);
    return (result as any)[0] ?? [];
  }
  const result = input?.includeInactive
    ? await db.execute(sql`SELECT * FROM tas_service_bays ORDER BY branchId ASC, isActive DESC, sortOrder ASC, name ASC, id ASC`)
    : await db.execute(sql`SELECT * FROM tas_service_bays WHERE isActive = 1 ORDER BY branchId ASC, sortOrder ASC, name ASC, id ASC`);
  return (result as any)[0] ?? [];
};

const assertTASServiceBayBranch = async (db: any, branchId: number) => {
  const rows = await db.execute(sql`SELECT id FROM tas_branches WHERE id = ${branchId} LIMIT 1`);
  if (!(((rows as any)[0] ?? [])[0])) throw new Error("Branch not found");
};

const assertUniqueTASServiceBayCode = async (db: any, branchId: number, code: string | null, excludeId?: number) => {
  if (!code) return;
  const rows = excludeId
    ? await db.execute(sql`SELECT id FROM tas_service_bays WHERE branchId = ${branchId} AND LOWER(code) = LOWER(${code}) AND id <> ${excludeId} LIMIT 1`)
    : await db.execute(sql`SELECT id FROM tas_service_bays WHERE branchId = ${branchId} AND LOWER(code) = LOWER(${code}) LIMIT 1`);
  if (((rows as any)[0] ?? []).length) throw new Error("Bay code already exists in this branch");
};

export const createTASServiceBay = async (input: AnyRow) => {
  const db = await getDb();
  if (!db) return 0;
  const branchId = Number(input.branchId ?? 0);
  if (!Number.isInteger(branchId) || branchId <= 0) throw new Error("Valid branchId is required");
  await assertTASServiceBayBranch(db, branchId);

  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Bay name is required");
  if (name.length > 120) throw new Error("Bay name is too long");
  const codeRaw = String(input.code ?? "").trim();
  const code = codeRaw ? codeRaw.slice(0, 64) : null;
  await assertUniqueTASServiceBayCode(db, branchId, code);

  const bayType = normalizeBayType(input.bayType);
  const capabilities = normalizeBayCapabilities(input.capabilitiesJson);
  const notesRaw = input.notes == null ? "" : String(input.notes).trim();
  const notes = notesRaw || null;
  const sortOrder = Math.max(-100000, Math.min(100000, Math.trunc(toNumber(input.sortOrder, 0))));
  const isActive = input.isActive === false || input.isActive === 0 ? 0 : 1;

  const result = await db.execute(sql`
    INSERT INTO tas_service_bays (
      branchId, name, code, bayType, capabilitiesJson, notes, sortOrder, isActive
    ) VALUES (
      ${branchId}, ${name}, ${code}, ${bayType}, ${JSON.stringify(capabilities)}, ${notes}, ${sortOrder}, ${isActive}
    )
  `);
  return Number((result as any)[0]?.insertId ?? 0);
};

export const updateTASServiceBay = async (bayId: number, input: AnyRow) => {
  const db = await getDb();
  if (!db) return false;
  if (!Number.isInteger(bayId) || bayId <= 0) throw new Error("Valid bay id is required");

  const existingRows = await db.execute(sql`SELECT * FROM tas_service_bays WHERE id = ${bayId} LIMIT 1`);
  const existing = ((existingRows as any)[0] ?? [])[0];
  if (!existing) throw new Error("Bay not found");

  const branchId = Number(input.branchId ?? existing.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) throw new Error("Valid branchId is required");
  await assertTASServiceBayBranch(db, branchId);

  const name = String(input.name ?? existing.name ?? "").trim();
  if (!name) throw new Error("Bay name is required");
  if (name.length > 120) throw new Error("Bay name is too long");
  const codeRaw = input.code !== undefined ? String(input.code ?? "").trim() : String(existing.code ?? "").trim();
  const code = codeRaw ? codeRaw.slice(0, 64) : null;
  await assertUniqueTASServiceBayCode(db, branchId, code, bayId);

  const bayType = normalizeBayType(input.bayType ?? existing.bayType);
  const capabilities = normalizeBayCapabilities(input.capabilitiesJson ?? existing.capabilitiesJson);
  const notes = input.notes !== undefined ? (String(input.notes ?? "").trim() || null) : (existing.notes ?? null);
  const sortOrder = Math.max(-100000, Math.min(100000, Math.trunc(toNumber(input.sortOrder, existing.sortOrder ?? 0))));
  const isActive = input.isActive === undefined
    ? (Number(existing.isActive) === 1 ? 1 : 0)
    : (input.isActive === false || input.isActive === 0 ? 0 : 1);

  await db.execute(sql`
    UPDATE tas_service_bays
    SET branchId = ${branchId},
        name = ${name},
        code = ${code},
        bayType = ${bayType},
        capabilitiesJson = ${JSON.stringify(capabilities)},
        notes = ${notes},
        sortOrder = ${sortOrder},
        isActive = ${isActive},
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${bayId}
  `);
  return true;
};

""" + anchor
    db = replace_once(db, anchor, addition, "server/tasDb.ts availability anchor")
    write(db_rel, db)

router_rel = "server/routers.ts"
router = read(router_rel)
if "listTASServiceBays" not in router:
    anchor = """  getTASBranches,
  createTASBranch,
  updateTASBranch,
  getTASSparePartRequests,
"""
    addition = """  getTASBranches,
  createTASBranch,
  updateTASBranch,
  listTASServiceBays,
  createTASServiceBay,
  updateTASServiceBay,
  getTASSparePartRequests,
"""
    router = replace_once(router, anchor, addition, "server/routers.ts tasDb import")

if "listBays: tasPermissionProcedure" not in router:
    anchor = """    createType: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASServiceType(input ?? {}) })),
"""
    addition = """    createType: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASServiceType(input ?? {}) })),
    listBays: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => listTASServiceBays({
      branchId: Number(input?.branchId ?? 0) || undefined,
      includeInactive: Boolean(input?.includeInactive),
    })),
    createBay: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASServiceBay(input ?? {}) })),
    updateBay: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASServiceBay(Number(input?.id ?? input?.bayId), input ?? {})),
"""
    count = router.count(anchor)
    if count != 2:
        raise RuntimeError("server/routers.ts service router anchor expected twice, found " + str(count))
    router = router.replace(anchor, addition)
write(router_rel, router)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read(page_rel)
if "TASServiceBaysSettings" not in page:
    import_anchor = "import TASBranchSchedulingSettings from '@/components/tas/TASBranchSchedulingSettings';\n"
    import_addition = import_anchor + "import TASServiceBaysSettings from '@/components/tas/TASServiceBaysSettings';\n"
    page = replace_once(page, import_anchor, import_addition, "TASServicePage import")
    body_anchor = "        <TASBranchSchedulingSettings />\n"
    body_addition = body_anchor + "        <TASServiceBaysSettings />\n"
    page = replace_once(page, body_anchor, body_addition, "TASServicePage settings placement")
    write(page_rel, page)

for rel in [
    "client/src/components/tas/TASServiceBaysSettings.tsx",
    "scripts/apply-tas-service-bays-v1.ts",
    "scripts/verify-tas-service-bays-v1.ts",
    "scripts/rollback-tas-service-bays-v1.ts",
]:
    copy_payload(rel)

print("PHASE3_SOURCE_TRANSFORM=PASS")
