import { useEffect, useMemo, useState } from "react";
import CRMLayout from "@/components/CRMLayout";
import { TASHero, SectionCard } from "@/components/tas/TASShared";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  TAS_DATA_SCOPES,
  TAS_RBAC_ACTIONS,
  TAS_RBAC_MODULES,
  type TasDataScope,
  type TasPermissionGrant,
  type TasPermissionMatrix,
  type TasRbacAction,
  type TasRbacModule,
} from "@/lib/tasRbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const EMPTY_GRANT: TasPermissionGrant = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
  approve: false,
  assign: false,
  dataScope: "own",
};

type RoleDraft = {
  roleKey: string;
  nameAr: string;
  nameEn: string;
  description: string;
  permissions: TasPermissionMatrix;
  isSystem: boolean;
  isNew: boolean;
};

const MODULE_COPY: Record<TasRbacModule, { ar: string; en: string }> = {
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  conversations: { ar: "المحادثات", en: "Conversations" },
  sales: { ar: "المبيعات", en: "Sales" },
  catalog: { ar: "كتالوج السيارات", en: "Vehicle Catalog" },
  finance: { ar: "التمويل", en: "Finance" },
  service: { ar: "الخدمة والصيانة", en: "Service" },
  after_sales: { ar: "ما بعد البيع", en: "After Sales" },
  operations: { ar: "العمليات", en: "Operations" },
  reports: { ar: "التقارير", en: "Reports" },
  marketing: { ar: "التسويق", en: "Marketing" },
  shipping: { ar: "الشحن", en: "Shipping" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  admin: { ar: "إدارة TAS", en: "TAS Admin" },
  users: { ar: "المستخدمون", en: "Users" },
  roles: { ar: "الأدوار والصلاحيات", en: "Roles & Permissions" },
  audit_log: { ar: "سجل العمليات", en: "Audit Log" },
  system_settings: { ar: "إعدادات النظام", en: "System Settings" },
};

const ACTION_COPY: Record<TasRbacAction, { ar: string; en: string }> = {
  view: { ar: "عرض", en: "View" },
  create: { ar: "إضافة", en: "Create" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  export: { ar: "تصدير", en: "Export" },
  approve: { ar: "اعتماد", en: "Approve" },
  assign: { ar: "تعيين", en: "Assign" },
};

const SCOPE_COPY: Record<TasDataScope, { ar: string; en: string }> = {
  own: { ar: "بياناته فقط", en: "Own data" },
  assigned: { ar: "المُسند إليه", en: "Assigned" },
  team: { ar: "فريقه", en: "Team" },
  branch: { ar: "فرعه", en: "Branch" },
  all: { ar: "كل البيانات", en: "All data" },
};

function cloneMatrix(matrix: TasPermissionMatrix | null | undefined): TasPermissionMatrix {
  const next: TasPermissionMatrix = {};
  for (const module of TAS_RBAC_MODULES) {
    const grant = matrix?.[module];
    next[module] = grant ? { ...grant } : { ...EMPTY_GRANT };
  }
  return next;
}

function cleanRoleKey(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

export default function TASRolesPermissionsPage() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();
  const rolesQ = trpc.tasRbac.listRoles.useQuery(undefined, { retry: false });
  const usersQ = trpc.tasRbac.listUsers.useQuery(undefined, { retry: false });
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("");
  const [draft, setDraft] = useState<RoleDraft | null>(null);

  const roles = (rolesQ.data ?? []) as any[];
  const users = (usersQ.data ?? []) as any[];

  const selectedRole = useMemo(
    () => roles.find((role) => role.roleKey === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );

  useEffect(() => {
    if (!selectedRoleKey && roles.length > 0) setSelectedRoleKey(roles[0].roleKey);
  }, [roles, selectedRoleKey]);

  useEffect(() => {
    if (!selectedRole) return;
    setDraft({
      roleKey: selectedRole.roleKey,
      nameAr: selectedRole.nameAr ?? "",
      nameEn: selectedRole.nameEn ?? selectedRole.roleKey,
      description: selectedRole.description ?? "",
      permissions: cloneMatrix(selectedRole.permissions as TasPermissionMatrix),
      isSystem: Boolean(selectedRole.isSystem),
      isNew: false,
    });
  }, [selectedRole]);

  const saveRole = trpc.tasRbac.saveRole.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حفظ الصلاحيات" : "Permissions saved");
      await Promise.all([rolesQ.refetch(), utils.tasRbac.me.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteRole = trpc.tasRbac.deleteRole.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حذف الدور" : "Role deleted");
      setSelectedRoleKey("");
      setDraft(null);
      await rolesQ.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const assignUserRole = trpc.tasRbac.assignUserRole.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم تحديث دور المستخدم" : "User role updated");
      await usersQ.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const isAdminRole = draft?.roleKey === "Admin";

  const startNewRole = () => {
    setSelectedRoleKey("");
    setDraft({
      roleKey: "",
      nameAr: "",
      nameEn: "",
      description: "",
      permissions: cloneMatrix({}),
      isSystem: false,
      isNew: true,
    });
  };

  const updateGrant = (module: TasRbacModule, action: TasRbacAction, checked: boolean) => {
    setDraft((current) => {
      if (!current || isAdminRole) return current;
      const grant = { ...(current.permissions[module] ?? EMPTY_GRANT), [action]: checked } as TasPermissionGrant;
      if (action !== "view" && checked) grant.view = true;
      if (action === "view" && !checked) {
        for (const key of TAS_RBAC_ACTIONS) grant[key] = false;
      }
      return { ...current, permissions: { ...current.permissions, [module]: grant } };
    });
  };

  const toggleModuleAll = (module: TasRbacModule, checked: boolean) => {
    setDraft((current) => {
      if (!current || isAdminRole) return current;
      const previous = current.permissions[module] ?? EMPTY_GRANT;
      const grant: TasPermissionGrant = {
        view: checked,
        create: checked,
        edit: checked,
        delete: checked,
        export: checked,
        approve: checked,
        assign: checked,
        dataScope: previous.dataScope,
      };
      return { ...current, permissions: { ...current.permissions, [module]: grant } };
    });
  };

  const updateScope = (module: TasRbacModule, dataScope: TasDataScope) => {
    setDraft((current) => {
      if (!current || isAdminRole) return current;
      const grant = { ...(current.permissions[module] ?? EMPTY_GRANT), dataScope } as TasPermissionGrant;
      return { ...current, permissions: { ...current.permissions, [module]: grant } };
    });
  };

  const submitRole = () => {
    if (!draft) return;
    const roleKey = cleanRoleKey(draft.roleKey.trim());
    if (roleKey.length < 2 || draft.nameEn.trim().length < 2) {
      toast.error(isRTL ? "أدخل مفتاح الدور والاسم الإنجليزي" : "Enter a valid role key and English name");
      return;
    }
    saveRole.mutate({
      roleKey,
      nameAr: draft.nameAr.trim() || undefined,
      nameEn: draft.nameEn.trim(),
      description: draft.description.trim() || undefined,
      permissions: TAS_RBAC_MODULES.map((module) => ({
        module,
        ...(draft.permissions[module] ?? EMPTY_GRANT),
      })),
    });
  };

  const confirmDelete = () => {
    if (!draft || draft.isSystem || draft.roleKey === "Admin") return;
    if (!window.confirm(isRTL ? `حذف الدور ${draft.nameAr || draft.nameEn}؟` : `Delete role ${draft.nameEn}?`)) return;
    deleteRole.mutate({ roleKey: draft.roleKey });
  };

  const changeUserRole = (user: any, roleKey: string) => {
    if (roleKey === user.role) return;
    const message = isRTL
      ? `تغيير دور ${user.name || user.email} من ${user.role || "—"} إلى ${roleKey}؟`
      : `Change ${user.name || user.email} from ${user.role || "—"} to ${roleKey}?`;
    if (!window.confirm(message)) return;
    assignUserRole.mutate({ userId: Number(user.id), roleKey });
  };

  return (
    <CRMLayout>
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        <TASHero
          icon={<ShieldCheck size={16} />}
          title={isRTL ? "الأدوار والصلاحيات" : "Roles & Permissions"}
          subtitle={isRTL
            ? "حدد ما الذي يراه كل دور، وما الذي يستطيع تنفيذه، ونطاق البيانات المسموح له به."
            : "Control what each role can see, what actions it can perform, and the data scope it can access."}
        />

        <div className="grid gap-6 2xl:grid-cols-[290px,minmax(0,1fr)]">
          <SectionCard
            title={isRTL ? "الأدوار" : "Roles"}
            right={
              <Button size="sm" variant="outline" className="rounded-xl" onClick={startNewRole}>
                <Plus className="me-1.5 h-4 w-4" />
                {isRTL ? "دور جديد" : "New role"}
              </Button>
            }
          >
            <div className="space-y-2">
              {rolesQ.isLoading ? <div className="text-sm text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</div> : null}
              {roles.map((role) => (
                <button
                  key={role.roleKey}
                  type="button"
                  onClick={() => setSelectedRoleKey(role.roleKey)}
                  className={`w-full rounded-2xl border px-4 py-3 text-start transition ${selectedRoleKey === role.roleKey ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-foreground">{isRTL ? (role.nameAr || role.nameEn) : role.nameEn}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{role.roleKey}</div>
                    </div>
                    {role.isSystem ? <Badge variant="secondary" className="text-[10px]">System</Badge> : null}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title={isRTL ? "بيانات الدور" : "Role details"}>
              {!draft ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{isRTL ? "اختر دورًا للبدء" : "Select a role to begin"}</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Role key</label>
                      <Input
                        value={draft.roleKey}
                        disabled={!draft.isNew || isAdminRole}
                        onChange={(event) => setDraft((current) => current ? { ...current, roleKey: cleanRoleKey(event.target.value) } : current)}
                        className="rounded-xl"
                        placeholder="SalesSupervisor"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isRTL ? "الاسم الإنجليزي" : "English name"}</label>
                      <Input value={draft.nameEn} disabled={isAdminRole} onChange={(event) => setDraft((current) => current ? { ...current, nameEn: event.target.value } : current)} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isRTL ? "الاسم العربي" : "Arabic name"}</label>
                      <Input value={draft.nameAr} disabled={isAdminRole} onChange={(event) => setDraft((current) => current ? { ...current, nameAr: event.target.value } : current)} className="rounded-xl" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isRTL ? "الوصف" : "Description"}</label>
                      <Textarea value={draft.description} disabled={isAdminRole} onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)} className="rounded-xl" rows={2} />
                    </div>
                  </div>
                  {isAdminRole ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                      {isRTL ? "دور Admin محمي ويحتفظ دائمًا بكامل الصلاحيات." : "Admin is protected and always keeps full access."}
                    </div>
                  ) : null}
                </div>
              )}
            </SectionCard>

            {draft ? (
              <SectionCard title={isRTL ? "مصفوفة الصلاحيات" : "Permission matrix"}>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="min-w-[180px]">{isRTL ? "القسم" : "Module"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الكل" : "All"}</TableHead>
                        {TAS_RBAC_ACTIONS.map((action) => (
                          <TableHead key={action} className="min-w-[78px] text-center text-xs">{isRTL ? ACTION_COPY[action].ar : ACTION_COPY[action].en}</TableHead>
                        ))}
                        <TableHead className="min-w-[170px]">{isRTL ? "نطاق البيانات" : "Data scope"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {TAS_RBAC_MODULES.map((module) => {
                        const grant = draft.permissions[module] ?? EMPTY_GRANT;
                        const allEnabled = TAS_RBAC_ACTIONS.every((action) => grant[action]);
                        return (
                          <TableRow key={module}>
                            <TableCell>
                              <div className="font-bold text-foreground">{isRTL ? MODULE_COPY[module].ar : MODULE_COPY[module].en}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{module}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch checked={allEnabled} disabled={isAdminRole} onCheckedChange={(checked) => toggleModuleAll(module, checked)} />
                            </TableCell>
                            {TAS_RBAC_ACTIONS.map((action) => (
                              <TableCell key={action} className="text-center">
                                <Switch checked={Boolean(grant[action])} disabled={isAdminRole} onCheckedChange={(checked) => updateGrant(module, action, checked)} />
                              </TableCell>
                            ))}
                            <TableCell>
                              <Select value={grant.dataScope} disabled={isAdminRole} onValueChange={(value) => updateScope(module, value as TasDataScope)}>
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TAS_DATA_SCOPES.map((scope) => <SelectItem key={scope} value={scope}>{isRTL ? SCOPE_COPY[scope].ar : SCOPE_COPY[scope].en}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {!isAdminRole ? (
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    {!draft.isSystem && !draft.isNew ? (
                      <Button variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50" disabled={deleteRole.isPending} onClick={confirmDelete}>
                        <Trash2 className="me-1.5 h-4 w-4" />{isRTL ? "حذف الدور" : "Delete role"}
                      </Button>
                    ) : null}
                    <Button className="rounded-xl" disabled={saveRole.isPending} onClick={submitRole}>
                      <Save className="me-1.5 h-4 w-4" />{saveRole.isPending ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ الصلاحيات" : "Save permissions")}
                    </Button>
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            <SectionCard title={isRTL ? "تعيين الأدوار للمستخدمين" : "Assign roles to users"} right={<Badge variant="secondary"><Users className="me-1 h-3.5 w-3.5" />{users.length}</Badge>}>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>{isRTL ? "المستخدم" : "User"}</TableHead>
                      <TableHead>{isRTL ? "البريد" : "Email"}</TableHead>
                      <TableHead className="min-w-[220px]">{isRTL ? "الدور" : "Role"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-bold">{user.name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email || "—"}</TableCell>
                        <TableCell>
                          <Select value={user.role || "SalesAgent"} disabled={assignUserRole.isPending} onValueChange={(roleKey) => changeUserRole(user, roleKey)}>
                            <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => <SelectItem key={role.roleKey} value={role.roleKey}>{isRTL ? (role.nameAr || role.nameEn) : role.nameEn}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
