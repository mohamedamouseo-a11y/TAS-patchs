#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(here, "..");
const patchesRoot = path.resolve(patchRoot, "..");
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
if (targetIndex === -1 || !args[targetIndex + 1]) {
  throw new Error("Usage: node scripts/apply-tas-rbac-matrix-enforcement-v4.mjs --target <TAS_TARGET>");
}
const target = path.resolve(args[targetIndex + 1]);

const required = [
  "client/src/App.tsx",
  "client/src/lib/tasRbac.ts",
  "client/src/pages/automotive/VehicleCatalogPage.tsx",
  "client/src/pages/automotive/AutomotiveConversationsPage.tsx",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(target, rel))) throw new Error(`Required TAS file missing: ${rel}`);
}

function read(rel) { return fs.readFileSync(path.join(target, rel), "utf8"); }
function write(rel, content) { fs.writeFileSync(path.join(target, rel), content, "utf8"); }
function replaceOnce(content, from, to, label) {
  if (content.includes(to)) return content;
  if (!content.includes(from)) throw new Error(`Expected anchor not found for ${label}`);
  return content.replace(from, to);
}
function copyNew(srcRel, dstRel) {
  const src = path.join(patchRoot, srcRel);
  const dst = path.join(target, dstRel);
  if (!fs.existsSync(src)) throw new Error(`Patch source missing: ${srcRel}`);
  if (fs.existsSync(dst)) {
    const current = fs.readFileSync(dst, "utf8");
    const incoming = fs.readFileSync(src, "utf8");
    if (current !== incoming) throw new Error(`Refusing to overwrite non-identical existing file: ${dstRel}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// 1) Close audited legacy direct-URL gaps using the already validated V2 patch.
let app = read("client/src/App.tsx");
if (!app.includes("LegacyRouteParityGuard")) {
  const v2Script = path.join(patchesRoot, "TAS-RBAC-Legacy-Route-Parity-V2/scripts/apply-tas-rbac-legacy-route-parity-v2.mjs");
  if (!fs.existsSync(v2Script)) throw new Error("Required sibling patch TAS-RBAC-Legacy-Route-Parity-V2 is missing");
  const result = spawnSync(process.execPath, [v2Script, "--target", target], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Legacy Route Parity V2 application failed");
}

// 2) Install shared live-matrix UI helpers.
copyNew("files/client/src/lib/tasUiPermissions.ts", "client/src/lib/tasUiPermissions.ts");
copyNew("files/client/src/components/TASPermissionAction.tsx", "client/src/components/TASPermissionAction.tsx");

// 3) Catalog: make Create/Edit/Delete UI obey the configured catalog matrix.
let catalog = read("client/src/pages/automotive/VehicleCatalogPage.tsx");
catalog = replaceOnce(
  catalog,
  'import { useAuth } from "@/_core/hooks/useAuth";',
  'import { useTasModuleActions } from "@/lib/tasUiPermissions";',
  "catalog permission import",
);
catalog = replaceOnce(
  catalog,
  '  const { user } = useAuth();\n  const canArchive = ["Admin", "admin", "SalesManager"].includes(String(user?.role || ""));',
  '  const catalogPermissions = useTasModuleActions("catalog");\n  const canCreate = catalogPermissions.create;\n  const canEdit = catalogPermissions.edit;\n  const canDelete = catalogPermissions.delete;',
  "catalog permission state",
);
catalog = replaceOnce(
  catalog,
  '  const startCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };',
  '  const startCreate = () => {\n    if (!canCreate) return toast.error(isRTL ? "ليس لديك صلاحية لإضافة سيارة" : "Missing permission: catalog.create");\n    setEditing(null); setForm(emptyForm); setOpen(true);\n  };',
  "catalog create guard",
);
catalog = replaceOnce(
  catalog,
  '  const startEdit = (v: any) => {\n    if (isDemoVehicle(v)) return toast.error',
  '  const startEdit = (v: any) => {\n    if (!canEdit) return toast.error(isRTL ? "ليس لديك صلاحية لتعديل السيارة" : "Missing permission: catalog.edit");\n    if (isDemoVehicle(v)) return toast.error',
  "catalog edit guard",
);
catalog = replaceOnce(
  catalog,
  '  const save = async () => {\n    if (!form.brandId || !form.model.trim())',
  '  const save = async () => {\n    if (editing && !canEdit) return toast.error(isRTL ? "ليس لديك صلاحية للتعديل" : "Missing permission: catalog.edit");\n    if (!editing && !canCreate) return toast.error(isRTL ? "ليس لديك صلاحية للإضافة" : "Missing permission: catalog.create");\n    if (!form.brandId || !form.model.trim())',
  "catalog save guard",
);
catalog = replaceOnce(
  catalog,
  '  const uploadImages = async (vehicle: any, files: FileList | null) => {\n    if (isDemoVehicle(vehicle))',
  '  const uploadImages = async (vehicle: any, files: FileList | null) => {\n    if (!canEdit) return toast.error(isRTL ? "ليس لديك صلاحية لتعديل صور السيارة" : "Missing permission: catalog.edit");\n    if (isDemoVehicle(vehicle))',
  "catalog image guard",
);
catalog = replaceOnce(
  catalog,
  '      <Button onClick={startCreate} className="bg-[#d99400] text-white hover:bg-[#bd7f00]"><Plus size={15} className="me-2"/>{isRTL ? "إضافة سيارة" : "Add vehicle"}</Button>',
  '      {canCreate && <Button onClick={startCreate} className="bg-[#d99400] text-white hover:bg-[#bd7f00]"><Plus size={15} className="me-2"/>{isRTL ? "إضافة سيارة" : "Add vehicle"}</Button>}',
  "catalog add button",
);
catalog = replaceOnce(
  catalog,
  '          <div className="grid grid-cols-2 gap-2">\n            <Button variant="outline" disabled={isDemoVehicle(v)} onClick={()=>startEdit(v)}><Edit3 size={14} className="me-2"/>{isRTL ? "تعديل" : "Edit"}</Button>\n            <label className={`inline-flex items-center justify-center rounded-md border px-3 text-sm font-medium ${isDemoVehicle(v) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50"}`}><ImagePlus size={14} className="me-2"/>{uploading ? (isRTL ? "جاري الرفع" : "Uploading") : (isRTL ? "رفع صور" : "Upload images")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isDemoVehicle(v)} onChange={e=>uploadImages(v,e.target.files)}/></label>\n          </div>',
  '          {canEdit && <div className="grid grid-cols-2 gap-2">\n            <Button variant="outline" disabled={isDemoVehicle(v)} onClick={()=>startEdit(v)}><Edit3 size={14} className="me-2"/>{isRTL ? "تعديل" : "Edit"}</Button>\n            <label className={`inline-flex items-center justify-center rounded-md border px-3 text-sm font-medium ${isDemoVehicle(v) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50"}`}><ImagePlus size={14} className="me-2"/>{uploading ? (isRTL ? "جاري الرفع" : "Uploading") : (isRTL ? "رفع صور" : "Upload images")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isDemoVehicle(v)} onChange={e=>uploadImages(v,e.target.files)}/></label>\n          </div>}',
  "catalog edit controls",
);
catalog = replaceOnce(
  catalog,
  '{!!v.images?.length && <div className="grid grid-cols-4 gap-2">',
  '{canEdit && !!v.images?.length && <div className="grid grid-cols-4 gap-2">',
  "catalog image controls",
);
catalog = replaceOnce(
  catalog,
  '{canArchive && <Button variant="ghost"',
  '{canDelete && <Button variant="ghost"',
  "catalog delete control",
);
catalog = replaceOnce(
  catalog,
  '<Button onClick={save} className="h-11 min-w-40 rounded-xl bg-[#d99400] px-6 font-black text-white shadow-[0_8px_18px_rgba(217,148,0,.22)] hover:bg-[#bd7f00]" disabled={createVehicle.isPending||updateVehicle.isPending}>',
  '{((editing && canEdit) || (!editing && canCreate)) && <Button onClick={save} className="h-11 min-w-40 rounded-xl bg-[#d99400] px-6 font-black text-white shadow-[0_8px_18px_rgba(217,148,0,.22)] hover:bg-[#bd7f00]" disabled={createVehicle.isPending||updateVehicle.isPending}>',
  "catalog save button open",
);
catalog = replaceOnce(
  catalog,
  '</Button>\n        </DialogFooter>\n      </DialogContent>',
  '</Button>}\n        </DialogFooter>\n      </DialogContent>',
  "catalog save button close",
);
write("client/src/pages/automotive/VehicleCatalogPage.tsx", catalog);

// 4) Conversations: fix the confirmed flat-response crash and make actions use matrix.
let conversations = read("client/src/pages/automotive/AutomotiveConversationsPage.tsx");
conversations = replaceOnce(
  conversations,
  "import { trpc } from '@/lib/trpc';",
  "import { trpc } from '@/lib/trpc';\nimport { useTasModuleActions } from '@/lib/tasUiPermissions';",
  "conversation permission import",
);
conversations = replaceOnce(
  conversations,
  "  const { isRTL } = useLanguage();\n  const listQ",
  "  const { isRTL } = useLanguage();\n  const conversationPermissions = useTasModuleActions('conversations');\n  const listQ",
  "conversation permission state",
);
conversations = replaceOnce(
  conversations,
  "  const selectedMessages = detailsQ.data?.messages ?? [];",
  "  const detailsConversation = (detailsQ.data as any)?.conversation ?? (detailsQ.data as any) ?? null;\n  const selectedMessages = (detailsQ.data as any)?.messages ?? [];",
  "conversation flat response adapter",
);
conversations = replaceOnce(
  conversations,
  "            <SectionCard title={isRTL ? 'رسالة جديدة' : 'Receive inbound'}>",
  "            {conversationPermissions.create && <SectionCard title={isRTL ? 'رسالة جديدة' : 'Receive inbound'}>",
  "conversation create section open",
);
conversations = replaceOnce(
  conversations,
  "            </SectionCard>\n\n            <SectionCard\n              title={isRTL ? 'المحادثات' : 'Conversations'}",
  "            </SectionCard>}\n\n            <SectionCard\n              title={isRTL ? 'المحادثات' : 'Conversations'}",
  "conversation create section close",
);
conversations = replaceOnce(
  conversations,
  "                        setStatus(row.status);",
  "                        setStatus(row?.status || 'Open');",
  "conversation list status guard",
);
conversations = conversations.replaceAll("detailsQ.data.conversation.", "detailsConversation?.");
conversations = replaceOnce(
  conversations,
  "                          disabled={!manualBody || sendManual.isPending}",
  "                          disabled={!conversationPermissions.create || !manualBody || sendManual.isPending}",
  "conversation reply permission",
);
conversations = replaceOnce(
  conversations,
  "                          disabled={updateStatus.isPending}",
  "                          disabled={!conversationPermissions.edit || updateStatus.isPending}",
  "conversation status permission",
);
conversations = replaceOnce(
  conversations,
  "                      disabled={!assignedToUserId || createHandover.isPending}",
  "                      disabled={!conversationPermissions.assign || !assignedToUserId || createHandover.isPending}",
  "conversation assign permission",
);
write("client/src/pages/automotive/AutomotiveConversationsPage.tsx", conversations);

console.log("Applied TAS-RBAC-Matrix-Enforcement-V4");
console.log("Next: run scripts/audit-tas-rbac-matrix-enforcement-v4.mjs --target <TAS_TARGET>");
