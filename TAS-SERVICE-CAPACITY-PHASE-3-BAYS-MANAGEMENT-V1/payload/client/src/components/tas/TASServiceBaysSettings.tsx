import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SectionCard } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Boxes, CheckCircle2, CircleOff, Hash, Pencil, Plus, Warehouse, Wrench } from 'lucide-react';
import { toast } from 'sonner';

const BAY_TYPES = [
  { value: 'General', ar: 'عام', en: 'General' },
  { value: 'QuickLube', ar: 'صيانة سريعة', en: 'Quick lube' },
  { value: 'Mechanical', ar: 'ميكانيكا', en: 'Mechanical' },
  { value: 'Electrical', ar: 'كهرباء', en: 'Electrical' },
  { value: 'Inspection', ar: 'فحص', en: 'Inspection' },
  { value: 'BodyPaint', ar: 'سمكرة ودهان', en: 'Body & paint' },
  { value: 'Other', ar: 'أخرى', en: 'Other' },
] as const;

type Draft = {
  name: string;
  code: string;
  bayType: string;
  capabilities: string;
  notes: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  code: '',
  bayType: 'General',
  capabilities: '',
  notes: '',
  sortOrder: '0',
  isActive: true,
});

function capabilitiesToText(value: unknown) {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return raw; }
  }
  return Array.isArray(raw) ? raw.map(String).filter(Boolean).join(', ') : '';
}

function textToCapabilities(value: string) {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean))).slice(0, 30);
}

export default function TASServiceBaysSettings() {
  const { isRTL } = useLanguage();
  const branchesQ = trpc.tas.branches.list.useQuery({ includeInactive: true });
  const branches = branchesQ.data ?? [];
  const [branchId, setBranchId] = useState('');
  const [editingId, setEditingId] = useState<'new' | string>('new');
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  useEffect(() => {
    if (!branchId && branches.length) {
      const firstActive = branches.find((branch: any) => Number(branch.isActive) === 1) ?? branches[0];
      setBranchId(String(firstActive.id));
    }
  }, [branchId, branches]);

  const numericBranchId = Number(branchId || 0);
  const baysQ = trpc.tas.service.listBays.useQuery(
    { branchId: numericBranchId, includeInactive: true },
    { enabled: numericBranchId > 0 },
  );
  const bays = baysQ.data ?? [];
  const selectedBranch = branches.find((branch: any) => String(branch.id) === branchId);
  const activeCount = bays.filter((bay: any) => Number(bay.isActive) === 1).length;

  const selectedBay = useMemo(
    () => bays.find((bay: any) => String(bay.id) === editingId),
    [bays, editingId],
  );

  useEffect(() => {
    if (editingId === 'new') {
      setDraft(emptyDraft());
      return;
    }
    if (!selectedBay) return;
    setDraft({
      name: String(selectedBay.name ?? ''),
      code: String(selectedBay.code ?? ''),
      bayType: String(selectedBay.bayType ?? 'General'),
      capabilities: capabilitiesToText(selectedBay.capabilitiesJson),
      notes: String(selectedBay.notes ?? ''),
      sortOrder: String(selectedBay.sortOrder ?? 0),
      isActive: Number(selectedBay.isActive) === 1,
    });
  }, [editingId, selectedBay]);

  useEffect(() => {
    setEditingId('new');
  }, [branchId]);

  const createBay = trpc.tas.service.createBay.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تمت إضافة الـBay' : 'Service bay added');
      setEditingId('new');
      setDraft(emptyDraft());
      baysQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر إضافة الـBay' : 'Could not add bay')),
  });

  const updateBay = trpc.tas.service.updateBay.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تحديث الـBay' : 'Service bay updated');
      baysQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث الـBay' : 'Could not update bay')),
  });

  const save = () => {
    if (!numericBranchId) {
      toast.error(isRTL ? 'اختر فرعًا أولًا' : 'Select a branch first');
      return;
    }
    if (!draft.name.trim()) {
      toast.error(isRTL ? 'اكتب اسم الـBay' : 'Bay name is required');
      return;
    }
    const sortOrder = Number(draft.sortOrder || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      toast.error(isRTL ? 'ترتيب الـBay غير صالح' : 'Invalid sort order');
      return;
    }
    const payload = {
      branchId: numericBranchId,
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      bayType: draft.bayType,
      capabilitiesJson: textToCapabilities(draft.capabilities),
      notes: draft.notes.trim() || null,
      sortOrder,
      isActive: draft.isActive,
    };

    if (editingId === 'new') createBay.mutate(payload);
    else updateBay.mutate({ id: Number(editingId), ...payload });
  };

  const busy = createBay.isPending || updateBay.isPending;

  return (
    <SectionCard
      title={isRTL ? 'إدارة Bays / Lifts الصيانة' : 'Service bays & lifts'}
      subtitle={isRTL
        ? 'عرّف الطاقة التشغيلية الفعلية لكل فرع بدون عدد ثابت. الربط التلقائي بالمواعيد سيتم في مراحل الجدولة اللاحقة.'
        : 'Define each branch\'s physical service capacity with no fixed bay count. Automatic booking assignment comes in later scheduling phases.'}
      right={(
        <Button
          variant="outline"
          className="h-9 rounded-xl border-zinc-200 bg-white text-xs"
          disabled={!numericBranchId}
          onClick={() => {
            setEditingId('new');
            setDraft(emptyDraft());
          }}
        >
          <Plus size={14} className="me-1.5" />
          {isRTL ? 'إضافة Bay' : 'Add bay'}
        </Button>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <FieldGroup>
          <FieldLabel>{isRTL ? 'فرع الصيانة' : 'Service branch'}</FieldLabel>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white">
              <SelectValue placeholder={isRTL ? 'اختر الفرع' : 'Select branch'} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch: any) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name}{Number(branch.isActive) === 1 ? '' : (isRTL ? ' — متوقف' : ' — Inactive')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>

        <div className="flex min-w-28 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <Boxes size={17} className="text-[#0a1f44]" />
          <div>
            <div className="text-[11px] text-zinc-400">{isRTL ? 'إجمالي Bays' : 'Total bays'}</div>
            <div className="text-lg font-semibold text-zinc-900">{bays.length}</div>
          </div>
        </div>

        <div className="flex min-w-28 items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <CheckCircle2 size={17} className="text-emerald-600" />
          <div>
            <div className="text-[11px] text-emerald-600/70">{isRTL ? 'نشطة' : 'Active'}</div>
            <div className="text-lg font-semibold text-emerald-700">{activeCount}</div>
          </div>
        </div>
      </div>

      {!branches.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center">
          <Warehouse size={26} className="mx-auto mb-3 text-zinc-300" />
          <div className="text-sm font-semibold text-zinc-700">{isRTL ? 'أضف فرع صيانة أولًا' : 'Add a service branch first'}</div>
          <p className="mt-1 text-xs text-zinc-400">{isRTL ? 'الـBays مرتبطة بفرع حقيقي ولا يتم إنشاء بيانات تجريبية.' : 'Bays belong to real branches; no demo data is created.'}</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{selectedBranch?.name || (isRTL ? 'الفرع' : 'Branch')}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{isRTL ? 'Bays الفعلية داخل الفرع' : 'Physical service bays at this branch'}</div>
              </div>
              {selectedBranch && (
                <Badge variant="outline" className={Number(selectedBranch.isActive) === 1 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}>
                  {Number(selectedBranch.isActive) === 1 ? (isRTL ? 'فرع نشط' : 'Active branch') : (isRTL ? 'فرع متوقف' : 'Inactive branch')}
                </Badge>
              )}
            </div>

            {baysQ.isLoading ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center text-sm text-zinc-400">
                {isRTL ? 'جاري تحميل الـBays...' : 'Loading bays...'}
              </div>
            ) : bays.length === 0 ? (
              <button
                type="button"
                onClick={() => setEditingId('new')}
                className="w-full rounded-2xl border border-dashed border-[#c99a2e]/40 bg-[#c99a2e]/5 px-5 py-9 text-center transition hover:bg-[#c99a2e]/10"
              >
                <Wrench size={26} className="mx-auto mb-3 text-[#b7861f]" />
                <div className="text-sm font-semibold text-zinc-800">{isRTL ? 'لا توجد Bays في هذا الفرع' : 'No bays configured for this branch'}</div>
                <p className="mt-1 text-xs text-zinc-500">{isRTL ? 'أضف العدد الحقيقي حسب تجهيز الفرع؛ لا يوجد رقم ثابت.' : 'Add the branch\'s real bays; there is no fixed count.'}</p>
              </button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {bays.map((bay: any) => {
                  const active = String(bay.id) === editingId;
                  const capabilities = capabilitiesToText(bay.capabilitiesJson);
                  return (
                    <button
                      type="button"
                      key={bay.id}
                      onClick={() => setEditingId(String(bay.id))}
                      className={'rounded-2xl border p-4 text-start transition ' + (active ? 'border-[#c99a2e]/45 bg-[#fffaf0] shadow-sm' : 'border-zinc-100 bg-white hover:border-zinc-200 hover:shadow-sm')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate font-semibold text-zinc-900">{bay.name}</div>
                            {bay.code && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                                <Hash size={9} />{bay.code}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {BAY_TYPES.find((item) => item.value === bay.bayType)?.[isRTL ? 'ar' : 'en'] || bay.bayType || 'General'}
                          </div>
                        </div>
                        {Number(bay.isActive) === 1
                          ? <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />
                          : <CircleOff size={17} className="shrink-0 text-zinc-300" />}
                      </div>
                      {capabilities && <div className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">{capabilities}</div>}
                      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
                        <span>{isRTL ? 'الترتيب' : 'Order'}: {bay.sortOrder ?? 0}</span>
                        <span className="inline-flex items-center gap-1"><Pencil size={11} />{isRTL ? 'تعديل' : 'Edit'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/50 p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {editingId === 'new' ? (isRTL ? 'Bay جديدة' : 'New bay') : (selectedBay?.name || (isRTL ? 'تعديل Bay' : 'Edit bay'))}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {isRTL ? 'إعدادات تعريفية فقط في هذه المرحلة؛ لا يوجد Auto Assignment بعد.' : 'Configuration only in this phase; auto-assignment is not enabled yet.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{isRTL ? 'نشطة' : 'Active'}</span>
                <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))} />
              </div>
            </div>

            <div className="space-y-3">
              <FieldGroup>
                <FieldLabel>{isRTL ? 'اسم الـBay / Lift' : 'Bay / lift name'}</FieldLabel>
                <Input
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  placeholder={isRTL ? 'مثال: Lift A' : 'e.g. Lift A'}
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
              </FieldGroup>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'الكود' : 'Code'}</FieldLabel>
                  <Input
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    placeholder="A-01"
                    value={draft.code}
                    onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'الترتيب' : 'Sort order'}</FieldLabel>
                  <Input
                    type="number"
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    value={draft.sortOrder}
                    onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </FieldGroup>
              </div>

              <FieldGroup>
                <FieldLabel>{isRTL ? 'نوع الـBay' : 'Bay type'}</FieldLabel>
                <Select value={draft.bayType} onValueChange={(value) => setDraft((prev) => ({ ...prev, bayType: value }))}>
                  <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BAY_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{isRTL ? type.ar : type.en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>{isRTL ? 'القدرات / الاستخدامات' : 'Capabilities'}</FieldLabel>
                <Input
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  placeholder={isRTL ? 'مثال: صيانة دورية، فرامل، عفشة' : 'e.g. periodic service, brakes, suspension'}
                  value={draft.capabilities}
                  onChange={(e) => setDraft((prev) => ({ ...prev, capabilities: e.target.value }))}
                />
                <p className="mt-1 text-[11px] text-zinc-400">{isRTL ? 'افصل بين القدرات بفاصلة.' : 'Separate capabilities with commas.'}</p>
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>{isRTL ? 'ملاحظات داخلية' : 'Internal notes'}</FieldLabel>
                <Textarea
                  className="min-h-20 rounded-xl border-zinc-200 bg-white"
                  value={draft.notes}
                  onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </FieldGroup>

              <Button
                className="h-10 w-full rounded-xl bg-[#0a1f44] text-white hover:bg-[#112b58]"
                disabled={busy || !numericBranchId}
                onClick={save}
              >
                {busy ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : editingId === 'new' ? (isRTL ? 'إضافة الـBay' : 'Add bay') : (isRTL ? 'حفظ التعديلات' : 'Save changes')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
