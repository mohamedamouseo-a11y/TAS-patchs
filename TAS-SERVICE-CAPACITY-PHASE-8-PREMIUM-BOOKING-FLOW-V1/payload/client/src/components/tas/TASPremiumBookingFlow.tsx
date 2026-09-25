import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SectionCard } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  Wrench,
} from 'lucide-react';

type Props = {
  onCreated?: () => void | Promise<void>;
};

function todayValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function vehicleLabel(vehicle: any) {
  return [vehicle?.brand, vehicle?.model, vehicle?.year].filter(Boolean).join(' ') || `Vehicle #${vehicle?.id ?? '—'}`;
}

function mileageLabel(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? `${new Intl.NumberFormat('en-US').format(n)} km` : '—';
}

function timeLabel(value: unknown) {
  const text = String(value ?? '');
  const match = text.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? text;
}

function stepClass(active: boolean, done: boolean) {
  if (active) return 'border-[#c99a2e]/50 bg-[#fff9ec] text-[#7c5711]';
  if (done) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-zinc-100 bg-white text-zinc-400';
}

export default function TASPremiumBookingFlow({ onCreated }: Props) {
  const { isRTL } = useLanguage();

  const vehiclesQ = trpc.tas.catalog.listVehicles.useQuery({ activeOnly: true });
  const branchesQ = trpc.tas.branches.list.useQuery({});
  const servicesQ = trpc.tas.service.listTypes.useQuery();

  const vehicles: any[] = vehiclesQ.data ?? [];
  const branches: any[] = branchesQ.data ?? [];
  const services: any[] = servicesQ.data ?? [];

  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [powertrain, setPowertrain] = useState('');
  const [variant, setVariant] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [maintenanceChoice, setMaintenanceChoice] = useState<'unselected' | 'general' | string>('unselected');
  const [branchId, setBranchId] = useState('');
  const [serviceDate, setServiceDate] = useState(todayValue());
  const [selectedSlotStart, setSelectedSlotStart] = useState('');
  const [notes, setNotes] = useState('');

  const selectedVehicle = useMemo(
    () => vehicles.find((row: any) => String(row.id) === vehicleId),
    [vehicles, vehicleId],
  );
  const selectedBranch = useMemo(
    () => branches.find((row: any) => String(row.id) === branchId),
    [branches, branchId],
  );
  const selectedService = useMemo(
    () => services.find((row: any) => String(row.id) === serviceTypeId),
    [services, serviceTypeId],
  );

  useEffect(() => {
    if (!selectedVehicle) return;
    setVehicleYear(selectedVehicle.year == null ? '' : String(selectedVehicle.year));
  }, [selectedVehicle]);

  const numericVehicleId = Number(vehicleId || 0);
  const numericMileage = mileageKm === '' ? -1 : Number(mileageKm);

  const resolutionQ = trpc.tas.service.resolveMaintenanceMileage.useQuery({
    vehicleId: numericVehicleId,
    mileageKm: numericMileage,
    powertrain: powertrain.trim() || undefined,
    variant: variant.trim() || undefined,
    year: vehicleYear ? Number(vehicleYear) : undefined,
  }, {
    enabled: numericVehicleId > 0 && Number.isInteger(numericMileage) && numericMileage >= 0,
  });

  const resolution: any = resolutionQ.data;

  const intervalOptions = useMemo(() => {
    const rows = [
      { key: 'exact', labelAr: 'مطابقة مباشرة', labelEn: 'Exact mileage', row: resolution?.exactInterval },
      { key: 'previous', labelAr: 'المرحلة السابقة', labelEn: 'Previous interval', row: resolution?.previousInterval },
      { key: 'next', labelAr: 'المرحلة التالية', labelEn: 'Next interval', row: resolution?.nextInterval },
    ];
    const seen = new Set<number>();
    return rows.filter((entry) => {
      const id = Number(entry.row?.id ?? 0);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [resolution]);

  useEffect(() => {
    const exactId = Number(resolution?.exactInterval?.id ?? 0);
    if (resolution?.mapping && !resolution?.ambiguous && exactId > 0) {
      setMaintenanceChoice(String(exactId));
    } else {
      setMaintenanceChoice('unselected');
    }
  }, [
    vehicleId,
    mileageKm,
    powertrain,
    variant,
    vehicleYear,
    resolution?.mapping?.id,
    resolution?.ambiguous,
    resolution?.exactInterval?.id,
  ]);

  const selectedInterval = useMemo(() => {
    if (maintenanceChoice === 'general' || maintenanceChoice === 'unselected') return null;
    return intervalOptions.find((entry) => String(entry.row?.id) === maintenanceChoice)?.row ?? null;
  }, [maintenanceChoice, intervalOptions]);

  useEffect(() => {
    setSelectedSlotStart('');
  }, [branchId, serviceDate, serviceTypeId, maintenanceChoice]);

  const slotsQ = trpc.tas.service.getAvailableSlots.useQuery({
    day: serviceDate,
    branchId: Number(branchId || 0) || undefined,
    serviceTypeId: Number(serviceTypeId || 0) || undefined,
    maintenanceIntervalId: selectedInterval ? Number(selectedInterval.id) : undefined,
  }, {
    enabled: step >= 3 && Boolean(serviceDate && branchId && serviceTypeId && maintenanceChoice !== 'unselected'),
  });

  const slots: any[] = (slotsQ.data ?? []).filter((row: any) => Number(row.availableCapacity ?? 0) > 0);
  const selectedSlot = slots.find((row: any) => String(row.startAt) === selectedSlotStart) ?? null;

  const createBooking = trpc.tas.service.createAppointment.useMutation({
    onSuccess: async (data: any) => {
      const bay = data?.bayName || data?.bayCode;
      toast.success(
        bay
          ? (isRTL ? `تم تأكيد الحجز وتعيين Bay: ${bay}` : `Booking confirmed • Bay: ${bay}`)
          : (isRTL ? 'تم تأكيد الحجز' : 'Booking confirmed'),
      );
      await onCreated?.();
      setStep(1);
      setCustomerName('');
      setCustomerPhone('');
      setVehicleId('');
      setVehicleYear('');
      setMileageKm('');
      setPowertrain('');
      setVariant('');
      setServiceTypeId('');
      setMaintenanceChoice('unselected');
      setBranchId('');
      setServiceDate(todayValue());
      setSelectedSlotStart('');
      setNotes('');
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تأكيد الحجز' : 'Could not confirm booking')),
  });

  const customerReady = Boolean(
    customerName.trim()
    && customerPhone.trim()
    && numericVehicleId > 0
    && Number.isInteger(numericMileage)
    && numericMileage >= 0,
  );
  const maintenanceReady = Boolean(serviceTypeId && maintenanceChoice !== 'unselected');
  const slotReady = Boolean(branchId && serviceDate && selectedSlot);

  const selectedMapping = resolution?.mapping ?? null;
  const canUseMaintenance = Boolean(selectedMapping && !resolution?.ambiguous);

  const goNext = () => {
    if (step === 1 && !customerReady) {
      toast.error(isRTL ? 'أكمل بيانات العميل والسيارة والكيلومترات' : 'Complete customer, vehicle, and mileage details');
      return;
    }
    if (step === 2 && !maintenanceReady) {
      toast.error(isRTL ? 'اختر نوع الخدمة وحدد سياق الصيانة أو General Service' : 'Select a service type and maintenance context or General Service');
      return;
    }
    if (step === 3 && !slotReady) {
      toast.error(isRTL ? 'اختر فرعًا وموعدًا متاحًا' : 'Select a branch and an available slot');
      return;
    }
    setStep((value) => Math.min(4, value + 1));
  };

  const steps = [
    { id: 1, ar: 'العميل والسيارة', en: 'Customer & vehicle', icon: UserRound },
    { id: 2, ar: 'سياق الصيانة', en: 'Maintenance', icon: Wrench },
    { id: 3, ar: 'الموعد المتاح', en: 'Availability', icon: CalendarDays },
    { id: 4, ar: 'مراجعة وتأكيد', en: 'Review', icon: ShieldCheck },
  ];

  const submit = () => {
    if (!selectedSlot || !selectedVehicle || !selectedService || !selectedBranch) return;
    if (maintenanceChoice !== 'general' && !selectedInterval) {
      toast.error(isRTL ? 'اختر مرحلة صيانة صالحة أو General Service' : 'Select a valid maintenance interval or General Service');
      return;
    }
    if (selectedInterval && !canUseMaintenance) {
      toast.error(isRTL ? 'ربط خطة الصيانة غير محسوم لهذه السيارة' : 'Maintenance mapping is not deterministic for this vehicle');
      return;
    }

    createBooking.mutate({
      bookingMode: 'premium_v1',
      branchId: Number(branchId),
      serviceTypeId: Number(serviceTypeId),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      vehicleId: Number(vehicleId),
      vehicleYear: vehicleYear ? Number(vehicleYear) : null,
      vehicleBrand: selectedVehicle.brand ?? null,
      vehicleModel: selectedVehicle.model ?? null,
      mileageKm: Number(mileageKm),
      powertrain: powertrain.trim() || null,
      variant: variant.trim() || null,
      maintenanceMappingId: selectedInterval ? Number(selectedMapping?.id) : null,
      maintenanceIntervalId: selectedInterval ? Number(selectedInterval.id) : null,
      startAt: selectedSlot.startAt,
      status: 'PendingConfirmation',
      sourceChannel: 'CRM',
      serviceNotes: notes.trim() || null,
    });
  };

  return (
    <SectionCard
      title={isRTL ? 'الحجز الذكي للصيانة' : 'Premium service booking'}
      subtitle={isRTL
        ? 'من السيارة والكيلومترات إلى خطة الصيانة والموعد والـBay — بدون إدخال وقت عشوائي.'
        : 'From vehicle and mileage to maintenance context, real availability, and Bay assignment — without arbitrary times.'}
      right={(
        <Badge className="border-0 bg-gradient-to-r from-[#0a1f44] to-[#173b72] text-white">
          <Sparkles size={12} className="me-1.5" />
          Phase 8
        </Badge>
      )}
    >
      <div className="mb-6 grid gap-2 md:grid-cols-4">
        {steps.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const done = step > item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id < step) setStep(item.id);
              }}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-start transition ${stepClass(active, done)}`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20">
                {done ? <Check size={14} /> : <Icon size={14} />}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60">0{item.id}</div>
                <div className="text-xs font-semibold">{isRTL ? item.ar : item.en}</div>
              </div>
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'اسم العميل' : 'Customer name'}</FieldLabel>
              <Input className="h-11 rounded-xl border-zinc-200 bg-white" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'رقم الهاتف' : 'Phone'}</FieldLabel>
              <Input className="h-11 rounded-xl border-zinc-200 bg-white" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="01xxxxxxxxx" />
            </FieldGroup>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr_0.7fr]">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'السيارة' : 'Vehicle'}</FieldLabel>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                  <SelectValue placeholder={isRTL ? 'اختر من كتالوج السيارات' : 'Select from vehicle catalog'} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle: any) => (
                    <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicleLabel(vehicle)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'سنة السيارة' : 'Vehicle year'}</FieldLabel>
              <Input type="number" className="h-11 rounded-xl border-zinc-200 bg-white" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'الكيلومترات الحالية' : 'Current mileage'}</FieldLabel>
              <Input type="number" min={0} className="h-11 rounded-xl border-zinc-200 bg-white" value={mileageKm} onChange={(e) => setMileageKm(e.target.value)} placeholder="60000" />
            </FieldGroup>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'المحرك / Powertrain — اختياري' : 'Powertrain — optional'}</FieldLabel>
              <Input className="h-11 rounded-xl border-zinc-200 bg-white" value={powertrain} onChange={(e) => setPowertrain(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'الفئة / Variant — اختياري' : 'Variant — optional'}</FieldLabel>
              <Input className="h-11 rounded-xl border-zinc-200 bg-white" value={variant} onChange={(e) => setVariant(e.target.value)} />
            </FieldGroup>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <CarFront size={14} />
                {isRTL ? 'السيارة والكيلومترات' : 'Vehicle & mileage'}
              </div>
              <div className="mt-2 font-semibold text-zinc-900">{vehicleLabel(selectedVehicle)}</div>
              <div className="mt-1 text-xs text-zinc-500">{mileageLabel(mileageKm)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <Route size={14} />
                {isRTL ? 'نتيجة خطة الصيانة' : 'Maintenance resolution'}
              </div>
              {resolutionQ.isLoading ? (
                <div className="mt-2 text-sm text-zinc-400">{isRTL ? 'جاري تحديد الخطة...' : 'Resolving plan...'}</div>
              ) : resolution?.ambiguous ? (
                <div className="mt-2 flex items-start gap-2 text-sm text-amber-700">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{isRTL ? `يوجد ${resolution?.candidates?.length ?? 0} ربطات محتملة. لن يتم تخمين الخطة.` : `${resolution?.candidates?.length ?? 0} mappings match. TAS will not guess a plan.`}</span>
                </div>
              ) : selectedMapping ? (
                <div className="mt-2">
                  <div className="font-semibold text-zinc-900">{selectedMapping.planName || `Plan #${selectedMapping.planId}`}</div>
                  <div className="mt-1 text-xs text-emerald-600">{isRTL ? 'ربط محدد وواضح' : 'Deterministic mapping'}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-400">{isRTL ? 'لا توجد خطة صيانة محددة لهذه البيانات.' : 'No maintenance plan resolves for these details.'}</div>
              )}
            </div>
          </div>

          <FieldGroup>
            <FieldLabel>{isRTL ? 'نوع الخدمة' : 'Service type'}</FieldLabel>
            <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
              <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                <SelectValue placeholder={isRTL ? 'اختر نوع الخدمة' : 'Select service type'} />
              </SelectTrigger>
              <SelectContent>
                {services.map((service: any) => (
                  <SelectItem key={service.id} value={String(service.id)}>{service.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          <div>
            <div className="mb-2 text-xs font-semibold text-zinc-600">{isRTL ? 'سياق الصيانة' : 'Maintenance context'}</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setMaintenanceChoice('general')}
                className={`rounded-2xl border p-4 text-start transition ${maintenanceChoice === 'general' ? 'border-[#c99a2e]/50 bg-[#fff9ec]' : 'border-zinc-100 bg-white hover:border-zinc-200'}`}
              >
                <Gauge size={16} className="text-[#0a1f44]" />
                <div className="mt-2 text-sm font-semibold text-zinc-900">{isRTL ? 'General Service' : 'General service'}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{isRTL ? 'بدون ربط بمرحلة صيانة. تستخدم مدة نوع الخدمة.' : 'No maintenance interval. Uses service-type duration.'}</div>
              </button>

              {intervalOptions.map((entry) => {
                const interval = entry.row;
                const active = maintenanceChoice === String(interval.id);
                return (
                  <button
                    key={interval.id}
                    type="button"
                    disabled={!canUseMaintenance}
                    onClick={() => setMaintenanceChoice(String(interval.id))}
                    className={`rounded-2xl border p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'border-emerald-300 bg-emerald-50/70' : 'border-zinc-100 bg-white hover:border-zinc-200'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? entry.labelAr : entry.labelEn}</div>
                      {entry.key === 'exact' && <Badge className="bg-emerald-600 text-white">Exact</Badge>}
                    </div>
                    <div className="mt-2 font-semibold text-zinc-900">{mileageLabel(interval.mileageKm)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{Number(interval.durationMinutes ?? 60)} {isRTL ? 'دقيقة' : 'min'}{interval.label ? ` • ${interval.label}` : ''}</div>
                    {entry.key !== 'exact' && (
                      <div className="mt-2 text-[10px] text-amber-600">{isRTL ? 'اختيار يدوي — لا يعني أنها الصيانة المستحقة.' : 'Manual choice — not inferred as due.'}</div>
                    )}
                  </button>
                );
              })}
            </div>
            {maintenanceChoice === 'unselected' && (
              <div className="mt-2 text-xs text-amber-700">
                {isRTL ? 'اختر مرحلة صيانة صراحة أو اختر General Service.' : 'Explicitly select a maintenance interval or choose General Service.'}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'الفرع' : 'Branch'}</FieldLabel>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-11 rounded-xl border-zinc-200 bg-white">
                  <SelectValue placeholder={isRTL ? 'اختر الفرع' : 'Select branch'} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'التاريخ' : 'Date'}</FieldLabel>
              <Input type="date" className="h-11 rounded-xl border-zinc-200 bg-white" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            <span className="font-semibold">{isRTL ? 'المدة المخططة:' : 'Planned duration:'}</span>{' '}
            {selectedInterval?.durationMinutes ?? selectedService?.durationMinutes ?? 60} {isRTL ? 'دقيقة' : 'min'}{' '}
            <span className="text-zinc-400">•</span>{' '}
            {selectedInterval ? (isRTL ? 'من مرحلة الصيانة المختارة' : 'from selected maintenance interval') : (isRTL ? 'من نوع الخدمة' : 'from service type')}
          </div>

          {!branchId ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              <MapPin size={25} className="mx-auto mb-2 text-zinc-300" />
              {isRTL ? 'اختر الفرع لعرض المواعيد الفعلية.' : 'Select a branch to load real availability.'}
            </div>
          ) : slotsQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              {isRTL ? 'جاري حساب الـAvailability...' : 'Calculating availability...'}
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center">
              <Clock3 size={25} className="mx-auto mb-2 text-zinc-300" />
              <div className="text-sm font-semibold text-zinc-700">{isRTL ? 'لا توجد مواعيد متاحة في هذا اليوم' : 'No available slots on this date'}</div>
              <div className="mt-1 text-xs text-zinc-400">{isRTL ? 'جرّب يومًا آخر أو راجع إعدادات الفرع والـBays.' : 'Try another date or review branch/Bay configuration.'}</div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slots.map((slot: any) => {
                const active = selectedSlotStart === String(slot.startAt);
                return (
                  <button
                    key={String(slot.startAt)}
                    type="button"
                    onClick={() => setSelectedSlotStart(String(slot.startAt))}
                    className={`rounded-2xl border p-4 text-start transition ${active ? 'border-[#c99a2e]/60 bg-[#fff9ec] shadow-sm' : 'border-zinc-100 bg-white hover:border-zinc-200'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-semibold text-zinc-900">{timeLabel(slot.startAt)}</div>
                      <Badge className="bg-emerald-600 text-white">{Number(slot.availableCapacity ?? 0)} {isRTL ? 'متاح' : 'free'}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{timeLabel(slot.startAt)} → {timeLabel(slot.endAt)}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-400">
                      {slot.capacitySource === 'service_bays' ? 'Bay-backed' : 'Legacy capacity'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <UserRound size={15} className="text-[#0a1f44]" />
              <div className="mt-2 text-xs text-zinc-400">{isRTL ? 'العميل' : 'Customer'}</div>
              <div className="mt-1 font-semibold text-zinc-900">{customerName}</div>
              <div className="mt-1 text-xs text-zinc-500">{customerPhone}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <CarFront size={15} className="text-[#0a1f44]" />
              <div className="mt-2 text-xs text-zinc-400">{isRTL ? 'السيارة' : 'Vehicle'}</div>
              <div className="mt-1 font-semibold text-zinc-900">{vehicleLabel(selectedVehicle)}</div>
              <div className="mt-1 text-xs text-zinc-500">{mileageLabel(mileageKm)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <Wrench size={15} className="text-[#0a1f44]" />
              <div className="mt-2 text-xs text-zinc-400">{isRTL ? 'الخدمة والصيانة' : 'Service & maintenance'}</div>
              <div className="mt-1 font-semibold text-zinc-900">{selectedService?.name || '—'}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {selectedInterval
                  ? `${selectedMapping?.planName || 'Maintenance'} • ${mileageLabel(selectedInterval.mileageKm)} • ${selectedInterval.durationMinutes} min`
                  : (isRTL ? 'General Service' : 'General service')}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <CalendarDays size={15} className="text-[#0a1f44]" />
              <div className="mt-2 text-xs text-zinc-400">{isRTL ? 'الموعد' : 'Appointment'}</div>
              <div className="mt-1 font-semibold text-zinc-900">{selectedBranch?.name || '—'}</div>
              <div className="mt-1 text-xs text-zinc-500">{serviceDate} • {timeLabel(selectedSlot?.startAt)} → {timeLabel(selectedSlot?.endAt)}</div>
            </div>
          </div>

          <FieldGroup>
            <FieldLabel>{isRTL ? 'ملاحظات الخدمة — اختياري' : 'Service notes — optional'}</FieldLabel>
            <Textarea rows={3} className="rounded-xl border-zinc-200 bg-white" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FieldGroup>

          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <div className="text-sm font-semibold text-emerald-800">{isRTL ? 'جاهز للتأكيد' : 'Ready to confirm'}</div>
              <div className="mt-1 text-xs leading-5 text-emerald-700">
                {isRTL
                  ? 'عند التأكيد سيعيد TAS فحص الـslot ثم يعيّن Bay متاحة داخل transaction. لو السعة تغيرت في نفس اللحظة سيُرفض الحجز بدل الـoverbooking.'
                  : 'On confirmation TAS revalidates the slot, then assigns an available Bay inside the transaction. If capacity changed concurrently, the booking is rejected instead of overbooking.'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        <Button
          variant="outline"
          disabled={step === 1 || createBooking.isPending}
          onClick={() => setStep((value) => Math.max(1, value - 1))}
          className="rounded-xl"
        >
          {isRTL ? <ChevronRight size={15} className="me-1.5" /> : <ChevronLeft size={15} className="me-1.5" />}
          {isRTL ? 'السابق' : 'Back'}
        </Button>

        {step < 4 ? (
          <Button onClick={goNext} className="rounded-xl bg-[#0a1f44] text-white hover:bg-[#0d2550]">
            {isRTL ? 'التالي' : 'Continue'}
            {isRTL ? <ChevronLeft size={15} className="ms-1.5" /> : <ChevronRight size={15} className="ms-1.5" />}
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!slotReady || createBooking.isPending}
            className="rounded-xl bg-[#0a1f44] px-6 text-white hover:bg-[#0d2550]"
          >
            <ShieldCheck size={15} className="me-1.5" />
            {createBooking.isPending
              ? (isRTL ? 'جاري التأكيد...' : 'Confirming...')
              : (isRTL ? 'تأكيد الحجز وتعيين Bay' : 'Confirm booking & assign Bay')}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
