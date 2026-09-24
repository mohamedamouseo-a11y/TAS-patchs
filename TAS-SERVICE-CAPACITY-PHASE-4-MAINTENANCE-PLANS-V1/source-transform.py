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
        raise RuntimeError("conflicting existing Phase 4 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if "export const tasMaintenancePlans = mysqlTable(" not in schema:
    anchor = "export type InsertTASServiceBay = typeof tasServiceBays.$inferInsert;\n"
    snippet = read_file(payload, "snippets/schema.ts.txt").rstrip() + "\n"
    schema = replace_once(schema, anchor, anchor + "\n" + snippet, "schema service bay type")
    write(schema_rel, schema)

db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
if "export const listTASMaintenancePlans" not in db:
    anchor = "export const getAvailableTASSlots = async (input: { day: Date; branchId?: number; serviceTypeId?: number }) => {"
    snippet = read_file(payload, "snippets/tasDb.ts.txt").rstrip() + "\n\n"
    db = replace_once(db, anchor, snippet + anchor, "tasDb availability anchor")
    write(db_rel, db)

router_rel = "server/routers.ts"
router = read_file(root, router_rel)
if "listTASMaintenancePlans," not in router:
    anchor = "  updateTASServiceBay,\n"
    snippet = read_file(payload, "snippets/router-import.txt")
    router = replace_once(router, anchor, anchor + snippet, "router tasDb import")

if "listMaintenancePlans: tasPermissionProcedure" not in router:
    anchor = "    updateBay: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ input }) => updateTASServiceBay(Number(input?.id ?? input?.bayId), input ?? {})),\n"
    snippet = read_file(payload, "snippets/router-endpoints.txt")
    count = router.count(anchor)
    if count != 2:
        raise RuntimeError("service router bay anchor expected twice, found " + str(count))
    router = router.replace(anchor, anchor + snippet)
write(router_rel, router)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)
if "TASMaintenancePlansSettings" not in page:
    import_anchor = "import TASServiceBaysSettings from '@/components/tas/TASServiceBaysSettings';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASMaintenancePlansSettings from '@/components/tas/TASMaintenancePlansSettings';\n",
        "service page import",
    )
    body_anchor = "        <TASServiceBaysSettings />\n"
    page = replace_once(
        page,
        body_anchor,
        body_anchor + "        <TASMaintenancePlansSettings />\n",
        "service page placement",
    )
    write(page_rel, page)

for rel in [
    "client/src/components/tas/TASMaintenancePlansSettings.tsx",
    "scripts/apply-tas-maintenance-plans-v1.ts",
    "scripts/verify-tas-maintenance-plans-v1.ts",
    "scripts/rollback-tas-maintenance-plans-v1.ts",
]:
    copy_payload(rel)

print("PHASE4_SOURCE_TRANSFORM=PASS")
