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
        raise RuntimeError("conflicting existing Phase 9 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)
scheduler_marker = "export const getTASServiceScheduler = async"
if scheduler_marker not in db:
    anchor = "const premiumSlotKey = (value: unknown) => {"
    idx = db.find(anchor)
    if idx < 0:
        raise RuntimeError("premium slot anchor missing")
    snippet = read_file(payload, "snippets/tasDb-service-scheduler-v1.ts.txt").rstrip() + "\n\n"
    db = db[:idx] + snippet + db[idx:]
    write(db_rel, db)

router_rel = "server/routers.ts"
router = read_file(root, router_rel)
if "  getTASServiceScheduler,\n" not in router:
    import_anchor = "  getAvailableTASSlots,\n"
    router = replace_once(
        router,
        import_anchor,
        import_anchor + "  getTASServiceScheduler,\n",
        "scheduler backend import",
    )

route_anchor = "    listAppointments: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getTASAppointments(input ?? {})),\n"
route_insert = route_anchor + """    getScheduler: tasPermissionProcedure.input(tasAnyInput).query(async ({ input }) => getTASServiceScheduler({
      day: input?.day ? new Date(input.day) : new Date(),
      branchId: Number(input?.branchId ?? 0),
    })),
"""
if "    getScheduler: tasPermissionProcedure.input(tasAnyInput)" not in router:
    count = router.count(route_anchor)
    if count != 2:
        raise RuntimeError("scheduler route anchor expected twice, found " + str(count))
    router = router.replace(route_anchor, route_insert)
write(router_rel, router)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)
if "import TASServiceScheduler from '@/components/tas/TASServiceScheduler';" not in page:
    import_anchor = "import TASPremiumBookingFlow from '@/components/tas/TASPremiumBookingFlow';\n"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "import TASServiceScheduler from '@/components/tas/TASServiceScheduler';\n",
        "scheduler UI import",
    )

if "<TASServiceScheduler />" not in page:
    flow_anchor = "        <TASPremiumBookingFlow onCreated={() => appointmentsQ.refetch()} />\n"
    page = replace_once(
        page,
        flow_anchor,
        flow_anchor + "\n        <TASServiceScheduler />\n",
        "scheduler UI placement",
    )
write(page_rel, page)

for rel in [
    "client/src/components/tas/TASServiceScheduler.tsx",
    "scripts/verify-tas-service-scheduler-v1.ts",
]:
    copy_payload(rel)

print("PHASE9_SOURCE_TRANSFORM=PASS")
