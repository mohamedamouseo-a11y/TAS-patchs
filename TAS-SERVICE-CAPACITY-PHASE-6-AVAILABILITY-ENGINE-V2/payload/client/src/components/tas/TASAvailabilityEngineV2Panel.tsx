import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldGroup, FieldLabel, SectionCard } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Boxes, CalendarDays, Clock3, Gauge, TriangleAlert } from 'lucide-react';

function todayValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeLabel(value: unknown) {
  const text = String(value ?? '');
  const match = text.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? text;
}

export default function TASAvailabilityEngineV2Panel() {
  const { isRTL } = useLanguage();
  const branchesQ = trpc.tas.branches.list.useQuery();
  const servicesQ = trpc.tas.service.listTypes.useQuery();

  const branches = branchesQ.data ?? [];
  const services = servicesQ.data ?? [];

  const [branchId, setBranchId] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [date, setDate] = useState(todayValue());

  const selectedBranch = useMemo(
    () => branches.find((row: any) => String(row.id) === branchId),
    [branches, branchId],
  );
  const selectedService = useMemo(
    () => services.find((row: any) => String(row.id) === serviceTypeId),
    [services, serviceTypeId],
  );

  const slotsQ = trpc.tas.service.getAvailableSlots.useQuery({
    day: date,
    branchId: Number(branchId || 0) || undefined,
    serviceTypeId: Number(serviceTypeId || 0) || undefined,
  }, {
    enabled: Boolean(date && branchId && serviceTypeId),
  });

  const slots: any[] = slotsQ.data ?? [];
  const bayBacked = slots.some((slot: any) => slot.capacitySource === 'service_bays');
  const legacyBacked = slots.some((slot: any) => slot.capacitySource === 'legacy_capacity');
  const availableSlots = slots.filter((slot: any) => Number(slot.availableCapacity ?? 0) > 0).length;
  const configuredBayCount = slots[0]?.configuredBayCount ?? 0;

  return (
    <SectionCard
      title={isRTL ? 'Availability Engine V2' : 'Availability Engine V2'}
      subtitle={isRTL
        ? 'عرض تشغيلي للـcapacity الفعلية حسب الـBays والحجوزات المتداخلة، بدون Auto Assignment في هذه المرحلة.'
        : 'Operational visibility into real Bay-backed capacity and overlapping bookings, without auto-assignment in this phase.'}
    >
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_220px]">
        <FieldGroup>
          <FieldLabel>{isRTL ? 'الفرع' : 'Branch'}</FieldLabel>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue placeholder={isRTL ? 'اختر الفرع' : 'Select branch'} /></SelectTrigger>
            <SelectContent>
              {branches.map((branch: any) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>{isRTL ? 'نوع الخدمة' : 'Service type'}</FieldLabel>
          <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
            <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white"><SelectValue placeholder={isRTL ? 'اختر الخدمة' : 'Select service'} /></SelectTrigger>
            <SelectContent>
              {services.map((service: any) => <SelectItem key={service.id} value={String(service.id)}>{service.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>{isRTL ? 'التاريخ' : 'Date'}</FieldLabel>
          <Input type="date" className="h-10 rounded-xl border-zinc-200 bg-white" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldGroup>
      </div>

      {(branchId && serviceTypeId) && (
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <Gauge size={17} className="text-[#0a1f44]" />
            <div>
              <div className="text-[11px] text-zinc-400">{isRTL ? 'Slots متاحة' : 'Available slots'}</div>
              <div className="text-lg font-semibold text-zinc-900">{availableSlots}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <Boxes size={17} className="text-[#0a1f44]" />
            <div>
              <div className="text-[11px] text-zinc-400">{isRTL ? 'Bays نشطة' : 'Active bays'}</div>
              <div className="text-lg font-semibold text-zinc-900">{configuredBayCount}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] text-zinc-400">{isRTL ? 'مصدر السعة' : 'Capacity source'}</div>
            <div className="mt-1">
              {bayBacked && <Badge className="bg-emerald-600 text-white">{isRTL ? 'Physical Bays' : 'Physical bays'}</Badge>}
              {legacyBacked && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{isRTL ? 'Legacy fallback' : 'Legacy fallback'}</Badge>}
              {!bayBacked && !legacyBacked && <span className="text-xs text-zinc-400">—</span>}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] text-zinc-400">{isRTL ? 'مدة الخدمة' : 'Service duration'}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-800">{selectedService?.durationMinutes ?? '—'} {isRTL ? 'دقيقة' : 'min'}</div>
          </div>
        </div>
      )}

      {!branchId || !serviceTypeId ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center">
          <CalendarDays size={28} className="mx-auto mb-3 text-zinc-300" />
          <div className="text-sm font-semibold text-zinc-700">{isRTL ? 'اختر الفرع والخدمة' : 'Select branch and service'}</div>
          <p className="mt-1 text-xs text-zinc-400">{isRTL ? 'سيظهر جدول السعة الفعلية لليوم المختار.' : 'The real availability timeline will appear for the selected date.'}</p>
        </div>
      ) : slotsQ.isLoading ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center text-sm text-zinc-400">
          {isRTL ? 'جاري حساب الـavailability...' : 'Calculating availability...'}
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-10 text-center">
          <Clock3 size={28} className="mx-auto mb-3 text-zinc-300" />
          <div className="text-sm font-semibold text-zinc-700">{isRTL ? 'لا توجد Slots في هذا اليوم' : 'No slots for this day'}</div>
          <p className="mt-1 text-xs text-zinc-400">{isRTL ? 'قد يكون اليوم خارج أيام العمل أو مدة الخدمة تتجاوز نهاية اليوم.' : 'The date may be outside working days or the service duration may exceed the day boundary.'}</p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot: any) => {
            const available = Number(slot.availableCapacity ?? 0);
            const legacyLoad = Number(slot.legacyUnassignedLoad ?? 0);
            const occupied = Array.isArray(slot.assignedOccupiedBayIds) ? slot.assignedOccupiedBayIds.length : 0;
            return (
              <div key={slot.startAt} className={'rounded-2xl border p-4 ' + (available > 0 ? 'border-zinc-100 bg-white' : 'border-rose-100 bg-rose-50/40')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Clock3 size={14} className="text-[#b7861f]" />
                      {timeLabel(slot.startAt)} → {timeLabel(slot.endAt)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {slot.capacitySource === 'service_bays'
                        ? (isRTL ? 'Bay-backed capacity' : 'Bay-backed capacity')
                        : (isRTL ? 'Legacy capacity fallback' : 'Legacy capacity fallback')}
                    </div>
                  </div>
                  <Badge className={available > 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                    {available} {isRTL ? 'متاح' : 'free'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-zinc-50 px-2 py-2">
                    <div className="text-[10px] text-zinc-400">{isRTL ? 'محجوز' : 'Reserved'}</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-700">{slot.reservedCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 px-2 py-2">
                    <div className="text-[10px] text-zinc-400">{isRTL ? 'Bays مشغولة' : 'Occupied bays'}</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-700">{occupied}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 px-2 py-2">
                    <div className="text-[10px] text-zinc-400">{isRTL ? 'Legacy load' : 'Legacy load'}</div>
                    <div className="mt-0.5 text-sm font-semibold text-zinc-700">{legacyLoad}</div>
                  </div>
                </div>

                {legacyLoad > 0 && slot.capacitySource === 'service_bays' && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                    {isRTL ? 'حجز قديم بدون Bay يستهلك سعة عامة بدون اختيار Bay محددة.' : 'Legacy unassigned bookings consume generic capacity without choosing a specific Bay.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(selectedBranch && legacyBacked) && (
        <p className="mt-4 text-[11px] text-amber-700">
          {isRTL
            ? `الفرع "${selectedBranch.name}" لا يحتوي Bays نشطة حاليًا؛ يتم استخدام capacityPerSlot مؤقتًا حتى يتم تكوين الـBays.`
            : `"${selectedBranch.name}" currently has no active Bays; capacityPerSlot is used temporarily until Bays are configured.`}
        </p>
      )}
    </SectionCard>
  );
}
