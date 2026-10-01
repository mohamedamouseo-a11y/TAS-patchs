#!/usr/bin/env python3
from pathlib import Path
import sys

MARKER = "// TAS_AFTER_SALES_SERVICE_MENU_V3"

def patch_layout(path: Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print(f"LAYOUT_ALREADY_APPLIED={path}")
        return

    old_block = '''// TAS_AFTER_SALES_SERVICE_AFTER_SALES_GROUP_V2
  const standaloneSidebarItems = compactItems(
    toSidebarGroupItem("/dashboard"),
    toSidebarGroupItem("/inbox")
  );

  const afterSalesServiceSidebarItem = customSidebarItem(
    "/tas/service",
    isRTL ? "خدمة ما بعد البيع" : "After Sales Service",
    <Wrench size={18} />,
    TAS_SERVICE_ROLES
  );'''

    new_block = '''// TAS_AFTER_SALES_SERVICE_MENU_V3
  const standaloneSidebarItems = compactItems(
    toSidebarGroupItem("/dashboard"),
    toSidebarGroupItem("/inbox")
  );'''

    if old_block not in text:
        raise SystemExit(f"ERROR=LAYOUT_V2_BLOCK_NOT_FOUND:{path}")
    text = text.replace(old_block, new_block, 1)

    marketing_anchor = '''    {
      key: "marketing",
      label: isRTL ? "التسويق" : "Marketing",'''

    after_sales_group = '''    {
      key: "after-sales-service",
      label: isRTL ? "خدمة ما بعد البيع" : "After Sales Service",
      icon: <Wrench size={18} />,
      items: compactItems(
        customSidebarItem("/tas/service", isRTL ? "نظرة عامة" : "Overview", <Activity size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/book", isRTL ? "حجز صيانة جديد" : "New Service Booking", <Calendar size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/appointments", isRTL ? "مواعيد الصيانة" : "Service Appointments", <CalendarClock size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/availability", isRTL ? "الجدولة والإتاحة" : "Availability & Scheduler", <Clock size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/maintenance-plans", isRTL ? "خطط الصيانة" : "Maintenance Plans", <ClipboardList size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/vehicle-mapping", isRTL ? "ربط السيارات" : "Vehicle Mapping", <Car size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/service-bays", isRTL ? "أماكن الخدمة" : "Service Bays", <Wrench size={15} />, TAS_SERVICE_ROLES),
        customSidebarItem("/tas/service/branch-scheduling", isRTL ? "مواعيد الفروع" : "Branch Scheduling", <Building2 size={15} />, TAS_SERVICE_ROLES)
      ),
    },
'''

    if marketing_anchor not in text:
        raise SystemExit(f"ERROR=MARKETING_GROUP_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(marketing_anchor, after_sales_group + marketing_anchor, 1)

    old_render = '''        {standaloneSidebarItems.map((item) => renderSidebarLink(item))}
        {sidebarGroups.flatMap((group) => [
          renderSidebarGroup(group),
          ...(group.key === "sales" && afterSalesServiceSidebarItem
            ? [renderSidebarLink(afterSalesServiceSidebarItem)]
            : []),
        ])}'''

    new_render = '''        {standaloneSidebarItems.map((item) => renderSidebarLink(item))}
        {sidebarGroups.map((group) => renderSidebarGroup(group))}'''

    if old_render not in text:
        raise SystemExit(f"ERROR=V2_RENDER_BLOCK_NOT_FOUND:{path}")
    text = text.replace(old_render, new_render, 1)

    old_parent_only = '''const parentOnly = new Set(["/dashboard", "/inbox", "/marketing", "/automotive", "/tas", "/bd"]);'''
    new_parent_only = '''const parentOnly = new Set(["/dashboard", "/inbox", "/marketing", "/automotive", "/tas", "/bd", "/tas/service"]);'''
    if old_parent_only not in text:
        raise SystemExit(f"ERROR=PARENT_ONLY_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(old_parent_only, new_parent_only, 1)

    if 'afterSalesServiceSidebarItem' in text:
        raise SystemExit(f"ERROR=OLD_STANDALONE_REFERENCE_REMAINS:{path}")
    if 'customSidebarItem("/tas/service", isRTL ? "عمليات الخدمة"' in text:
        raise SystemExit(f"ERROR=OLD_AUTOMOTIVE_SERVICE_ENTRY_REMAINS:{path}")
    if '"/tas/help-center"' in after_sales_group:
        raise SystemExit("ERROR=HELP_CENTER_MUST_NOT_BE_IN_AFTER_SALES_MENU")

    path.write_text(text, encoding="utf-8")
    print(f"LAYOUT_PATCHED={path}")


def patch_app(path: Path):
    text = path.read_text(encoding="utf-8")
    subroute = '''      <Route path="/tas/service/:section">{() => <TASPermissionGuard module="service"><TASServicePage /></TASPermissionGuard>}</Route>
'''
    rootroute = '''      <Route path="/tas/service">{() => <TASPermissionGuard module="service"><TASServicePage /></TASPermissionGuard>}</Route>
'''
    if subroute in text:
        print(f"APP_ALREADY_APPLIED={path}")
        return
    if rootroute not in text:
        raise SystemExit(f"ERROR=SERVICE_ROUTE_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(rootroute, subroute + rootroute, 1)
    path.write_text(text, encoding="utf-8")
    print(f"APP_PATCHED={path}")


def patch_service(path: Path):
    text = path.read_text(encoding="utf-8")
    page_marker = "// TAS_AFTER_SALES_SERVICE_SECTION_PAGES_V3"
    if page_marker in text:
        print(f"SERVICE_ALREADY_APPLIED={path}")
        return

    import_anchor = '''import { toast } from 'sonner';
'''
    if "from 'wouter'" not in text:
        if import_anchor not in text:
            raise SystemExit(f"ERROR=WOUTER_IMPORT_ANCHOR_NOT_FOUND:{path}")
        text = text.replace(import_anchor, import_anchor + "import { useLocation } from 'wouter';\n", 1)

    hook_anchor = '''export default function TASServicePage() {
  const { isRTL } = useLanguage();
'''
    if hook_anchor not in text:
        raise SystemExit(f"ERROR=SERVICE_HOOK_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(
        hook_anchor,
        '''export default function TASServicePage() {
  const { isRTL } = useLanguage();
  const [location] = useLocation();
''',
        1,
    )

    return_start = text.find("  return (\n    <CRMLayout>")
    if return_start < 0:
        raise SystemExit(f"ERROR=SERVICE_RETURN_START_NOT_FOUND:{path}")
    function_end = text.rfind("\n}")
    if function_end < return_start:
        raise SystemExit(f"ERROR=SERVICE_FUNCTION_END_NOT_FOUND:{path}")

    new_tail = r'''  // TAS_AFTER_SALES_SERVICE_SECTION_PAGES_V3
  const cleanPath = location.split(/[?#]/)[0].replace(/\/+$/, '');
  const sectionSlug = cleanPath.startsWith('/tas/service/')
    ? cleanPath.slice('/tas/service/'.length).split('/')[0]
    : 'overview';

  const allowedSections = new Set([
    'overview',
    'book',
    'appointments',
    'availability',
    'maintenance-plans',
    'vehicle-mapping',
    'service-bays',
    'branch-scheduling',
  ]);
  const section = allowedSections.has(sectionSlug) ? sectionSlug : 'overview';

  const sectionCopy: Record<string, { ar: string; en: string; arSub: string; enSub: string }> = {
    overview: {
      ar: 'خدمة ما بعد البيع',
      en: 'After Sales Service',
      arSub: 'نظرة تشغيلية سريعة على حجوزات ومواعيد الصيانة.',
      enSub: 'A focused operational overview of service bookings and appointments.',
    },
    book: {
      ar: 'حجز صيانة جديد',
      en: 'New Service Booking',
      arSub: 'إنشاء حجز صيانة جديد بخطوات واضحة وربط الموعد بالخدمة المناسبة.',
      enSub: 'Create a new service booking with the guided premium booking flow.',
    },
    appointments: {
      ar: 'مواعيد الصيانة',
      en: 'Service Appointments',
      arSub: 'متابعة حجوزات الصيانة الحالية وحالاتها ومواعيدها.',
      enSub: 'Review current service bookings, statuses, bays, and appointment times.',
    },
    availability: {
      ar: 'الجدولة والإتاحة',
      en: 'Availability & Scheduler',
      arSub: 'إدارة الإتاحة وتوزيع المواعيد وفق الطاقة التشغيلية.',
      enSub: 'Manage service availability and scheduling against operational capacity.',
    },
    'maintenance-plans': {
      ar: 'خطط الصيانة',
      en: 'Maintenance Plans',
      arSub: 'إدارة خطط الصيانة والدورات والبنود المرتبطة بها.',
      enSub: 'Manage maintenance plans, intervals, and their related service items.',
    },
    'vehicle-mapping': {
      ar: 'ربط السيارات',
      en: 'Vehicle Mapping',
      arSub: 'ربط موديلات السيارات بخطط الصيانة المناسبة.',
      enSub: 'Map vehicle models to the appropriate maintenance plans.',
    },
    'service-bays': {
      ar: 'أماكن الخدمة',
      en: 'Service Bays',
      arSub: 'إدارة أماكن ومواضع الخدمة المتاحة داخل الفروع.',
      enSub: 'Manage the service bays and work positions available at branches.',
    },
    'branch-scheduling': {
      ar: 'مواعيد الفروع',
      en: 'Branch Scheduling',
      arSub: 'ضبط ساعات العمل وقواعد المواعيد لكل فرع.',
      enSub: 'Configure branch working hours and appointment scheduling rules.',
    },
  };

  const copy = sectionCopy[section] ?? sectionCopy.overview;

  return (
    <CRMLayout>
      <div className="space-y-6 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <TASHero
          icon={<Wrench size={16} />}
          title={isRTL ? copy.ar : copy.en}
          subtitle={isRTL ? copy.arSub : copy.enSub}
        />

        {section === 'overview' && (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard icon={<CalendarClock size={15} />} label={isRTL ? 'مواعيد مفتوحة' : 'Open appointments'} value={pendingCount} tone="gold" />
            <StatCard icon={<Clock size={15} />} label={isRTL ? 'مواعيد اليوم' : 'Today'} value={todayCount} tone="navy" />
            <StatCard icon={<CheckCircle2 size={15} />} label={isRTL ? 'مكتملة' : 'Completed'} value={completedCount} tone="green" />
          </div>
        )}

        {section === 'book' && (
          <TASPremiumBookingFlow onCreated={() => appointmentsQ.refetch()} />
        )}

        {section === 'appointments' && (
          <div className="grid gap-6">
            <SectionCard title={isRTL ? 'مواعيد الصيانة' : 'Service appointments'} right={<Badge className="bg-[#0a1f44] text-white">{appointments.length}</Badge>}>
              {appointmentsQ.isLoading ? (
                <div className="py-10 text-center text-sm text-zinc-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : appointments.length === 0 ? (
                <div className="py-12 text-center">
                  <Wrench size={36} className="mx-auto mb-3 text-zinc-200" />
                  <p className="text-sm text-zinc-400">{isRTL ? 'لا توجد مواعيد صيانة حتى الآن.' : 'No service appointments yet.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-100">
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'العميل' : 'Customer'}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'الخدمة' : 'Service'}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'Bay / الكوريك' : 'Bay'}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'السيارة' : 'Vehicle'}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'الموعد' : 'Appointment'}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-zinc-400">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.slice(0, 20).map((row: any) => (
                        <TableRow key={row.id} className="border-zinc-50 hover:bg-zinc-50/50">
                          <TableCell>
                            <div className="font-medium text-zinc-800">{row.customerName || '—'}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><Phone size={11} />{row.customerPhone || row.phone || '—'}</div>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600">{row.serviceTypeName || row.serviceName || `#${row.serviceTypeId}`}</TableCell>
                          <TableCell>
                            {row.bayId ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                {row.bayName || row.bayCode || `Bay #${row.bayId}`}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-400">
                                {isRTL ? 'غير معيّن' : 'Unassigned'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600">
                            <div>{[row.vehicleBrand, row.vehicleModel, row.vehicleYear].filter(Boolean).join(' ') || '—'}</div>
                            {row.mileageKm != null && <div className="mt-1 text-[11px] text-zinc-400">{Number(row.mileageKm).toLocaleString('en-US')} km</div>}
                            {row.maintenancePlanName && (
                              <div className="mt-1 text-[11px] text-[#9a6b12]">
                                {row.maintenancePlanName}{row.maintenanceMileageKm != null ? ` • ${Number(row.maintenanceMileageKm).toLocaleString('en-US')} km` : ''}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600">{row.startAt ? formatEgyptDateTime(row.startAt) : '—'}</TableCell>
                          <TableCell><StatusBadge status={row.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {section === 'availability' && <TASAvailabilityEngineV2Panel />}
        {section === 'maintenance-plans' && <TASMaintenancePlansSettings />}
        {section === 'vehicle-mapping' && <TASMaintenanceVehicleMappingSettings />}
        {section === 'service-bays' && <TASServiceBaysSettings />}
        {section === 'branch-scheduling' && <TASBranchSchedulingSettings />}
      </div>
    </CRMLayout>
  );
}'''

    text = text[:return_start] + new_tail + text[function_end + 2:]
    path.write_text(text, encoding="utf-8")
    print(f"SERVICE_PATCHED={path}")


if len(sys.argv) != 4:
    raise SystemExit("USAGE: apply.py <CRMLayout.tsx> <App.tsx> <TASServicePage.tsx>")

patch_layout(Path(sys.argv[1]))
patch_app(Path(sys.argv[2]))
patch_service(Path(sys.argv[3]))
print("PATCH_RESULT=PASS")
