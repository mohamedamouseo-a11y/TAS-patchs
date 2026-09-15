import type { TasRbacModule } from "./tasRbacPolicy";

export type TasRbacFeatureDefinition = {
  key: string;
  module: TasRbacModule;
  labelEn: string;
  labelAr: string;
  routes?: readonly string[];
};

export const TAS_RBAC_FEATURES = [
  { key: "dashboard.home", module: "dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم", routes: ["/tas", "/automotive"] },
  { key: "conversations.inbox", module: "conversations", labelEn: "Conversations", labelAr: "المحادثات", routes: ["/tas/conversations", "/automotive/conversations"] },
  { key: "sales.overview", module: "sales", labelEn: "Sales Overview", labelAr: "نظرة عامة للمبيعات", routes: ["/tas/sales", "/automotive/sales"] },
  { key: "sales.leads", module: "sales", labelEn: "Leads", labelAr: "العملاء المحتملون", routes: ["/leads"] },
  { key: "sales.lead_profile", module: "sales", labelEn: "Lead Profile", labelAr: "ملف العميل المحتمل", routes: ["/leads/:id"] },
  { key: "sales.excel_imports", module: "sales", labelEn: "Excel Imports", labelAr: "استيرادات Excel", routes: ["/excel-imports", "/import"] },
  { key: "sales.competitive_queues", module: "sales", labelEn: "Competitive Queues", labelAr: "متابعة الـ Queues", routes: ["/competitive-queues"] },
  { key: "sales.quotations", module: "sales", labelEn: "Quotations", labelAr: "عروض الأسعار" },
  { key: "sales.tasks", module: "sales", labelEn: "Sales Tasks", labelAr: "مهام المبيعات" },
  { key: "sales.test_drives", module: "sales", labelEn: "Test Drives", labelAr: "تجارب القيادة" },
  { key: "sales.trade_ins", module: "sales", labelEn: "Trade-ins", labelAr: "الاستبدال" },
  { key: "sales.finance_applications", module: "sales", labelEn: "Finance Applications", labelAr: "طلبات التمويل" },
  { key: "catalog.vehicles", module: "catalog", labelEn: "Vehicle Catalog", labelAr: "كتالوج السيارات", routes: ["/automotive/catalog"] },
  { key: "catalog.inventory", module: "catalog", labelEn: "Inventory", labelAr: "المخزون" },
  { key: "catalog.brands", module: "catalog", labelEn: "Brands", labelAr: "العلامات التجارية" },
  { key: "finance.overview", module: "finance", labelEn: "Finance", labelAr: "التمويل", routes: ["/tas/finance", "/automotive/finance"] },
  { key: "service.overview", module: "service", labelEn: "Service", labelAr: "الخدمة والصيانة", routes: ["/tas/service", "/automotive/service"] },
  { key: "after_sales.overview", module: "after_sales", labelEn: "After Sales", labelAr: "ما بعد البيع", routes: ["/tas/after-sales", "/automotive/after-sales"] },
  { key: "operations.overview", module: "operations", labelEn: "Operations", labelAr: "العمليات", routes: ["/tas/operations", "/automotive/operations"] },
  { key: "reports.overview", module: "reports", labelEn: "Reports", labelAr: "التقارير", routes: ["/tas/reports", "/automotive/reports"] },
  { key: "marketing.overview", module: "marketing", labelEn: "Marketing", labelAr: "التسويق", routes: ["/tas/marketing", "/automotive/marketing"] },
  { key: "shipping.agent", module: "shipping", labelEn: "Shipping Agent", labelAr: "وكيل الشحن", routes: ["/tas/shipping-agent", "/automotive/shipping-agent"] },
  { key: "integrations.whatsapp_cloud", module: "integrations", labelEn: "WhatsApp Cloud", labelAr: "واتساب كلاود", routes: ["/tas/whatsapp-cloud", "/automotive/whatsapp-cloud"] },
  { key: "integrations.whatsapp_gateway", module: "integrations", labelEn: "WhatsApp Gateway", labelAr: "بوابة واتساب", routes: ["/wa-gateway"] },
  { key: "admin.overview", module: "admin", labelEn: "TAS Admin", labelAr: "إدارة TAS", routes: ["/tas/admin", "/automotive/admin"] },
  { key: "admin.users", module: "users", labelEn: "Users", labelAr: "المستخدمون" },
  { key: "admin.roles_permissions", module: "roles", labelEn: "Roles & Permissions", labelAr: "الأدوار والصلاحيات", routes: ["/tas/admin/permissions"] },
  { key: "admin.audit_log", module: "audit_log", labelEn: "Audit Log", labelAr: "سجل العمليات", routes: ["/audit-log"] },
  { key: "admin.system_settings", module: "system_settings", labelEn: "System Settings", labelAr: "إعدادات النظام", routes: ["/settings"] },
] as const satisfies readonly TasRbacFeatureDefinition[];

export type TasRbacFeatureKey = (typeof TAS_RBAC_FEATURES)[number]["key"];

const FEATURE_MAP = new Map<string, TasRbacFeatureDefinition>(TAS_RBAC_FEATURES.map((feature) => [feature.key, feature]));

export function isTasRbacFeatureKey(value: string): value is TasRbacFeatureKey {
  return FEATURE_MAP.has(value);
}

export function getTasRbacFeature(value: string): TasRbacFeatureDefinition | null {
  return FEATURE_MAP.get(value) ?? null;
}

export function inferTasRbacFeature(path: string): TasRbacFeatureKey | null {
  const normalized = String(path || "").toLowerCase();
  if (!normalized || normalized.startsWith("tasrbac.")) return null;

  if (normalized.includes("excelimport") || normalized.includes("excel_import") || normalized.includes("importbatch")) return "sales.excel_imports";
  if (normalized.includes("competitivequeue") || normalized.includes("competitive_queue")) return "sales.competitive_queues";
  if (normalized.includes("quotation") || normalized.includes("quote")) return "sales.quotations";
  if (normalized.includes("testdrive") || normalized.includes("test_drive")) return "sales.test_drives";
  if (normalized.includes("tradein") || normalized.includes("trade_in")) return "sales.trade_ins";
  if (normalized.includes("financeapplication") || normalized.includes("finance_application")) return "sales.finance_applications";
  if (normalized.includes("salestask") || normalized.includes("sales_task")) return "sales.tasks";
  if (normalized.includes("leadprofile") || normalized.includes("leadbyid")) return "sales.lead_profile";
  if (normalized.startsWith("tas.sales.") || normalized.includes("lead")) return "sales.leads";

  if (normalized.includes("vehiclebrand") || normalized.includes("brand")) return "catalog.brands";
  if (normalized.includes("inventory")) return "catalog.inventory";
  if (normalized.includes("vehicle") || normalized.includes("catalog")) return "catalog.vehicles";

  if (normalized.includes("whatsapp-cloud") || normalized.includes("whatsappcloud")) return "integrations.whatsapp_cloud";
  if (normalized.includes("wagateway") || normalized.includes("wa_gateway")) return "integrations.whatsapp_gateway";
  if (normalized.includes("conversation") || normalized.includes("message")) return "conversations.inbox";
  if (normalized.includes("shipping") || normalized.includes("shipment")) return "shipping.agent";
  if (normalized.includes("finance")) return "finance.overview";
  if (normalized.includes("aftersales") || normalized.includes("after_sales")) return "after_sales.overview";
  if (normalized.includes("service")) return "service.overview";
  if (normalized.includes("report") || normalized.includes("analytics")) return "reports.overview";
  if (normalized.includes("marketing") || normalized.includes("campaign")) return "marketing.overview";
  if (normalized.includes("operation") || normalized.includes("dispatcher")) return "operations.overview";
  if (normalized.includes("audit")) return "admin.audit_log";
  if (normalized.includes("role") || normalized.includes("permission")) return "admin.roles_permissions";
  if (normalized.includes("user")) return "admin.users";
  if (normalized.includes("setting")) return "admin.system_settings";
  if (normalized.includes("admin")) return "admin.overview";
  return null;
}
