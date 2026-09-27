#!/usr/bin/env python3
import shutil
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: source-transform.py <source-root> <payload-root>")

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
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)

def copy_payload(rel: str) -> None:
    src = payload / rel
    dst = root / rel
    if not src.is_file():
        raise RuntimeError("missing payload: " + rel)
    incoming = src.read_bytes()
    if dst.exists():
        if dst.is_file() and dst.read_bytes() == incoming:
            return
        raise RuntimeError("conflicting existing file: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

# server/tasDb.ts
rel = "server/tasDb.ts"
text = read(rel)
old = '''export const getTASServiceTypes = async () => (await listTASServiceTypes()).map((row: AnyRow) => ({
  ...row,
  category: row.category ?? "Other",
  defaultCapacityUnits: row.defaultCapacityUnits ?? row.slotCapacity ?? 1,
  notes: row.notes ?? row.description ?? null,
}));

export const createTASServiceType = async (input: AnyRow) => createServiceTypeRow({
  name: input.name,
  category: input.category ?? 'Other',
  durationMinutes: input.durationMinutes ?? 60,
  slotCapacity: input.defaultCapacityUnits ?? input.slotCapacity ?? 1,
  description: input.notes ?? input.description ?? null,
});

'''
new = '''const TAS_SERVICE_TYPE_CATEGORIES = new Set([
  "PeriodicMaintenance",
  "Mechanical",
  "Electrical",
  "BodyShop",
  "Inspection",
  "Other",
]);

const mapTASServiceType = (row: AnyRow) => ({
  ...row,
  category: row.category ?? "Other",
  defaultCapacityUnits: row.defaultCapacityUnits ?? row.slotCapacity ?? 1,
  notes: row.notes ?? row.description ?? null,
});

const normalizeTASServiceTypeInput = (input: AnyRow, existing?: AnyRow) => {
  const name = String(input.name ?? existing?.name ?? "").trim();
  if (!name) throw new Error("Service type name is required");

  const requestedCategory = String(input.category ?? existing?.category ?? "Other").trim();
  const category = TAS_SERVICE_TYPE_CATEGORIES.has(requestedCategory) ? requestedCategory : "Other";

  const durationMinutes = Math.trunc(toNumber(input.durationMinutes, toNumber(existing?.durationMinutes, 60)));
  if (durationMinutes < 1 || durationMinutes > 1440) {
    throw new Error("Service duration must be between 1 and 1440 minutes");
  }

  const slotCapacity = Math.trunc(toNumber(
    input.defaultCapacityUnits ?? input.slotCapacity,
    toNumber(existing?.slotCapacity, 1),
  ));
  if (slotCapacity < 1 || slotCapacity > 100) {
    throw new Error("Service slot capacity must be between 1 and 100");
  }

  const descriptionValue = input.notes ?? input.description;
  const description = descriptionValue === undefined
    ? (existing?.description ?? null)
    : (String(descriptionValue ?? "").trim() || null);

  const isActive = input.isActive === undefined
    ? (existing ? Number(existing.isActive) === 1 : True)
    : !(input.isActive === false || input.isActive === 0);

  return { name, category, durationMinutes, slotCapacity, description, isActive };
};

export const getTASServiceTypes = async () => (await listTASServiceTypes()).map(mapTASServiceType);

export const getTASServiceTypesAdmin = async () => {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT *
    FROM tas_service_types
    ORDER BY isActive DESC, name ASC, id DESC
  `);
  return (((rows as any)[0] ?? []) as AnyRow[]).map(mapTASServiceType);
};

export const createTASServiceType = async (input: AnyRow) => {
  const normalized = normalizeTASServiceTypeInput(input);
  const id = await createServiceTypeRow({
    name: normalized.name,
    category: normalized.category,
    durationMinutes: normalized.durationMinutes,
    slotCapacity: normalized.slotCapacity,
    description: normalized.description,
  });

  if (id && !normalized.isActive) {
    const db = await getDb();
    if (db) await db.execute(sql`UPDATE tas_service_types SET isActive=0 WHERE id=${id}`);
  }

  return id;
};

export const updateTASServiceType = async (serviceTypeId: number, input: AnyRow) => {
  const db = await getDb();
  if (!db) return false;
  if (!Number.isInteger(serviceTypeId) || serviceTypeId <= 0) {
    throw new Error("Valid service type id is required");
  }

  const rows = await db.execute(sql`SELECT * FROM tas_service_types WHERE id=${serviceTypeId} LIMIT 1`);
  const existing = (((rows as any)[0] ?? []) as AnyRow[])[0];
  if (!existing) throw new Error("Service type not found");

  const normalized = normalizeTASServiceTypeInput(input, existing);

  await db.execute(sql`
    UPDATE tas_service_types
    SET
      name=${normalized.name},
      category=${normalized.category},
      durationMinutes=${normalized.durationMinutes},
      slotCapacity=${normalized.slotCapacity},
      description=${normalized.description},
      isActive=${normalized.isActive ? 1 : 0},
      updatedAt=CURRENT_TIMESTAMP
    WHERE id=${serviceTypeId}
  `);

  return true;
};

'''
# Python boolean typo is intentional only inside TS string? Must be "true".
new = new.replace(" : True)", " : true)")
if "getTASServiceTypesAdmin" not in text:
    text = replace_once(text, old, new, "service type backend")
write(rel, text)

# server/routers.ts
rel = "server/routers.ts"
text = read(rel)
if "  getTASServiceTypesAdmin,\n" not in text:
    text = replace_once(
        text,
        "  getTASServiceTypes,\n  createTASServiceType,\n",
        "  getTASServiceTypes,\n  getTASServiceTypesAdmin,\n  createTASServiceType,\n  updateTASServiceType,\n",
        "service type imports",
    )

if "    listTypesAdmin:" not in text:
    route_anchor = (
        "    listTypes: tasPermissionProcedure.input(tasAnyInput).query(async () => getTASServiceTypes()),\n"
        "    createType: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASServiceType(input ?? {}) })),\n"
    )
    route_replacement = (
        "    listTypes: tasPermissionProcedure.input(tasAnyInput).query(async () => getTASServiceTypes()),\n"
        "    listTypesAdmin: tasPermissionProcedure.input(tasAnyInput).query(async () => getTASServiceTypesAdmin()),\n"
        "    createType: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => ({ id: await createTASServiceType(input ?? {}) })),\n"
        "    updateType: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASServiceType(Number(input?.id ?? input?.serviceTypeId), input ?? {})),\n"
    )
    route_count = text.count(route_anchor)
    if route_count != 2:
        raise RuntimeError(f"service type routes: expected 2 mirrored anchors, found {route_count}")
    text = text.replace(route_anchor, route_replacement)
write(rel, text)

# client page
rel = "client/src/pages/tas/TASServicePage.tsx"
text = read(rel)
if "TASServiceTypesSettings" not in text:
    text = replace_once(
        text,
        "import TASServiceBaysSettings from '@/components/tas/TASServiceBaysSettings';\n",
        "import TASServiceBaysSettings from '@/components/tas/TASServiceBaysSettings';\n"
        "import TASServiceTypesSettings from '@/components/tas/TASServiceTypesSettings';\n",
        "service types UI import",
    )
    text = replace_once(
        text,
        "        <TASBranchSchedulingSettings />\n        <TASServiceBaysSettings />\n",
        "        <TASBranchSchedulingSettings />\n        <TASServiceTypesSettings />\n        <TASServiceBaysSettings />\n",
        "service types UI placement",
    )
write(rel, text)

copy_payload("client/src/components/tas/TASServiceTypesSettings.tsx")

print("SERVICE_TYPES_SETTINGS_SOURCE_TRANSFORM=PASS")
