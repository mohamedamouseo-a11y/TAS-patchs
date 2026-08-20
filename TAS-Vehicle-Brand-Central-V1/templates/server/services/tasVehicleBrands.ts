import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { normalizeVehicleBrandPayload, type VehicleBrandInput } from "./tasVehicleBrandContract";

type AnyRow = Record<string, any>;
const rowsOf = (result: any): AnyRow[] => (result as any)?.[0] ?? [];
const oneOf = (result: any): AnyRow | null => rowsOf(result)[0] ?? null;

function normalizeBrandRow(row: AnyRow) {
  let aliases: string[] = [];
  try {
    aliases = Array.isArray(row.aliases) ? row.aliases : JSON.parse(String(row.aliases ?? "[]"));
  } catch {
    aliases = [];
  }
  return {
    ...row,
    id: Number(row.id),
    isActive: Number(row.isActive ?? 1),
    sortOrder: Number(row.sortOrder ?? 0),
    aliases,
  };
}

export async function listTASVehicleBrands(input: { activeOnly?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql`
    SELECT id, code, nameEn, nameAr, aliases, isActive, sortOrder, createdAt, updatedAt
    FROM tas_vehicle_brands
    ${input.activeOnly === false ? sql`` : sql`WHERE isActive = 1`}
    ORDER BY sortOrder ASC, nameEn ASC, id ASC
  `);
  return rowsOf(result).map(normalizeBrandRow);
}

export async function getTASVehicleBrandById(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql`
    SELECT id, code, nameEn, nameAr, aliases, isActive, sortOrder, createdAt, updatedAt
    FROM tas_vehicle_brands
    WHERE id = ${Number(brandId)}
    LIMIT 1
  `);
  const row = oneOf(result);
  return row ? normalizeBrandRow(row) : null;
}

export async function requireActiveTASVehicleBrand(brandId: number) {
  const brand = await getTASVehicleBrandById(Number(brandId));
  if (!brand || Number(brand.isActive) !== 1) {
    throw new Error("Selected vehicle brand is not active");
  }
  return brand;
}

export async function createTASVehicleBrand(input: VehicleBrandInput, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const value = normalizeVehicleBrandPayload(input);
  const duplicate = oneOf(await db.execute(sql`
    SELECT id FROM tas_vehicle_brands
    WHERE code = ${value.code} OR LOWER(nameEn) = LOWER(${value.nameEn})
    LIMIT 1
  `));
  if (duplicate?.id) throw new Error("Vehicle brand already exists");
  const result = await db.execute(sql`
    INSERT INTO tas_vehicle_brands (
      code, nameEn, nameAr, aliases, isActive, sortOrder, createdBy, updatedBy
    ) VALUES (
      ${value.code}, ${value.nameEn}, ${value.nameAr}, ${JSON.stringify(value.aliases)},
      ${value.isActive}, ${value.sortOrder}, ${Number(actorUserId)}, ${Number(actorUserId)}
    )
  `);
  const id = Number((result as any)?.[0]?.insertId ?? 0);
  if (!id) throw new Error("Vehicle brand insert did not return an id");
  return getTASVehicleBrandById(id);
}

export async function updateTASVehicleBrand(
  brandId: number,
  input: VehicleBrandInput,
  actorUserId: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = Number(brandId);
  const current = await getTASVehicleBrandById(id);
  if (!current) throw new Error("Vehicle brand not found");
  const value = normalizeVehicleBrandPayload({
    code: input.code ?? current.code,
    nameEn: input.nameEn ?? current.nameEn,
    nameAr: input.nameAr ?? current.nameAr,
    aliases: input.aliases ?? current.aliases,
    isActive: input.isActive ?? Boolean(current.isActive),
    sortOrder: input.sortOrder ?? current.sortOrder,
  });
  const duplicate = oneOf(await db.execute(sql`
    SELECT id FROM tas_vehicle_brands
    WHERE id <> ${id}
      AND (code = ${value.code} OR LOWER(nameEn) = LOWER(${value.nameEn}))
    LIMIT 1
  `));
  if (duplicate?.id) throw new Error("Vehicle brand code or name already exists");
  await db.execute(sql`
    UPDATE tas_vehicle_brands
    SET code = ${value.code},
        nameEn = ${value.nameEn},
        nameAr = ${value.nameAr},
        aliases = ${JSON.stringify(value.aliases)},
        isActive = ${value.isActive},
        sortOrder = ${value.sortOrder},
        updatedBy = ${Number(actorUserId)},
        updatedAt = NOW()
    WHERE id = ${id}
  `);
  return getTASVehicleBrandById(id);
}
