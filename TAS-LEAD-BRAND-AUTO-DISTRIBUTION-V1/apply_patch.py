from pathlib import Path

MARKER = "TAS_LEAD_BRAND_AUTO_DISTRIBUTION_V1"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL:{label}:expected_1_found_{count}")
    return text.replace(old, new, 1)


root = Path("/var/www/TAS-root")
client_path = root / "client/src/pages/LeadsList.tsx"
router_path = root / "server/routers.ts"
db_path = root / "server/db.ts"

for p in (client_path, router_path, db_path):
    if not p.exists():
        raise SystemExit(f"PATCH_FAIL:missing:{p}")

client = client_path.read_text()
router = router_path.read_text()
db = db_path.read_text()

if MARKER in client and MARKER in router and MARKER in db:
    print("PATCH_APPLIED=YES")
    print("FILES=client/src/pages/LeadsList.tsx,server/routers.ts,server/db.ts")
    raise SystemExit(0)

# ---------------- client/src/pages/LeadsList.tsx ----------------
if 'from "@/components/ui/switch"' not in client:
    client = replace_once(
        client,
        'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\n',
        'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\nimport { Switch } from "@/components/ui/switch";\n',
        "client_switch_import",
    )

client = replace_once(
    client,
    '  const { data: campaigns } = trpc.campaigns.list.useQuery();\n  const { data: distinctCampaignNames } = trpc.campaigns.distinctNames.useQuery();\n',
    '  const { data: campaigns } = trpc.campaigns.list.useQuery();\n  const { data: vehicleBrands } = trpc.tas.vehicleBrands.list.useQuery({ activeOnly: true });\n  const { data: distinctCampaignNames } = trpc.campaigns.distinctNames.useQuery();\n',
    "client_vehicle_brands_query",
)

client = replace_once(
    client,
    '      campaignName: "",\n      adCreative: "",\n      ownerId: undefined as number | undefined,\n',
    '      campaignName: "",\n      adCreative: "",\n      vehicleBrandId: undefined as number | undefined,\n      autoAssign: false,\n      ownerId: undefined as number | undefined,\n',
    "client_form_defaults",
)

ad_block = '''                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {t("adCreative") || "الإعلان"}
                    </Label>
                    <Input
                      {...register("adCreative")}
                      placeholder={isRTL ? "اسم الإعلان" : "Ad creative name"}
                      className="h-10 rounded-xl border-zinc-200 bg-zinc-50 focus:bg-white text-sm transition-colors"
                    />
                  </div>'''
brand_and_ad_block = '''                  {/* TAS_LEAD_BRAND_AUTO_DISTRIBUTION_V1 */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {isRTL ? "ماركة السيارة" : "Vehicle Brand"}
                    </Label>
                    <Select
                      value={watch("vehicleBrandId") != null ? String(watch("vehicleBrandId")) : "none"}
                      onValueChange={(v) => setValue("vehicleBrandId", v === "none" ? undefined : Number(v), { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm">
                        <SelectValue placeholder={isRTL ? "اختر الماركة" : "Select vehicle brand"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {vehicleBrands?.map((brand: any) => (
                          <SelectItem key={brand.id} value={String(brand.id)}>
                            {isRTL ? (brand.nameAr || brand.nameEn) : brand.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {t("adCreative") || "الإعلان"}
                    </Label>
                    <Input
                      {...register("adCreative")}
                      placeholder={isRTL ? "اسم الإعلان" : "Ad creative name"}
                      className="h-10 rounded-xl border-zinc-200 bg-zinc-50 focus:bg-white text-sm transition-colors"
                    />
                  </div>'''
client = replace_once(client, ad_block, brand_and_ad_block, "client_brand_select")

assignment_old = '''                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("owner")}</Label>
                      <Select value={watch("ownerId") != null ? String(watch("ownerId")) : undefined} onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v), { shouldDirty: true })}>'''
assignment_new = '''                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div>
                        <Label className="text-sm font-semibold">{isRTL ? "توزيع تلقائي" : "Automatic Distribution"}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isRTL ? "توزيع العميل تلقائياً على موظفي المبيعات بنظام Round Robin" : "Assign this lead automatically to Sales Agents using round-robin"}
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(watch("autoAssign"))}
                        onCheckedChange={(checked) => {
                          setValue("autoAssign", checked, { shouldDirty: true });
                          if (checked) setValue("ownerId", undefined, { shouldDirty: true });
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("owner")}</Label>
                      <Select disabled={Boolean(watch("autoAssign"))} value={watch("ownerId") != null ? String(watch("ownerId")) : undefined} onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v), { shouldDirty: true })}>'''
client = replace_once(client, assignment_old, assignment_new, "client_auto_assign_ui")

# ---------------- server/routers.ts ----------------
router = replace_once(
    router,
    'import { createTASVehicleBrand, listTASVehicleBrands, updateTASVehicleBrand } from "./services/tasVehicleBrands";\n',
    'import { createTASVehicleBrand, listTASVehicleBrands, requireActiveTASVehicleBrand, updateTASVehicleBrand } from "./services/tasVehicleBrands";\n',
    "router_brand_import",
)

router = replace_once(
    router,
    '          adCreative: z.string().optional(),\n          ownerId: z.number().optional(),\n          stage: z.string().default("New"),\n',
    '          adCreative: z.string().optional(),\n          vehicleBrandId: z.number().int().positive().optional(),\n          autoAssign: z.boolean().optional().default(false),\n          ownerId: z.number().optional(),\n          stage: z.string().default("New"),\n',
    "router_create_input",
)

mutation_old = '''      .mutation(async ({ ctx, input }) => {
        let ownerId = input.ownerId;

        // SalesAgent ownership is always forced server-side to the logged-in user.
        // Managers/Admins may explicitly choose another owner.
        if (isSalesAgentRole(ctx.user.role)) {
          ownerId = ctx.user.id;
        } else if (!ownerId) {
          ownerId = ctx.user.id;
        }

        // ── Duplicate phone check ──
        const normalizedPhone = normalizePhone(input.phone);
        const conflict = await getLeadConflictByPhone(normalizedPhone);
        if (conflict) {
          const isSameAgent = conflict.ownerId === ctx.user.id;
          throw new TRPCError({
            code: "CONFLICT",
            message: isSameAgent
              ? "هذا الرقم مسجل عندك بالفعل"
              : "هذا الرقم موجود بالفعل في النظام ولا يمكن إنشاء سجل مكرر",
          });
        }

        const sourceMetadata = {
          source: "Manual Lead",
          entryMethod: "manual_add_lead",
          createdByUserId: ctx.user.id,
          createdByUserName: ctx.user.name ?? null,
          createdByUserRole: ctx.user.role,
        };
        const id = await createLead({ ...input, ownerId, sourceMetadata } as any);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "create",
          entityType: "leads",
          entityId: id,
          entityName: input.name || input.phone,
          details: sourceMetadata,
        });
        return { id };
      }),'''
mutation_new = '''      .mutation(async ({ ctx, input }) => {
        let ownerId = input.ownerId;

        // TAS_LEAD_BRAND_AUTO_DISTRIBUTION_V1
        // SalesAgent ownership stays self-owned. Dispatcher/Admin/Manager can
        // either choose an owner manually or request an explicit round-robin assignment.
        if (isSalesAgentRole(ctx.user.role)) {
          ownerId = ctx.user.id;
        } else if (input.autoAssign) {
          if (!input.campaignName) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is required for automatic distribution" });
          }
          ownerId = await assignLeadRoundRobin(input.campaignName, true);
          if (!ownerId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Automatic distribution is unavailable because no active Sales Agent was found" });
          }
        } else if (!ownerId) {
          ownerId = ctx.user.id;
        }

        // ── Duplicate phone check ──
        const normalizedPhone = normalizePhone(input.phone);
        const conflict = await getLeadConflictByPhone(normalizedPhone);
        if (conflict) {
          const isSameAgent = conflict.ownerId === ctx.user.id;
          throw new TRPCError({
            code: "CONFLICT",
            message: isSameAgent
              ? "هذا الرقم مسجل عندك بالفعل"
              : "هذا الرقم موجود بالفعل في النظام ولا يمكن إنشاء سجل مكرر",
          });
        }

        const vehicleBrand = input.vehicleBrandId
          ? await requireActiveTASVehicleBrand(input.vehicleBrandId)
          : null;
        const sourceMetadata = {
          source: "Manual Lead",
          entryMethod: "manual_add_lead",
          createdByUserId: ctx.user.id,
          createdByUserName: ctx.user.name ?? null,
          createdByUserRole: ctx.user.role,
          autoAssignmentRequested: Boolean(input.autoAssign),
          vehicleBrandId: vehicleBrand?.id ?? null,
          vehicleBrandCode: vehicleBrand?.code ?? null,
          vehicleBrandName: vehicleBrand ? (vehicleBrand.nameAr || vehicleBrand.nameEn) : null,
          vehicleBrandSource: vehicleBrand ? "manual_select" : null,
        };
        const { vehicleBrandId: _vehicleBrandId, autoAssign: _autoAssign, ...leadInput } = input;
        const id = await createLead({ ...leadInput, ownerId, sourceMetadata } as any);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "create",
          entityType: "leads",
          entityId: id,
          entityName: input.name || input.phone,
          details: { ...sourceMetadata, assignedOwnerId: ownerId ?? null },
        });
        return { id, ownerId: ownerId ?? null };
      }),'''
router = replace_once(router, mutation_old, mutation_new, "router_create_mutation")

# ---------------- server/db.ts ----------------
round_robin_old = '''export async function assignLeadRoundRobin(campaignName: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Find campaign
  const campaign = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.name, campaignName), eq(campaigns.roundRobinEnabled, true)))
    .limit(1);

  if (!campaign.length || !campaign[0].roundRobinEnabled) return null;

  // Get active sales agents
  const agents = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "SalesAgent"), eq(users.isActive, true)));

  if (!agents.length) return null;

  const currentIndex = campaign[0].roundRobinIndex % agents.length;
  const assignedAgent = agents[currentIndex];

  // Update round-robin index
  await db
    .update(campaigns)
    .set({ roundRobinIndex: currentIndex + 1 })
    .where(eq(campaigns.id, campaign[0].id));

  return assignedAgent.id;
}'''
round_robin_new = '''// TAS_LEAD_BRAND_AUTO_DISTRIBUTION_V1
export async function assignLeadRoundRobin(campaignName: string, force = false): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Find the campaign. `force` is used only by the explicit Add Lead
  // "Automatic Distribution" toggle; existing callers keep the campaign setting behavior.
  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.name, campaignName))
    .limit(1);

  if (!campaign.length || (!force && !campaign[0].roundRobinEnabled)) return null;

  // Get active sales agents
  const agents = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "SalesAgent"), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(asc(users.id));

  if (!agents.length) return null;

  const currentIndex = campaign[0].roundRobinIndex % agents.length;
  const assignedAgent = agents[currentIndex];

  // Update round-robin index
  await db
    .update(campaigns)
    .set({ roundRobinIndex: currentIndex + 1 })
    .where(eq(campaigns.id, campaign[0].id));

  return assignedAgent.id;
}'''
db = replace_once(db, round_robin_old, round_robin_new, "db_round_robin_force")

client_path.write_text(client)
router_path.write_text(router)
db_path.write_text(db)

print("PATCH_APPLIED=YES")
print("FILES=client/src/pages/LeadsList.tsx,server/routers.ts,server/db.ts")
