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
import { CarFront, CheckCircle2, CircleAlert, CircleOff, Gauge, Link2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

type MappingDraft = {
  vehicleId: string;
  planId: string;
  powertrain: string;
  variant: string;
  yearFrom: string;
  yearTo: string;
  notes: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyDraft = (): MappingDraft => ({
  vehicleId: '',
  planId: '',
  powertrain: '',
  variant: '',
  yearFrom: '',
  yearTo: '',
  notes: '',
  sortOrder: '0',
  isActive: true,
});

function vehicleLabel(vehicle: any) {
  return [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || `Vehicle #${vehicle.id}`;
}

function mileageLabel(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US').format(n) + ' km' : '—';
}

function intervalCard(interval: any, title: string, tone: 'exact' | 'muted') {
  if (!interval) return null;
  return (
    <div className={tone === 'exact'
      ? 'rounded-xl border border-emerald-200 bg-emerald-50/70 p-3'
      : 'rounded-xl border border-zinc-100 bg-zinc-50/70 p-3'}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</div>
      <div className="mt-1 font-semibold text-zinc-900">{mileageLabel(interval.mileageKm)}</div>
      <div className="mt-1 text-xs text-zinc-500">
        {Number(interval.durationMinutes ?? 0)} min{interval.label ? ` • ${interval.label}` : ''}
      </div>
    </div>
  );
}

export default function TASMaintenanceVehicleMappingSettings() {
  const { isRTL } = useLanguage();

  const vehiclesQ = trpc.tas.catalog.listVehicles.useQuery({ activeOnly: true });
  const plansQ = trpc.tas.service.listMaintenancePlans.useQuery({ includeInactive: false });

  const vehicles = vehiclesQ.data ?? [];
  const plans = plansQ.data ?? [];

  const [vehicleFilter, setVehicleFilter] = useState('');
  const numericVehicleFilter = Number(vehicleFilter || 0);

  const mappingsQ = trpc.tas.service.listMaintenanceVehicleMappings.useQuery({
    vehicleId: numericVehicleFilter || undefined,
    includeInactive: true,
  });
  const mappings = mappingsQ.data ?? [];

  const [editingId, setEditingId] = useState<'new' | string>('new');
  const [draft, setDraft] = useState<MappingDraft>(emptyDraft());
  const selectedMapping = useMemo(
    () => mappings.find((row: any) => String(row.id) === editingId),
    [mappings, editingId],
  );

  useEffect(() => {
    if (editingId === 'new') {
      setDraft((prev) => ({ ...emptyDraft(), vehicleId: vehicleFilter || prev.vehicleId }));
      return;
    }
    if (!selectedMapping) return;
    setDraft({
      vehicleId: String(selectedMapping.vehicleId ?? ''),
      planId: String(selectedMapping.planId ?? ''),
      powertrain: String(selectedMapping.powertrain ?? ''),
      variant: String(selectedMapping.variant ?? ''),
      yearFrom: selectedMapping.yearFrom == null ? '' : String(selectedMapping.yearFrom),
      yearTo: selectedMapping.yearTo == null ? '' : String(selectedMapping.yearTo),
      notes: String(selectedMapping.notes ?? ''),
      sortOrder: String(selectedMapping.sortOrder ?? 0),
      isActive: Number(selectedMapping.isActive) === 1,
    });
  }, [editingId, selectedMapping, vehicleFilter]);

  useEffect(() => {
    setEditingId('new');
    setDraft((prev) => ({ ...emptyDraft(), vehicleId: vehicleFilter || prev.vehicleId }));
  }, [vehicleFilter]);

  const createMapping = trpc.tas.service.createMaintenanceVehicleMapping.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم إنشاء ربط خطة الصيانة' : 'Maintenance mapping created');
      setEditingId('new');
      await mappingsQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر إنشاء الربط' : 'Could not create mapping')),
  });

  const updateMapping = trpc.tas.service.updateMaintenanceVehicleMapping.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث الربط' : 'Maintenance mapping updated');
      await mappingsQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث الربط' : 'Could not update mapping')),
  });

  const save = () => {
    const vehicleId = Number(draft.vehicleId || 0);
    const planId = Number(draft.planId || 0);
    if (!vehicleId || !planId) {
      toast.error(isRTL ? 'اختر السيارة وخطة الصيانة' : 'Select vehicle and maintenance plan');
      return;
    }

    const yearFrom = draft.yearFrom ? Number(draft.yearFrom) : null;
    const yearTo = draft.yearTo ? Number(draft.yearTo) : null;
    if (yearFrom !== null && (!Number.isInteger(yearFrom) || yearFrom < 0 || yearFrom > 9999)) {
      toast.error(isRTL ? 'بداية السنوات غير صالحة' : 'Invalid year-from value');
      return;
    }
    if (yearTo !== null && (!Number.isInteger(yearTo) || yearTo < 0 || yearTo > 9999)) {
      toast.error(isRTL ? 'نهاية السنوات غير صالحة' : 'Invalid year-to value');
      return;
    }
    if (yearFrom !== null && yearTo !== null && yearTo < yearFrom) {
      toast.error(isRTL ? 'نهاية السنوات يجب أن تكون بعد البداية' : 'Year-to must be after year-from');
      return;
    }

    const sortOrder = Number(draft.sortOrder || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      toast.error(isRTL ? 'ترتيب الربط غير صالح' : 'Invalid sort order');
      return;
    }

    const payload = {
      vehicleId,
      planId,
      powertrain: draft.powertrain.trim() || null,
      variant: draft.variant.trim() || null,
      yearFrom,
      yearTo,
      notes: draft.notes.trim() || null,
      sortOrder,
      isActive: draft.isActive,
    };

    if (editingId === 'new') createMapping.mutate(payload);
    else updateMapping.mutate({ id: Number(editingId), ...payload });
  };

  const [resolver, setResolver] = useState({
    vehicleId: '',
    mileageKm: '',
    powertrain: '',
    variant: '',
    year: '',
  });

  useEffect(() => {
    if (vehicleFilter) {
      setResolver((prev) => ({ ...prev, vehicleId: vehicleFilter }));
    }
  }, [vehicleFilter]);

  const resolverVehicleId = Number(resolver.vehicleId || 0);
  const resolverMileage = resolver.mileageKm === '' ? -1 : Number(resolver.mileageKm);
  const resolutionQ = trpc.tas.service.resolveMaintenanceMileage.useQuery({
    vehicleId: resolverVehicleId,
    mileageKm: resolverMileage,
    powertrain: resolver.powertrain.trim() || undefined,
    variant: resolver.variant.trim() || undefined,
    year: resolver.year ? Number(resolver.year) : undefined,
  }, {
    enabled: resolverVehicleId > 0 && Number.isInteger(resolverMileage) && resolverMileage >= 0,
  });

  const resolution: any = resolutionQ.data;
  const busy = createMapping.isPending || updateMapping.isPending;

  return (
    <SectionCard
      title={isRTL ? 'ربط السيارات بخطط الصيانة' : 'Vehicle maintenance mapping'}
      subtitle={isRTL
        ? 'اربط السيارة الحالية بخطة الصيانة حسب المحرك/الفئة اختياريًا، ثم اختبر تحديد مرحلة الصيانة حسب الكيلومترات.'
        : 'Map existing vehicles to maintenance plans with optional powertrain/variant rules, then test mileage resolution.'}
      right={(
        <Button
          variant="outline"
          className="h-9 rounded-xl border-zinc-200 bg-white text-xs"
          onClick={() => {
            setEditingId('new');
            setDraft({ ...emptyDraft(), vehicleId: vehicleFilter });
          }}
        >
          <Plus size={14} className="me-1.5" />
          {isRTL ? 'ربط جديد' : 'New mapping'}
        </Button>
      )}
    >
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <FieldGroup>
          <FieldLabel>{isRTL ? 'فلترة حسب السيارة' : 'Filter by vehicle'}</FieldLabel>
          <Select value={vehicleFilter || 'all'} onValueChange={(value) => setVehicleFilter(value === 'all' ? '' : value)}>
            <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white">
              <SelectValue placeholder={isRTL ? 'كل السيارات' : 'All vehicles'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل السيارات' : 'All vehicles'}</SelectItem>
              {vehicles.map((vehicle: any) => (
                <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicleLabel(vehicle)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <div className="flex min-w-36 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <Link2 size={17} className="text-[#0a1f44]" />
          <div>
            <div className="text-[11px] text-zinc-400">{isRTL ? 'الربطات' : 'Mappings'}</div>
            <div className="text-lg font-semibold text-zinc-900">{mappings.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          {mappingsQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-9 text-center text-sm text-zinc-400">
              {isRTL ? 'جاري تحميل الربطات...' : 'Loading mappings...'}
            </div>
          ) : mappings.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditingId('new')}
              className="w-full rounded-2xl border border-dashed border-[#c99a2e]/40 bg-[#c99a2e]/5 px-5 py-9 text-center"
            >
              <CarFront size={26} className="mx-auto mb-3 text-[#b7861f]" />
              <div className="text-sm font-semibold text-zinc-800">{isRTL ? 'لا توجد ربطات حتى الآن' : 'No vehicle mappings yet'}</div>
              <p className="mt-1 text-xs text-zinc-500">{isRTL ? 'لن يتم إنشاء أي ربط افتراضي.' : 'No default mappings are seeded.'}</p>
            </button>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping: any) => {
                const active = String(mapping.id) === editingId;
                return (
                  <button
                    type="button"
                    key={mapping.id}
                    onClick={() => setEditingId(String(mapping.id))}
                    className={'w-full rounded-2xl border p-4 text-start transition ' + (active ? 'border-[#c99a2e]/45 bg-[#fffaf0]' : 'border-zinc-100 bg-white hover:border-zinc-200')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900">
                          {[mapping.vehicleBrand, mapping.vehicleModel, mapping.vehicleYear].filter(Boolean).join(' ') || `#${mapping.vehicleId}`}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{mapping.planName || `Plan #${mapping.planId}`}</div>
                      </div>
                      {Number(mapping.isActive) === 1
                        ? <CheckCircle2 size={16} className="text-emerald-500" />
                        : <CircleOff size={16} className="text-zinc-300" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {mapping.powertrain && <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">{mapping.powertrain}</Badge>}
                      {mapping.variant && <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">{mapping.variant}</Badge>}
                      {(mapping.yearFrom != null || mapping.yearTo != null) && (
                        <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
                          {mapping.yearFrom ?? '…'}–{mapping.yearTo ?? '…'}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                      <Pencil size={10} className="me-1" />{isRTL ? 'تعديل' : 'Edit'}
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
                {editingId === 'new' ? (isRTL ? 'ربط سيارة جديد' : 'New vehicle mapping') : (isRTL ? 'تعديل الربط' : 'Edit mapping')}
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {isRTL ? 'المحرك والفئة ونطاق السنوات اختياريين؛ لا يتم افتراض قيم تلقائيًا.' : 'Powertrain, variant, and year range are optional; nothing is inferred automatically.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{isRTL ? 'نشط' : 'Active'}</span>
              <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'السيارة' : 'Vehicle'}</FieldLabel>
              <Select value={draft.vehicleId} onValueChange={(value) => setDraft((prev) => ({ ...prev, vehicleId: value }))}>
                <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue placeholder={isRTL ? 'اختر السيارة' : 'Select vehicle'} /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle: any) => <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicleLabel(vehicle)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'خطة الصيانة' : 'Maintenance plan'}</FieldLabel>
              <Select value={draft.planId} onValueChange={(value) => setDraft((prev) => ({ ...prev, planId: value }))}>
                <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue placeholder={isRTL ? 'اختر الخطة' : 'Select plan'} /></SelectTrigger>
                <SelectContent>
                  {plans.map((plan: any) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'Powertrain / المحرك' : 'Powertrain'}</FieldLabel>
              <Input className="h-10 rounded-xl border-zinc-200 bg-white" value={draft.powertrain} onChange={(e) => setDraft((prev) => ({ ...prev, powertrain: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'الفئة / Variant' : 'Variant'}</FieldLabel>
              <Input className="h-10 rounded-xl border-zinc-200 bg-white" value={draft.variant} onChange={(e) => setDraft((prev) => ({ ...prev, variant: e.target.value }))} />
            </FieldGroup>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'من سنة' : 'Year from'}</FieldLabel>
              <Input type="number" className="h-10 rounded-xl border-zinc-200 bg-white" value={draft.yearFrom} onChange={(e) => setDraft((prev) => ({ ...prev, yearFrom: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'إلى سنة' : 'Year to'}</FieldLabel>
              <Input type="number" className="h-10 rounded-xl border-zinc-200 bg-white" value={draft.yearTo} onChange={(e) => setDraft((prev) => ({ ...prev, yearTo: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'الترتيب' : 'Sort order'}</FieldLabel>
              <Input type="number" className="h-10 rounded-xl border-zinc-200 bg-white" value={draft.sortOrder} onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: e.target.value }))} />
            </FieldGroup>
          </div>

          <div className="mt-3">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'ملاحظات' : 'Notes'}</FieldLabel>
              <Textarea className="min-h-16 rounded-xl border-zinc-200 bg-white" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
            </FieldGroup>
          </div>

          <Button className="mt-4 h-10 rounded-xl bg-[#0a1f44] px-5 text-white hover:bg-[#112b58]" disabled={busy} onClick={save}>
            {busy ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : editingId === 'new' ? (isRTL ? 'إنشاء الربط' : 'Create mapping') : (isRTL ? 'حفظ الربط' : 'Save mapping')}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Gauge size={16} className="text-[#b7861f]" />
          <div>
            <div className="text-sm font-semibold text-zinc-900">{isRTL ? 'اختبار تحديد الصيانة حسب الكيلومترات' : 'Mileage resolution test'}</div>
            <p className="mt-0.5 text-xs text-zinc-400">{isRTL ? 'يعرض Exact / Previous / Next بدون اختيار صامت عند وجود أكثر من ربط.' : 'Shows Exact / Previous / Next and never silently chooses between ambiguous mappings.'}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <FieldGroup>
            <FieldLabel>{isRTL ? 'السيارة' : 'Vehicle'}</FieldLabel>
            <Select value={resolver.vehicleId} onValueChange={(value) => setResolver((prev) => ({ ...prev, vehicleId: value }))}>
              <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-zinc-50"><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle: any) => <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicleLabel(vehicle)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>{isRTL ? 'الكيلومترات' : 'Mileage'}</FieldLabel>
            <Input type="number" min="0" className="h-10 rounded-xl border-zinc-200 bg-zinc-50" value={resolver.mileageKm} onChange={(e) => setResolver((prev) => ({ ...prev, mileageKm: e.target.value }))} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Powertrain</FieldLabel>
            <Input className="h-10 rounded-xl border-zinc-200 bg-zinc-50" value={resolver.powertrain} onChange={(e) => setResolver((prev) => ({ ...prev, powertrain: e.target.value }))} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>{isRTL ? 'الفئة' : 'Variant'}</FieldLabel>
            <Input className="h-10 rounded-xl border-zinc-200 bg-zinc-50" value={resolver.variant} onChange={(e) => setResolver((prev) => ({ ...prev, variant: e.target.value }))} />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>{isRTL ? 'السنة' : 'Year'}</FieldLabel>
            <Input type="number" className="h-10 rounded-xl border-zinc-200 bg-zinc-50" value={resolver.year} onChange={(e) => setResolver((prev) => ({ ...prev, year: e.target.value }))} />
          </FieldGroup>
        </div>

        {resolutionQ.isFetching && <div className="mt-4 text-xs text-zinc-400">{isRTL ? 'جاري التحليل...' : 'Resolving...'}</div>}

        {resolution && (
          <div className="mt-4">
            {resolution.ambiguous ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><CircleAlert size={16} />{isRTL ? 'الربط غير محدد بشكل وحيد' : 'Mapping is ambiguous'}</div>
                <p className="mt-1 text-xs text-amber-700">{isRTL ? 'حدد Powertrain / Variant / السنة بشكل أدق، أو اجعل ربطًا واحدًا Default.' : 'Provide a more specific powertrain / variant / year, or keep one default mapping.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(resolution.candidates ?? []).map((candidate: any) => (
                    <Badge key={candidate.id} variant="outline" className="border-amber-200 bg-white text-amber-800">{candidate.planName || `Plan #${candidate.planId}`}</Badge>
                  ))}
                </div>
              </div>
            ) : resolution.mapping ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#0a1f44] text-white">{resolution.mapping.planName || `Plan #${resolution.mapping.planId}`}</Badge>
                  {resolution.mapping.powertrain && <Badge variant="outline">{resolution.mapping.powertrain}</Badge>}
                  {resolution.mapping.variant && <Badge variant="outline">{resolution.mapping.variant}</Badge>}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {intervalCard(resolution.exactInterval, isRTL ? 'مطابقة مباشرة' : 'Exact interval', 'exact')}
                  {intervalCard(resolution.previousInterval, isRTL ? 'المرحلة السابقة' : 'Previous interval', 'muted')}
                  {intervalCard(resolution.nextInterval, isRTL ? 'المرحلة التالية' : 'Next interval', 'muted')}
                </div>
                {!resolution.exactInterval && !resolution.previousInterval && !resolution.nextInterval && (
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500">
                    {isRTL ? 'الخطة المختارة لا تحتوي مراحل صيانة نشطة.' : 'The selected plan has no active maintenance intervals.'}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500">
                {isRTL ? 'لا يوجد ربط صيانة مطابق لهذه السيارة.' : 'No maintenance mapping matches this vehicle.'}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
