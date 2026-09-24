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
        raise RuntimeError("conflicting existing Phase 7 payload target: " + rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

db_rel = "server/tasDb.ts"
db = read_file(root, db_rel)

if "export const selectTASAutoBayCandidateForLoad" not in db:
    import_anchor = "  createTASServiceBooking,\n"
    if import_anchor in db:
        db = db.replace(import_anchor, "", 1)

    start_anchor = "export const getTASAppointments = async"
    end_anchor = "export const confirmTASAppointmentWorkflow = async"
    start = db.find(start_anchor)
    end = db.find(end_anchor, start)
    if start < 0 or end < 0:
        raise RuntimeError("tasDb appointment block anchors missing")

    snippet = read_file(payload, "snippets/tasDb-auto-bay.ts.txt").rstrip() + "\n\n"
    db = db[:start] + snippet + db[end:]
    write(db_rel, db)

router_rel = "server/routers.ts"
router = read_file(root, router_rel)
old_route = "    createAppointment: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ ctx, input }) => ({ id: await createTASAppointment({ ...(input ?? {}), createdByUserId: ctx.user.id }) })),\n"
new_route = "    createAppointment: tasPermissionProcedure.input(tasAnyInput).mutation(async ({ ctx, input }) => createTASAppointment({ ...(input ?? {}), createdByUserId: ctx.user.id })),\n"
if old_route in router:
    count = router.count(old_route)
    if count != 2:
        raise RuntimeError("createAppointment router anchor expected twice, found " + str(count))
    router = router.replace(old_route, new_route)
elif new_route not in router:
    raise RuntimeError("createAppointment router anchor missing")
write(router_rel, router)

page_rel = "client/src/pages/tas/TASServicePage.tsx"
page = read_file(root, page_rel)

old_success = """  const createAppointment = trpc.tas.service.createAppointment.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم إنشاء موعد الصيانة' : 'Service appointment created');
      appointmentsQ.refetch();
      setForm((prev) => ({ ...prev, customerName: '', customerPhone: '', vehicleBrand: '', vehicleModel: '', vehicleYear: '', serviceNotes: '' }));
    },
"""
new_success = """  const createAppointment = trpc.tas.service.createAppointment.useMutation({
    onSuccess: (data: any) => {
      const assignedBay = data?.bayName || data?.bayCode;
      toast.success(
        assignedBay
          ? (isRTL ? `تم إنشاء الموعد وتعيين Bay: ${assignedBay}` : `Appointment created • Bay: ${assignedBay}`)
          : (isRTL ? 'تم إنشاء الموعد — الفرع يعمل حاليًا بدون Bays نشطة' : 'Appointment created — branch currently uses legacy no-Bay mode'),
      );
      appointmentsQ.refetch();
      setForm((prev) => ({ ...prev, customerName: '', customerPhone: '', vehicleBrand: '', vehicleModel: '', vehicleYear: '', serviceNotes: '' }));
    },
"""
if old_success in page:
    page = replace_once(page, old_success, new_success, "appointment success handler")
elif new_success not in page:
    raise RuntimeError("appointment success handler anchor missing")

old_head = """                      <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'الخدمة' : 'Service'}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'السيارة' : 'Vehicle'}</TableHead>
"""
new_head = """                      <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'الخدمة' : 'Service'}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'Bay / الكوريك' : 'Bay'}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'السيارة' : 'Vehicle'}</TableHead>
"""
if old_head in page:
    page = replace_once(page, old_head, new_head, "appointment table Bay header")
elif new_head not in page:
    raise RuntimeError("appointment table Bay header anchor missing")

old_cell = """                        <TableCell className="text-sm text-zinc-600">{row.serviceTypeName || row.serviceName || `#${row.serviceTypeId}`}</TableCell>
                        <TableCell className="text-sm text-zinc-600">{[row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—'}</TableCell>
"""
new_cell = """                        <TableCell className="text-sm text-zinc-600">{row.serviceTypeName || row.serviceName || `#${row.serviceTypeId}`}</TableCell>
                        <TableCell>
                          {row.bayId ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              {row.bayName || row.bayCode || `Bay #${row.bayId}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-400">
                              {isRTL ? 'غير معيّن' : 'Unassigned'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">{[row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—'}</TableCell>
"""
if old_cell in page:
    page = replace_once(page, old_cell, new_cell, "appointment table Bay cell")
elif new_cell not in page:
    raise RuntimeError("appointment table Bay cell anchor missing")

write(page_rel, page)

copy_payload("scripts/verify-tas-auto-bay-assignment-v1.ts")

print("PHASE7_SOURCE_TRANSFORM=PASS")
