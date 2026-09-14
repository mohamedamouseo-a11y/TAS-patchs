from pathlib import Path

ROOT = Path('/var/www/TAS-root')
changed = []

def edit(rel, transforms):
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    original = text
    for label, old, new, marker in transforms:
        if marker and marker in text:
            continue
        if old not in text:
            raise RuntimeError(f'{rel}: cannot find expected source for {label}')
        text = text.replace(old, new, 1)
    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(rel)

edit('client/src/pages/Login.tsx', [
    ('dispatcher login destination',
     '    if (normalized === "LeadDispatcher") return "/tas/sales";',
     '    if (normalized === "LeadDispatcher") return "/leads";',
     'if (normalized === "LeadDispatcher") return "/leads";'),
])

edit('client/src/components/CRMLayout.tsx', [
    ('leads nav role',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"],',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "LeadDispatcher", "MediaBuyer"],',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "LeadDispatcher", "MediaBuyer"],'),
    ('settings nav role',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"],',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "LeadDispatcher", "MediaBuyer", "AccountManager", "AccountManagerLead"],',
     'roles: ["Admin", "admin", "SalesManager", "SalesAgent", "LeadDispatcher", "MediaBuyer", "AccountManager", "AccountManagerLead"],'),
])

edit('client/src/pages/LeadsList.tsx', [
    ('shared LeadDispatcher leads controls',
     '  const isAdminOrManager = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");',
     '  const isAdminOrManager = ["Admin", "SalesManager", "admin", "LeadDispatcher"].includes(user?.role ?? "");',
     '["Admin", "SalesManager", "admin", "LeadDispatcher"].includes(user?.role ?? "")'),
])

edit('client/src/pages/tas/TASSalesPage.tsx', [
    ('remove duplicate dispatcher export',
     "  const canExportLeads = isAdmin || isSalesManager || isLeadDispatcher;",
     "  const canExportLeads = isAdmin || isSalesManager;\n  const canCreateDispatcherLead = isAdmin || isSalesManager;",
     'const canCreateDispatcherLead = isAdmin || isSalesManager;'),
    ('hide duplicate dispatcher manual-add card start',
     "              <SectionCard title={isRTL ? 'إنشاء Lead يدوي' : 'Create manual lead'} subtitle={isRTL ? 'بدون بيع أو إجراءات مالية' : 'No deal or finance actions'} right={<Badge>{isRTL ? 'LeadDispatcher' : 'LeadDispatcher'}</Badge>}>",
     "              {canCreateDispatcherLead && <SectionCard title={isRTL ? 'إنشاء Lead يدوي' : 'Create manual lead'} subtitle={isRTL ? 'بدون بيع أو إجراءات مالية' : 'No deal or finance actions'} right={<Badge>{isRTL ? 'LeadDispatcher' : 'LeadDispatcher'}</Badge>}>",
     "{canCreateDispatcherLead && <SectionCard title={isRTL ? 'إنشاء Lead يدوي'"),
    ('hide duplicate dispatcher manual-add card end',
     "                  <Button className=\"w-full rounded-xl\" disabled={!dispatcherLead.phone || createDispatcherLead.isPending} onClick={() => createDispatcherLead.mutate({ name: dispatcherLead.name || undefined, phone: dispatcherLead.phone, notes: dispatcherLead.notes || undefined, assignedToUserId: dispatcherLead.assignedToUserId === 'none' ? undefined : Number(dispatcherLead.assignedToUserId) })}><UserPlus size={14} className=\"me-2\" />{isRTL ? 'إنشاء Lead' : 'Create lead'}</Button>\n                </div>\n              </SectionCard>",
     "                  <Button className=\"w-full rounded-xl\" disabled={!dispatcherLead.phone || createDispatcherLead.isPending} onClick={() => createDispatcherLead.mutate({ name: dispatcherLead.name || undefined, phone: dispatcherLead.phone, notes: dispatcherLead.notes || undefined, assignedToUserId: dispatcherLead.assignedToUserId === 'none' ? undefined : Number(dispatcherLead.assignedToUserId) })}><UserPlus size={14} className=\"me-2\" />{isRTL ? 'إنشاء Lead' : 'Create lead'}</Button>\n                </div>\n              </SectionCard>}",
     "</SectionCard>}\n\n              <SectionCard\n                title={isRTL ? 'توزيع Queue رقم برقم'"),
])

edit('client/src/pages/AdminSettings.tsx', [
    ('dispatcher campaign permission vars',
     '  const isAdmin = isAdminRole(user?.role ?? "");\n  const isMediaBuyer = isMediaBuyerRole(user?.role ?? "");',
     '  const isAdmin = isAdminRole(user?.role ?? "");\n  const isLeadDispatcher = String(user?.role ?? "").trim() === "LeadDispatcher";\n  const canCreateCampaign = isAdmin || isLeadDispatcher;\n  const isMediaBuyer = isMediaBuyerRole(user?.role ?? "");',
     'const canCreateCampaign = isAdmin || isLeadDispatcher;'),
    ('campaign tab visibility',
     '{isAdmin && <TabsTrigger value="campaigns"',
     '{canCreateCampaign && <TabsTrigger value="campaigns"',
     '{canCreateCampaign && <TabsTrigger value="campaigns"'),
    ('campaign content visibility',
     '{isAdmin && <TabsContent value="campaigns"',
     '{canCreateCampaign && <TabsContent value="campaigns"',
     '{canCreateCampaign && <TabsContent value="campaigns"'),
    ('round robin admin-only switch',
     'checked={camp.roundRobinEnabled ?? false}\n                            onCheckedChange=',
     'checked={camp.roundRobinEnabled ?? false}\n                            disabled={!isAdmin}\n                            onCheckedChange=',
     'checked={camp.roundRobinEnabled ?? false}\n                            disabled={!isAdmin}'),
    ('active admin-only switch',
     'checked={camp.isActive ?? true}\n                            onCheckedChange=',
     'checked={camp.isActive ?? true}\n                            disabled={!isAdmin}\n                            onCheckedChange=',
     'checked={camp.isActive ?? true}\n                            disabled={!isAdmin}'),
    ('campaign delete admin-only',
     '''                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCampaign.mutate({ id: camp.id })}
                          >
                            <Trash2 size={13} />
                          </Button>''',
     '''                          {isAdmin ? <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCampaign.mutate({ id: camp.id })}
                          >
                            <Trash2 size={13} />
                          </Button> : <span className="text-xs text-muted-foreground">—</span>}''',
     '{isAdmin ? <Button\n                            variant="ghost"'),
])

edit('server/tasRbacPolicy.ts', [
    ('dispatcher sales create/export permission',
     'dashboard: read("team"), conversations: read("team"), sales: grant({ view: true, edit: true, assign: true }, "team"), reports: read("team"),',
     'dashboard: read("team"), conversations: read("team"), sales: grant({ view: true, create: true, edit: true, export: true, assign: true }, "team"), reports: read("team"),',
     'sales: grant({ view: true, create: true, edit: true, export: true, assign: true }, "team")'),
])

edit('server/routers.ts', [
    ('dispatcher read shared leads',
     'if (!(isManagerRole(ctx.user.role) || isSalesAgentRole(ctx.user.role) || isMediaBuyerRole(ctx.user.role) || ["ServiceAdvisor", "PartsAgent", "CrmFollowUp", "Viewer"].includes(String(ctx.user.role)))) {',
     'if (!(isManagerRole(ctx.user.role) || isSalesAgentRole(ctx.user.role) || isLeadDispatcherRole(ctx.user.role) || isMediaBuyerRole(ctx.user.role) || ["ServiceAdvisor", "PartsAgent", "CrmFollowUp", "Viewer"].includes(String(ctx.user.role)))) {',
     'isSalesAgentRole(ctx.user.role) || isLeadDispatcherRole(ctx.user.role) || isMediaBuyerRole'),
    ('lead create narrow procedure',
     '''const salesEditProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isManagerRole(ctx.user.role) || isSalesAgentRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sales edit access required" });
  }
  return next({ ctx });
});''',
     '''const salesEditProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isManagerRole(ctx.user.role) || isSalesAgentRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sales edit access required" });
  }
  return next({ ctx });
});

const leadCreateProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isManagerRole(ctx.user.role) || isSalesAgentRole(ctx.user.role) || isLeadDispatcherRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lead create access required" });
  }
  return next({ ctx });
});''',
     'const leadCreateProcedure = protectedProcedure.use'),
    ('campaign create narrow procedure',
     '''const mediaBuyerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isAdminRole(ctx.user.role) || isMediaBuyerRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only Admin or Media Buyer can manage campaigns" });
  }
  return next({ ctx });
});''',
     '''const mediaBuyerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isAdminRole(ctx.user.role) || isMediaBuyerRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only Admin or Media Buyer can manage campaigns" });
  }
  return next({ ctx });
});

const campaignCreateProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!(isAdminRole(ctx.user.role) || isMediaBuyerRole(ctx.user.role) || isLeadDispatcherRole(ctx.user.role))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot create campaigns" });
  }
  return next({ ctx });
});''',
     'const campaignCreateProcedure = protectedProcedure.use'),
    ('use narrow campaign create procedure',
     '    create: mediaBuyerOrAdminProcedure\n      .input(\n        z.object({\n          name: z.string().min(1),',
     '    create: campaignCreateProcedure\n      .input(\n        z.object({\n          name: z.string().min(1),',
     'create: campaignCreateProcedure'),
    ('use narrow lead create procedure',
     '    create: salesEditProcedure\n      .input(\n        z.object({\n          name: z.string().optional(),',
     '    create: leadCreateProcedure\n      .input(\n        z.object({\n          name: z.string().optional(),',
     'create: leadCreateProcedure'),
    ('record manual lead creator',
     '        const id = await createLead({ ...input, ownerId } as any);\n        return { id };',
     '''        const sourceMetadata = {
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
        return { id };''',
     'entryMethod: "manual_add_lead"'),
])

edit('client/src/pages/LeadProfile.tsx', [
    ('show source-only creator metadata',
     '''                        const customData = (lead as any).customFieldsData;
                        const sourceData = (lead as any).sourceMetadata;
                        if (!customData || Object.keys(customData).length === 0) return (''',
     '''                        const customData = (lead as any).customFieldsData;
                        const sourceData = (lead as any).sourceMetadata;
                        const hasCustomData = Boolean(customData && Object.keys(customData).length > 0);
                        const hasSourceData = Boolean(sourceData && Object.keys(sourceData).length > 0);
                        if (!hasCustomData && !hasSourceData) return (''',
     'const hasSourceData = Boolean(sourceData && Object.keys(sourceData).length > 0);'),
    ('safe custom data entries',
     '                            {Object.entries(customData)\n',
     '                            {Object.entries(customData ?? {})\n',
     'Object.entries(customData ?? {})'),
    ('safe inbox url access',
     '                            {customData.inbox_url && (',
     '                            {customData?.inbox_url && (',
     '{customData?.inbox_url && ('),
    ('show manual creator',
     '                                  {sourceData.ad_id && <InfoRow label="Ad ID" value={sourceData.ad_id} mono />}\n',
     '''                                  {sourceData.ad_id && <InfoRow label="Ad ID" value={sourceData.ad_id} mono />}
                                  {sourceData.createdByUserName && (
                                    <InfoRow
                                      label={isRTL ? "أضيف بواسطة" : "Created by"}
                                      value={`${sourceData.createdByUserName}${sourceData.createdByUserRole ? ` (${sourceData.createdByUserRole})` : ""}`}
                                    />
                                  )}
''',
     'label={isRTL ? "أضيف بواسطة" : "Created by"}'),
])

print('PATCH_OK')
print('FILES_CHANGED=' + ','.join(changed))
