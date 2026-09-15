import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = path.resolve(process.argv[2] || process.cwd());

const read = (rel) => fs.readFileSync(path.join(targetRoot, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(targetRoot, rel), value, 'utf8');
const lines = (items) => items.join('\n');

function replaceExact(rel, oldText, newText) {
  const current = read(rel);
  if (!current.includes(oldText)) throw new Error(`Expected source block not found in ${rel}`);
  if (current.indexOf(oldText) !== current.lastIndexOf(oldText)) throw new Error(`Expected source block is not unique in ${rel}`);
  write(rel, current.replace(oldText, newText));
}

const dashboardTarget = 'client/src/pages/tas/TASDashboard.tsx';
const dashboardReplacement = path.join(packageRoot, 'files', dashboardTarget);
if (!fs.existsSync(dashboardReplacement)) throw new Error(`Missing replacement file: ${dashboardReplacement}`);
if (!fs.existsSync(path.join(targetRoot, dashboardTarget))) throw new Error(`Missing TAS target file: ${dashboardTarget}`);
fs.copyFileSync(dashboardReplacement, path.join(targetRoot, dashboardTarget));

const salesPage = 'client/src/pages/tas/TASSalesPage.tsx';
replaceExact(
  salesPage,
  `<StatCard icon={<Gauge size={18} />} label={isRTL ? 'فرص مفتوحة' : 'Open opportunities'} value={overview?.totals?.open ?? 0} helper={isRTL ? 'Pipeline نشط' : 'Active pipeline'} tone="gold" />`,
  `<StatCard icon={<Gauge size={18} />} label={isRTL ? 'TAS Pipeline — فرص مفتوحة' : 'TAS pipeline — open'} value={overview?.totals?.open ?? 0} helper={isRTL ? 'Handover Pipeline فعلي' : 'Live handover pipeline'} tone="gold" />`,
);
replaceExact(
  salesPage,
  `<StatCard icon={<DollarSign size={18} />} label={isRTL ? 'قيمة الفرص' : 'Pipeline value'} value={formatEGP(overview?.totals?.openValue)} helper={isRTL ? 'حسب العروض/السيارات' : 'Quotes / vehicles'} />`,
  `<StatCard icon={<DollarSign size={18} />} label={isRTL ? 'قيمة TAS Pipeline المفتوحة' : 'Open TAS pipeline value'} value={formatEGP(overview?.totals?.openValue)} helper={isRTL ? 'حسب عروض/سيارات Handover Pipeline' : 'Handover quotes / vehicles'} />`,
);
replaceExact(
  salesPage,
  `<StatCard icon={<CheckCircle2 size={18} />} label={isRTL ? 'مبيعات ناجحة' : 'Won sales'} value={overview?.totals?.won ?? 0} helper={formatEGP(overview?.totals?.wonValue)} tone="success" />`,
  `<StatCard icon={<CheckCircle2 size={18} />} label={isRTL ? 'TAS Handover — Won / Delivered' : 'TAS handovers — won / delivered'} value={overview?.totals?.won ?? 0} helper={formatEGP(overview?.totals?.wonValue)} tone="success" />`,
);
replaceExact(
  salesPage,
  "<StatCard icon={<TrendingUp size={18} />} label={isRTL ? 'Win Rate' : 'Win rate'} value={`${overview?.totals?.winRate ?? 0}%`} helper={isRTL ? 'Won مقابل Lost' : 'Won vs lost'} />",
  "<StatCard icon={<TrendingUp size={18} />} label={isRTL ? 'Win Rate — TAS Handover' : 'TAS handover win rate'} value={`${overview?.totals?.winRate ?? 0}%`} helper={isRTL ? 'Won مقابل Lost داخل Handover Pipeline' : 'Won vs lost handovers'} />",
);

const dbFile = 'server/db.ts';
replaceExact(
  dbFile,
  lines([
    '  const activityConditions = isMediaBuyer',
    '    ? [gte(activities.createdAt, from), lte(activities.createdAt, to)]',
    '    : [eq(activities.userId, userId), gte(activities.createdAt, from), lte(activities.createdAt, to)];',
  ]),
  lines([
    '  const activityConditions = isMediaBuyer',
    '    ? [isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to)]',
    '    : [eq(activities.userId, userId), isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to)];',
  ]),
);

replaceExact(
  dbFile,
  lines([
    '    isMediaBuyer',
    "      ? db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`)",
    "      : db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`),",
  ]),
  lines([
    '    isMediaBuyer',
    "      ? db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND COALESCE(d.closedAt, d.updatedAt, d.createdAt) BETWEEN ${from} AND ${to}`)",
    "      : db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND COALESCE(d.closedAt, d.updatedAt, d.createdAt) BETWEEN ${from} AND ${to}`),",
  ]),
);

replaceExact(
  dbFile,
  lines([
    '  const revenueBreakdownQuery = isMediaBuyer',
    "    ? db.execute(sql`SELECT COALESCE(d.currency, 'EGP') as currency, COALESCE(SUM(CAST(d.valueEgp AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND (l.deletedAt IS NULL OR d.leadId IS NULL) AND d.status = 'Won' AND COALESCE(d.closedAt, d.updatedAt, d.createdAt) BETWEEN ${from} AND ${to} GROUP BY d.currency`)",
    "    : db.execute(sql`SELECT COALESCE(d.currency, 'EGP') as currency, COALESCE(SUM(CAST(d.valueEgp AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to} GROUP BY d.currency`);",
  ]),
  lines([
    '  const revenueBreakdownQuery = isMediaBuyer',
    "    ? db.execute(sql`SELECT COALESCE(d.currency, 'EGP') as currency, COALESCE(SUM(CAST(d.valueEgp AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND COALESCE(d.closedAt, d.updatedAt, d.createdAt) BETWEEN ${from} AND ${to} GROUP BY d.currency`)",
    "    : db.execute(sql`SELECT COALESCE(d.currency, 'EGP') as currency, COALESCE(SUM(CAST(d.valueEgp AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND COALESCE(d.closedAt, d.updatedAt, d.createdAt) BETWEEN ${from} AND ${to} GROUP BY d.currency`);",
  ]),
);

replaceExact(
  dbFile,
  lines([
    '      LEFT JOIN (',
    '        SELECT userId, COUNT(*) as activityCount',
    '        FROM activities',
    '        WHERE createdAt BETWEEN ${from} AND ${to}',
    '        GROUP BY userId',
    '      ) ac ON ac.userId = u.id',
  ]),
  lines([
    '      LEFT JOIN (',
    '        SELECT userId, COUNT(*) as activityCount',
    '        FROM activities',
    '        WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to}',
    '        GROUP BY userId',
    '      ) ac ON ac.userId = u.id',
  ]),
);
replaceExact(
  dbFile,
  "    db.select({ count: sql<number>`count(*)` }).from(activities).where(and(gte(activities.createdAt, from), lte(activities.createdAt, to))),",
  "    db.select({ count: sql<number>`count(*)` }).from(activities).where(and(isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to))),",
);
replaceExact(
  dbFile,
  lines([
    "  const wonRow = dealRows.find((r: any) => r.status === 'Won');",
    "  const wonLeadsRow = stageRows.find((r: any) => r.stage === 'Won');",
    '  const wonDeals = Number(wonLeadsRow?.count ?? 0);',
  ]),
  lines([
    "  const wonRow = dealRows.find((r: any) => r.status === 'Won');",
    '  const wonDeals = Number(wonRow?.count ?? 0);',
  ]),
);
replaceExact(
  dbFile,
  "  const slaBreachedCount = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.slaBreached, true), isNull(leads.deletedAt)));",
  "  const slaBreachedCount = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)));",
);

console.log('DASHBOARD_DATA_ACCURACY_FIX_APPLIED=YES');
console.log('FILES_CHANGED=client/src/pages/tas/TASDashboard.tsx,client/src/pages/tas/TASSalesPage.tsx,server/db.ts');
