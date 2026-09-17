from pathlib import Path

MARKER = "TAS_LEAD_DISPATCHER_DASHBOARD_V1"
ROOT = Path("/var/www/TAS-root")
APP = ROOT / "client/src/App.tsx"
ROUTER = ROOT / "server/routers.ts"
PAGE = ROOT / "client/src/pages/LeadDispatcherDashboard.tsx"
SERVICE = ROOT / "server/services/leadDispatcherDashboard.ts"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL:{label}:expected_1_found_{count}")
    return text.replace(old, new, 1)


for path in (APP, ROUTER):
    if not path.exists():
        raise SystemExit(f"PATCH_FAIL:missing:{path}")

app = APP.read_text()
router = ROUTER.read_text()

if MARKER in app and MARKER in router and PAGE.exists() and SERVICE.exists():
    print("PATCH_APPLIED=YES")
    print("FILES=client/src/App.tsx,client/src/pages/LeadDispatcherDashboard.tsx,server/routers.ts,server/services/leadDispatcherDashboard.ts")
    raise SystemExit(0)

page_content = r'''// TAS_LEAD_DISPATCHER_DASHBOARD_V1
import CRMLayout from "@/components/CRMLayout";
import { TASHero, SectionCard, StatCard } from "@/components/tas/TASShared";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Send,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Link } from "wouter";

function n(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function when(value: unknown, isRTL: boolean) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(isRTL ? "ar-EG" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function Empty({ isRTL }: { isRTL: boolean }) {
  return <div className="py-10 text-center text-sm text-[var(--tas-text-muted)]">{isRTL ? "لا توجد بيانات حالياً" : "No data yet"}</div>;
}

export default function LeadDispatcherDashboard() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { data, isLoading, refetch, isFetching } = trpc.leadDispatcherDashboard.overview.useQuery();

  const kpi = data?.kpi;
  const agentRows = data?.agents ?? [];
  const feedbackRows = data?.recentFeedback ?? [];
  const attentionRows = data?.needsAttention ?? [];
  const campaignRows = data?.campaigns ?? [];
  const brandRows = data?.brands ?? [];

  return (
    <CRMLayout>
      <div className="space-y-6 p-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--tas-text)]">
              {isRTL ? "لوحة توزيع العملاء" : "Lead Distribution Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-[var(--tas-text-muted)]">
              {isRTL ? "متابعة التوزيع، ردود فريق المبيعات، والحالات التي تحتاج تدخلاً" : "Distribution, sales feedback, and follow-up exceptions in one operational view"}
            </p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw size={14} className={`me-2 ${isFetching ? "animate-spin" : ""}`} />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <TASHero
          className="tas-dashboard-hero"
          icon={<UserRoundCheck size={16} />}
          title={isRTL ? `مرحباً ${user?.name ?? ""}` : `Welcome ${user?.name ?? ""}`}
          subtitle={isRTL ? "هذه اللوحة تعرض فقط العملاء المرتبطين بعملك كمسؤول توزيع، مع أحدث Feedback من موظفي المبيعات." : "This dashboard is scoped to leads tied to your dispatcher activity, with the latest Sales Agent feedback."}
          actions={
            <>
              <Link href="/leads"><Button className="rounded-xl bg-[var(--tas-gold)] text-[var(--tas-on-gold)] hover:bg-[var(--tas-gold-soft)]"><Users size={14} className="me-2" />{isRTL ? "إدارة العملاء" : "Manage leads"}</Button></Link>
              <Link href="/import"><Button variant="outline" className="rounded-xl border-[var(--tas-border-strong)]"><Send size={14} className="me-2" />{isRTL ? "استيراد وتوزيع" : "Import & distribute"}</Button></Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Send size={18} />} label={isRTL ? "تم توزيعهم اليوم" : "Distributed today"} value={isLoading ? "..." : n(kpi?.distributedToday)} helper={isRTL ? "عملاء تم إسنادهم للمبيعات اليوم" : "Assigned to Sales Agents today"} tone="gold" />
          <StatCard icon={<Clock3 size={18} />} label={isRTL ? "بانتظار Feedback" : "Waiting feedback"} value={isLoading ? "..." : n(kpi?.waitingFeedback)} helper={isRTL ? "تم التوزيع ولم يصل رد بعد" : "Assigned with no feedback yet"} />
          <StatCard icon={<CheckCircle2 size={18} />} label={isRTL ? "Feedback اليوم" : "Feedback today"} value={isLoading ? "..." : n(kpi?.feedbackToday)} helper={isRTL ? "عملاء وصل عليهم رد من المبيعات" : "Leads with Sales feedback today"} tone="gold" />
          <StatCard icon={<AlertTriangle size={18} />} label={isRTL ? "تحتاج متابعة" : "Needs attention"} value={isLoading ? "..." : n(kpi?.needsAttention)} helper={isRTL ? "SLA أو أكثر من 24 ساعة بلا Feedback" : "SLA breach or 24h+ without feedback"} />
          <StatCard icon={<Users size={18} />} label={isRTL ? "غير موزعين للمبيعات" : "Not with Sales"} value={isLoading ? "..." : n(kpi?.unassigned)} helper={isRTL ? "ضمن نطاق عملك وغير مسندين SalesAgent" : "Scoped leads not owned by a Sales Agent"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,1.4fr]">
          <SectionCard title={isRTL ? "حالة التوزيع حسب موظف المبيعات" : "Distribution by Sales Agent"} subtitle={isRTL ? "فقط العملاء المرتبطون بتوزيعاتك" : "Only leads scoped to your dispatcher activity"}>
            {!agentRows.length ? <Empty isRTL={isRTL} /> : (
              <div className="space-y-3">
                {agentRows.map((row: any) => (
                  <div key={row.agentId} className="rounded-xl border border-[var(--tas-border)] bg-[var(--tas-card)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--tas-text)]">{row.agentName || `#${row.agentId}`}</p>
                        <p className="mt-1 text-xs text-[var(--tas-text-muted)]">{isRTL ? `${n(row.assigned)} مسند` : `${n(row.assigned)} assigned`}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">{isRTL ? `رد ${n(row.feedbackDone)}` : `Feedback ${n(row.feedbackDone)}`}</span>
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">{isRTL ? `منتظر ${n(row.waiting)}` : `Waiting ${n(row.waiting)}`}</span>
                        {Number(row.slaBreached) > 0 && <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-700">SLA {n(row.slaBreached)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={isRTL ? "آخر Feedback من المبيعات" : "Latest Sales Feedback"} subtitle={isRTL ? "النتائج المسجلة على العملاء الذين قمت بإنشائهم أو توزيعهم" : "Outcomes recorded on leads you created or distributed"}>
            {!feedbackRows.length ? <Empty isRTL={isRTL} /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead><tr className="border-b border-[var(--tas-border)] text-xs text-[var(--tas-text-muted)]">
                    <th className="px-3 py-2 text-start">{isRTL ? "العميل" : "Lead"}</th>
                    <th className="px-3 py-2 text-start">{isRTL ? "الموظف" : "Sales Agent"}</th>
                    <th className="px-3 py-2 text-start">Feedback</th>
                    <th className="px-3 py-2 text-start">{isRTL ? "الحملة / الماركة" : "Campaign / Brand"}</th>
                    <th className="px-3 py-2 text-start">{isRTL ? "الوقت" : "Time"}</th>
                  </tr></thead>
                  <tbody>{feedbackRows.map((row: any) => (
                    <tr key={row.activityId} className="border-b border-[var(--tas-border)]/70 align-top">
                      <td className="px-3 py-3"><Link href={`/leads/${row.leadId}`}><span className="font-bold hover:underline">{row.leadName || row.phone || `#${row.leadId}`}</span></Link></td>
                      <td className="px-3 py-3 text-[var(--tas-text-muted)]">{row.feedbackBy || row.assignedAgent || "—"}</td>
                      <td className="px-3 py-3"><span className="rounded-full bg-[color-mix(in_srgb,var(--tas-gold)_16%,transparent)] px-2.5 py-1 text-xs font-black">{row.outcome || row.type || "—"}</span>{row.notes && <p className="mt-1 max-w-[240px] truncate text-xs text-[var(--tas-text-muted)]" title={row.notes}>{row.notes}</p>}</td>
                      <td className="px-3 py-3 text-xs text-[var(--tas-text-muted)]"><div>{row.campaignName || "—"}</div><div className="mt-1 flex items-center gap-1"><CarFront size={12} />{row.vehicleBrand || "—"}</div></td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-[var(--tas-text-muted)]">{when(row.feedbackAt, isRTL)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr,0.85fr,0.85fr]">
          <SectionCard title={isRTL ? "تحتاج متابعة الآن" : "Needs Attention Now"}>
            {!attentionRows.length ? <Empty isRTL={isRTL} /> : (
              <div className="space-y-2">
                {attentionRows.map((row: any) => (
                  <Link key={row.leadId} href={`/leads/${row.leadId}`}>
                    <div className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--tas-border)] p-3 transition-colors hover:bg-[color-mix(in_srgb,var(--tas-gold)_6%,transparent)]">
                      <div className="min-w-0"><p className="truncate text-sm font-bold">{row.leadName || row.phone || `#${row.leadId}`}</p><p className="mt-1 truncate text-xs text-[var(--tas-text-muted)]">{row.agentName || (isRTL ? "غير مسند" : "Unassigned")} · {row.campaignName || "—"}</p></div>
                      <div className="text-end"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${Number(row.slaBreached) ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"}`}>{Number(row.slaBreached) ? "SLA" : `${n(row.ageHours)}h`}</span><p className="mt-1 text-[10px] text-[var(--tas-text-muted)]">{when(row.createdAt, isRTL)}</p></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={isRTL ? "أعلى الحملات" : "Top Campaigns"}>
            {!campaignRows.length ? <Empty isRTL={isRTL} /> : <div className="space-y-3">{campaignRows.map((row: any, i: number) => <div key={`${row.campaignName}-${i}`} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{row.campaignName}</p><p className="text-xs text-[var(--tas-text-muted)]">{isRTL ? `${n(row.withFeedback)} Feedback` : `${n(row.withFeedback)} feedback`}</p></div><span className="text-lg font-black text-[var(--tas-gold)]">{n(row.total)}</span></div>)}</div>}
          </SectionCard>

          <SectionCard title={isRTL ? "ماركات السيارات" : "Vehicle Brands"}>
            {!brandRows.length ? <Empty isRTL={isRTL} /> : <div className="space-y-3">{brandRows.map((row: any, i: number) => <div key={`${row.vehicleBrand}-${i}`} className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><CarFront size={14} className="shrink-0 text-[var(--tas-gold)]" /><span className="truncate text-sm font-bold">{row.vehicleBrand}</span></div><span className="text-lg font-black">{n(row.total)}</span></div>)}</div>}
          </SectionCard>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--tas-border)] bg-[var(--tas-card)] px-4 py-3 text-xs text-[var(--tas-text-muted)]">
          <span>{isRTL ? `إجمالي العملاء في نطاقك: ${n(kpi?.scopedLeads)} · المسند للمبيعات: ${n(kpi?.assigned)}` : `Scoped leads: ${n(kpi?.scopedLeads)} · Assigned to Sales: ${n(kpi?.assigned)}`}</span>
          <BarChart3 size={15} />
        </div>
      </div>
    </CRMLayout>
  );
}
'''

service_content = r'''// TAS_LEAD_DISPATCHER_DASHBOARD_V1
import { sql } from "drizzle-orm";
import { getDb } from "../db";

type Row = Record<string, any>;
const rowsOf = (result: any): Row[] => (result as any)?.[0] ?? [];
const num = (value: unknown) => Number(value ?? 0);

export async function getLeadDispatcherDashboard(dispatcherUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const dispatcherId = Number(dispatcherUserId);
  if (!Number.isInteger(dispatcherId) || dispatcherId <= 0) throw new Error("Invalid dispatcher user");

  const [metricsResult, agentsResult, feedbackResult, attentionResult, campaignsResult, brandsResult] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(DISTINCT l.id) AS scopedLeads,
        SUM(CASE WHEN owner.id IS NOT NULL THEN 1 ELSE 0 END) AS assigned,
        SUM(CASE WHEN owner.id IS NULL THEN 1 ELSE 0 END) AS unassigned,
        SUM(CASE WHEN owner.id IS NOT NULL AND EXISTS (
          SELECT 1 FROM audit_logs al_today
          WHERE al_today.entityType = 'leads' AND al_today.entityId = l.id
            AND al_today.userId = ${dispatcherId}
            AND al_today.action IN ('create', 'lead_distribution')
            AND DATE(al_today.createdAt) = CURDATE()
        ) THEN 1 ELSE 0 END) AS distributedToday,
        SUM(CASE WHEN owner.id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM activities af
          INNER JOIN users fu ON fu.id = af.userId AND fu.role = 'SalesAgent'
          WHERE af.leadId = l.id AND af.outcome IS NOT NULL
        ) THEN 1 ELSE 0 END) AS waitingFeedback,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM activities aft
          INNER JOIN users fut ON fut.id = aft.userId AND fut.role = 'SalesAgent'
          WHERE aft.leadId = l.id AND aft.outcome IS NOT NULL
            AND DATE(COALESCE(aft.activityTime, aft.createdAt)) = CURDATE()
        ) THEN 1 ELSE 0 END) AS feedbackToday,
        SUM(CASE WHEN owner.id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM activities an
          INNER JOIN users un ON un.id = an.userId AND un.role = 'SalesAgent'
          WHERE an.leadId = l.id AND an.outcome IS NOT NULL
        ) AND (COALESCE(l.slaBreached, 0) = 1 OR l.createdAt <= DATE_SUB(NOW(), INTERVAL 24 HOUR)) THEN 1 ELSE 0 END) AS needsAttention
      FROM leads l
      LEFT JOIN users owner ON owner.id = l.ownerId AND owner.role = 'SalesAgent' AND owner.deletedAt IS NULL
      WHERE l.deletedAt IS NULL
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId}
              AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
    `),
    db.execute(sql`
      SELECT owner.id AS agentId, COALESCE(owner.name, owner.email, CONCAT('User #', owner.id)) AS agentName,
        COUNT(DISTINCT l.id) AS assigned,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM activities a1 INNER JOIN users f1 ON f1.id = a1.userId AND f1.role = 'SalesAgent'
          WHERE a1.leadId = l.id AND a1.outcome IS NOT NULL
        ) THEN 1 ELSE 0 END) AS feedbackDone,
        SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM activities a2 INNER JOIN users f2 ON f2.id = a2.userId AND f2.role = 'SalesAgent'
          WHERE a2.leadId = l.id AND a2.outcome IS NOT NULL
        ) THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN COALESCE(l.slaBreached, 0) = 1 THEN 1 ELSE 0 END) AS slaBreached
      FROM leads l
      INNER JOIN users owner ON owner.id = l.ownerId AND owner.role = 'SalesAgent' AND owner.deletedAt IS NULL
      WHERE l.deletedAt IS NULL
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId} AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
      GROUP BY owner.id, owner.name, owner.email
      ORDER BY waiting DESC, assigned DESC, agentName ASC
      LIMIT 20
    `),
    db.execute(sql`
      SELECT a.id AS activityId, l.id AS leadId, l.name AS leadName, l.phone, l.campaignName,
        COALESCE(owner.name, owner.email) AS assignedAgent,
        COALESCE(actor.name, actor.email) AS feedbackBy,
        a.type, a.outcome, a.notes, COALESCE(a.activityTime, a.createdAt) AS feedbackAt,
        COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.vehicleBrandName')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.vehicleBrandCode')), ''),
          '—'
        ) AS vehicleBrand
      FROM activities a
      INNER JOIN leads l ON l.id = a.leadId AND l.deletedAt IS NULL
      INNER JOIN users actor ON actor.id = a.userId AND actor.role = 'SalesAgent'
      LEFT JOIN users owner ON owner.id = l.ownerId
      WHERE a.outcome IS NOT NULL
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId} AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
      ORDER BY COALESCE(a.activityTime, a.createdAt) DESC, a.id DESC
      LIMIT 12
    `),
    db.execute(sql`
      SELECT l.id AS leadId, l.name AS leadName, l.phone, l.campaignName, l.createdAt,
        COALESCE(owner.name, owner.email) AS agentName,
        COALESCE(l.slaBreached, 0) AS slaBreached,
        TIMESTAMPDIFF(HOUR, l.createdAt, NOW()) AS ageHours
      FROM leads l
      INNER JOIN users owner ON owner.id = l.ownerId AND owner.role = 'SalesAgent' AND owner.deletedAt IS NULL
      WHERE l.deletedAt IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM activities a3 INNER JOIN users f3 ON f3.id = a3.userId AND f3.role = 'SalesAgent'
          WHERE a3.leadId = l.id AND a3.outcome IS NOT NULL
        )
        AND (COALESCE(l.slaBreached, 0) = 1 OR l.createdAt <= DATE_SUB(NOW(), INTERVAL 24 HOUR))
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId} AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
      ORDER BY COALESCE(l.slaBreached, 0) DESC, l.createdAt ASC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT COALESCE(NULLIF(l.campaignName, ''), 'Unattributed') AS campaignName,
        COUNT(DISTINCT l.id) AS total,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM activities ac INNER JOIN users uc ON uc.id = ac.userId AND uc.role = 'SalesAgent'
          WHERE ac.leadId = l.id AND ac.outcome IS NOT NULL
        ) THEN 1 ELSE 0 END) AS withFeedback
      FROM leads l
      WHERE l.deletedAt IS NULL
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId} AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
      GROUP BY COALESCE(NULLIF(l.campaignName, ''), 'Unattributed')
      ORDER BY total DESC, campaignName ASC
      LIMIT 8
    `),
    db.execute(sql`
      SELECT COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.vehicleBrandName')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.vehicleBrandCode')), ''),
          'Unspecified'
        ) AS vehicleBrand,
        COUNT(DISTINCT l.id) AS total
      FROM leads l
      WHERE l.deletedAt IS NULL
        AND (
          CAST(JSON_UNQUOTE(JSON_EXTRACT(l.sourceMetadata, '$.createdByUserId')) AS UNSIGNED) = ${dispatcherId}
          OR EXISTS (
            SELECT 1 FROM audit_logs al_scope
            WHERE al_scope.entityType = 'leads' AND al_scope.entityId = l.id
              AND al_scope.userId = ${dispatcherId} AND al_scope.action IN ('create', 'lead_distribution')
          )
        )
      GROUP BY vehicleBrand
      ORDER BY total DESC, vehicleBrand ASC
      LIMIT 8
    `),
  ]);

  const metrics = rowsOf(metricsResult)[0] ?? {};
  return {
    scope: "dispatcher-originated" as const,
    kpi: {
      scopedLeads: num(metrics.scopedLeads),
      assigned: num(metrics.assigned),
      unassigned: num(metrics.unassigned),
      distributedToday: num(metrics.distributedToday),
      waitingFeedback: num(metrics.waitingFeedback),
      feedbackToday: num(metrics.feedbackToday),
      needsAttention: num(metrics.needsAttention),
    },
    agents: rowsOf(agentsResult).map((row) => ({ ...row, agentId: num(row.agentId), assigned: num(row.assigned), feedbackDone: num(row.feedbackDone), waiting: num(row.waiting), slaBreached: num(row.slaBreached) })),
    recentFeedback: rowsOf(feedbackResult).map((row) => ({ ...row, activityId: num(row.activityId), leadId: num(row.leadId) })),
    needsAttention: rowsOf(attentionResult).map((row) => ({ ...row, leadId: num(row.leadId), slaBreached: num(row.slaBreached), ageHours: num(row.ageHours) })),
    campaigns: rowsOf(campaignsResult).map((row) => ({ ...row, total: num(row.total), withFeedback: num(row.withFeedback) })),
    brands: rowsOf(brandsResult).map((row) => ({ ...row, total: num(row.total) })),
  };
}
'''

if PAGE.exists() and MARKER not in PAGE.read_text():
    raise SystemExit(f"PATCH_FAIL:existing_unexpected:{PAGE}")
if SERVICE.exists() and MARKER not in SERVICE.read_text():
    raise SystemExit(f"PATCH_FAIL:existing_unexpected:{SERVICE}")
PAGE.write_text(page_content)
SERVICE.write_text(service_content)

if MARKER not in app:
    if 'import { useAuth } from "@/_core/hooks/useAuth";' not in app:
        app = replace_once(
            app,
            'import ErrorBoundary from "./components/ErrorBoundary";\n',
            'import ErrorBoundary from "./components/ErrorBoundary";\nimport { useAuth } from "@/_core/hooks/useAuth";\n',
            "app_auth_import",
        )
    app = replace_once(
        app,
        'import AgentDashboard from "./pages/AgentDashboard";\n',
        'import AgentDashboard from "./pages/AgentDashboard";\nimport LeadDispatcherDashboard from "./pages/LeadDispatcherDashboard";\n',
        "app_dashboard_import",
    )
    app = replace_once(
        app,
        'function Router() {\n',
        '''// TAS_LEAD_DISPATCHER_DASHBOARD_V1\nfunction DashboardRoute() {\n  const { user } = useAuth();\n  return String(user?.role ?? "").trim() === "LeadDispatcher"\n    ? <LeadDispatcherDashboard />\n    : <AgentDashboard />;\n}\n\nfunction Router() {\n''',
        "app_role_dashboard",
    )
    app = replace_once(app, '<Route path="/" component={AgentDashboard} />', '<Route path="/" component={DashboardRoute} />', "app_root_route")
    app = replace_once(app, '<Route path="/dashboard" component={AgentDashboard} />', '<Route path="/dashboard" component={DashboardRoute} />', "app_dashboard_route")

if MARKER not in router:
    router = replace_once(
        router,
        'import { askShipmentTrackingAgent } from "./services/shipmentTrackingAgent";\n',
        'import { askShipmentTrackingAgent } from "./services/shipmentTrackingAgent";\nimport { getLeadDispatcherDashboard } from "./services/leadDispatcherDashboard";\n',
        "router_service_import",
    )
    router = replace_once(
        router,
        'const clientOpsProcedure = protectedProcedure.use(({ ctx, next }) => {\n',
        '''// TAS_LEAD_DISPATCHER_DASHBOARD_V1\nconst leadDispatcherDashboardProcedure = protectedProcedure.use(({ ctx, next }) => {\n  if (String(ctx.user.role ?? "").trim() !== "LeadDispatcher") {\n    throw new TRPCError({ code: "FORBIDDEN", message: "Lead Dispatcher access required" });\n  }\n  return next({ ctx });\n});\n\nconst clientOpsProcedure = protectedProcedure.use(({ ctx, next }) => {\n''',
        "router_dispatcher_guard",
    )
    router = replace_once(
        router,
        'export const appRouter = router({\n',
        '''export const appRouter = router({\n  leadDispatcherDashboard: router({\n    overview: leadDispatcherDashboardProcedure.query(({ ctx }) => getLeadDispatcherDashboard(ctx.user.id)),\n  }),\n''',
        "router_dashboard_route",
    )

APP.write_text(app)
ROUTER.write_text(router)

print("PATCH_APPLIED=YES")
print("FILES=client/src/App.tsx,client/src/pages/LeadDispatcherDashboard.tsx,server/routers.ts,server/services/leadDispatcherDashboard.ts")
