import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionCard, StatusBadge } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  PackageCheck,
  RefreshCw,
  Warehouse,
} from 'lucide-react';

// NEXT_DAY_PREPARATION_BOARD

function dateValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeLabel(value: unknown) {
  const match = String(value ?? '').match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? '—';
}

function quantity(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function vehicleLabel(row: any) {
  return [row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—';
}

function prepBadge(status: string) {
  if (status === 'Prepared') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Partial') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Shortage') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function TASNextDayPartsPreparation() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const branchesQ = trpc.tas.branches.list.useQuery({});
  const branches: any[] = branchesQ.data ?? [];

  const [day, setDay] = useState(dateValue(1));
  const [branchId, setBranchId] = useState('all');
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const boardQ = trpc.tas.service.getPartsPreparationBoard.useQuery({
    day,
    branchId: branchId === 'all' ? undefined : Number(branchId),
  }, {
    refetchOnWindowFocus: false,
  });

  const board: any = boardQ.data;
  const lines: any[] = board?.lines ?? [];
  const aggregates: any[] = board?.aggregates ?? [];
  const summary: any = board?.summary ?? {};

  const tomorrow = dateValue(1);
  const isTomorrow = day === tomorrow;

  const updatePrep = trpc.tas.service.updateBookingItemPreparation.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث حالة التجهيز' : 'Preparation status updated');
      await utils.tas.service.getPartsPreparationBoard.invalidate();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث التجهيز' : 'Could not update preparation')),
  });

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => {
      const timeCompare = String(a.appointmentStartAt ?? '').localeCompare(String(b.appointmentStartAt ?? ''));
      if (timeCompare !== 0) return timeCompare;
      return Number(a.bookingId) - Number(b.bookingId);
    }),
    [lines],
  );

  const qtyDraft = (line: any) => {
    const key = String(line.bookingItemId);
    return draftQty[key] ?? String(line.preparedQuantity ?? 0);
  };

  const noteDraft = (line: any) => {
    const key = String(line.bookingItemId);
    return draftNotes[key] ?? String(line.preparationNotes ?? '');
  };

  const setStatus = (line: any, status: 'Pending' | 'Partial' | 'Prepared' | 'Shortage') => {
    const key = String(line.bookingItemId);
    const enteredQty = Number(qtyDraft(line) || 0);
    const notes = noteDraft(line).trim();

    if (status === 'Partial') {
      if (!(enteredQty > 0 && enteredQty < Number(line.requiredQuantity))) {
        toast.error(isRTL ? 'Partial يحتاج كمية مجهزة أكبر من صفر وأقل من المطلوبة' : 'Partial requires a prepared quantity above zero and below the required quantity');
        return;
      }
    }

    if (status === 'Shortage' && !notes) {
      toast.error(isRTL ? 'اكتب سبب النقص أولاً' : 'Enter the shortage reason first');
      return;
    }

    updatePrep.mutate({
      bookingItemId: Number(line.bookingItemId),
      status,
      preparedQuantity: status === 'Prepared'
        ? Number(line.requiredQuantity)
        : status === 'Pending'
          ? 0
          : enteredQty,
      notes: notes || null,
    });

    if (status === 'Prepared') {
      setDraftQty((current) => ({ ...current, [key]: String(line.requiredQuantity) }));
    }
    if (status === 'Pending') {
      setDraftQty((current) => ({ ...current, [key]: '0' }));
    }
  };

  return (
    <SectionCard
      title={isRTL ? 'تجهيز قطع ومستلزمات المواعيد' : 'Parts & materials preparation'}
      subtitle={isRTL
        ? 'احتياجات اليوم المختار من Snapshot الحجز نفسه، مجمعة للمخزن مع Checklist لكل سيارة.'
        : 'Requirements for the selected service day, read from booking snapshots and aggregated for the warehouse.'}
      right={(
        <div className="flex items-center gap-2">
          <Badge className="border-0 bg-gradient-to-r from-[#0a1f44] to-[#173b72] text-white">
            <Warehouse size={12} className="me-1.5" />
            Phase 12
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl"
            disabled={boardQ.isFetching}
            onClick={() => boardQ.refetch()}
          >
            <RefreshCw size={13} className={boardQ.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      )}
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[190px] flex-1">
          <div className="mb-1.5 text-xs font-semibold text-zinc-600">{isRTL ? 'اليوم' : 'Service day'}</div>
          <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} className="h-10 rounded-xl" />
        </div>

        <div className="min-w-[210px] flex-1">
          <div className="mb-1.5 text-xs font-semibold text-zinc-600">{isRTL ? 'الفرع' : 'Branch'}</div>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الفروع' : 'All branches'}</SelectItem>
              {branches.map((branch: any) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => setDay(shiftDate(day, -1))}>
            {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </Button>
          <Button variant={isTomorrow ? 'default' : 'outline'} className="h-10 rounded-xl" onClick={() => setDay(tomorrow)}>
            <CalendarDays size={14} className="me-1.5" />
            {isRTL ? 'بكرة' : 'Tomorrow'}
          </Button>
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => setDay(shiftDate(day, 1))}>
            {isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </Button>
        </div>
      </div>

      {boardQ.isLoading ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          {isRTL ? 'جاري تجميع احتياجات التجهيز...' : 'Loading preparation requirements...'}
        </div>
      ) : boardQ.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {boardQ.error.message}
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'حجوزات تحتاج تجهيز' : 'Bookings'}</div>
              <div className="mt-1 text-xl font-black text-zinc-900">{Number(summary.bookingCount ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'أصناف مختلفة' : 'Distinct items'}</div>
              <div className="mt-1 text-xl font-black text-zinc-900">{Number(summary.distinctItemCount ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'سطور جاهزة' : 'Prepared lines'}</div>
              <div className="mt-1 text-xl font-black text-emerald-700">{Number(summary.readyLineCount ?? 0)} / {Number(summary.lineCount ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'نواقص' : 'Shortages'}</div>
              <div className="mt-1 text-xl font-black text-rose-700">{Number(summary.shortageLineCount ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-[#c99a2e]/20 bg-[#fffaf0] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9a6b12]">{isRTL ? 'جاهزية التجهيز' : 'Readiness'}</div>
              <div className="mt-1 text-xl font-black text-[#7c5711]">{Number(summary.readinessPct ?? 0).toFixed(1)}%</div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-zinc-100 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Boxes size={16} className="text-[#0a1f44]" />
                <div>
                  <div className="text-sm font-bold text-zinc-900">{isRTL ? 'الاحتياجات المجمعة' : 'Aggregated requirements'}</div>
                  <div className="text-[11px] text-zinc-400">{isRTL ? 'تجميع حسب الصنف والوحدة من كل الحجوزات.' : 'Grouped by item and unit across all matching bookings.'}</div>
                </div>
              </div>
              <Badge variant="outline">{aggregates.length}</Badge>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الصنف' : 'Item'}</TableHead>
                    <TableHead>{isRTL ? 'المطلوب' : 'Required'}</TableHead>
                    <TableHead>{isRTL ? 'المجهز' : 'Prepared'}</TableHead>
                    <TableHead>{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                    <TableHead>{isRTL ? 'الحجوزات' : 'Bookings'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'State'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregates.map((row: any) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="font-semibold text-zinc-800">{row.itemName}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-400">{row.itemCode || row.itemType}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{quantity(row.requiredQuantity)} {row.unit}</TableCell>
                      <TableCell className="text-emerald-700">{quantity(row.preparedQuantity)} {row.unit}</TableCell>
                      <TableCell className={Number(row.remainingQuantity) > 0 ? 'font-semibold text-amber-700' : 'text-zinc-400'}>{quantity(row.remainingQuantity)} {row.unit}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{Number(row.bookingCount)}</TableCell>
                      <TableCell>
                        {row.ready ? (
                          <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} className="me-1" />{isRTL ? 'جاهز' : 'Ready'}</Badge>
                        ) : Number(row.shortageLineCount) > 0 ? (
                          <Badge className="bg-rose-100 text-rose-700"><AlertTriangle size={11} className="me-1" />{isRTL ? 'يوجد نقص' : 'Shortage'}</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700"><CircleDot size={11} className="me-1" />{isRTL ? 'قيد التجهيز' : 'Preparing'}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!aggregates.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                        {isRTL ? 'لا توجد احتياجات تجهيز لهذا اليوم.' : 'No preparation requirements for this day.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white">
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <PackageCheck size={16} className="text-[#0a1f44]" />
                <div>
                  <div className="text-sm font-bold text-zinc-900">{isRTL ? 'Checklist الحجوزات' : 'Booking checklist'}</div>
                  <div className="text-[11px] text-zinc-400">{isRTL ? 'التحديث هنا على Snapshot الحجز نفسه، وليس على الـMaster Package.' : 'Updates apply to the booking snapshot line, never the master package.'}</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الموعد' : 'Appointment'}</TableHead>
                    <TableHead>{isRTL ? 'العميل / السيارة' : 'Customer / vehicle'}</TableHead>
                    <TableHead>{isRTL ? 'الصنف' : 'Item'}</TableHead>
                    <TableHead>{isRTL ? 'المطلوب' : 'Required'}</TableHead>
                    <TableHead>{isRTL ? 'المجهز' : 'Prepared qty'}</TableHead>
                    <TableHead>{isRTL ? 'ملاحظة / سبب نقص' : 'Note / shortage reason'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'State'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLines.map((line: any) => {
                    const key = String(line.bookingItemId);
                    return (
                      <TableRow key={line.bookingItemId}>
                        <TableCell className="min-w-[130px]">
                          <div className="font-semibold text-zinc-800">{timeLabel(line.appointmentStartAt)}</div>
                          <div className="mt-0.5 text-[10px] text-zinc-400">{line.branchName || '—'} · #{line.bookingId}</div>
                          <div className="mt-1"><StatusBadge status={line.bookingStatus} /></div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-semibold text-zinc-800">{line.customerName || '—'}</div>
                          <div className="mt-0.5 text-xs text-zinc-500">{vehicleLabel(line)}</div>
                          {line.maintenanceMileageKm != null && <div className="mt-0.5 text-[10px] text-zinc-400">{Number(line.maintenanceMileageKm).toLocaleString('en-US')} km</div>}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-semibold text-zinc-800">{line.itemName}</div>
                          <div className="mt-0.5 text-[10px] text-zinc-400">{line.itemCode || line.itemType} · {line.action}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{quantity(line.requiredQuantity)} {line.unit}</TableCell>
                        <TableCell className="min-w-[125px]">
                          <Input
                            type="number"
                            min={0}
                            max={Number(line.requiredQuantity)}
                            step="0.001"
                            value={qtyDraft(line)}
                            onChange={(event) => setDraftQty((current) => ({ ...current, [key]: event.target.value }))}
                            className="h-8 rounded-lg"
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Input
                            value={noteDraft(line)}
                            onChange={(event) => setDraftNotes((current) => ({ ...current, [key]: event.target.value }))}
                            placeholder={isRTL ? 'ملاحظة أو سبب النقص...' : 'Note or shortage reason...'}
                            className="h-8 rounded-lg"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={prepBadge(line.preparationStatus)}>{line.preparationStatus}</Badge>
                          {Number(line.remainingQuantity) > 0 && <div className="mt-1 text-[10px] text-zinc-400">{isRTL ? 'متبقي' : 'Remaining'} {quantity(line.remainingQuantity)} {line.unit}</div>}
                        </TableCell>
                        <TableCell className="min-w-[245px]">
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={updatePrep.isPending} onClick={() => setStatus(line, 'Pending')}>Pending</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={updatePrep.isPending} onClick={() => setStatus(line, 'Partial')}>Partial</Button>
                            <Button size="sm" className="h-7 bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-700" disabled={updatePrep.isPending} onClick={() => setStatus(line, 'Prepared')}>Prepared</Button>
                            <Button size="sm" variant="outline" className="h-7 border-rose-200 px-2 text-[10px] text-rose-700" disabled={updatePrep.isPending} onClick={() => setStatus(line, 'Shortage')}>Shortage</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!sortedLines.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <PackageCheck size={26} className="mx-auto mb-2 text-zinc-200" />
                        <div className="text-sm font-semibold text-zinc-600">{isRTL ? 'لا توجد سطور تحتاج تحضير' : 'Nothing needs preparation'}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {isRTL ? 'الحجوزات بدون Snapshot أو بدون preparationRequired لن تظهر هنا.' : 'Bookings without snapshot lines marked preparationRequired do not appear here.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[11px] leading-5 text-zinc-500">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-zinc-400" />
            <span>
              {isRTL
                ? 'Phase 12 لا تخصم مخزون ولا تنشئ Purchase Orders ولا تستبدل Part Number تلقائيًا. هي قائمة تجهيز تشغيلية مبنية فقط على متطلبات الحجز المثبتة في الـSnapshot.'
                : 'Phase 12 does not deduct inventory, create purchase orders, or substitute part numbers. It is an operational preparation list driven only by frozen booking snapshots.'}
            </span>
          </div>
        </>
      )}
    </SectionCard>
  );
}
