import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleX,
  History,
  MoreHorizontal,
  ShieldCheck,
  UserX,
} from 'lucide-react';

type Props = {
  booking: any;
  compact?: boolean;
};

const labels: Record<string, { ar: string; en: string }> = {
  Pending: { ar: 'معلق', en: 'Pending' },
  PendingConfirmation: { ar: 'بانتظار التأكيد', en: 'Pending confirmation' },
  Confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  Completed: { ar: 'مكتمل', en: 'Completed' },
  Cancelled: { ar: 'ملغي', en: 'Cancelled' },
  NoShow: { ar: 'لم يحضر', en: 'No show' },
};

function actionIcon(status: string) {
  if (status === 'Confirmed') return ShieldCheck;
  if (status === 'Completed') return CheckCircle2;
  if (status === 'Cancelled') return CircleX;
  if (status === 'NoShow') return UserX;
  return ChevronRight;
}

function requiresReason(status: string) {
  return status === 'Cancelled' || status === 'NoShow';
}

function formatHistoryDate(value: unknown) {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Cairo',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function TASBookingLifecycleActions({ booking, compact = false }: Props) {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reason, setReason] = useState('');

  const bookingId = Number(booking?.id ?? booking?.appointmentId ?? 0);
  const lifecycleQ = trpc.tas.service.getBookingLifecycle.useQuery(
    { bookingId },
    { enabled: open && bookingId > 0, refetchOnWindowFocus: false },
  );

  const lifecycle: any = lifecycleQ.data;
  const currentStatus = String(lifecycle?.booking?.status ?? booking?.status ?? '');
  const allowedTransitions: string[] = lifecycle?.allowedTransitions ?? [];
  const terminal = Boolean(lifecycle?.terminal);

  useEffect(() => {
    if (!open) {
      setSelectedStatus('');
      setReason('');
    }
  }, [open]);

  useEffect(() => {
    if (selectedStatus && !allowedTransitions.includes(selectedStatus)) {
      setSelectedStatus('');
      setReason('');
    }
  }, [allowedTransitions, selectedStatus]);

  const mutation = trpc.tas.service.transitionBookingStatus.useMutation({
    onSuccess: async (result: any) => {
      toast.success(
        result?.changed === false
          ? (isRTL ? 'الحالة بالفعل محدثة' : 'Booking already has this status')
          : (isRTL ? 'تم تحديث حالة الحجز' : 'Booking status updated'),
      );
      setSelectedStatus('');
      setReason('');
      await Promise.all([
        utils.tas.service.listAppointments.invalidate(),
        utils.tas.service.getScheduler.invalidate(),
        utils.tas.service.getBookingLifecycle.invalidate({ bookingId }),
      ]);
      await lifecycleQ.refetch();
    },
    onError: (error) => toast.error(error.message || (isRTL ? 'تعذر تحديث الحالة' : 'Could not update status')),
  });

  const selectedLabel = useMemo(() => {
    if (!selectedStatus) return '';
    const item = labels[selectedStatus];
    return item ? (isRTL ? item.ar : item.en) : selectedStatus;
  }, [selectedStatus, isRTL]);

  const submit = () => {
    if (!selectedStatus) return;
    if (requiresReason(selectedStatus) && !reason.trim()) {
      toast.error(isRTL ? 'اكتب سبب الإلغاء أو عدم الحضور' : 'Enter a cancellation / no-show reason');
      return;
    }
    mutation.mutate({
      bookingId,
      toStatus: selectedStatus,
      reason: reason.trim() || null,
      source: 'ServiceUI',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact
            ? 'h-7 w-7 rounded-lg border-zinc-200 p-0'
            : 'h-8 rounded-xl border-zinc-200 px-2.5 text-xs'}
          title={isRTL ? 'إدارة حالة الحجز' : 'Manage booking status'}
        >
          <MoreHorizontal size={compact ? 14 : 15} />
          {!compact && <span className="ms-1.5">{isRTL ? 'الحالة' : 'Status'}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'دورة حالة حجز الصيانة' : 'Service booking lifecycle'}</DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'التغييرات محكومة بمسار واضح ويتم تسجيل كل انتقال في سجل المراجعة.'
              : 'Status changes follow an enforced path and every transition is recorded in the audit history.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {lifecycleQ.isLoading ? (
            <div className="py-8 text-center text-sm text-zinc-400">
              {isRTL ? 'جاري تحميل الحالة...' : 'Loading lifecycle...'}
            </div>
          ) : lifecycleQ.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {lifecycleQ.error.message}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {isRTL ? 'الحالة الحالية' : 'Current status'}
                  </div>
                  <div className="mt-2"><StatusBadge status={currentStatus} /></div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-semibold text-zinc-900">{lifecycle?.booking?.customerName || booking?.customerName || '—'}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {lifecycle?.booking?.serviceTypeName || booking?.serviceTypeName || 'Service'} · #{bookingId}
                  </div>
                </div>
              </div>

              {terminal ? (
                <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <Ban size={17} className="mt-0.5 shrink-0 text-zinc-500" />
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">
                      {isRTL ? 'حالة نهائية' : 'Terminal status'}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500">
                      {isRTL
                        ? 'هذا الحجز انتهى ولا يمكن نقله لحالة أخرى من المسار التشغيلي.'
                        : 'This booking is closed in the lifecycle and cannot move to another operational status.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-2 text-xs font-semibold text-zinc-600">
                    {isRTL ? 'الانتقالات المسموحة' : 'Allowed next states'}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allowedTransitions.map((status) => {
                      const Icon = actionIcon(status);
                      const active = selectedStatus === status;
                      const label = labels[status];
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setSelectedStatus(status);
                            if (!requiresReason(status)) setReason('');
                          }}
                          className={
                            'flex items-center gap-3 rounded-2xl border p-3 text-start transition ' +
                            (active
                              ? 'border-[#c99a2e]/55 bg-[#fff9ec]'
                              : 'border-zinc-100 bg-white hover:border-zinc-200')
                          }
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-[#0a1f44]">
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">{isRTL ? label?.ar : label?.en}</div>
                            {requiresReason(status) && (
                              <div className="mt-0.5 text-[10px] font-medium text-amber-600">
                                {isRTL ? 'السبب مطلوب' : 'Reason required'}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedStatus && (
                    <div className="mt-4">
                      <div className="mb-1.5 text-xs font-semibold text-zinc-600">
                        {requiresReason(selectedStatus)
                          ? (isRTL ? `سبب ${selectedLabel}` : `${selectedLabel} reason`)
                          : (isRTL ? 'ملاحظة — اختياري' : 'Note — optional')}
                      </div>
                      <Textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={requiresReason(selectedStatus)
                          ? (isRTL ? 'اكتب سببًا واضحًا...' : 'Enter a clear reason...')
                          : (isRTL ? 'ملاحظة على تغيير الحالة...' : 'Optional status-change note...')}
                        className="rounded-xl border-zinc-200"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-zinc-100 pt-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-600">
                  <History size={14} />
                  {isRTL ? 'سجل الحالة' : 'Status history'}
                </div>
                {(lifecycle?.history ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 py-5 text-center text-xs text-zinc-400">
                    {isRTL ? 'لا توجد انتقالات مسجلة بعد.' : 'No lifecycle transitions recorded yet.'}
                  </div>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
                    {(lifecycle?.history ?? []).map((entry: any) => (
                      <div key={entry.id} className="rounded-xl border border-zinc-100 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={entry.fromStatus} />
                          <ChevronRight size={13} className={isRTL ? 'rotate-180 text-zinc-300' : 'text-zinc-300'} />
                          <StatusBadge status={entry.toStatus} />
                          <span className="ms-auto text-[10px] text-zinc-400">{formatHistoryDate(entry.createdAt)}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-500">
                          {entry.actorName || entry.actorRole || (isRTL ? 'النظام' : 'System')}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
          {!terminal && (
            <Button
              className="bg-[#0a1f44] text-white hover:bg-[#0d2550]"
              disabled={!selectedStatus || mutation.isPending}
              onClick={submit}
            >
              {mutation.isPending
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : (isRTL ? 'تأكيد تغيير الحالة' : 'Confirm status change')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
