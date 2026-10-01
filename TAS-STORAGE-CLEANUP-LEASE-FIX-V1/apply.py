#!/usr/bin/env python3
from pathlib import Path
import sys

MARKER = "// TAS_STORAGE_CLEANUP_LEASE_FIX_V1"

def replace_function(text: str, name: str, replacement: str) -> str:
    needle = f"async function {name}("
    start = text.find(needle)
    if start < 0:
        raise SystemExit(f"ERROR=FUNCTION_NOT_FOUND:{name}")

    brace = text.find("{", start)
    if brace < 0:
        raise SystemExit(f"ERROR=FUNCTION_BODY_NOT_FOUND:{name}")

    depth = 0
    i = brace
    in_single = in_double = in_template = False
    escape = False
    while i < len(text):
        ch = text[i]
        if escape:
            escape = False
            i += 1
            continue
        if ch == "\\":
            escape = True
            i += 1
            continue
        if in_single:
            if ch == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == '"':
                in_double = False
            i += 1
            continue
        if in_template:
            if ch == "`":
                in_template = False
            i += 1
            continue
        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == "`":
            in_template = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                return text[:start] + replacement.rstrip() + "\n" + text[end:]
        i += 1
    raise SystemExit(f"ERROR=FUNCTION_END_NOT_FOUND:{name}")

def patch_file(path: Path):
    text = path.read_text(encoding="utf-8")

    if "TAS_STORAGE_DB_CLOCK_LEASE_FIX_V1" not in text:
        raise SystemExit(f"ERROR=DB_CLOCK_LEASE_FIX_MARKER_MISSING:{path}")

    is_owned = r'''async function isStorageLockOwned(id: number, token: string, generation?: number): Promise<boolean> {
  const [{ getDb }, { globalFileStorageObjects }, { and, eq, gt, sql }] = await Promise.all([
    import("./db.js"),
    import("../drizzle/schema.js"),
    import("drizzle-orm"),
  ]);
  const db = await getDb();
  if (!db) return false;

  const filters = [
    eq(globalFileStorageObjects.id, id),
    eq(globalFileStorageObjects.uploadLockToken, token),
    sql`${globalFileStorageObjects.deletedAt} IS NULL`,
    gt(globalFileStorageObjects.uploadLockExpiresAt, sql`NOW()`),
  ];
  if (generation != null) {
    filters.push(eq(globalFileStorageObjects.generation, generation));
  }

  const rows = await db
    .select({ id: globalFileStorageObjects.id })
    .from(globalFileStorageObjects)
    .where(and(...filters))
    .limit(1);

  return rows.length > 0;
}'''

    claim_cleanup = r'''async function claimStorageObjectForCleanup(
  expected: Pick<StoredObjectRow, "id" | "generation">,
  driveFileId: string,
): Promise<string | null> {
  const token = `cleanup-${crypto.randomBytes(20).toString("hex")}`;
  const [{ getDb }, { sql }] = await Promise.all([import("./db.js"), import("drizzle-orm")]);
  const db = await getDb();
  if (!db) return null;

  const result = await db.execute(sql`
    UPDATE global_file_storage_objects
    SET uploadLockToken = ${token},
        uploadLockExpiresAt = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
    WHERE id = ${expected.id}
      AND generation = ${expected.generation}
      AND deletedAt IS NULL
      AND uploadStatus = 'uploaded'
      AND driveFileId = ${driveFileId}
      AND (
        uploadLockToken IS NULL
        OR uploadLockExpiresAt IS NULL
        OR uploadLockExpiresAt <= NOW()
      )
  `);

  return affectedRows(result) > 0 ? token : null;
}'''

    text = replace_function(text, "isStorageLockOwned", is_owned)
    text = replace_function(text, "claimStorageObjectForCleanup", claim_cleanup)

    if MARKER not in text:
        anchor = "// TAS_STORAGE_DB_CLOCK_LEASE_FIX_V1"
        text = text.replace(anchor, anchor + "\n" + MARKER, 1)

    path.write_text(text, encoding="utf-8")

for raw in sys.argv[1:]:
    patch_file(Path(raw))

print("SOURCE_PATCH=PASS")
