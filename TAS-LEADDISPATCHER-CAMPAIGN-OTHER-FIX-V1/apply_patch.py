#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "/var/www/TAS-root").resolve()
admin = root / "client/src/pages/AdminSettings.tsx"
routers = root / "server/routers.ts"

if not admin.is_file() or not routers.is_file():
    raise SystemExit("ERROR=TAS_SOURCE_NOT_FOUND")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR={label}_MATCH_COUNT_{count}")
    return text.replace(old, new, 1)

admin_text = admin.read_text(encoding="utf-8")
routers_text = routers.read_text(encoding="utf-8")

admin_text = replace_once(
    admin_text,
    '''const ROLES = [...APP_USER_ROLES];\n\nfunction normalizeSuperAdminValue(value: unknown) {''',
    '''const ROLES = [...APP_USER_ROLES];\n\ntype CampaignPlatform = "Messages" | "LeadForm" | "Meta" | "Google" | "Snapchat" | "TikTok" | "Other";\n\ntype CampaignFormValues = {\n  name: string;\n  platform: CampaignPlatform;\n  platformOther: string;\n  notes: string;\n  roundRobinEnabled: boolean;\n};\n\nconst CAMPAIGN_PLATFORMS: CampaignPlatform[] = ["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"];\n\nfunction normalizeSuperAdminValue(value: unknown) {''',
    "ADMIN_TYPES",
)

admin_text = replace_once(
    admin_text,
    '''  const { register: campReg, handleSubmit: campSubmit, reset: campReset, setValue: campSetVal } = useForm({\n    defaultValues: { name: "", platform: "Meta" as const, notes: "", roundRobinEnabled: false },\n  });''',
    '''  const {\n    register: campReg,\n    handleSubmit: campSubmit,\n    reset: campReset,\n    setValue: campSetVal,\n    watch: campWatch,\n    formState: { errors: campErrors },\n  } = useForm<CampaignFormValues>({\n    defaultValues: { name: "", platform: "Meta", platformOther: "", notes: "", roundRobinEnabled: false },\n  });\n  const selectedCampaignPlatform = campWatch("platform");''',
    "ADMIN_FORM_STATE",
)

admin_text = replace_once(
    admin_text,
    '''                          <Badge variant="secondary" className="text-xs">{camp.platform}</Badge>''',
    '''                          <Badge variant="secondary" className="text-xs">\n                            {camp.platform === "Other" && camp.platformOther ? camp.platformOther : camp.platform}\n                          </Badge>''',
    "ADMIN_CAMPAIGN_BADGE",
)

admin_text = replace_once(
    admin_text,
    '''          <form onSubmit={campSubmit((data) => createCampaign.mutate(data))} className="space-y-4">\n            <div className="flex flex-col gap-1.5">\n              <Label>{t("name")}</Label>\n              <Input {...campReg("name", { required: true })} className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm" />\n            </div>\n            <div className="flex flex-col gap-1.5">\n              <Label>{t("platform")}</Label>\n              <Select defaultValue="Meta" onValueChange={(v) => campSetVal("platform", v as any)}>\n                <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-zinc-50"><SelectValue /></SelectTrigger>\n                <SelectContent>\n                  {["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"].map((p) => (\n                    <SelectItem key={p} value={p}>{p}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n            <div className="flex items-center gap-2">''',
    '''          <form\n            onSubmit={campSubmit((data) =>\n              createCampaign.mutate({\n                ...data,\n                platformOther: data.platform === "Other" ? data.platformOther.trim() : undefined,\n              })\n            )}\n            className="space-y-4"\n          >\n            <div className="flex flex-col gap-1.5">\n              <Label>{t("name")}</Label>\n              <Input {...campReg("name", { required: true })} className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm" />\n            </div>\n            <div className="flex flex-col gap-1.5">\n              <Label>{t("platform")}</Label>\n              <Select\n                defaultValue="Meta"\n                onValueChange={(v) => {\n                  campSetVal("platform", v as CampaignPlatform, { shouldDirty: true, shouldValidate: true });\n                  if (v !== "Other") {\n                    campSetVal("platformOther", "", { shouldDirty: true, shouldValidate: true });\n                  }\n                }}\n              >\n                <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-zinc-50"><SelectValue /></SelectTrigger>\n                <SelectContent>\n                  {CAMPAIGN_PLATFORMS.map((p) => (\n                    <SelectItem key={p} value={p}>{p}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n            {selectedCampaignPlatform === "Other" && (\n              <div className="flex flex-col gap-1.5">\n                <Label>{isRTL ? "اسم المنصة الأخرى" : "Other platform name"}</Label>\n                <Input\n                  {...campReg("platformOther", {\n                    maxLength: 255,\n                    validate: (value) =>\n                      selectedCampaignPlatform !== "Other" ||\n                      Boolean(value.trim()) ||\n                      (isRTL ? "اكتب اسم المنصة" : "Enter the platform name"),\n                  })}\n                  className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm"\n                  placeholder={isRTL ? "مثال: X أو Telegram" : "e.g. X or Telegram"}\n                  maxLength={255}\n                  autoFocus\n                />\n                {campErrors.platformOther?.message && (\n                  <p className="text-xs text-destructive">{String(campErrors.platformOther.message)}</p>\n                )}\n              </div>\n            )}\n            <div className="flex items-center gap-2">''',
    "ADMIN_OTHER_FIELD",
)

routers_text = replace_once(
    routers_text,
    '''        z.object({\n          name: z.string().min(1),\n          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).default("Meta"),\n          startDate: z.date().optional(),\n          endDate: z.date().optional(),\n          notes: z.string().optional(),\n          roundRobinEnabled: z.boolean().default(false),\n        })\n      )\n      .mutation(({ input }) => createCampaign(input as any)),''',
    '''        z.object({\n          name: z.string().min(1),\n          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).default("Meta"),\n          platformOther: z.string().trim().max(255).optional(),\n          startDate: z.date().optional(),\n          endDate: z.date().optional(),\n          notes: z.string().optional(),\n          roundRobinEnabled: z.boolean().default(false),\n        }).superRefine((data, ctx) => {\n          if (data.platform === "Other" && !data.platformOther?.trim()) {\n            ctx.addIssue({\n              code: "custom",\n              path: ["platformOther"],\n              message: "Custom platform name is required when platform is Other",\n            });\n          }\n        })\n      )\n      .mutation(({ input }) =>\n        createCampaign({\n          ...input,\n          platformOther: input.platform === "Other" ? input.platformOther?.trim() || null : null,\n        } as any)\n      ),''',
    "ROUTER_CAMPAIGN_CREATE",
)

routers_text = replace_once(
    routers_text,
    '''          id: z.number(),\n          name: z.string().optional(),\n          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).optional(),\n          notes: z.string().optional(),''',
    '''          id: z.number(),\n          name: z.string().optional(),\n          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).optional(),\n          platformOther: z.string().trim().max(255).nullable().optional(),\n          notes: z.string().optional(),''',
    "ROUTER_CAMPAIGN_UPDATE",
)

admin.write_text(admin_text, encoding="utf-8")
routers.write_text(routers_text, encoding="utf-8")

print("PATCH_APPLIED=YES")
print("FILES=client/src/pages/AdminSettings.tsx,server/routers.ts")
