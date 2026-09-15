import CRMLayout from '@/components/CRMLayout';
import { TASHero, SectionCard, StatCard, StatusBadge, formatEGP, formatEgyptDateTime } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  Activity,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Package,
  Phone,
  Ship,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';

const CLOSED_SALES_STATUSES = new Set(['Won', 'Delivered', 'Lost', 'Closed']);

const stageLabelAr: Record<string, string> = {
  Pending: 'جديد',
  Accepted: 'مقبول',
  Contacted: 'تم التواصل',
  Qualified: 'مؤهل',
  TestDriveScheduled: 'تجربة قيادة محددة',
  TestDriveDone: 'تمت تجربة القيادة',
  Negotiation: 'تفاوض',
  Booking: 'حجز',
  Finance: 'تمويل',
  Delivered: 'تم التسليم',
  Won: 'تم البيع',
  Lost: 'خسارة',
  Closed: 'مغلق',
};

export default function TASDashboard() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const role = String(user?.role ?? 'SalesAgent');
  const isAdminOrManager = ['Admin', 'admin', 'SalesManager'].includes(role);
  const canUseSalesDashboard = isAdminOrManager || role === 'SalesAgent' || role === 'LeadDispatcher';
  const canUseSalesMetrics = isAdminOrManager || role === 'SalesAgent';
  const canUseFinanceDashboard = isAdminOrManager || role === 'SalesAgent' || role === 'Finance';
  const canUseServiceDashboard = isAdminOrManager || role === 'ServiceAdvisor' || role === 'CrmFollowUp';
  const canUseAfterSalesDashboard = isAdminOrManager || role === 'ServiceAdvisor' || role === 'PartsAgent' || role === 'CrmFollowUp';
  const canUseShipmentDashboard = isAdminOrManager || role === 'ServiceAdvisor' || role === 'PartsAgent' || role === 'CrmFollowUp';
  const canUseAdminDashboard = ['Admin', 'admin'].includes(role);

  const vehiclesQ = trpc.tas.catalog.listVehicles.useQuery();
  const branchesQ = trpc.tas.branches.list.useQuery();
  const programsQ = trpc.tas.finance.listPrograms.useQuery({}, { enabled: canUseFinanceDashboard });
  const appointmentsQ = trpc.tas.service.listAppointments.useQuery({}, { enabled: canUseServiceDashboard });
  const conversationsQ = trpc.tas.conversations.list.useQuery({});
  const handoversQ = trpc.tas.handovers.list.useQuery({}, { enabled: canUseSalesDashboard });
  const followUpsQ = trpc.tas.workflows.listServiceFollowUps.useQuery({}, { enabled: canUseAfterSalesDashboard });
  const partRequestsQ = trpc.tas.afterSales.listPartRequests.useQuery({}, { enabled: canUseAfterSalesDashboard });
  const salesOverviewQ = trpc.tas.sales.overview.useQuery({}, { enabled: canUseSalesMetrics });
  const salesPipelineQ = trpc.tas.sales.pipeline.useQuery({}, { enabled: canUseSalesMetrics });

  const vehicles = vehiclesQ.data ?? [];
  const appointments = appointmentsQ.data ?? [];
  const conversations = conversationsQ.data ?? [];
  const handovers = handoversQ.data ?? [];
  const followUps = followUpsQ.data ?? [];
  const parts = partRequestsQ.data ?? [];
  const branches = branchesQ.data ?? [];
  const programs = programsQ.data ?? [];
  const overview = salesOverviewQ.data;
  const pipeline = salesPipelineQ.data ?? [];

  const openConversations = conversations.filter((row: any) => row.status !== 'Closed').length;
  const pendingAppointments = appointments.filter((row: any) => !['Completed', 'Cancelled'].includes(row.status)).length;
  const pendingFollowUps = followUps.filter((row: any) => ['Scheduled', 'Pending'].includes(row.status)).length;
  const salesMetricsLoading = salesOverviewQ.isLoading || salesPipelineQ.isLoading;
  const openPipelineRows = pipeline.filter((row: any) => !CLOSED_SALES_STATUSES.has(String(row.status ?? '')));
  const recentPipelineUpdates = pipeline.slice(0, 4);
  const journeyRows = (overview?.stages ?? []).map((row: any) => ({
    stage: String(row.stage ?? 'Unknown'),
    count: Number(row.count ?? 0),
  }));
  const maxJourneyCount = Math.max(...journeyRows.map((row) => row.count), 0);
  const pipelineTotal = pipeline.length;

  const salesMetric = (value: number | string) => {
    if (!canUseSalesMetrics) return '—';
    return salesMetricsLoading ? '...' : value;
  };

  return (
    <CRMLayout>
      <div className="space-y-6 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <TASHero
          icon={<Car size={16} />}
          title={isRTL ? `مرحباً ${user?.name ?? 'بك'} في TAS` : `Welcome ${user?.name ?? ''} to TAS`}
          subtitle={
            isRTL
              ? 'منصة TAS تعرض بيانات التشغيل الفعلية للمبيعات والخدمات وما بعد البيع بدون أرقام تجريبية.'
              : 'TAS shows live operational sales, service and after-sales data without demo metrics.'
          }
          actions={
            <>
              {canUseSalesDashboard && (
                <Link href="/tas/sales">
                  <Button className="rounded-xl bg-[var(--tas-gold)] text-[var(--tas-on-gold)] hover:bg-[var(--tas-gold-soft)]">
                    <BarChart3 size={14} className="me-2" />
                    {isRTL ? 'عرض Pipeline المبيعات' : 'View sales pipeline'}
                  </Button>
                </Link>
              )}
              {canUseFinanceDashboard && (
                <Link href="/tas/finance">
                  <Button variant="outline" className="rounded-xl border-[var(--tas-border-strong)] bg-[color-mix(in_srgb,var(--tas-card)_70%,transparent)]">
                    <CircleDollarSign size={14} className="me-2" />
                    {isRTL ? 'حاسبة التمويل' : 'Finance'}
                  </Button>
                </Link>
              )}
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Gauge size={18} />}
            label={isRTL ? 'Win Rate — TAS Pipeline' : 'TAS pipeline win rate'}
            value={salesMetric(`${Number(overview?.totals?.winRate ?? 0)}%`)}
            helper={isRTL ? 'Won مقابل Lost داخل Handover Pipeline' : 'Won vs lost handovers'}
            tone="gold"
          />
          <StatCard
            icon={<Users size={18} />}
            label={isRTL ? 'فرص TAS في Pipeline' : 'TAS pipeline opportunities'}
            value={salesMetric(pipelineTotal.toLocaleString('en-US'))}
            helper={isRTL ? 'صفوف Handover المحملة فعلياً' : 'Loaded handover pipeline rows'}
          />
          <StatCard
            icon={<CircleDollarSign size={18} />}
            label={isRTL ? 'قيمة TAS Won / Delivered' : 'TAS won / delivered value'}
            value={salesMetric(formatEGP(overview?.totals?.wonValue ?? 0))}
            helper={isRTL ? 'قيمة Handover المكتسب/المسلّم' : 'Won / delivered handovers'}
            tone="gold"
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label={isRTL ? 'فرص TAS المفتوحة' : 'Open TAS opportunities'}
            value={salesMetric(Number(overview?.totals?.open ?? 0).toLocaleString('en-US'))}
            helper={isRTL ? 'Handover غير مغلق' : 'Open handover pipeline'}
          />
          <StatCard
            icon={<Calendar size={18} />}
            label={isRTL ? 'مواعيد الخدمة المفتوحة' : 'Open service appointments'}
            value={canUseServiceDashboard ? pendingAppointments : '—'}
            helper={canUseServiceDashboard ? (isRTL ? `${pendingFollowUps} متابعة معلقة` : `${pendingFollowUps} pending follow-ups`) : (isRTL ? 'غير متاح لهذا الدور' : 'Not available for this role')}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.9fr,0.95fr]">
          <SectionCard
            title={isRTL ? 'TAS Sales Journey' : 'TAS Sales Journey'}
            subtitle={isRTL ? 'التوزيع الفعلي لمراحل Handover Pipeline' : 'Live TAS handover pipeline stage distribution'}
            action={canUseSalesDashboard ? <Link href="/tas/sales" className="text-xs font-bold text-[var(--tas-gold)]">{isRTL ? 'عرض Pipeline' : 'View pipeline'}</Link> : null}
          >
            {!canUseSalesMetrics ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? 'مؤشرات المبيعات غير متاحة لهذا الدور' : 'Sales metrics are not available for this role'}</div>
            ) : salesMetricsLoading ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">...</div>
            ) : journeyRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? 'لا توجد بيانات Pipeline' : 'No pipeline data'}</div>
            ) : (
              <div className="grid gap-3">
                {journeyRows.map((item) => {
                  const width = item.count > 0 && maxJourneyCount > 0 ? Math.max((item.count / maxJourneyCount) * 100, 8) : 0;
                  return (
                    <div key={item.stage} className="flex items-center gap-4">
                      <div className="w-28 truncate text-xs font-bold text-[var(--tas-text-muted)]">{isRTL ? (stageLabelAr[item.stage] ?? item.stage) : item.stage}</div>
                      <div className="h-9 flex-1 overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--tas-text-muted)_10%,transparent)]">
                        <div className="tas-funnel-segment flex h-full items-center justify-between rounded-xl px-4 text-xs font-black" style={{ width: `${width}%` }}>
                          {item.count > 0 ? <span>{item.count}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title={isRTL ? 'الخدمات والصيانة' : 'Service & Maintenance'} subtitle={isRTL ? 'قيم فعلية من مواعيد الخدمة وطلبات القطع' : 'Live appointment and parts-request counts'}>
            <div className="grid gap-4 sm:grid-cols-[1fr,0.9fr]">
              <div className="rounded-2xl border border-[var(--tas-border)] bg-[color-mix(in_srgb,var(--tas-gold)_8%,transparent)] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Wrench size={16} className="text-[var(--tas-gold)]" />
                  {isRTL ? 'حالة الخدمة' : 'Service status'}
                </div>
                <div className="text-3xl font-black">{canUseServiceDashboard ? pendingAppointments : '—'}</div>
                <p className="mt-2 text-xs text-[var(--tas-text-muted)]">{isRTL ? 'مواعيد غير مكتملة وغير ملغاة' : 'Appointments not completed or cancelled'}</p>
              </div>
              <div className="flex flex-col justify-center rounded-2xl border border-[var(--tas-border)] p-4 text-center">
                <div className="text-3xl font-black">—</div>
                <p className="mt-3 text-xs font-bold text-[var(--tas-text-muted)]">{isRTL ? 'رضا العملاء: لا يوجد مصدر بيانات موثوق متصل حالياً' : 'Customer satisfaction: no trusted data source is currently connected'}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div><b className="text-lg">{canUseServiceDashboard ? pendingAppointments : '—'}</b><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'مواعيد مفتوحة' : 'Open appointments'}</p></div>
              <div><b className="text-lg">{canUseServiceDashboard ? appointments.length : '—'}</b><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'كل المواعيد المحملة' : 'Loaded appointments'}</p></div>
              <div><b className="text-lg">{canUseAfterSalesDashboard ? parts.length : '—'}</b><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'طلبات قطع' : 'Parts requests'}</p></div>
            </div>
          </SectionCard>

          <SectionCard title={isRTL ? 'توزيع TAS Pipeline' : 'TAS Pipeline Distribution'} subtitle={isRTL ? 'النسبة حسب حالة Handover' : 'Share by handover status'}>
            {!canUseSalesMetrics || salesMetricsLoading ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">{canUseSalesMetrics ? '...' : (isRTL ? 'غير متاح لهذا الدور' : 'Not available for this role')}</div>
            ) : journeyRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? 'لا توجد بيانات' : 'No data'}</div>
            ) : (
              <div className="space-y-3">
                {journeyRows.slice(0, 8).map((row) => {
                  const pct = pipelineTotal > 0 ? Math.round((row.count / pipelineTotal) * 1000) / 10 : 0;
                  return (
                    <div key={row.stage} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-bold">{isRTL ? (stageLabelAr[row.stage] ?? row.stage) : row.stage}</span>
                      <span className="shrink-0 text-[var(--tas-text-muted)]">{row.count} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr,1.55fr]">
          <SectionCard title={isRTL ? 'أداء TAS Pipeline' : 'TAS Pipeline Performance'} subtitle={isRTL ? 'ملخص مباشر بدون Trend تجريبي' : 'Live summary without demo trend data'}>
            {!canUseSalesMetrics || salesMetricsLoading ? (
              <div className="py-12 text-center text-sm text-[var(--tas-text-muted)]">{canUseSalesMetrics ? '...' : (isRTL ? 'غير متاح لهذا الدور' : 'Not available for this role')}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--tas-border)] p-4"><CircleDollarSign size={18} className="mb-2 text-[var(--tas-gold)]" /><div className="text-xl font-black">{formatEGP(overview?.totals?.wonValue ?? 0)}</div><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'قيمة Won / Delivered' : 'Won / delivered value'}</p></div>
                <div className="rounded-2xl border border-[var(--tas-border)] p-4"><TrendingUp size={18} className="mb-2 text-[var(--tas-gold)]" /><div className="text-xl font-black">{formatEGP(overview?.totals?.openValue ?? 0)}</div><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'قيمة Pipeline المفتوحة' : 'Open pipeline value'}</p></div>
                <div className="rounded-2xl border border-[var(--tas-border)] p-4"><CheckCircle2 size={18} className="mb-2 text-[var(--tas-success)]" /><div className="text-xl font-black">{overview?.totals?.won ?? 0}</div><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'Won / Delivered' : 'Won / delivered'}</p></div>
                <div className="rounded-2xl border border-[var(--tas-border)] p-4"><Gauge size={18} className="mb-2 text-[var(--tas-gold)]" /><div className="text-xl font-black">{overview?.totals?.winRate ?? 0}%</div><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? 'Won مقابل Lost' : 'Won vs lost'}</p></div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={isRTL ? 'فرص TAS المفتوحة' : 'Open TAS Opportunities'} action={canUseSalesDashboard ? <Link href="/tas/sales" className="text-xs font-bold text-[var(--tas-gold)]">{isRTL ? 'عرض Pipeline' : 'View pipeline'}</Link> : null}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--tas-border)] text-xs text-[var(--tas-text-muted)]">
                    <th className="py-3 text-start">{isRTL ? 'العميل' : 'Customer'}</th>
                    <th className="py-3 text-start">{isRTL ? 'المركبة' : 'Vehicle'}</th>
                    <th className="py-3 text-start">{isRTL ? 'قيمة الفرصة' : 'Value'}</th>
                    <th className="py-3 text-start">{isRTL ? 'المرحلة' : 'Stage'}</th>
                    <th className="py-3 text-start">{isRTL ? 'المسؤول' : 'Owner'}</th>
                    <th className="py-3 text-start">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {openPipelineRows.slice(0, 6).map((row: any) => (
                    <tr key={row.id} className="border-b border-[var(--tas-border)] last:border-0">
                      <td className="py-3 font-bold">{row.customerName || row.customerPhone || `#${row.leadId ?? row.id}`}</td>
                      <td className="py-3"><div className="flex items-center gap-2"><Car size={16} className="text-[var(--tas-gold)]" />{row.vehicleTitle || '—'}</div></td>
                      <td className="py-3 font-bold text-[var(--tas-gold)]">{formatEGP(row.latestQuoteTotal ?? row.vehiclePrice ?? 0)}</td>
                      <td className="py-3"><StatusBadge status={isRTL ? (stageLabelAr[String(row.status)] ?? String(row.status ?? '')) : String(row.status ?? '')} /></td>
                      <td className="py-3 text-[var(--tas-text-muted)]">{row.assignedToUserName || (isRTL ? 'غير معين' : 'Unassigned')}</td>
                      <td className="py-3"><Link href="/tas/sales"><Button size="sm" variant="outline" className="h-8 rounded-lg border-[var(--tas-border)]">{isRTL ? 'عرض' : 'View'}</Button></Link></td>
                    </tr>
                  ))}
                  {!salesMetricsLoading && openPipelineRows.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? 'لا توجد فرص TAS مفتوحة' : 'No open TAS opportunities'}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <SectionCard title={isRTL ? 'آخر تحديثات TAS Pipeline' : 'Recent TAS Pipeline Updates'} className="xl:col-span-1">
            <div className="space-y-3">
              {recentPipelineUpdates.map((row: any) => (
                <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-[var(--tas-border)] bg-[color-mix(in_srgb,var(--tas-gold)_5%,transparent)] p-3">
                  <span className="tas-icon-badge flex h-10 w-10 items-center justify-center rounded-xl"><Activity size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.customerName || row.customerPhone || `#${row.leadId ?? row.id}`}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={isRTL ? (stageLabelAr[String(row.status)] ?? String(row.status ?? '')) : String(row.status ?? '')} /><span className="text-xs text-[var(--tas-text-muted)]">{formatEgyptDateTime(row.updatedAt)}</span></div>
                  </div>
                </div>
              ))}
              {!salesMetricsLoading && recentPipelineUpdates.length === 0 ? <div className="py-8 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? 'لا توجد تحديثات Pipeline' : 'No pipeline updates'}</div> : null}
            </div>
          </SectionCard>

          <SectionCard title={isRTL ? 'مركز التشغيل السريع' : 'Quick Operations'} className="xl:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/tas/conversations', icon: Phone, ar: 'محادثات العملاء', en: 'Customer conversations', value: openConversations, visible: true },
                { href: '/tas/sales', icon: Car, ar: 'مبيعات السيارات', en: 'Automotive sales', value: handovers.length, visible: canUseSalesDashboard },
                { href: '/tas/finance', icon: CircleDollarSign, ar: 'برامج التمويل', en: 'Finance programs', value: programs.length, visible: canUseFinanceDashboard },
                { href: '/tas/shipping-agent', icon: Ship, ar: 'تتبع الشحنات', en: 'Shipment tracking', value: 0, visible: canUseShipmentDashboard },
                { href: '/tas/service', icon: ClipboardList, ar: 'مواعيد الصيانة', en: 'Service appointments', value: appointments.length, visible: canUseServiceDashboard },
                { href: '/tas/after-sales', icon: Package, ar: 'ما بعد البيع', en: 'After sales', value: parts.length, visible: canUseAfterSalesDashboard },
                { href: '/tas/admin', icon: Package, ar: 'المخزون والفروع', en: 'Inventory & branches', value: vehicles.length + branches.length, visible: canUseAdminDashboard },
              ].filter((item) => item.visible).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div className="tas-stat-card rounded-2xl border p-4">
                      <Icon size={18} className="mb-3 text-[var(--tas-gold)]" />
                      <div className="text-2xl font-black">{item.value}</div>
                      <p className="mt-1 text-xs font-bold text-[var(--tas-text-muted)]">{isRTL ? item.ar : item.en}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </CRMLayout>
  );
}
