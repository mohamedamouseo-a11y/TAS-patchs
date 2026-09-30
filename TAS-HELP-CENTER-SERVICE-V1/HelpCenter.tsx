import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import PublicHelpLayout from "@/components/PublicHelpLayout";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Gauge,
  PackageCheck,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

// TAS_HELP_CENTER_SERVICE_V1

type Lang = "ar" | "en";

type Guide = {
  slug: string;
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  stepsAr: string[];
  stepsEn: string[];
  resultAr: string;
  resultEn: string;
};

const GUIDES: Guide[] = [
  {
    slug: "service-setup",
    icon: <Settings2 className="h-5 w-5" />,
    titleAr: "إعداد الفروع والـ Bays",
    titleEn: "Branches & Bays setup",
    descriptionAr: "ابدأ من هنا لتجهيز الفرع، مواعيد العمل، والطاقة الاستيعابية للورشة.",
    descriptionEn: "Start here to configure branches, working hours, and workshop capacity.",
    stepsAr: [
      "افتح TAS ثم Service.",
      "راجع إعدادات الفرع ومواعيد العمل.",
      "أضف الـ Bays المتاحة لكل فرع وحدد حالتها Active.",
      "تأكد أن عدد الـ Bays يعكس الطاقة الفعلية للورشة.",
    ],
    stepsEn: [
      "Open TAS, then Service.",
      "Review branch settings and working hours.",
      "Add the available Bays for each branch and keep the required ones Active.",
      "Make sure the Bay count matches the workshop's real capacity.",
    ],
    resultAr: "النتيجة: النظام يقدر يحسب التوافر الحقيقي ويمنع الـ overbooking.",
    resultEn: "Result: TAS can calculate real availability and prevent overbooking.",
  },
  {
    slug: "maintenance-plans",
    icon: <Wrench className="h-5 w-5" />,
    titleAr: "خطط الصيانة والـ Intervals",
    titleEn: "Maintenance plans & intervals",
    descriptionAr: "أنشئ خطة صيانة وحدد مراحل مثل 10K و20K ومدة كل مرحلة.",
    descriptionEn: "Create a maintenance plan and define intervals such as 10K and 20K.",
    stepsAr: [
      "من Service افتح Maintenance Plans.",
      "أنشئ أو عدل خطة الصيانة المطلوبة.",
      "أضف الـ Intervals وحدد Mileage ومدة الخدمة لكل Interval.",
      "رتب الـ Intervals وتأكد أن المطلوب منها Active.",
    ],
    stepsEn: [
      "Open Maintenance Plans from Service.",
      "Create or edit the required maintenance plan.",
      "Add intervals and set mileage plus service duration.",
      "Order the intervals and keep the required ones Active.",
    ],
    resultAr: "النتيجة: TAS يعرف الصيانة المناسبة ومدة الخدمة حسب الكيلومترات.",
    resultEn: "Result: TAS can resolve the right maintenance stage and duration by mileage.",
  },
  {
    slug: "vehicle-mapping",
    icon: <Car className="h-5 w-5" />,
    titleAr: "ربط السيارات بخطط الصيانة",
    titleEn: "Vehicle maintenance mapping",
    descriptionAr: "اربط السيارة بالخطة الصحيحة حسب الموديل والسنة.",
    descriptionEn: "Map each vehicle to the correct maintenance plan.",
    stepsAr: [
      "افتح Vehicle / Maintenance Mapping.",
      "اختر السيارة أو الموديل والسنة المطلوبة.",
      "اربطها بخطة الصيانة الصحيحة.",
      "راجع الأولوية والحالة Active لتجنب أكثر من Mapping متعارض.",
    ],
    stepsEn: [
      "Open Vehicle / Maintenance Mapping.",
      "Choose the required vehicle, model, and year.",
      "Link it to the correct maintenance plan.",
      "Review priority and Active state to avoid conflicting mappings.",
    ],
    resultAr: "النتيجة: عند إدخال الكيلومترات يحدد TAS الخطة والـ Interval تلقائيًا.",
    resultEn: "Result: TAS automatically resolves the plan and interval from the vehicle and mileage.",
  },
  {
    slug: "items-costs",
    icon: <ClipboardList className="h-5 w-5" />,
    titleAr: "قطع الصيانة والتكلفة",
    titleEn: "Maintenance items & costs",
    descriptionAr: "حدد القطع، الكميات، الأسعار، الضريبة، وما يحتاج تجهيز مسبق.",
    descriptionEn: "Define items, quantities, pricing, VAT, and preparation requirements.",
    stepsAr: [
      "افتح Maintenance Items & Costs.",
      "اختر الخطة ثم الـ Interval المطلوب.",
      "أضف القطعة وحدد Action وQuantity وUnit cost وUnit price وVAT.",
      "فعّل Preparation required للقطع التي يجب تجهيزها قبل الموعد.",
    ],
    stepsEn: [
      "Open Maintenance Items & Costs.",
      "Choose the maintenance plan and interval.",
      "Add the item and set action, quantity, unit cost, unit price, and VAT.",
      "Enable Preparation required for items that must be prepared before the appointment.",
    ],
    resultAr: "النتيجة: كل Interval يبقى له Package واضحة وجاهزة للحجز.",
    resultEn: "Result: each interval has a clear package ready to be used by bookings.",
  },
  {
    slug: "premium-booking",
    icon: <CalendarDays className="h-5 w-5" />,
    titleAr: "إنشاء حجز صيانة",
    titleEn: "Create a service booking",
    descriptionAr: "اعمل الحجز من العميل والعربية حتى اختيار الموعد والـ Bay.",
    descriptionEn: "Create a booking from customer and vehicle through time slot and Bay assignment.",
    stepsAr: [
      "من Service اضغط Create Premium Service Booking.",
      "أدخل اسم العميل، الهاتف، السيارة، السنة، والكيلومترات الحالية.",
      "راجع Maintenance resolution وتأكد أن الخطة والـ Interval صحيحين.",
      "اختر الفرع ثم أحد المواعيد المتاحة.",
      "راجع ملخص الحجز واضغط Confirm booking.",
      "بعد التأكيد سيقوم TAS بتخصيص Bay متاح تلقائيًا.",
    ],
    stepsEn: [
      "From Service, click Create Premium Service Booking.",
      "Enter customer name, phone, vehicle, year, and current mileage.",
      "Review Maintenance resolution and confirm the plan and interval are correct.",
      "Choose the branch and one of the available time slots.",
      "Review the booking summary and click Confirm booking.",
      "After confirmation, TAS automatically assigns an available Bay.",
    ],
    resultAr: "النتيجة: يتعمل الحجز بميعاد صحيح، مدة صحيحة، وBay متاح بدون overbooking.",
    resultEn: "Result: the booking is created with the correct slot, duration, and an available Bay.",
  },
  {
    slug: "scheduler-lifecycle",
    icon: <Clock3 className="h-5 w-5" />,
    titleAr: "Scheduler وحالة الحجز",
    titleEn: "Scheduler & booking lifecycle",
    descriptionAr: "تابع الحجز، الـ Bay، وتاريخ تغييرات الحالة.",
    descriptionEn: "Track bookings, Bay allocation, and status history.",
    stepsAr: [
      "استخدم الـ Scheduler لمراجعة مواعيد العربيات والـ Bays.",
      "افتح Service booking lifecycle من الحجز المطلوب.",
      "غيّر الحالة فقط للانتقالات المتاحة مثل Confirmed أو Completed أو Cancelled.",
      "راجع Status history لمعرفة التغييرات السابقة.",
    ],
    stepsEn: [
      "Use the Scheduler to review vehicle appointments and Bays.",
      "Open Service booking lifecycle for the required booking.",
      "Move the booking only through allowed statuses such as Confirmed, Completed, or Cancelled.",
      "Review Status history to see previous changes.",
    ],
    resultAr: "النتيجة: دورة الحجز واضحة ويمكن تتبع كل تغيير.",
    resultEn: "Result: the booking lifecycle is clear and every status change is traceable.",
  },
  {
    slug: "booking-snapshot",
    icon: <ShieldCheck className="h-5 w-5" />,
    titleAr: "Frozen Maintenance Snapshot",
    titleEn: "Frozen maintenance snapshot",
    descriptionAr: "افهم ليه تفاصيل الحجز القديم لا تتغير بعد تعديل الباكدج.",
    descriptionEn: "Understand why an existing booking does not change when its package is edited later.",
    stepsAr: [
      "عند إنشاء الحجز يأخذ TAS نسخة ثابتة من Package الصيانة.",
      "النسخة تحفظ القطع والكميات والأسعار والضريبة وحالة Preparation وقت الحجز.",
      "لو عدلت الـ Package الأصلية بعد ذلك، الحجز القديم يظل بنفس بياناته.",
      "يمكن مشاهدة النسخة من Service booking lifecycle داخل Maintenance snapshot.",
    ],
    stepsEn: [
      "When a booking is created, TAS stores a frozen copy of the maintenance package.",
      "The snapshot keeps items, quantities, pricing, VAT, and preparation state at booking time.",
      "Editing the original package later does not change old bookings.",
      "Open Service booking lifecycle and check Maintenance snapshot to review it.",
    ],
    resultAr: "النتيجة: تاريخ وأسعار الحجز القديم تظل محفوظة كما كانت وقت الحجز.",
    resultEn: "Result: historical booking details and pricing stay exactly as they were when booked.",
  },
  {
    slug: "parts-preparation",
    icon: <PackageCheck className="h-5 w-5" />,
    titleAr: "تجهيز قطع الحجوزات القادمة",
    titleEn: "Next-day parts preparation",
    descriptionAr: "تابع المطلوب، المجهز، المتبقي، والنواقص قبل وصول العربية.",
    descriptionEn: "Track required, prepared, remaining, and shortage quantities before the vehicle arrives.",
    stepsAr: [
      "افتح Next Day Parts Preparation من Service.",
      "اختر اليوم المطلوب لمراجعة الحجوزات القادمة.",
      "راجع Required وPrepared وRemaining لكل قطعة.",
      "استخدم Prepared عند اكتمال التجهيز، أو Shortage عند وجود نقص مع كتابة السبب.",
      "راجع Readiness للتأكد أن الحجز جاهز قبل موعده.",
    ],
    stepsEn: [
      "Open Next Day Parts Preparation from Service.",
      "Choose the required day to review upcoming bookings.",
      "Check Required, Prepared, and Remaining quantities for each item.",
      "Use Prepared when complete, or Shortage with a note when stock is missing.",
      "Review Readiness to confirm the booking is prepared before arrival.",
    ],
    resultAr: "النتيجة: فريق الصيانة يعرف مسبقًا هل كل قطع الحجز جاهزة أم يوجد نقص.",
    resultEn: "Result: the service team knows in advance whether every required item is ready.",
  },
];

const FLOW_AR = ["الإعداد", "خطط الصيانة", "القطع والتكلفة", "الحجز", "الحالة", "تجهيز القطع"];
const FLOW_EN = ["Setup", "Maintenance plans", "Items & costs", "Booking", "Lifecycle", "Parts preparation"];

function GuideCard({ guide, lang }: { guide: Guide; lang: Lang }) {
  const isAr = lang === "ar";
  return (
    <Link
      href={`/${lang}/help-center/${guide.slug}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#c9963b]/45 hover:shadow-[0_16px_40px_rgba(15,39,71,0.08)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2747] text-white shadow-sm">
          {guide.icon}
        </div>
        <ChevronRight className={`mt-1 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 ${isAr ? "rotate-180" : ""}`} />
      </div>
      <h3 className="text-base font-bold text-[#0f2747]">{isAr ? guide.titleAr : guide.titleEn}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {isAr ? guide.descriptionAr : guide.descriptionEn}
      </p>
    </Link>
  );
}

function Home({ lang }: { lang: Lang }) {
  const isAr = lang === "ar";
  const [query, setQuery] = useState("");

  const visibleGuides = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDES;
    return GUIDES.filter((guide) =>
      [guide.titleAr, guide.titleEn, guide.descriptionAr, guide.descriptionEn]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const flow = isAr ? FLOW_AR : FLOW_EN;

  return (
    <>
      <section className="border-b border-slate-100 bg-[#fbfaf7]">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#c9963b]/25 bg-white px-3 py-1.5 text-xs font-bold text-[#8a682d] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {isAr ? "TAS After Sales & Service" : "TAS After Sales & Service"}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#0f2747] md:text-5xl">
              {isAr ? "مركز مساعدة الصيانة وخدمة ما بعد البيع" : "Service & After-Sales Help Center"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
              {isAr
                ? "دليل بسيط خطوة بخطوة لإعداد الصيانة، إنشاء الحجوزات، متابعة الـ Bays، وتجهـيز القطع قبل وصول العربية."
                : "A simple step-by-step guide for service setup, bookings, Bay management, booking lifecycle, and parts preparation."}
            </p>

            <div className="relative mx-auto mt-7 max-w-2xl">
              <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isAr ? "right-4" : "left-4"}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? "ابحث: حجز، باكدج، قطع، Bay..." : "Search: booking, package, parts, Bay..."}
                className={`h-13 w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm text-slate-800 shadow-[0_12px_30px_rgba(15,39,71,0.06)] outline-none transition focus:border-[#c9963b] focus:ring-4 focus:ring-[#c9963b]/10 ${isAr ? "pr-11 pl-4" : "pl-11 pr-4"}`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="rounded-2xl border border-slate-200 bg-[#0f2747] p-5 text-white md:p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold">
              <Gauge className="h-4 w-4 text-[#e4bb68]" />
              {isAr ? "مسار الشغل باختصار" : "Service workflow"}
            </div>
            <div className="grid gap-2 md:grid-cols-6">
              {flow.map((label, index) => (
                <div key={label} className="flex items-center gap-2 rounded-xl bg-white/7 px-3 py-3 text-xs font-semibold">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c9963b] text-[11px] font-black text-white">
                    {index + 1}
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c9963b]">
                {isAr ? "دليل الصيانة" : "Service guides"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#0f2747]">
                {isAr ? "اختار الجزء اللي عايز تعمل عليه" : "Choose what you want to do"}
              </h2>
            </div>
            <a
              href="/tas/service"
              className="hidden rounded-xl bg-[#0f2747] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#17365d] md:inline-flex"
            >
              {isAr ? "فتح TAS Service" : "Open TAS Service"}
            </a>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {visibleGuides.map((guide) => <GuideCard key={guide.slug} guide={guide} lang={lang} />)}
          </div>

          {visibleGuides.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {isAr ? "مفيش نتيجة مطابقة. جرّب كلمة أبسط." : "No matching guide. Try a simpler search term."}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function GuidePage({ guide, lang }: { guide: Guide; lang: Lang }) {
  const isAr = lang === "ar";
  const steps = isAr ? guide.stepsAr : guide.stepsEn;

  return (
    <div className="bg-[#fbfaf7]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <Link
          href={`/${lang}/help-center`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#0f2747]"
        >
          {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {isAr ? "الرجوع لمركز المساعدة" : "Back to Help Center"}
        </Link>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,39,71,0.07)]">
          <div className="border-b border-slate-100 bg-[#0f2747] px-6 py-7 text-white md:px-9">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#c9963b] text-white">
              {guide.icon}
            </div>
            <h1 className="text-2xl font-black md:text-3xl">{isAr ? guide.titleAr : guide.titleEn}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
              {isAr ? guide.descriptionAr : guide.descriptionEn}
            </p>
          </div>

          <div className="px-6 py-7 md:px-9 md:py-9">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f2747]">
              <BookOpen className="h-4 w-4 text-[#c9963b]" />
              {isAr ? "الخطوات" : "Steps"}
            </div>

            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0f2747] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-semibold leading-6">{isAr ? guide.resultAr : guide.resultEn}</p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/tas/service"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f2747] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17365d]"
              >
                {isAr ? "فتح TAS Service" : "Open TAS Service"}
                {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </a>
              <Link
                href={`/${lang}/help-center`}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {isAr ? "كل الأدلة" : "All guides"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [location] = useLocation();
  const lang: Lang = location.startsWith("/en/") ? "en" : "ar";
  const path = location.split(/[?#]/)[0].replace(/\/+$/, "");
  const base = `/${lang}/help-center`;
  const slug = path.startsWith(base + "/") ? decodeURIComponent(path.slice(base.length + 1)) : "";
  const guide = GUIDES.find((item) => item.slug === slug) ?? null;

  return (
    <PublicHelpLayout lang={lang} currentSlug={guide?.slug ?? null}>
      {guide ? <GuidePage guide={guide} lang={lang} /> : <Home lang={lang} />}
    </PublicHelpLayout>
  );
}
