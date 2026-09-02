import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const targetArg = targetIndex >= 0 ? args[targetIndex + 1] : args.find((arg) => !arg.startsWith('--'));
if (!targetArg) {
  console.error('Usage: node apply-tas-rbac-ui-critical-actions-v1.mjs --target <TAS_WORKTREE>');
  process.exit(2);
}

const root = path.resolve(targetArg);
const required = [
  'client/src/lib/tasRbac.ts',
  'client/src/pages/automotive/VehicleCatalogPage.tsx',
  'client/src/pages/tas/TASAdminPage.tsx',
  'client/src/pages/automotive/AutomotiveAdminPage.tsx',
  'client/src/pages/tas/TASConversationsPage.tsx',
  'client/src/pages/tas/TASFinancePage.tsx',
  'client/src/pages/automotive/AutomotiveFinancePage.tsx',
  'client/src/pages/tas/TASOperationsPage.tsx',
  'client/src/pages/automotive/AutomotiveOperationsPage.tsx',
  'client/src/pages/tas/TASSalesPage.tsx',
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`TAS_RBAC_UI_CRITICAL_ACTIONS_APPLY=FAIL missing ${rel}`);
    process.exit(1);
  }
}

const cache = new Map();
function read(rel) {
  if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
  return cache.get(rel);
}
function write(rel, value) { cache.set(rel, value); }
function replaceOnce(rel, from, to, label) {
  const source = read(rel);
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${rel}: missing anchor ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${rel}: non-unique anchor ${label}`);
  write(rel, source.slice(0, first) + to + source.slice(first + from.length));
}
function replaceAll(rel, from, to, expected, label) {
  const source = read(rel);
  const count = source.split(from).length - 1;
  if (count !== expected) throw new Error(`${rel}: expected ${expected} matches for ${label}, found ${count}`);
  write(rel, source.split(from).join(to));
}
function insertAfter(rel, anchor, addition, label) {
  const source = read(rel);
  if (source.includes(addition.trim())) return;
  replaceOnce(rel, anchor, `${anchor}\n${addition}`, label);
}

try {
  // Vehicle Catalog ---------------------------------------------------------
  {
    const f = 'client/src/pages/automotive/VehicleCatalogPage.tsx';
    insertAfter(f, 'import { trpc } from "@/lib/trpc";', 'import { useTasRbac } from "@/lib/tasRbac";', 'VehicleCatalog tasRbac import');
    replaceOnce(
      f,
      '  const { user } = useAuth();\n  const canArchive = ["Admin", "admin", "SalesManager"].includes(String(user?.role || ""));',
      '  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canCreateCatalog = rbac.can("catalog", "create");\n  const canEditCatalog = rbac.can("catalog", "edit");\n  const canDeleteCatalog = rbac.can("catalog", "delete");',
      'VehicleCatalog role gate',
    );
    replaceOnce(f, '<Button onClick={startCreate} className="bg-[#d99400] text-white hover:bg-[#bd7f00]"><Plus size={15} className="me-2"/>{isRTL ? "إضافة سيارة" : "Add vehicle"}</Button>', '{canCreateCatalog ? <Button onClick={startCreate} className="bg-[#d99400] text-white hover:bg-[#bd7f00]"><Plus size={15} className="me-2"/>{isRTL ? "إضافة سيارة" : "Add vehicle"}</Button> : null}', 'VehicleCatalog add button');
    replaceOnce(f, '<Button variant="outline" disabled={isDemoVehicle(v)} onClick={()=>startEdit(v)}>', '<Button variant="outline" disabled={isDemoVehicle(v) || !canEditCatalog} hidden={!canEditCatalog} onClick={()=>startEdit(v)}>', 'VehicleCatalog edit button');
    replaceOnce(f, '<label className={`inline-flex items-center justify-center rounded-md border px-3 text-sm font-medium ${isDemoVehicle(v) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50"}`}><ImagePlus size={14} className="me-2"/>{uploading ? (isRTL ? "جاري الرفع" : "Uploading") : (isRTL ? "رفع صور" : "Upload images")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isDemoVehicle(v)} onChange={e=>uploadImages(v,e.target.files)}/></label>', '{canCreateCatalog ? <label className={`inline-flex items-center justify-center rounded-md border px-3 text-sm font-medium ${isDemoVehicle(v) ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50"}`}><ImagePlus size={14} className="me-2"/>{uploading ? (isRTL ? "جاري الرفع" : "Uploading") : (isRTL ? "رفع صور" : "Upload images")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isDemoVehicle(v) || !canCreateCatalog} onChange={e=>uploadImages(v,e.target.files)}/></label> : null}', 'VehicleCatalog upload image');
    replaceOnce(f, '<button title="Primary" onClick={async()=>{await setPrimaryImage.mutateAsync({vehicleId:v.id,imageId:img.id});await refresh();}} className="text-white"><Star size={13} fill={img.isPrimary ? "currentColor" : "none"}/></button>', '{canEditCatalog ? <button title="Primary" onClick={async()=>{await setPrimaryImage.mutateAsync({vehicleId:v.id,imageId:img.id});await refresh();}} className="text-white"><Star size={13} fill={img.isPrimary ? "currentColor" : "none"}/></button> : null}', 'VehicleCatalog primary image');
    replaceOnce(f, '<button title="Remove" onClick={async()=>{await removeImage.mutateAsync({vehicleId:v.id,imageId:img.id});await refresh();}} className="text-red-300"><Trash2 size={13}/></button>', '{canDeleteCatalog ? <button title="Remove" onClick={async()=>{await removeImage.mutateAsync({vehicleId:v.id,imageId:img.id});await refresh();}} className="text-red-300"><Trash2 size={13}/></button> : null}', 'VehicleCatalog remove image');
    replaceAll(f, 'canArchive &&', 'canDeleteCatalog &&', 1, 'VehicleCatalog archive gate');
  }

  // TAS Admin ---------------------------------------------------------------
  {
    const f = 'client/src/pages/tas/TASAdminPage.tsx';
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", 'TASAdmin tasRbac import');
    replaceOnce(f, "  const { user } = useAuth();\n  const isAdmin = ['Admin', 'admin'].includes(user?.role || '');", "  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canCreateCatalog = rbac.can('catalog', 'create');\n  const canCreateAdmin = rbac.can('admin', 'create');\n  const canCreateFinance = rbac.can('finance', 'create');\n  const canCreateService = rbac.can('service', 'create');\n  const canViewIntegrations = rbac.can('integrations', 'view');\n  const canEditIntegrations = rbac.can('integrations', 'edit');\n  const hasAnyAdminWrite = canCreateCatalog || canCreateAdmin || canCreateFinance || canCreateService || canEditIntegrations;", 'TASAdmin role gate');
    replaceAll(f, '{ enabled: isAdmin }', '{ enabled: canViewIntegrations }', 2, 'TASAdmin integration reads');
    replaceOnce(f, '{!isAdmin ? (', '{!hasAnyAdminWrite ? (', 'TASAdmin warning');
    replaceOnce(f, 'disabled={!isAdmin || createVehicle.isPending || !vehicle.brand || !vehicle.model}', 'disabled={!canCreateCatalog || createVehicle.isPending || !vehicle.brand || !vehicle.model} hidden={!canCreateCatalog}', 'TASAdmin create vehicle');
    replaceOnce(f, 'disabled={!isAdmin || createBranch.isPending || !branch.name}', 'disabled={!canCreateAdmin || createBranch.isPending || !branch.name} hidden={!canCreateAdmin}', 'TASAdmin create branch');
    replaceOnce(f, 'disabled={!isAdmin || createProgram.isPending || !program.bankName || !program.programName}', 'disabled={!canCreateFinance || createProgram.isPending || !program.bankName || !program.programName} hidden={!canCreateFinance}', 'TASAdmin create finance');
    replaceOnce(f, 'disabled={!isAdmin || createType.isPending || !serviceType.name}', 'disabled={!canCreateService || createType.isPending || !serviceType.name} hidden={!canCreateService}', 'TASAdmin create service');
    replaceOnce(f, 'disabled={!isAdmin || upsertIntegration.isPending || !integration.integrationName}', 'disabled={!canEditIntegrations || upsertIntegration.isPending || !integration.integrationName} hidden={!canEditIntegrations}', 'TASAdmin integration edit');
  }

  // Automotive Admin --------------------------------------------------------
  {
    const f = 'client/src/pages/automotive/AutomotiveAdminPage.tsx';
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", 'AutomotiveAdmin tasRbac import');
    replaceOnce(f, "  const { user } = useAuth();\n  const isAdmin = ['Admin', 'admin'].includes(user?.role || '');", "  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canViewCatalog = rbac.can('catalog', 'view');\n  const canCreateCatalog = rbac.can('catalog', 'create');\n  const canEditCatalog = rbac.can('catalog', 'edit');\n  const canCreateAdmin = rbac.can('admin', 'create');\n  const canCreateFinance = rbac.can('finance', 'create');\n  const canCreateService = rbac.can('service', 'create');\n  const canViewIntegrations = rbac.can('integrations', 'view');\n  const canEditIntegrations = rbac.can('integrations', 'edit');\n  const hasAnyAdminWrite = canCreateCatalog || canEditCatalog || canCreateAdmin || canCreateFinance || canCreateService || canEditIntegrations;", 'AutomotiveAdmin role gate');
    replaceOnce(f, '{ activeOnly: false }, { enabled: isAdmin }', '{ activeOnly: false }, { enabled: canViewCatalog }', 'AutomotiveAdmin brand view');
    replaceAll(f, '{ enabled: isAdmin }', '{ enabled: canViewIntegrations }', 2, 'AutomotiveAdmin integration reads');
    replaceOnce(f, '{!isAdmin ? (', '{!hasAnyAdminWrite ? (', 'AutomotiveAdmin warning');
    replaceOnce(f, 'disabled={!isAdmin || createVehicleBrand.isPending || !vehicleBrand.code.trim() || !vehicleBrand.nameEn.trim()}', 'disabled={!canCreateCatalog || createVehicleBrand.isPending || !vehicleBrand.code.trim() || !vehicleBrand.nameEn.trim()} hidden={!canCreateCatalog}', 'AutomotiveAdmin create brand');
    replaceOnce(f, 'disabled={!isAdmin || updateVehicleBrand.isPending}', 'disabled={!canEditCatalog || updateVehicleBrand.isPending}', 'AutomotiveAdmin update brand');
    replaceOnce(f, 'disabled={!isAdmin || createVehicle.isPending || !vehicle.brand || !vehicle.model}', 'disabled={!canCreateCatalog || createVehicle.isPending || !vehicle.brand || !vehicle.model} hidden={!canCreateCatalog}', 'AutomotiveAdmin create vehicle');
    replaceOnce(f, 'disabled={!isAdmin || createBranch.isPending || !branch.name}', 'disabled={!canCreateAdmin || createBranch.isPending || !branch.name} hidden={!canCreateAdmin}', 'AutomotiveAdmin create branch');
    replaceOnce(f, 'disabled={!isAdmin || createProgram.isPending || !program.bankName || !program.programName}', 'disabled={!canCreateFinance || createProgram.isPending || !program.bankName || !program.programName} hidden={!canCreateFinance}', 'AutomotiveAdmin create finance');
    replaceOnce(f, 'disabled={!isAdmin || createType.isPending || !serviceType.name}', 'disabled={!canCreateService || createType.isPending || !serviceType.name} hidden={!canCreateService}', 'AutomotiveAdmin create service');
    replaceOnce(f, 'disabled={!isAdmin || upsertIntegration.isPending || !integration.integrationName}', 'disabled={!canEditIntegrations || upsertIntegration.isPending || !integration.integrationName} hidden={!canEditIntegrations}', 'AutomotiveAdmin integration edit');
  }

  // Conversations -----------------------------------------------------------
  {
    const f = 'client/src/pages/tas/TASConversationsPage.tsx';
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", 'TASConversations tasRbac import');
    replaceOnce(f, "  const { user } = useAuth();\n  const role = String(user?.role ?? 'SalesAgent');\n  const canCreateSalesHandover = ['Admin', 'admin', 'SalesManager', 'SalesAgent', 'LeadDispatcher'].includes(role);", "  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canEditConversations = rbac.can('conversations', 'edit');\n  const canCreateConversations = rbac.can('conversations', 'create');\n  const canCreateSalesHandover = rbac.can('sales', 'create');", 'TASConversations role gate');
    replaceOnce(f, 'disabled={updateStatus.isPending} onClick={() => updateStatus.mutate', 'disabled={!canEditConversations || updateStatus.isPending} hidden={!canEditConversations} onClick={() => updateStatus.mutate', 'TASConversations update status');
    replaceOnce(f, 'disabled={!reply.trim() || sendManual.isPending} onClick={() => sendManual.mutate', 'disabled={!canCreateConversations || !reply.trim() || sendManual.isPending} hidden={!canCreateConversations} onClick={() => sendManual.mutate', 'TASConversations send reply');
  }

  // Finance pages -----------------------------------------------------------
  for (const f of ['client/src/pages/tas/TASFinancePage.tsx', 'client/src/pages/automotive/AutomotiveFinancePage.tsx']) {
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", `${f} tasRbac import`);
    replaceOnce(f, "  const { user } = useAuth();\n  const isAdmin = ['Admin', 'admin'].includes(user?.role || '');", "  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canCreateFinance = rbac.can('finance', 'create');\n  const canEditFinance = rbac.can('finance', 'edit');", `${f} role gate`);
    replaceOnce(f, '{!isAdmin ? (', '{!canCreateFinance ? (', `${f} create section`);
    replaceOnce(f, 'isAdmin ? (', 'canEditFinance ? (', `${f} edit section`);
  }

  // Operations pages --------------------------------------------------------
  for (const f of ['client/src/pages/tas/TASOperationsPage.tsx', 'client/src/pages/automotive/AutomotiveOperationsPage.tsx']) {
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", `${f} tasRbac import`);
    replaceOnce(f, "  const { user } = useAuth();\n  const isAdmin = ['Admin', 'admin'].includes(user?.role || '');", "  const { isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canViewIntegrations = rbac.can('integrations', 'view');\n  const canEditIntegrations = rbac.can('integrations', 'edit');\n  const canEditSales = rbac.can('sales', 'edit');\n  const canCreateService = rbac.can('service', 'create');", `${f} role gate`);
    replaceAll(f, '{ enabled: isAdmin }', '{ enabled: canViewIntegrations }', 2, `${f} integration reads`);
    replaceOnce(f, 'if (isAdmin) webhookEventsQ.refetch();', 'if (canViewIntegrations) webhookEventsQ.refetch();', `${f} webhook refetch`);
    replaceOnce(f, 'const webhooks = isAdmin ? (webhookEventsQ.data ?? []) : [];', 'const webhooks = canViewIntegrations ? (webhookEventsQ.data ?? []) : [];', `${f} webhook data`);
    replaceOnce(f, 'const envStatus = isAdmin ? (envStatusQ.data ?? {}) : {};', 'const envStatus = canViewIntegrations ? (envStatusQ.data ?? {}) : {};', `${f} env data`);
    replaceOnce(f, '            isAdmin ? (', '            canEditIntegrations ? (', `${f} process queue gate`);
    replaceOnce(f, '        {isAdmin ? (', '        {canViewIntegrations ? (', `${f} integration health gate`);
    replaceOnce(f, 'disabled={updateHandover.isPending}', 'disabled={!canEditSales || updateHandover.isPending} hidden={!canEditSales}', `${f} update handover`);
    replaceOnce(f, "disabled={sendFollowUp.isPending || ['Sent', 'Responded', 'Escalated', 'Closed'].includes(row.status)}", "disabled={!canCreateService || sendFollowUp.isPending || ['Sent', 'Responded', 'Escalated', 'Closed'].includes(row.status)}\n                          hidden={!canCreateService}", `${f} send followup`);
  }

  // TAS Sales ---------------------------------------------------------------
  {
    const f = 'client/src/pages/tas/TASSalesPage.tsx';
    insertAfter(f, "import { trpc } from '@/lib/trpc';", "import { useTasRbac } from '@/lib/tasRbac';", 'TASSales tasRbac import');
    replaceOnce(f, '  const { user } = useAuth();', '  const { user, isAuthenticated } = useAuth();', 'TASSales auth');
    replaceOnce(f, "  const role = String(user?.role ?? 'SalesAgent');", "  const role = String(user?.role ?? 'SalesAgent');\n  const rbac = useTasRbac(isAuthenticated);\n  const canCreateSales = rbac.can('sales', 'create');\n  const canEditSales = rbac.can('sales', 'edit');\n  const canAssignSales = rbac.can('sales', 'assign');\n  const canCreateFinance = rbac.can('finance', 'create');\n  const canEditCatalog = rbac.can('catalog', 'edit');", 'TASSales permissions');
    replaceOnce(f, '  const canManageSalesActions = isAdmin || isSalesManager || isSalesAgent;', '  const canManageSalesActions = canCreateSales || canEditSales;', 'TASSales action tab gate');
    replaceOnce(f, '{isSalesAgent && (', '{isSalesAgent && canEditSales && (', 'TASSales claim own gate');
    replaceOnce(f, 'disabled={claimNextLead.isPending} onClick={() => claimNextLead.mutate({})}', 'disabled={!canEditSales || claimNextLead.isPending} onClick={() => claimNextLead.mutate({})}', 'TASSales claim own action');
    replaceOnce(f, 'disabled={isLeadDispatcher || updateStage.isPending}', 'disabled={!canEditSales || updateStage.isPending} hidden={!canEditSales}', 'TASSales update stage');
    replaceOnce(f, 'disabled={isLeadDispatcher || !selected || !quote.vehiclePrice || createQuote.isPending}', 'disabled={!canCreateSales || !selected || !quote.vehiclePrice || createQuote.isPending} hidden={!canCreateSales}', 'TASSales quote');
    replaceOnce(f, 'disabled={!selected || !testDrive.scheduledAt || createTestDrive.isPending}', 'disabled={!canCreateSales || !selected || !testDrive.scheduledAt || createTestDrive.isPending} hidden={!canCreateSales}', 'TASSales test drive');
    replaceOnce(f, 'disabled={isLeadDispatcher || !selected || !task.title || createTask.isPending}', 'disabled={!canCreateSales || !selected || !task.title || createTask.isPending} hidden={!canCreateSales}', 'TASSales task create');
    replaceOnce(f, 'disabled={isLeadDispatcher || !selected || !tradeIn.currentBrand || !tradeIn.currentModel || createTradeIn.isPending}', 'disabled={!canCreateSales || !selected || !tradeIn.currentBrand || !tradeIn.currentModel || createTradeIn.isPending} hidden={!canCreateSales}', 'TASSales trade-in');
    replaceOnce(f, 'disabled={isLeadDispatcher || !selected || !finance.vehiclePrice || createFinance.isPending}', 'disabled={!canCreateFinance || !selected || !finance.vehiclePrice || createFinance.isPending} hidden={!canCreateFinance}', 'TASSales finance application');
    replaceOnce(f, '<Button size="sm" variant="outline" className="mt-3 rounded-lg" onClick={() => completeTask.mutate', '<Button size="sm" variant="outline" className="mt-3 rounded-lg" disabled={!canEditSales || completeTask.isPending} hidden={!canEditSales} onClick={() => completeTask.mutate', 'TASSales complete task');
    replaceOnce(f, 'disabled={!isAdmin || !inventory.vehicleId || saveInventory.isPending}', 'disabled={!canEditCatalog || !inventory.vehicleId || saveInventory.isPending} hidden={!canEditCatalog}', 'TASSales inventory');
    replaceOnce(f, 'disabled={!dispatcherLead.phone || createDispatcherLead.isPending}', 'disabled={!canCreateSales || !dispatcherLead.phone || createDispatcherLead.isPending} hidden={!canCreateSales}', 'TASSales dispatcher create');
    replaceOnce(f, 'disabled={assignee === \'none\' || assignDispatcherLead.isPending}', 'disabled={!canAssignSales || assignee === \'none\' || assignDispatcherLead.isPending} hidden={!canAssignSales}', 'TASSales assign');
    replaceOnce(f, 'disabled={assignee === \'none\' || Number(assignee) === Number(lead.ownerId) || reassignDispatcherLead.isPending}', 'disabled={!canAssignSales || assignee === \'none\' || Number(assignee) === Number(lead.ownerId) || reassignDispatcherLead.isPending} hidden={!canAssignSales}', 'TASSales reassign');
    replaceOnce(f, 'disabled={!selectedQueueAgentIds.length || claimNextLead.isPending}', 'disabled={!canEditSales || !selectedQueueAgentIds.length || claimNextLead.isPending} hidden={!canEditSales}', 'TASSales batch claim');
  }

  for (const [rel, source] of cache.entries()) {
    fs.writeFileSync(path.join(root, rel), source, 'utf8');
    console.log(`PATCH ${rel}`);
  }

  const verifierSource = `import fs from 'node:fs';\nimport path from 'node:path';\n\nconst root = process.cwd();\nconst checks = [\n  ['client/src/pages/automotive/VehicleCatalogPage.tsx', ['useTasRbac', 'rbac.can("catalog", "create")', 'rbac.can("catalog", "edit")', 'rbac.can("catalog", "delete")']],\n  ['client/src/pages/tas/TASAdminPage.tsx', ['useTasRbac', "rbac.can('catalog', 'create')", "rbac.can('admin', 'create')", "rbac.can('finance', 'create')", "rbac.can('service', 'create')", "rbac.can('integrations', 'edit')"]],\n  ['client/src/pages/automotive/AutomotiveAdminPage.tsx', ['useTasRbac', "rbac.can('catalog', 'create')", "rbac.can('catalog', 'edit')", "rbac.can('integrations', 'edit')"]],\n  ['client/src/pages/tas/TASConversationsPage.tsx', ['useTasRbac', "rbac.can('conversations', 'edit')", "rbac.can('conversations', 'create')", "rbac.can('sales', 'create')"]],\n  ['client/src/pages/tas/TASFinancePage.tsx', ['useTasRbac', "rbac.can('finance', 'create')", "rbac.can('finance', 'edit')"]],\n  ['client/src/pages/automotive/AutomotiveFinancePage.tsx', ['useTasRbac', "rbac.can('finance', 'create')", "rbac.can('finance', 'edit')"]],\n  ['client/src/pages/tas/TASOperationsPage.tsx', ['useTasRbac', "rbac.can('integrations', 'edit')", "rbac.can('sales', 'edit')", "rbac.can('service', 'create')"]],\n  ['client/src/pages/automotive/AutomotiveOperationsPage.tsx', ['useTasRbac', "rbac.can('integrations', 'edit')", "rbac.can('sales', 'edit')", "rbac.can('service', 'create')"]],\n  ['client/src/pages/tas/TASSalesPage.tsx', ['useTasRbac', "rbac.can('sales', 'create')", "rbac.can('sales', 'edit')", "rbac.can('sales', 'assign')", "rbac.can('finance', 'create')", "rbac.can('catalog', 'edit')"]],\n];\nlet failed = false;\nfor (const [rel, needles] of checks) {\n  const full = path.join(root, rel);\n  const source = fs.readFileSync(full, 'utf8');\n  for (const needle of needles) {\n    if (!source.includes(needle)) { console.error('MISSING ' + rel + ' :: ' + needle); failed = true; }\n  }\n}\nconst forbidden = [\n  ['client/src/pages/automotive/VehicleCatalogPage.tsx', 'const canArchive = ['],\n  ['client/src/pages/tas/TASConversationsPage.tsx', 'const canCreateSalesHandover = ['],\n  ['client/src/pages/tas/TASFinancePage.tsx', "const isAdmin = ['Admin'"],\n  ['client/src/pages/automotive/AutomotiveFinancePage.tsx', "const isAdmin = ['Admin'"],\n  ['client/src/pages/tas/TASOperationsPage.tsx', "const isAdmin = ['Admin'"],\n  ['client/src/pages/automotive/AutomotiveOperationsPage.tsx', "const isAdmin = ['Admin'"],\n];\nfor (const [rel, needle] of forbidden) {\n  const source = fs.readFileSync(path.join(root, rel), 'utf8');\n  if (source.includes(needle)) { console.error('FORBIDDEN ' + rel + ' :: ' + needle); failed = true; }\n}\nif (failed) process.exit(1);\nconsole.log('TAS_RBAC_UI_CRITICAL_ACTIONS_VERIFY=PASS');\n`;
  const verifierPath = path.join(root, 'scripts/verify-tas-rbac-ui-critical-actions-v1.mjs');
  fs.writeFileSync(verifierPath, verifierSource, 'utf8');
  console.log('ADD scripts/verify-tas-rbac-ui-critical-actions-v1.mjs');
  console.log('TAS_RBAC_UI_CRITICAL_ACTIONS_APPLY=PASS');
} catch (error) {
  console.error(`TAS_RBAC_UI_CRITICAL_ACTIONS_APPLY=FAIL ${error.message}`);
  process.exit(1);
}
