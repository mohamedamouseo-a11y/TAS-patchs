import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldGroup, FieldLabel, SectionCard, StatusBadge } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  Layers3,
  RefreshCw,
  Wrench,
} from 'lucide-react';

const MINUTE_PX = 2;
const LABEL_WIDTH = 184;

function localDateValue(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

function minutesLabel(minutes: number) {
  const normalized = Math.max(0, Math.min(1440, Math.round(minutes)));
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function nominalOffsetMinutes(value: unknown, baseDate: string) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const base = baseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !base) return null;
  const current = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  const origin = Date.UTC(Number(base[1]), Number(base[2]) - 1, Number(base[3]));
  return Math.round((current - origin) / 60000);
}

function timeFromDateTime(value: unknown) {
  const match = String(value ?? '').match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? '—';
}

function vehicleText(row: any) {
  return [row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—';
}

function bookingTone(status: unknown) {
  const value = String(status ?? '').toLowerCase();
  if (value.includes('completed')) return 'border-emerald-200 bg-emerald-50/95';
  if (value.includes('confirmed')) return 'border-blue-200 bg-blue-50/95';
  if (value.includes('pending')) return 'border-amber-200 bg-amber-50/95';
  return 'border-zinc-200 bg-white/95';
}

export default function TASServiceScheduler() {
  const { isRTL } = useLanguage();
  const branchesQ = trpc.tas.branches.list.useQuery({});
  const branches: any[] = branchesQ.data ?? [];

  const [branchId, setBranchId] = useState('');
  const [day, setDay] = useState(localDateValue());

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(String(branches[0].id));
    }
  }, [branchId, branches]);

  const schedulerQ = trpc.tas.service.getScheduler.useQuery({
    branchId: Number(branchId || 0),
    day,
  }, {
    enabled: Number(branchId || 0) > 0 && Boolean(day),
    refetchOnWindowFocus: false,
  });

  const data: any = schedulerQ.data;
  const scheduleStart = Number(data?.branch?.workdayStartMinutes ?? 540);
  const scheduleEnd = Math.max(scheduleStart + 60, Number(data?.branch?.workdayEndMinutes ?? 1080));
  const spanMinutes = Math.max(60, scheduleEnd - scheduleStart);
  const timelineWidth = spanMinutes * MINUTE_PX;

  const hourMarks = useMemo(() => {
    const startHour = Math.ceil(scheduleStart / 60);
    const endHour = Math.floor(scheduleEnd / 60);
    const marks: number[] = [];
    for (let hour = startHour; hour <= endHour; hour += 1) marks.push(hour * 60);
    return marks;
  }, [scheduleStart, scheduleEnd]);

  const bookings: any[] = data?.bookings ?? [];
  const bays: any[] = data?.bays ?? [];

  const lanes = useMemo(() => {
    const rows = bays.map((bay: any) => ({
      key: `bay-${bay.id}`,
      kind: 'bay',
      title: bay.name || `Bay #${bay.id}`,
      subtitle: [bay.code, bay.bayType].filter(Boolean).join(' • '),
      bookings: bookings.filter((booking: any) => booking.laneType === 'bay' && Number(booking.bayId) === Number(bay.id)),
    }));

    const unassigned = bookings.filter((booking: any) => booking.laneType === 'unassigned');
    if (unassigned.length > 0) {
      rows.push({
        key: 'unassigned',
        kind: 'unassigned',
        title: isRTL ? 'غير معيّن / Legacy' : 'Unassigned / Legacy',
        subtitle: isRTL ? 'لا يتم تخمين Bay لهذه الحجوزات' : 'No Bay is inferred for these bookings',
        bookings: unassigned,
      });
    }

    const exceptions = bookings.filter((booking: any) => booking.laneType === 'exception');
    if (exceptions.length > 0) {
      rows.push({
        key: 'exception',
        kind: 'exception',
        title: isRTL ? 'Bay Exception' : 'Bay exception',
        subtitle: isRTL ? 'Bay غير نشطة أو غير موجودة' : 'Inactive or missing Bay assignment',
        bookings: exceptions,
      });
    }

    return rows;
  }, [bays, bookings, isRTL]);

  const bookingGeometry = (booking: any) => {
    const rawStart = nominalOffsetMinutes(booking.startAt, day);
    const rawEnd = nominalOffsetMinutes(booking.endAt, day);
    const start = rawStart == null ? scheduleStart : Math.max(scheduleStart, Math.min(scheduleEnd, rawStart));
    const fallbackEnd = start + Math.max(15, Number(booking.durationMinutes ?? 60));
    const end = rawEnd == null ? fallbackEnd : Math.max(start + 1, Math.min(scheduleEnd, rawEnd));
    return {
      left: Math.max(0, (start - scheduleStart) * MINUTE_PX),
      width: Math.max(58, (end - start) * MINUTE_PX),
    };
  };

  const summary = data?.summary ?? {};
  const isToday = day === localDateValue();

  return (
    <SectionCard
      title={isRTL ? 'جدول تشغيل الصيانة' : 'Service scheduler'}
      subtitle={isRTL
        ? 'عرض يومي فعلي حسب الـBay والوقت، مبني على مدة كل حجز وتعيين الـBay الحقيقي.'
        : 'A real daily Bay × time board based on each booking duration and its actual Bay assignment.'}
      right={(
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#c99a2e]/30 bg-[#fffaf0] text-[#8a6115]">
            <Layers3 size={12} className="me-1.5" />
            Phase 9
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl"
            disabled={!branchId || schedulerQ.isFetching}
            onClick={() => schedulerQ.refetch()}
          >
            <RefreshCw size={13} className={schedulerQ.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      )}
    >
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <FieldGroup>
          <FieldLabel>{isRTL ? 'الفرع' : 'Branch'}</FieldLabel>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-10 rounded-xl border-zinc-200 bg-white">
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
          <FieldLabel>{isRTL ? 'اليوم' : 'Day'}</FieldLabel>
          <Input type="date" className="h-10 rounded-xl border-zinc-200 bg-white" value={day} onChange={(event) => setDay(event.target.value)} />
        </FieldGroup>

        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setDay(shiftDate(day, -1))}>
            {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </Button>
          <Button type="button" variant={isToday ? 'default' : 'outline'} className="h-10 rounded-xl" onClick={() => setDay(localDateValue())}>
            <CalendarDays size={14} className="me-1.5" />
            {isRTL ? 'اليوم' : 'Today'}
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setDay(shiftDate(day, 1))}>
            {isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </Button>
        </div>
      </div>

      {data && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'Bays نشطة' : 'Active Bays'}</div>
            <div className="mt-1 text-xl font-black text-zinc-900">{Number(summary.activeBayCount ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'حجوزات اليوم' : 'Bookings'}</div>
            <div className="mt-1 text-xl font-black text-zinc-900">{Number(summary.bookingCount ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'غير معيّن' : 'Unassigned'}</div>
            <div className="mt-1 text-xl font-black text-amber-700">{Number(summary.unassignedCount ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'استثناءات Bay' : 'Bay exceptions'}</div>
            <div className="mt-1 text-xl font-black text-rose-700">{Number(summary.exceptionCount ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Gauge size={11} />
              {isRTL ? 'استغلال اليوم' : 'Utilization'}
            </div>
            <div className="mt-1 text-xl font-black text-[#0a1f44]">{Number(summary.utilizationPct ?? 0).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {!branchId ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          {isRTL ? 'اختر الفرع لعرض الجدول.' : 'Select a branch to view its schedule.'}
        </div>
      ) : schedulerQ.isLoading ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          {isRTL ? 'جاري تحميل جدول التشغيل...' : 'Loading service scheduler...'}
        </div>
      ) : schedulerQ.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {schedulerQ.error.message}
        </div>
      ) : !data ? null : (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3">
            <div>
              <div className="font-semibold text-zinc-900">{data.branch?.name || '—'}</div>
              <div className="mt-0.5 text-xs text-zinc-400">
                {minutesLabel(scheduleStart)} → {minutesLabel(scheduleEnd)}
                {' • '}
                {Number(data.branch?.slotIntervalMinutes ?? 30)} {isRTL ? 'دقيقة / slot' : 'min / slot'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">{isRTL ? 'Confirmed' : 'Confirmed'}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{isRTL ? 'Pending' : 'Pending'}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{isRTL ? 'Completed' : 'Completed'}</span>
            </div>
          </div>

          {lanes.length === 0 ? (
            <div className="py-14 text-center">
              <Clock3 size={28} className="mx-auto mb-3 text-zinc-200" />
              <div className="text-sm font-semibold text-zinc-700">{isRTL ? 'لا توجد Bays أو حجوزات لهذا اليوم' : 'No Bays or bookings for this day'}</div>
              <div className="mt-1 text-xs text-zinc-400">{isRTL ? 'أضف Bays للفرع أو أنشئ حجزًا من الـPremium Flow.' : 'Add Bays to the branch or create a booking from the Premium Flow.'}</div>
            </div>
          ) : (
            <div className="overflow-x-auto" dir="ltr">
              <div style={{ width: LABEL_WIDTH + timelineWidth, minWidth: LABEL_WIDTH + timelineWidth }}>
                <div className="flex h-12 border-b border-zinc-100 bg-white">
                  <div
                    className="sticky left-0 z-30 flex shrink-0 items-center border-r border-zinc-100 bg-white px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                    style={{ width: LABEL_WIDTH }}
                  >
                    {isRTL ? 'Bay / الكوريك' : 'Bay / lane'}
                  </div>
                  <div className="relative h-12 shrink-0" style={{ width: timelineWidth }}>
                    {hourMarks.map((minutes) => (
                      <div
                        key={minutes}
                        className="absolute inset-y-0 border-l border-zinc-100"
                        style={{ left: (minutes - scheduleStart) * MINUTE_PX }}
                      >
                        <span className="absolute left-2 top-3 whitespace-nowrap text-[10px] font-medium text-zinc-400">
                          {minutesLabel(minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {lanes.map((lane: any) => (
                  <div key={lane.key} className="flex min-h-[92px] border-b border-zinc-100 last:border-b-0">
                    <div
                      className={
                        'sticky left-0 z-20 flex shrink-0 items-center border-r border-zinc-100 px-4 ' +
                        (lane.kind === 'unassigned'
                          ? 'bg-amber-50'
                          : lane.kind === 'exception'
                            ? 'bg-rose-50'
                            : 'bg-white')
                      }
                      style={{ width: LABEL_WIDTH }}
                    >
                      <div className="min-w-0" dir={isRTL ? 'rtl' : 'ltr'}>
                        <div className="flex items-center gap-2">
                          {lane.kind === 'exception'
                            ? <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                            : lane.kind === 'unassigned'
                              ? <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                              : <Wrench size={14} className="shrink-0 text-[#0a1f44]" />}
                          <div className="truncate text-xs font-bold text-zinc-800">{lane.title}</div>
                        </div>
                        {lane.subtitle && <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-400">{lane.subtitle}</div>}
                        <div className="mt-1 text-[10px] font-semibold text-zinc-400">{lane.bookings.length} {isRTL ? 'حجز' : 'booking(s)'}</div>
                      </div>
                    </div>

                    <div
                      className={
                        'relative min-h-[92px] shrink-0 ' +
                        (lane.kind === 'unassigned'
                          ? 'bg-amber-50/20'
                          : lane.kind === 'exception'
                            ? 'bg-rose-50/20'
                            : 'bg-white')
                      }
                      style={{ width: timelineWidth }}
                    >
                      {hourMarks.map((minutes) => (
                        <div
                          key={minutes}
                          className="absolute inset-y-0 border-l border-zinc-100"
                          style={{ left: (minutes - scheduleStart) * MINUTE_PX }}
                        />
                      ))}

                      {lane.bookings.map((booking: any) => {
                        const geometry = bookingGeometry(booking);
                        return (
                          <div
                            key={booking.id}
                            className={
                              'absolute top-2 h-[76px] overflow-hidden rounded-xl border px-2.5 py-2 shadow-sm ' +
                              (lane.kind === 'unassigned'
                                ? 'border-amber-300 bg-amber-50'
                                : lane.kind === 'exception'
                                  ? 'border-rose-300 bg-rose-50'
                                  : bookingTone(booking.status))
                            }
                            style={{ left: geometry.left, width: geometry.width }}
                            title={[
                              booking.customerName,
                              vehicleText(booking),
                              booking.serviceTypeName,
                              booking.maintenancePlanName,
                              `${timeFromDateTime(booking.startAt)} - ${timeFromDateTime(booking.endAt)}`,
                            ].filter(Boolean).join(' • ')}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="truncate text-[11px] font-black text-zinc-900">{timeFromDateTime(booking.startAt)}–{timeFromDateTime(booking.endAt)}</div>
                              <StatusBadge status={booking.status} className="max-w-[76px] truncate px-1.5 py-0.5 text-[9px]" />
                            </div>
                            <div className="mt-1 truncate text-[11px] font-semibold text-zinc-800">{booking.customerName || '—'}</div>
                            <div className="truncate text-[10px] text-zinc-500">{vehicleText(booking)}</div>
                            <div className="truncate text-[10px] text-zinc-400">
                              {booking.maintenancePlanName
                                ? `${booking.maintenancePlanName}${booking.maintenanceMileageKm != null ? ` • ${Number(booking.maintenanceMileageKm).toLocaleString('en-US')} km` : ''}`
                                : (booking.serviceTypeName || 'Service')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[11px] leading-5 text-zinc-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-zinc-400" />
        <span>
          {isRTL
            ? 'Phase 9 عرض تشغيلي فقط: الحجوزات القديمة غير المعيّنة لا يتم توزيعها تلقائيًا، وتغيير الحالة أو إعادة الجدولة سيأتي في Phase 10.'
            : 'Phase 9 is visibility-only: legacy unassigned bookings are never auto-placed, and status/rescheduling actions arrive in Phase 10.'}
        </span>
      </div>
    </SectionCard>
  );
}
