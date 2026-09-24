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
        raise RuntimeError("conflicting existing Phase 6 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

schema_rel = "shared/schema.ts"
schema = read_file(root, schema_rel)
if 'bayId: int("bayId")' not in schema:
    field_anchor = '  serviceTypeId: int(),\n'
    schema = replace_once(
        schema,
        field_anchor,
        field_anchor + '  bayId: int("bayId"),\n',
        "service booking bayId field",
    )
    index_anchor = '  index("idx_service_bookings_leadId").on(table.leadId),\n'
    schema = replace_once(
        schema,
        index_anchor,
        index_anchor + '  index("idx_service_bookings_bayId").on(table.bayId),\n',
        "service booking bayId index",
    )
    write(schema_rel, schema)

db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
marker = "export const getAvailableTASSlots = async (input:"
start = db.find(marker)
if start < 0:
    raise RuntimeError("availability function start anchor missing")
end_marker = "\nexport const getTASSparePartRequests"
end = db.find(end_marker, start)
if end < 0:
    raise RuntimeError("availability function end anchor missing")
snippet = read_file(payload, "snippets/tasDb-availability-v2.ts.txt").rstrip()
if "engineVersion: 2" not in db[start:end]:
    db = db[:start] + snippet + "\n" + db[end:]
    write(db_rel, db)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)
if "TASAvailabilityEngineV2Panel" not in page:
    import_anchor = "import TASMaintenanceVehicleMappingSettings from '@/components/tas/TASMaintenanceVehicleMappingSettings';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASAvailabilityEngineV2Panel from '@/components/tas/TASAvailabilityEngineV2Panel';\n",
        "service page availability import",
    )
    body_anchor = "        <TASMaintenanceVehicleMappingSettings />\n"
    page = replace_once(
        page,
        body_anchor,
        body_anchor + "        <TASAvailabilityEngineV2Panel />\n",
        "service page availability placement",
    )
    write(page_rel, page)

for rel in [
    "client/src/components/tas/TASAvailabilityEngineV2Panel.tsx",
    "scripts/apply-tas-availability-engine-v2.ts",
    "scripts/verify-tas-availability-engine-v2.ts",
    "scripts/rollback-tas-availability-engine-v2.ts",
]:
    copy_payload(rel)

print("PHASE6_SOURCE_TRANSFORM=PASS")
