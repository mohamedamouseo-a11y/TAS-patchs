#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const sourceRoot = path.resolve(valueOf("--source", process.cwd()));
const outputPatch = path.resolve(valueOf("--output", path.join(process.cwd(), "TAS-Vehicle-Brand-Central-V1.atomic.patch")));
const kitRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const templateRoot = path.join(kitRoot, "templates");
const expectedPaths = [
  "client/src/components/settings/VehicleBrandsSettings.tsx",
  "client/src/pages/AdminSettings.tsx",
  "client/src/pages/ImportLeads.tsx",
  "server/automotiveCatalogCompat.ts",
  "server/routers.ts",
  "server/services/tasExcelCompetitiveQueue.ts",
  "server/services/tasVehicleBrandContract.test.ts",
  "server/services/tasVehicleBrandContract.ts",
  "server/services/tasVehicleBrands.ts",
].sort();

const fail = (message) => { throw new Error(`[TAS Vehicle Brand Central V1] ${message}`); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (root, rel, text) => {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
};
const replaceOnce = (text, oldValue, newValue, label) => {
  const first = text.indexOf(oldValue);
  if (first < 0) fail(`anchor not found: ${label}`);
  if (text.indexOf(oldValue, first + oldValue.length) >= 0) fail(`anchor is not unique: ${label}`);
  return text.slice(0, first) + newValue + text.slice(first + oldValue.length);
};
const copyTree = (from, to) => fs.cpSync(from, to, {
  recursive: true,
  filter(src) {
    const base = path.basename(src);
    return !["node_modules", ".git", "dist"].includes(base);
  },
});

if (!fs.existsSync(sourceRoot)) fail(`source root does not exist: ${sourceRoot}`);
const routerSource = read(sourceRoot, "server/routers.ts");
if (!routerSource.includes('from "./services/tasExcelCompetitiveQueueSafe";')) {
  fail("current production router is not using tasExcelCompetitiveQueueSafe; refusing to build a patch that could regress Excel V1");
}
if (routerSource.includes("tasVehicleBrands")) fail("brand central feature appears to be already installed");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tas-brand-v1-"));
const base = path.join(tmp, "base");
const target = path.join(tmp, "target");
copyTree(sourceRoot, base);
copyTree(sourceRoot, target);

for (const rel of [
  "server/services/tasVehicleBrandContract.ts",
  "server/services/tasVehicleBrandContract.test.ts",
  "server/services/tasVehicleBrands.ts",
  "client/src/components/settings/VehicleBrandsSettings.tsx",
]) {
  const src = path.join(templateRoot, rel);
  if (!fs.existsSync(src)) fail(`missing template: ${rel}`);
  write(target, rel, fs.readFileSync(src, "utf8"));
}

// server/routers.ts
{
  const rel = "server/routers.ts";
  let text = read(target, rel);
  text = replaceOnce(text,
    '} from "./services/tasExcelCompetitiveQueueSafe";\n',
    '} from "./services/tasExcelCompetitiveQueueSafe";\nimport { createTASVehicleBrand, listTASVehicleBrands, updateTASVehicleBrand } from "./services/tasVehicleBrands";\n',
    "routers safe Excel import block");
  text = replaceOnce(text,
    '          sourceFileName: z.string().max(255).optional(),\n',
    '          sourceFileName: z.string().max(255).optional(),\n          brandId: z.number().int().positive().optional(),\n',
    "leads.import sourceFileName input");
  text = replaceOnce(text,
    '            sourceFileName: input.sourceFileName ?? null,\n',
    '            sourceFileName: input.sourceFileName ?? null,\n            brandId: input.brandId ?? null,\n',
    "leads.import service payload");
  text = replaceOnce(text,
    'const tasRouter = router({\n',
    `const tasRouter = router({\n  vehicleBrands: router({\n    list: protectedProcedure\n      .input(z.object({ activeOnly: z.boolean().optional() }).optional())\n      .query(async ({ input }) => listTASVehicleBrands({ activeOnly: input?.activeOnly })),\n    create: adminProcedure\n      .input(z.object({\n        code: z.string().min(1).max(64),\n        nameEn: z.string().min(1).max(120),\n        nameAr: z.string().max(120).optional(),\n        aliases: z.array(z.string().max(120)).max(50).optional(),\n        isActive: z.boolean().optional(),\n        sortOrder: z.number().int().min(-100000).max(100000).optional(),\n      }))\n      .mutation(async ({ ctx, input }) => createTASVehicleBrand(input, ctx.user.id)),\n    update: adminProcedure\n      .input(z.object({\n        id: z.number().int().positive(),\n        code: z.string().min(1).max(64),\n        nameEn: z.string().min(1).max(120),\n        nameAr: z.string().max(120).optional(),\n        aliases: z.array(z.string().max(120)).max(50).optional(),\n        isActive: z.boolean().optional(),\n        sortOrder: z.number().int().min(-100000).max(100000).optional(),\n      }))\n      .mutation(async ({ ctx, input }) => updateTASVehicleBrand(input.id, input, ctx.user.id)),\n  }),\n`,
    "tasRouter root");
  write(target, rel, text);
}

// Excel import service: preserve safe wrapper, extend canonical implementation.
{
  const rel = "server/services/tasExcelCompetitiveQueue.ts";
  let text = read(target, rel);
  text = replaceOnce(text,
    '} from "../db";\n',
    '} from "../db";\nimport { assertTASExcelVehicleBrandSelection } from "./tasVehicleBrandContract";\nimport { requireActiveTASVehicleBrand } from "./tasVehicleBrands";\n',
    "Excel queue db import");
  text = replaceOnce(text,
    '  sourceFileName?: string | null;\n};\n',
    '  sourceFileName?: string | null;\n  brandId?: number | null;\n};\n',
    "Excel input type");
  text = replaceOnce(text,
    '  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  if (!Array.isArray(input.leads) || input.leads.length === 0) {\n',
    '  assertTASExcelVehicleBrandSelection(input.sourceFileName, input.brandId);\n  const selectedBrand = input.brandId ? await requireActiveTASVehicleBrand(Number(input.brandId)) : null;\n  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  if (!Array.isArray(input.leads) || input.leads.length === 0) {\n',
    "Excel import brand validation");
  text = replaceOnce(text,
    '        sourceFileName, assignmentMode, selectedAgentIds, totalRows,\n',
    '        sourceFileName, brandId, assignmentMode, selectedAgentIds, totalRows,\n',
    "Excel batch columns");
  text = replaceOnce(text,
    '        ${input.sourceFileName ?? null},\n        ${input.assignmentMode},\n',
    '        ${input.sourceFileName ?? null},\n        ${selectedBrand?.id ?? null},\n        ${input.assignmentMode},\n',
    "Excel batch values");
  text = replaceOnce(text,
    '        assignmentMode: input.assignmentMode,\n      });\n',
    '        assignmentMode: input.assignmentMode,\n        vehicleBrandId: selectedBrand?.id ?? null,\n      });\n',
    "Excel lead source metadata");
  text = replaceOnce(text,
    '      created += 1;\n\n      if (input.assignmentMode === "direct") {\n',
    `      created += 1;\n\n      if (selectedBrand?.id) {\n        await tx.execute(sql\`\n          INSERT INTO tas_lead_vehicle_interests (\n            leadId, brandId, importBatchId, source, isPrimary\n          ) VALUES (\n            \${leadId}, \${Number(selectedBrand.id)}, \${importBatchId}, 'excel_import', 1\n          )\n          ON DUPLICATE KEY UPDATE\n            importBatchId = VALUES(importBatchId),\n            source = VALUES(source),\n            isPrimary = VALUES(isPrimary),\n            updatedAt = NOW()\n        \`);\n      }\n\n      if (input.assignmentMode === "direct") {\n`,
    "Excel lead brand interest insert");
  write(target, rel, text);
}

// ImportLeads UI.
{
  const rel = "client/src/pages/ImportLeads.tsx";
  let text = read(target, rel);
  text = replaceOnce(text,
    '  const { data: campaigns } = trpc.campaigns.list.useQuery();\n  const { data: agents } = trpc.tas.sales.listAssignableSalesAgents.useQuery(undefined);\n  const [selectedCampaign, setSelectedCampaign] = useState<string>("");\n',
    '  const { data: campaigns } = trpc.campaigns.list.useQuery();\n  const { data: agents } = trpc.tas.sales.listAssignableSalesAgents.useQuery(undefined);\n  const { data: vehicleBrands } = trpc.tas.vehicleBrands.list.useQuery({ activeOnly: true });\n  const [selectedCampaign, setSelectedCampaign] = useState<string>("");\n  const [selectedBrandId, setSelectedBrandId] = useState<string>("");\n',
    "ImportLeads queries and brand state");
  text = replaceOnce(text,
    '  const handleImport = () => {\n    const leadsData = rows.map((row) => {\n',
    '  const handleImport = () => {\n    if (!selectedBrandId) {\n      toast.error(isRTL ? "اختر ماركة السيارة قبل بدء الاستيراد" : "Select a vehicle brand before starting the import");\n      return;\n    }\n    const leadsData = rows.map((row) => {\n',
    "ImportLeads required brand guard");
  text = replaceOnce(text,
    '      selectedAgentIds,\n      sourceFileName: fileName,\n',
    '      selectedAgentIds,\n      sourceFileName: fileName,\n      brandId: Number(selectedBrandId),\n',
    "ImportLeads mutation brand payload");

  const marker = '                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>';
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) fail("ImportLeads campaign Select marker missing");
  const gridIndex = text.lastIndexOf('                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">', markerIndex);
  if (gridIndex < 0) fail("ImportLeads campaign grid marker missing");
  text = text.slice(0, gridIndex) + text.slice(gridIndex).replace('md:grid-cols-2', 'md:grid-cols-3');
  const shiftedMarker = text.indexOf(marker);
  const close = text.indexOf('                    </Select>\n                  </div>', shiftedMarker);
  if (close < 0) fail("ImportLeads campaign Select closing marker missing");
  const insertionAt = close + '                    </Select>\n                  </div>'.length;
  const brandUi = `\n                  <div>\n                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">\n                      {isRTL ? "ماركة السيارة *" : "Vehicle Brand *"}\n                    </label>\n                    <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>\n                      <SelectTrigger className="h-9 text-sm border-slate-200">\n                        <SelectValue placeholder={isRTL ? "اختر الماركة..." : "Select brand..."} />\n                      </SelectTrigger>\n                      <SelectContent>\n                        {(vehicleBrands ?? []).map((brand: any) => (\n                          <SelectItem key={brand.id} value={String(brand.id)} className="text-sm">\n                            {isRTL ? (brand.nameAr || brand.nameEn) : brand.nameEn}\n                          </SelectItem>\n                        ))}\n                      </SelectContent>\n                    </Select>\n                    {(vehicleBrands ?? []).length === 0 && (\n                      <p className="text-[11px] text-amber-600 mt-1">\n                        {isRTL ? "أضف ماركة نشطة من الإعدادات أولاً" : "Add an active brand from Settings first"}\n                      </p>\n                    )}\n                  </div>`;
  text = text.slice(0, insertionAt) + brandUi + text.slice(insertionAt);
  write(target, rel, text);
}

// Admin Settings tab.
{
  const rel = "client/src/pages/AdminSettings.tsx";
  let text = read(target, rel);
  text = replaceOnce(text,
    'import { trpc } from "@/lib/trpc";\n',
    'import { trpc } from "@/lib/trpc";\nimport VehicleBrandsSettings from "@/components/settings/VehicleBrandsSettings";\n',
    "AdminSettings trpc import");
  text = replaceOnce(text,
    '    (activeTab === "tara" && !canManageTara)\n      ? "preferences"\n',
    '    (activeTab === "tara" && !canManageTara) ||\n    (activeTab === "brands" && !isAdmin)\n      ? "preferences"\n',
    "AdminSettings safeActiveTab");
  const packagesTrigger = '            {isAdmin && <TabsTrigger value="packages"';
  const triggerIndex = text.indexOf(packagesTrigger);
  if (triggerIndex < 0) fail("AdminSettings packages trigger missing");
  const brandsTrigger = `            {isAdmin && <TabsTrigger value="brands" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">\n              <Package size={13} />\n              <span>{isRTL ? "ماركات السيارات" : "Vehicle Brands"}</span>\n            </TabsTrigger>}\n`;
  const p2 = text.indexOf(packagesTrigger);
  text = text.slice(0, p2) + brandsTrigger + text.slice(p2);
  const preferencesBlock = '          <TabsContent value="preferences" className="mt-4">\n            <NotificationSettingsContent />\n          </TabsContent>\n';
  text = replaceOnce(text,
    preferencesBlock,
    preferencesBlock + '          {isAdmin && <TabsContent value="brands" className="mt-4">\n            <VehicleBrandsSettings />\n          </TabsContent>}\n',
    "AdminSettings preferences content");
  write(target, rel, text);
}

// Automotive catalog compatibility: central brandId for new/updated records while preserving legacy brand text.
{
  const rel = "server/automotiveCatalogCompat.ts";
  let text = read(target, rel);
  text = replaceOnce(text,
    'import { getDb } from "./db";\n',
    'import { getDb } from "./db";\nimport { requireActiveTASVehicleBrand } from "./services/tasVehicleBrands";\n',
    "automotive catalog brand service import");
  text = replaceOnce(text,
    'type VehicleFilters = {\n  brand?: string;\n',
    'type VehicleFilters = {\n  brandId?: number;\n  brand?: string;\n',
    "automotive filters brandId");
  text = replaceOnce(text,
    '  "brand", "model", "trim",',
    '  "brandId", "brand", "model", "trim",',
    "automotive writable columns brandId");
  text = replaceOnce(text,
    '    ...row,\n    id: Number(row.id),\n',
    '    ...row,\n    id: Number(row.id),\n    brandId: row.brandId == null ? null : Number(row.brandId),\n',
    "automotive normalize brandId");
  text = replaceOnce(text,
    '  const conditions: any[] = [];\n  if (filters.brand) conditions.push(sql`brand = ${filters.brand}`);\n',
    '  const conditions: any[] = [];\n  if (filters.brandId) conditions.push(sql`brandId = ${Number(filters.brandId)}`);\n  if (filters.brand) conditions.push(sql`brand = ${filters.brand}`);\n',
    "automotive list brandId filter");
  text = replaceOnce(text,
    '  if (!db) throw new Error("Database not available");\n  const result = await db.execute(sql`\n    INSERT INTO automotive_vehicles (\n      brand, model, trim, modelYear,',
    '  if (!db) throw new Error("Database not available");\n  const centralBrand = data.brandId ? await requireActiveTASVehicleBrand(Number(data.brandId)) : null;\n  const canonicalBrandName = centralBrand?.nameEn ?? data.brand;\n  if (!canonicalBrandName) throw new Error("Vehicle brand is required");\n  const result = await db.execute(sql`\n    INSERT INTO automotive_vehicles (\n      brandId, brand, model, trim, modelYear,',
    "automotive create canonical brand");
  text = replaceOnce(text,
    '    ) VALUES (\n      ${data.brand}, ${data.model}, ${data.trim ?? null},',
    '    ) VALUES (\n      ${centralBrand?.id ?? null}, ${canonicalBrandName}, ${data.model}, ${data.trim ?? null},',
    "automotive create brand values");
  text = replaceOnce(text,
    '  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  const updates: any[] = [];\n  for (const [column, rawValue] of Object.entries({ ...patch, updatedBy: actorUserId })) {\n',
    '  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  const normalizedPatch: AnyRow = { ...patch };\n  if (patch.brandId !== undefined) {\n    if (patch.brandId == null || patch.brandId === "") {\n      normalizedPatch.brandId = null;\n    } else {\n      const centralBrand = await requireActiveTASVehicleBrand(Number(patch.brandId));\n      normalizedPatch.brandId = centralBrand.id;\n      normalizedPatch.brand = centralBrand.nameEn;\n    }\n  }\n  const updates: any[] = [];\n  for (const [column, rawValue] of Object.entries({ ...normalizedPatch, updatedBy: actorUserId })) {\n',
    "automotive update canonical brand");
  write(target, rel, text);
}

// Syntax-only TypeScript/TSX parse for every changed/new app file using the source project's local TypeScript.
const syntaxFiles = expectedPaths.filter((p) => /\.(ts|tsx)$/.test(p));
const syntaxCheck = `
const [projectRoot,...files]=process.argv.slice(1);
let ts;
try {
  const typescriptPath=require.resolve('typescript',{paths:[projectRoot]});
  ts=require(typescriptPath);
} catch (error) {
  console.error('PROJECT_LOCAL_TYPESCRIPT_RESOLUTION_FAILED', error?.code || error?.message || String(error));
  process.exit(3);
}
const fs=require('fs');
for(const f of files){
 const src=fs.readFileSync(f,'utf8');
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true,fileName:f});
 const errors=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length){console.error(f,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')));process.exit(2);}
}
`;
execFileSync(process.execPath, ["-e", syntaxCheck, sourceRoot, ...syntaxFiles.map((rel) => path.join(target, rel))], { stdio: "inherit" });

let diff = "";
try {
  diff = execFileSync("git", ["diff", "--no-index", "--binary", "--unified=3", "--", base, target], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  if (error.status !== 1) throw error;
  diff = String(error.stdout || "");
}
if (!diff.trim()) fail("generated patch is empty");
const esc = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
diff = diff
  .replace(new RegExp(`a/${esc(base.replace(/^\//, ""))}/`, "g"), "a/")
  .replace(new RegExp(`a/${esc(target.replace(/^\//, ""))}/`, "g"), "a/")
  .replace(new RegExp(`b/${esc(base.replace(/^\//, ""))}/`, "g"), "b/")
  .replace(new RegExp(`b/${esc(target.replace(/^\//, ""))}/`, "g"), "b/");
fs.writeFileSync(outputPatch, diff);

const paths = [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((m) => m[1]).sort();
if (JSON.stringify(paths) !== JSON.stringify(expectedPaths)) {
  fail(`unexpected patch paths: ${JSON.stringify(paths)}`);
}
const dry = path.join(tmp, "dry");
copyTree(sourceRoot, dry);
execFileSync("patch", ["--batch", "--forward", "--fuzz=0", "--strip=1", `--directory=${dry}`], {
  input: diff,
  stdio: ["pipe", "inherit", "inherit"],
});
const sha = crypto.createHash("sha256").update(fs.readFileSync(outputPatch)).digest("hex");
console.log(`TAS_VEHICLE_BRAND_PATCH_BUILD=PASS`);
console.log(`PATCH=${outputPatch}`);
console.log(`PATCH_SHA256=${sha}`);
console.log(`PATCH_PATHS=${paths.join(",")}`);
console.log(`PATCH_DRY_RUN=PASS`);
console.log(`SAFE_EXCEL_IMPORT_PRESERVED=YES`);
