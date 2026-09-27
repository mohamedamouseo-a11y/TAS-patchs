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
import { CheckCircle2, CircleOff, Clock3, Pencil, Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';

// TAS_SERVICE_TYPES_SETTINGS_UI_V1

const CATEGORIES = [
  { value: 'PeriodicMaintenance', en: 'Periodic maintenance', ar: 'صيانة دورية' },
  { value: 'Mechanical', en: 'Mechanical', ar: 'ميكانيكا' },
  { value: 'Electrical', en: 'Electrical', ar: 'كهرباء' },
  { value: 'BodyShop', en: 'Body shop', ar: 'سمكرة ودهان' },
  { value: 'Inspection', en: 'Inspection', ar: 'فحص' },
  { value: 'Other', en: 'Other', ar: 'أخرى' },
] as const;

type Draft = {
  name: string;
  category: string;
  durationMinutes: string;
  slotCapacity: string;
  description: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  category: 'PeriodicMaintenance',
  durationMinutes: '60',
  slotCapacity: '1',
  description: '',
  isActive: true,
});

export default function TASServiceTypesSettings() {
  const { isRTL } = useLanguage();
  const typesQ = trpc.tas.service.listTypesAdmin.useQuery({ includeInactive: true });
  const types: any[] = typesQ.data ?? [];

  const [editingId, setEditingId] = useState<'new' | string>('new');
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const selected = useMemo(
    () => types.find((row: any) => String(row.id) === editingId),
    [types, editingId],
  );

  useEffect(() => {
    if (editingId === 'new') {
      setDraft(emptyDraft());
      return;
    }
    if (!selected) return;
    setDraft({
      name: String(selected.name ?? ''),
      category: String(selected.category ?? 'Other'),
      durationMinutes: String(selected.durationMinutes ?? 60),
      slotCapacity: String(selected.slotCapacity ?? selected.defaultCapacityUnits ?? 1),
      description: String(selected.description ?? selected.notes ?? ''),
      isActive: Number(selected.isActive) === 1,
    });
  }, [editingId, selected]);

  const createType = trpc.tas.service.createType.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم إنشاء نوع الخدمة' : 'Service type created');
      setEditingId('new');
      setDraft(emptyDraft());
      await typesQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر إنشاء نوع الخدمة' : 'Could not create service type')),
  });

  const updateType = trpc.tas.service.updateType.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث نوع الخدمة' : 'Service type updated');
      await typesQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث نوع الخدمة' : 'Could not update service type')),
  });

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error(isRTL ? 'اكتب اسم الخدمة' : 'Service name is required');
      return;
    }

    const durationMinutes = Number(draft.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      toast.error(isRTL ? 'مدة الخدمة يجب أن تكون بين 1 و1440 دقيقة' : 'Duration must be between 1 and 1440 minutes');
      return;
    }

    const slotCapacity = Number(draft.slotCapacity);
    if (!Number.isInteger(slotCapacity) || slotCapacity < 1 || slotCapacity > 100) {
      toast.error(isRTL ? 'سعة الخدمة يجب أن تكون بين 1 و100' : 'Slot capacity must be between 1 and 100');
      return;
    }

    const payload = {
      name,
      category: draft.category,
      durationMinutes,
      slotCapacity,
      description: draft.description.trim() || null,
      isActive: draft.isActive,
    };

    if (editingId === 'new') createType.mutate(payload);
    else updateType.mutate({ id: Number(editingId), ...payload });
  };

  const activeCount = types.filter((row: any) => Number(row.isActive) === 1).length;
  const busy = createType.isPending || updateType.isPending;

  return (
    <SectionCard
      title={isRTL ? 'أنواع خدمات الصيانة' : 'Service types'}
      subtitle={isRTL
        ? 'عرّف الخدمات التي يستخدمها الحجز والـAvailability مع المدة والسعة الافتراضية.'
        : 'Define the services used by booking and availability, including default duration and capacity.'}
      right={(
        <Button
          variant="outline"
          className="h-9 rounded-xl border-zinc-200 bg-white text-xs"
          onClick={() => {
            setEditingId('new');
            setDraft(emptyDraft());
          }}
        >
          <Plus size={14} className="me-1.5" />
          {isRTL ? 'خدمة جديدة' : 'New service type'}
        </Button>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="text-[11px] text-zinc-400">{isRTL ? 'إجمالي الأنواع' : 'Total types'}</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900">{types.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <div className="text-[11px] text-emerald-600/70">{isRTL ? 'نشطة' : 'Active'}</div>
          <div className="mt-1 text-lg font-semibold text-emerald-700">{activeCount}</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          {typesQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center text-sm text-zinc-400">
              {isRTL ? 'جاري تحميل أنواع الخدمات...' : 'Loading service types...'}
            </div>
          ) : types.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditingId('new')}
              className="w-full rounded-2xl border border-dashed border-[#c99a2e]/40 bg-[#c99a2e]/5 px-5 py-9 text-center"
            >
              <Wrench size={26} className="mx-auto mb-3 text-[#b7861f]" />
              <div className="text-sm font-semibold text-zinc-800">{isRTL ? 'لا توجد أنواع خدمات بعد' : 'No service types yet'}</div>
              <p className="mt-1 text-xs text-zinc-500">{isRTL ? 'أضف أول خدمة ليعمل الحجز والـAvailability.' : 'Add the first service so booking and availability can operate.'}</p>
            </button>
          ) : (
            <div className="space-y-2">
              {types.map((type: any) => {
                const active = String(type.id) === editingId;
                const category = CATEGORIES.find((item) => item.value === type.category);
                return (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => setEditingId(String(type.id))}
                    className={'w-full rounded-2xl border p-4 text-start transition ' + (active ? 'border-[#c99a2e]/45 bg-[#fffaf0] shadow-sm' : 'border-zinc-100 bg-white hover:border-zinc-200')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-zinc-900">{type.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {category ? (isRTL ? category.ar : category.en) : type.category}
                        </div>
                      </div>
                      {Number(type.isActive) === 1
                        ? <CheckCircle2 size={17} className="text-emerald-500" />
                        : <CircleOff size={17} className="text-zinc-300" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                      <Badge variant="outline" className="border-zinc-200 bg-zinc-50">
                        <Clock3 size={11} className="me-1" />{Number(type.durationMinutes ?? 60)} min
                      </Badge>
                      <Badge variant="outline" className="border-zinc-200 bg-zinc-50">
                        {isRTL ? 'السعة' : 'Capacity'}: {Number(type.slotCapacity ?? 1)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                      <span className="inline-flex items-center gap-1"><Pencil size={10} />{isRTL ? 'تعديل' : 'Edit'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/40 p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                {editingId === 'new' ? (isRTL ? 'نوع خدمة جديد' : 'New service type') : (selected?.name || (isRTL ? 'تعديل نوع الخدمة' : 'Edit service type'))}
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {isRTL ? 'المدة تستخدم في حساب الـSlots، والسعة تبقى fallback فقط عندما لا توجد Bays نشطة.' : 'Duration drives slot calculation; capacity is a fallback when no active physical Bays exist.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{isRTL ? 'نشطة' : 'Active'}</span>
              <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>

          <div className="space-y-3">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'اسم الخدمة' : 'Service name'}</FieldLabel>
              <Input
                className="h-10 rounded-xl border-zinc-200 bg-white"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={isRTL ? 'مثال: صيانة دورية' : 'e.g. Periodic service'}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel>{isRTL ? 'الفئة' : 'Category'}</FieldLabel>
              <Select value={draft.category} onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}>
                <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {isRTL ? category.ar : category.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup>
                <FieldLabel>{isRTL ? 'المدة (دقيقة)' : 'Duration (min)'}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>{isRTL ? 'السعة الافتراضية' : 'Fallback slot capacity'}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  value={draft.slotCapacity}
                  onChange={(event) => setDraft((prev) => ({ ...prev, slotCapacity: event.target.value }))}
                />
              </FieldGroup>
            </div>

            <FieldGroup>
              <FieldLabel>{isRTL ? 'الوصف' : 'Description'}</FieldLabel>
              <Textarea
                className="min-h-20 rounded-xl border-zinc-200 bg-white"
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </FieldGroup>

            <Button
              className="h-10 w-full rounded-xl bg-[#0a1f44] text-white hover:bg-[#112b58]"
              disabled={busy}
              onClick={save}
            >
              {busy
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : editingId === 'new'
                  ? (isRTL ? 'إنشاء نوع الخدمة' : 'Create service type')
                  : (isRTL ? 'حفظ التعديلات' : 'Save changes')}
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
