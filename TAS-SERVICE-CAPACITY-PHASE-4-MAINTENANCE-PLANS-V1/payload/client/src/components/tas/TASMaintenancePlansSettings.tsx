import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SectionCard } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { BookOpen, CheckCircle2, CircleOff, Clock3, Gauge, Hash, Pencil, Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';

type PlanDraft = {
  name: string;
  code: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

type IntervalDraft = {
  mileageKm: string;
  label: string;
  durationMinutes: string;
  notes: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyPlan = (): PlanDraft => ({
  name: '',
  code: '',
  description: '',
  sortOrder: '0',
  isActive: true,
});

const emptyInterval = (): IntervalDraft => ({
  mileageKm: '',
  label: '',
  durationMinutes: '60',
  notes: '',
  sortOrder: '0',
  isActive: true,
});

function formatMileage(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US').format(number) + ' km';
}

function formatDuration(value: unknown, isRTL: boolean) {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} ${isRTL ? 'دقيقة' : 'min'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return `${hours} ${isRTL ? 'ساعة' : hours === 1 ? 'hr' : 'hrs'}`;
  return `${hours}:${String(rest).padStart(2, '0')} ${isRTL ? 'ساعة' : 'hrs'}`;
}

export default function TASMaintenancePlansSettings() {
  const { isRTL } = useLanguage();
  const plansQ = trpc.tas.service.listMaintenancePlans.useQuery({ includeInactive: true });
  const plans = plansQ.data ?? [];

  const [selectedPlanId, setSelectedPlanId] = useState<'new' | string>('new');
  const [planDraft, setPlanDraft] = useState<PlanDraft>(emptyPlan());
  const [selectedIntervalId, setSelectedIntervalId] = useState<'new' | string>('new');
  const [intervalDraft, setIntervalDraft] = useState<IntervalDraft>(emptyInterval());

  const selectedPlan = useMemo(
    () => plans.find((plan: any) => String(plan.id) === selectedPlanId),
    [plans, selectedPlanId],
  );

  const numericPlanId = selectedPlanId === 'new' ? 0 : Number(selectedPlanId || 0);
  const intervalsQ = trpc.tas.service.listMaintenanceIntervals.useQuery(
    { planId: numericPlanId, includeInactive: true },
    { enabled: numericPlanId > 0 },
  );
  const intervals = intervalsQ.data ?? [];

  const selectedInterval = useMemo(
    () => intervals.find((interval: any) => String(interval.id) === selectedIntervalId),
    [intervals, selectedIntervalId],
  );

  useEffect(() => {
    if (selectedPlanId === 'new') {
      setPlanDraft(emptyPlan());
      return;
    }
    if (!selectedPlan) return;
    setPlanDraft({
      name: String(selectedPlan.name ?? ''),
      code: String(selectedPlan.code ?? ''),
      description: String(selectedPlan.description ?? ''),
      sortOrder: String(selectedPlan.sortOrder ?? 0),
      isActive: Number(selectedPlan.isActive) === 1,
    });
  }, [selectedPlanId, selectedPlan]);

  useEffect(() => {
    setSelectedIntervalId('new');
    setIntervalDraft(emptyInterval());
  }, [selectedPlanId]);

  useEffect(() => {
    if (selectedIntervalId === 'new') {
      setIntervalDraft(emptyInterval());
      return;
    }
    if (!selectedInterval) return;
    setIntervalDraft({
      mileageKm: String(selectedInterval.mileageKm ?? ''),
      label: String(selectedInterval.label ?? ''),
      durationMinutes: String(selectedInterval.durationMinutes ?? 60),
      notes: String(selectedInterval.notes ?? ''),
      sortOrder: String(selectedInterval.sortOrder ?? selectedInterval.mileageKm ?? 0),
      isActive: Number(selectedInterval.isActive) === 1,
    });
  }, [selectedIntervalId, selectedInterval]);

  const createPlan = trpc.tas.service.createMaintenancePlan.useMutation({
    onSuccess: async (data: any) => {
      toast.success(isRTL ? 'تم إنشاء خطة الصيانة' : 'Maintenance plan created');
      await plansQ.refetch();
      if (data?.id) setSelectedPlanId(String(data.id));
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر إنشاء الخطة' : 'Could not create plan')),
  });

  const updatePlan = trpc.tas.service.updateMaintenancePlan.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث خطة الصيانة' : 'Maintenance plan updated');
      await plansQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث الخطة' : 'Could not update plan')),
  });

  const createInterval = trpc.tas.service.createMaintenanceInterval.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تمت إضافة مرحلة الصيانة' : 'Maintenance interval added');
      setSelectedIntervalId('new');
      setIntervalDraft(emptyInterval());
      await intervalsQ.refetch();
      await plansQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر إضافة المرحلة' : 'Could not add interval')),
  });

  const updateInterval = trpc.tas.service.updateMaintenanceInterval.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث مرحلة الصيانة' : 'Maintenance interval updated');
      await intervalsQ.refetch();
      await plansQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث المرحلة' : 'Could not update interval')),
  });

  const savePlan = () => {
    if (!planDraft.name.trim()) {
      toast.error(isRTL ? 'اكتب اسم خطة الصيانة' : 'Plan name is required');
      return;
    }
    const sortOrder = Number(planDraft.sortOrder || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      toast.error(isRTL ? 'ترتيب الخطة غير صالح' : 'Invalid plan sort order');
      return;
    }
    const payload = {
      name: planDraft.name.trim(),
      code: planDraft.code.trim() || null,
      description: planDraft.description.trim() || null,
      sortOrder,
      isActive: planDraft.isActive,
    };

    if (selectedPlanId === 'new') createPlan.mutate(payload);
    else updatePlan.mutate({ id: Number(selectedPlanId), ...payload });
  };

  const saveInterval = () => {
    if (!numericPlanId) {
      toast.error(isRTL ? 'احفظ الخطة أولًا' : 'Save the plan first');
      return;
    }
    const mileageKm = Number(intervalDraft.mileageKm);
    const durationMinutes = Number(intervalDraft.durationMinutes);
    const sortOrder = Number(intervalDraft.sortOrder || mileageKm || 0);

    if (!Number.isInteger(mileageKm) || mileageKm < 0 || mileageKm > 2000000) {
      toast.error(isRTL ? 'قيمة الكيلومترات غير صالحة' : 'Invalid mileage');
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 2880) {
      toast.error(isRTL ? 'مدة الصيانة يجب أن تكون بين 15 دقيقة و48 ساعة' : 'Duration must be between 15 minutes and 48 hours');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 2000000) {
      toast.error(isRTL ? 'ترتيب المرحلة غير صالح' : 'Invalid interval sort order');
      return;
    }

    const payload = {
      planId: numericPlanId,
      mileageKm,
      label: intervalDraft.label.trim() || null,
      durationMinutes,
      notes: intervalDraft.notes.trim() || null,
      sortOrder,
      isActive: intervalDraft.isActive,
    };

    if (selectedIntervalId === 'new') createInterval.mutate(payload);
    else updateInterval.mutate({ id: Number(selectedIntervalId), ...payload });
  };

  const activePlanCount = plans.filter((plan: any) => Number(plan.isActive) === 1).length;
  const activeIntervalCount = intervals.filter((interval: any) => Number(interval.isActive) === 1).length;
  const planBusy = createPlan.isPending || updatePlan.isPending;
  const intervalBusy = createInterval.isPending || updateInterval.isPending;

  return (
    <SectionCard
      title={isRTL ? 'خطط الصيانة الدورية' : 'Maintenance plans'}
      subtitle={isRTL
        ? 'أنشئ خطط الصيانة ومراحل الكيلومترات ومدد التنفيذ. ربط الخطط بالموديلات سيتم في المرحلة التالية.'
        : 'Create maintenance plans, mileage intervals, and service durations. Vehicle/model mapping comes in the next phase.'}
      right={(
        <Button
          variant="outline"
          className="h-9 rounded-xl border-zinc-200 bg-white text-xs"
          onClick={() => {
            setSelectedPlanId('new');
            setPlanDraft(emptyPlan());
          }}
        >
          <Plus size={14} className="me-1.5" />
          {isRTL ? 'خطة جديدة' : 'New plan'}
        </Button>
      )}
    >
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="rounded-2xl border border-zinc-100 bg-gradient-to-r from-white to-zinc-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen size={17} className="text-[#0a1f44]" />
            <div>
              <div className="text-[11px] text-zinc-400">{isRTL ? 'خطط الصيانة' : 'Maintenance plans'}</div>
              <div className="text-lg font-semibold text-zinc-900">{plans.length}</div>
            </div>
          </div>
        </div>
        <div className="flex min-w-28 items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <CheckCircle2 size={17} className="text-emerald-600" />
          <div>
            <div className="text-[11px] text-emerald-600/70">{isRTL ? 'خطط نشطة' : 'Active plans'}</div>
            <div className="text-lg font-semibold text-emerald-700">{activePlanCount}</div>
          </div>
        </div>
        <div className="flex min-w-28 items-center gap-2 rounded-2xl border border-[#c99a2e]/20 bg-[#fffaf0] px-4 py-3">
          <Gauge size={17} className="text-[#b7861f]" />
          <div>
            <div className="text-[11px] text-[#9b741f]">{isRTL ? 'مراحل الخطة' : 'Intervals'}</div>
            <div className="text-lg font-semibold text-[#7e5d16]">{numericPlanId ? intervals.length : '—'}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.25fr]">
        <div className="space-y-2">
          {plansQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-9 text-center text-sm text-zinc-400">
              {isRTL ? 'جاري تحميل الخطط...' : 'Loading plans...'}
            </div>
          ) : plans.length === 0 ? (
            <button
              type="button"
              onClick={() => setSelectedPlanId('new')}
              className="w-full rounded-2xl border border-dashed border-[#c99a2e]/40 bg-[#c99a2e]/5 px-5 py-8 text-center transition hover:bg-[#c99a2e]/10"
            >
              <Wrench size={24} className="mx-auto mb-3 text-[#b7861f]" />
              <div className="text-sm font-semibold text-zinc-800">{isRTL ? 'ابدأ بأول خطة صيانة' : 'Create your first maintenance plan'}</div>
              <p className="mt-1 text-xs text-zinc-500">{isRTL ? 'لن يتم إنشاء أي كيلومترات أو مدد افتراضية.' : 'No mileage or duration values are seeded.'}</p>
            </button>
          ) : (
            plans.map((plan: any) => {
              const active = String(plan.id) === selectedPlanId;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(String(plan.id))}
                  className={'w-full rounded-2xl border p-4 text-start transition ' + (active ? 'border-[#c99a2e]/45 bg-[#fffaf0] shadow-sm' : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50/50')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-zinc-900">{plan.name}</div>
                        {plan.code && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                            <Hash size={9} />{plan.code}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {Number(plan.intervalCount ?? 0)} {isRTL ? 'مرحلة' : 'intervals'}
                        <span className="mx-1.5 text-zinc-300">•</span>
                        {Number(plan.activeIntervalCount ?? 0)} {isRTL ? 'نشطة' : 'active'}
                      </div>
                    </div>
                    {Number(plan.isActive) === 1
                      ? <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />
                      : <CircleOff size={17} className="shrink-0 text-zinc-300" />}
                  </div>
                  {plan.description && <div className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">{plan.description}</div>}
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/40 p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {selectedPlanId === 'new' ? (isRTL ? 'خطة صيانة جديدة' : 'New maintenance plan') : (selectedPlan?.name || (isRTL ? 'إعدادات الخطة' : 'Plan settings'))}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {isRTL ? 'الخطة هنا Master مستقلة؛ الموديلات والمحركات ستُربط بها لاحقًا.' : 'This is the plan master; vehicle and powertrain mapping is added later.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{isRTL ? 'نشطة' : 'Active'}</span>
                <Switch checked={planDraft.isActive} onCheckedChange={(checked) => setPlanDraft((prev) => ({ ...prev, isActive: checked }))} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup>
                <FieldLabel>{isRTL ? 'اسم الخطة' : 'Plan name'}</FieldLabel>
                <Input
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  value={planDraft.name}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, name: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>{isRTL ? 'كود الخطة' : 'Plan code'}</FieldLabel>
                <Input
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  placeholder="PM-STD"
                  value={planDraft.code}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, code: e.target.value }))}
                />
              </FieldGroup>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
              <FieldGroup>
                <FieldLabel>{isRTL ? 'وصف الخطة' : 'Description'}</FieldLabel>
                <Textarea
                  className="min-h-20 rounded-xl border-zinc-200 bg-white"
                  value={planDraft.description}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel>{isRTL ? 'ترتيب العرض' : 'Sort order'}</FieldLabel>
                <Input
                  type="number"
                  className="h-10 rounded-xl border-zinc-200 bg-white"
                  value={planDraft.sortOrder}
                  onChange={(e) => setPlanDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
                />
              </FieldGroup>
            </div>

            <Button
              className="mt-4 h-10 rounded-xl bg-[#0a1f44] px-5 text-white hover:bg-[#112b58]"
              disabled={planBusy}
              onClick={savePlan}
            >
              {planBusy
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : selectedPlanId === 'new'
                  ? (isRTL ? 'إنشاء الخطة' : 'Create plan')
                  : (isRTL ? 'حفظ الخطة' : 'Save plan')}
            </Button>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <Gauge size={16} className="text-[#b7861f]" />
                  {isRTL ? 'مراحل الكيلومترات والمدة' : 'Mileage intervals & duration'}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {numericPlanId
                    ? (isRTL ? `${activeIntervalCount} مرحلة نشطة في هذه الخطة.` : `${activeIntervalCount} active intervals in this plan.`)
                    : (isRTL ? 'احفظ الخطة أولًا ثم أضف مراحل الصيانة.' : 'Save the plan first, then add intervals.')}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-9 rounded-xl border-zinc-200 bg-white text-xs"
                disabled={!numericPlanId}
                onClick={() => {
                  setSelectedIntervalId('new');
                  setIntervalDraft(emptyInterval());
                }}
              >
                <Plus size={14} className="me-1.5" />
                {isRTL ? 'إضافة مرحلة' : 'Add interval'}
              </Button>
            </div>

            {numericPlanId > 0 && (
              <div className="mb-5 grid gap-2 md:grid-cols-2">
                {intervalsQ.isLoading ? (
                  <div className="col-span-full rounded-xl border border-dashed border-zinc-200 px-4 py-7 text-center text-xs text-zinc-400">
                    {isRTL ? 'جاري تحميل المراحل...' : 'Loading intervals...'}
                  </div>
                ) : intervals.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedIntervalId('new')}
                    className="col-span-full rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-7 text-center text-xs text-zinc-500 transition hover:bg-zinc-50"
                  >
                    {isRTL ? 'لا توجد مراحل بعد — أضف أول مسافة صيانة.' : 'No intervals yet — add the first maintenance mileage.'}
                  </button>
                ) : (
                  intervals.map((interval: any) => {
                    const active = String(interval.id) === selectedIntervalId;
                    return (
                      <button
                        type="button"
                        key={interval.id}
                        onClick={() => setSelectedIntervalId(String(interval.id))}
                        className={'rounded-xl border p-3 text-start transition ' + (active ? 'border-[#c99a2e]/45 bg-[#fffaf0]' : 'border-zinc-100 bg-zinc-50/40 hover:border-zinc-200')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-zinc-900">{formatMileage(interval.mileageKm)}</div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                              <Clock3 size={12} />
                              {formatDuration(interval.durationMinutes, isRTL)}
                              {interval.label && <span className="text-zinc-300">•</span>}
                              {interval.label && <span className="truncate">{interval.label}</span>}
                            </div>
                          </div>
                          {Number(interval.isActive) === 1
                            ? <CheckCircle2 size={16} className="text-emerald-500" />
                            : <CircleOff size={16} className="text-zinc-300" />}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                          <span>{isRTL ? 'الترتيب' : 'Order'}: {interval.sortOrder ?? 0}</span>
                          <span className="inline-flex items-center gap-1"><Pencil size={10} />{isRTL ? 'تعديل' : 'Edit'}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <div className={numericPlanId ? 'rounded-2xl border border-zinc-100 bg-zinc-50/40 p-4' : 'pointer-events-none rounded-2xl border border-zinc-100 bg-zinc-50/40 p-4 opacity-50'}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {selectedIntervalId === 'new' ? (isRTL ? 'مرحلة جديدة' : 'New interval') : (isRTL ? 'تعديل المرحلة' : 'Edit interval')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{isRTL ? 'نشطة' : 'Active'}</span>
                  <Switch checked={intervalDraft.isActive} onCheckedChange={(checked) => setIntervalDraft((prev) => ({ ...prev, isActive: checked }))} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'الكيلومترات' : 'Mileage (km)'}</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    value={intervalDraft.mileageKm}
                    onChange={(e) => setIntervalDraft((prev) => ({ ...prev, mileageKm: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'المدة بالدقائق' : 'Duration (min)'}</FieldLabel>
                  <Input
                    type="number"
                    min="15"
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    value={intervalDraft.durationMinutes}
                    onChange={(e) => setIntervalDraft((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'اسم المرحلة' : 'Interval label'}</FieldLabel>
                  <Input
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                    value={intervalDraft.label}
                    onChange={(e) => setIntervalDraft((prev) => ({ ...prev, label: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'الترتيب' : 'Sort order'}</FieldLabel>
                  <Input
                    type="number"
                    className="h-10 rounded-xl border-zinc-200 bg-white"
                    value={intervalDraft.sortOrder}
                    onChange={(e) => setIntervalDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </FieldGroup>
              </div>

              <div className="mt-3">
                <FieldGroup>
                  <FieldLabel>{isRTL ? 'ملاحظات المرحلة' : 'Interval notes'}</FieldLabel>
                  <Textarea
                    className="min-h-16 rounded-xl border-zinc-200 bg-white"
                    value={intervalDraft.notes}
                    onChange={(e) => setIntervalDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </FieldGroup>
              </div>

              <Button
                className="mt-4 h-10 rounded-xl bg-[#0a1f44] px-5 text-white hover:bg-[#112b58]"
                disabled={!numericPlanId || intervalBusy}
                onClick={saveInterval}
              >
                {intervalBusy
                  ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                  : selectedIntervalId === 'new'
                    ? (isRTL ? 'إضافة المرحلة' : 'Add interval')
                    : (isRTL ? 'حفظ المرحلة' : 'Save interval')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
