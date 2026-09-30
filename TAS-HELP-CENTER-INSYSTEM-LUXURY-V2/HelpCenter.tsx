import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import CRMLayout from "@/components/CRMLayout";
import { useLanguage } from "@/contexts/LanguageContext";
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
  HelpCircle,
  PackageCheck,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

// TAS_HELP_CENTER_INSYSTEM_LUXURY_V2

type Lang = "ar" | "en";

type Guide = {
  slug: string;
  step: string;
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
    step: "01",
    icon: <Settings2 className="h-5 w-5" />,
    titleAr: "إعداد الفروع والـ Bays",
    titleEn: "Branches & Bays setup",
    descriptionAr: "جهّز الفرع، مواعيد العمل، والطاقة الاستيعابية الحقيقية للورشة.",
    descriptionEn: "Configure branches, working hours, and real workshop capacity.",
    stepsAr: ["افتح TAS Service.", "راجع إعدادات الفرع ومواعيد العمل.", "أضف الـ Bays المتاحة لكل فرع وحدد حالتها Active.", "تأكد أن عدد الـ Bays يعكس الطاقة الفعلية للورشة."],
    stepsEn: ["Open TAS Service.", "Review branch settings and working hours.", "Add available Bays for each branch and keep the required Bays Active.", "Make sure the Bay count matches the workshop's real capacity."],
    resultAr: "النظام يقدر يحسب التوافر الحقيقي ويمنع الـ overbooking.",
    resultEn: "TAS can calculate real availability and prevent overbooking.",
  },
  {
    slug: "maintenance-plans",
    step: "02",
    icon: <Wrench className="h-5 w-5" />,
    titleAr: "خطط الصيانة والـ Intervals",
    titleEn: "Maintenance plans & intervals",
    descriptionAr: "أنشئ خطة الصيانة وحدد 10K و20K ومدة كل مرحلة.",
    descriptionEn: "Create maintenance plans and define mileage intervals and duration.",
    stepsAr: ["افتح Maintenance Plans من Service.", "أنشئ أو عدل خطة الصيانة المطلوبة.", "أضف الـ Intervals وحدد Mileage ومدة الخدمة.", "رتب الـ Intervals وتأكد أن المطلوب Active."],
    stepsEn: ["Open Maintenance Plans from Service.", "Create or edit the required maintenance plan.", "Add intervals and set mileage plus service duration.", "Order the intervals and keep the required ones Active."],
    resultAr: "TAS يعرف مرحلة الصيانة ومدة الخدمة المناسبة حسب الكيلومترات.",
    resultEn: "TAS resolves the correct maintenance stage and duration from mileage.",
  },
  {
    slug: "vehicle-mapping",
    step: "03",
    icon: <Car className="h-5 w-5" />,
    titleAr: "ربط السيارات بخطط الصيانة",
    titleEn: "Vehicle maintenance mapping",
    descriptionAr: "اربط السيارة بالخطة الصحيحة حسب الموديل والسنة.",
    descriptionEn: "Map each vehicle to its correct maintenance plan.",
    stepsAr: ["افتح Vehicle / Maintenance Mapping.", "اختر السيارة أو الموديل والسنة المطلوبة.", "اربطها بخطة الصيانة الصحيحة.", "راجع الأولوية والحالة Active لتجنب Mappings متعارضة."],
    stepsEn: ["Open Vehicle / Maintenance Mapping.", "Choose the required vehicle, model, and year.", "Link it to the correct maintenance plan.", "Review priority and Active state to avoid conflicting mappings."],
    resultAr: "عند إدخال الكيلومترات يحدد TAS الخطة والـ Interval تلقائيًا.",
    resultEn: "TAS automatically resolves the plan and interval from vehicle and mileage.",
  },
  {
    slug: "items-costs",
    step: "04",
    icon: <ClipboardList className="h-5 w-5" />,
    titleAr: "قطع الصيانة والتكلفة",
    titleEn: "Maintenance items & costs",
    descriptionAr: "حدد القطع والكميات والأسعار والضريبة وما يحتاج تجهيز مسبق.",
    descriptionEn: "Define items, quantities, pricing, VAT, and preparation requirements.",
    stepsAr: ["افتح Maintenance Items & Costs.", "اختر الخطة ثم الـ Interval المطلوب.", "أضف القطعة وحدد Action وQuantity وUnit cost وUnit price وVAT.", "فعّل Preparation required للقطع التي يجب تجهيزها قبل الموعد."],
    stepsEn: ["Open Maintenance Items & Costs.", "Choose the maintenance plan and interval.", "Add the item and set action, quantity, unit cost, unit price, and VAT.", "Enable Preparation required for items that must be prepared before the appointment."],
    resultAr: "كل Interval يبقى له Package واضحة وجاهزة للحجز.",
    resultEn: "Each interval has a clear package ready for bookings.",
  },
  {
    slug: "premium-booking",
    step: "05",
    icon: <CalendarDays className="h-5 w-5" />,
    titleAr: "إنشاء حجز صيانة",
    titleEn: "Create a service booking",
    descriptionAr: "من العميل والعربية لحد اختيار الموعد وتخصيص الـ Bay.",
    descriptionEn: "Create a booking from customer and vehicle through Bay assignment.",
    stepsAr: ["من Service ابدأ Premium Service Booking.", "أدخل بيانات العميل والسيارة والكيلومترات.", "راجع Maintenance resolution وتأكد من الخطة والـ Interval.", "اختر الفرع وأحد المواعيد المتاحة.", "راجع الملخص واضغط Confirm booking.", "TAS يخصص Bay متاح تلقائيًا عند التأكيد."],
    stepsEn: ["Start Premium Service Booking from Service.", "Enter customer, vehicle, and current mileage.", "Review Maintenance resolution and confirm the plan and interval.", "Choose the branch and an available slot.", "Review the summary and confirm the booking.", "TAS automatically assigns an available Bay."],
    resultAr: "الحجز يتعمل بميعاد ومدة وBay صحيحين بدون overbooking.",
    resultEn: "The booking is created with the correct slot, duration, and Bay without overbooking.",
  },
  {
    slug: "scheduler-lifecycle",
    step: "06",
    icon: <Clock3 className="h-5 w-5" />,
    titleAr: "Scheduler وحالة الحجز",
    titleEn: "Scheduler & booking lifecycle",
    descriptionAr: "تابع المواعيد والـ Bays وتاريخ تغييرات حالة الحجز.",
    descriptionEn: "Track appointments, Bay allocation, and booking status history.",
    stepsAr: ["استخدم Scheduler لمراجعة المواعيد والـ Bays.", "افتح Service booking lifecycle للحجز.", "غيّر الحالة من الانتقالات المسموحة فقط.", "راجع Status history لمعرفة التغييرات السابقة."],
    stepsEn: ["Use Scheduler to review appointments and Bays.", "Open Service booking lifecycle.", "Move the booking only through allowed statuses.", "Review Status history for previous changes."],
    resultAr: "دورة الحجز واضحة وكل تغيير قابل للتتبع.",
    resultEn: "The booking lifecycle stays clear and fully traceable.",
  },
  {
    slug: "booking-snapshot",
    step: "07",
    icon: <ShieldCheck className="h-5 w-5" />,
    titleAr: "Frozen Maintenance Snapshot",
    titleEn: "Frozen maintenance snapshot",
    descriptionAr: "افهم ليه الحجز القديم لا يتغير بعد تعديل الباكدج الأصلية.",
    descriptionEn: "Understand why old bookings do not change after package edits.",
    stepsAr: ["عند إنشاء الحجز يأخذ TAS نسخة ثابتة من Package الصيانة.", "النسخة تحفظ القطع والكميات والأسعار والضريبة وحالة Preparation.", "تعديل الـ Package الأصلية لاحقًا لا يغيّر الحجز القديم.", "راجع النسخة من Service booking lifecycle > Maintenance snapshot."],
    stepsEn: ["TAS stores a frozen copy of the maintenance package when booking.", "The snapshot keeps items, quantities, prices, VAT, and preparation state.", "Later package edits do not change historical bookings.", "Review it from Service booking lifecycle > Maintenance snapshot."],
    resultAr: "تفاصيل وأسعار الحجز تظل محفوظة كما كانت وقت الحجز.",
    resultEn: "Historical booking details and pricing stay exactly as booked.",
  },
  {
    slug: "parts-preparation",
    step: "08",
    icon: <PackageCheck className="h-5 w-5" />,
    titleAr: "تجهيز قطع الحجوزات القادمة",
    titleEn: "Next-day parts preparation",
    descriptionAr: "تابع المطلوب والمجهز والمتبقي والنواقص قبل وصول العربية.",
    descriptionEn: "Track required, prepared, remaining, and shortage quantities.",
    stepsAr: ["افتح Parts & materials preparation من Service.", "اختر يوم الخدمة المطلوب.", "راجع Required وPrepared وRemaining.", "استخدم Prepared عند اكتمال التجهيز أو Shortage مع كتابة السبب.", "راجع Readiness قبل موعد العربية."],
    stepsEn: ["Open Parts & materials preparation from Service.", "Choose the required service day.", "Review Required, Prepared, and Remaining.", "Use Prepared when complete or Shortage with a reason.", "Review Readiness before vehicle arrival."],
    resultAr: "فريق الصيانة يعرف مسبقًا هل كل القطع جاهزة أم يوجد نقص.",
    resultEn: "The service team knows in advance whether every required item is ready.",
  },
];

const FLOW = [
  { ar: "الإعداد", en: "Setup", icon: <Settings2 className="h-4 w-4" /> },
  { ar: "خطط الصيانة", en: "Maintenance plans", icon: <Wrench className="h-4 w-4" /> },
  { ar: "القطع والتكلفة", en: "Items & costs", icon: <ClipboardList className="h-4 w-4" /> },
  { ar: "الحجز", en: "Booking", icon: <CalendarDays className="h-4 w-4" /> },
  { ar: "Lifecycle", en: "Lifecycle", icon: <Clock3 className="h-4 w-4" /> },
  { ar: "تجهيز القطع", en: "Parts prep", icon: <PackageCheck className="h-4 w-4" /> },
];

function GuideCard({ guide, lang }: { guide: Guide; lang: Lang }) {
  const isAr = lang === "ar";
  return (
    <Link href={`/tas/help-center/${guide.slug}`} className="group block">
      <article className="h-full rounded-[22px] border border-[#eadfca] bg-white p-5 shadow-[0_8px_24px_rgba(15,39,71,0.045)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c99a44]/55 hover:shadow-[0_20px_48px_rgba(15,39,71,0.11)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3f8] text-[#0b2850] ring-1 ring-[#dce6f0] transition group-hover:bg-[#0b2850] group-hover:text-white">
            {guide.icon}
          </div>
          <span className="rounded-full bg-[#f8f1e3] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#9a6b12]">
            {guide.step}
          </span>
        </div>
        <h3 className="mt-5 text-[15px] font-black leading-6 text-[#0b2850]">{isAr ? guide.titleAr : guide.titleEn}</h3>
        <p className="mt-2 min-h-[48px] text-[13px] leading-6 text-slate-500">{isAr ? guide.descriptionAr : guide.descriptionEn}</p>
        <div className="mt-5 flex items-center gap-2 text-xs font-black text-[#9a6b12]">
          <span>{isAr ? "فتح الدليل" : "Open guide"}</span>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-1 ${isAr ? "rotate-180" : ""}`} />
        </div>
      </article>
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
      [guide.titleAr, guide.titleEn, guide.descriptionAr, guide.descriptionEn].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[#e5d6b7] bg-[#f8f4eb] shadow-[0_22px_60px_rgba(15,39,71,0.08)]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(248,244,235,.99) 0%, rgba(248,244,235,.97) 42%, rgba(248,244,235,.58) 68%, rgba(248,244,235,.2) 100%), url('/assets/tas-dashboard-hero-light.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center right",
          }}
        />
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[34px] border-[#c99a44]/12" />
        <div className="relative z-10 grid min-h-[330px] items-center gap-8 p-7 md:grid-cols-[1.25fr_.75fr] md:p-10 lg:p-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7ba7d] bg-white/85 px-3 py-1.5 text-[11px] font-black tracking-[0.08em] text-[#8b651f] shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              TAS SERVICE KNOWLEDGE HUB
            </div>
            <h1 className="mt-5 text-3xl font-black leading-[1.08] tracking-tight text-[#09264b] md:text-5xl">
              {isAr ? "مركز مساعدة الصيانة وخدمة ما بعد البيع" : "Service & After-Sales Help Center"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              {isAr
                ? "دليل عملي داخل TAS يوصلك من إعداد الورشة لحد الحجز وتجهيز القطع قبل وصول العربية."
                : "A practical guide inside TAS, from workshop setup to service booking and next-day parts preparation."}
            </p>

            <div className="relative mt-7 max-w-2xl">
              <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7c91] ${isAr ? "right-4" : "left-4"}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? "ابحث عن حجز، باكدج، قطع، Bay..." : "Search booking, package, parts, Bay..."}
                className={`h-14 w-full rounded-2xl border border-white/90 bg-white/95 py-3 text-sm text-slate-800 shadow-[0_16px_32px_rgba(15,39,71,0.10)] outline-none ring-1 ring-[#dce3ec] transition focus:ring-2 focus:ring-[#c99a44]/50 ${isAr ? "pr-11 pl-4" : "pl-11 pr-4"}`}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[isAr ? "8 أدلة تشغيلية" : "8 practical guides", isAr ? "عربي + English" : "Arabic + English", isAr ? "من داخل TAS" : "Inside TAS"].map((label) => (
                <span key={label} className="rounded-full border border-[#e1d4bb] bg-white/75 px-3 py-1.5 text-[11px] font-bold text-slate-600 backdrop-blur">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden justify-self-end md:block">
            <div className="w-56 rounded-[28px] border border-white/70 bg-[#0b2850]/92 p-5 text-white shadow-[0_24px_60px_rgba(11,40,80,.22)] backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c99a44]">
                <HelpCircle className="h-5 w-5" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#e9c777]">{isAr ? "ابدأ بسرعة" : "Quick start"}</p>
              <p className="mt-2 text-lg font-black leading-6">{isAr ? "محتاج تعمل حجز صيانة؟" : "Need to create a service booking?"}</p>
              <a href="/tas/service" className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-xs font-black text-[#0b2850] transition hover:bg-[#f8f1e3]">
                <span>{isAr ? "فتح TAS Service" : "Open TAS Service"}</span>
                {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] bg-[#09264b] p-6 text-white shadow-[0_18px_45px_rgba(9,38,75,.18)] md:p-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e7be6d]">{isAr ? "مسار الصيانة" : "Service workflow"}</p>
            <h2 className="mt-1 text-xl font-black">{isAr ? "من إعداد الورشة لحد تجهيز القطع" : "From setup to parts preparation"}</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-slate-300">{isAr ? "امشِ على المسار ده لو بتجهز الموديول لأول مرة." : "Follow this sequence when setting up the module for the first time."}</p>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-6">
          {FLOW.map((item, index) => (
            <div key={item.en} className="relative rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c99a44] text-[11px] font-black">{index + 1}</span>
                <span className="text-slate-300">{item.icon}</span>
              </div>
              <p className="mt-4 text-xs font-bold leading-5">{isAr ? item.ar : item.en}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#eadfca] bg-[#fbfaf7] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b07a20]">{isAr ? "أدلة الصيانة" : "Service guides"}</p>
            <h2 className="mt-1 text-2xl font-black text-[#0b2850] md:text-3xl">{isAr ? "اختار الجزء اللي عايز تعمل عليه" : "Choose what you want to do"}</h2>
          </div>
          <a href="/tas/service" className="inline-flex items-center gap-2 rounded-xl bg-[#0b2850] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#143a68]">
            {isAr ? "فتح TAS Service" : "Open TAS Service"}
            {isAr ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleGuides.map((guide) => <GuideCard key={guide.slug} guide={guide} lang={lang} />)}
        </div>

        {visibleGuides.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-[#d8c8a8] bg-white p-10 text-center text-sm text-slate-500">
            {isAr ? "مفيش نتيجة مطابقة. جرّب كلمة أبسط." : "No matching guide. Try a simpler search term."}
          </div>
        )}
      </section>
    </div>
  );
}

function GuidePage({ guide, lang }: { guide: Guide; lang: Lang }) {
  const isAr = lang === "ar";
  const steps = isAr ? guide.stepsAr : guide.stepsEn;

  return (
    <div className="space-y-6">
      <Link href="/tas/help-center" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#0b2850]">
        {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        {isAr ? "الرجوع لمركز المساعدة" : "Back to Help Center"}
      </Link>

      <section className="overflow-hidden rounded-[30px] border border-[#e4d5b8] bg-white shadow-[0_18px_50px_rgba(15,39,71,0.08)]">
        <div className="relative overflow-hidden bg-[#09264b] px-6 py-8 text-white md:px-9 md:py-10">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-[28px] border-[#c99a44]/15" />
          <div className="relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c99a44] shadow-lg">{guide.icon}</div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#e7be6d]">{isAr ? "دليل تشغيلي" : "Operational guide"} • {guide.step}</p>
            <h1 className="mt-2 text-2xl font-black md:text-4xl">{isAr ? guide.titleAr : guide.titleEn}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{isAr ? guide.descriptionAr : guide.descriptionEn}</p>
          </div>
        </div>

        <div className="grid gap-7 p-6 md:grid-cols-[1fr_280px] md:p-9">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#0b2850]">
              <BookOpen className="h-4 w-4 text-[#c99a44]" />
              {isAr ? "الخطوات" : "Steps"}
            </div>
            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-[#ece5d8] bg-[#fbfaf7] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0b2850] text-xs font-black text-white">{index + 1}</span>
                  <p className="pt-1.5 text-sm leading-6 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <CheckCircle2 className="h-5 w-5" />
              <p className="mt-3 text-xs font-black uppercase tracking-[0.14em]">{isAr ? "النتيجة المتوقعة" : "Expected result"}</p>
              <p className="mt-2 text-sm font-semibold leading-6">{isAr ? guide.resultAr : guide.resultEn}</p>
            </div>
            <a href="/tas/service" className="flex items-center justify-between rounded-2xl bg-[#0b2850] px-5 py-4 text-sm font-black text-white transition hover:bg-[#143a68]">
              <span>{isAr ? "فتح TAS Service" : "Open TAS Service"}</span>
              {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </a>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function HelpCenter() {
  const { lang: contextLang, isRTL } = useLanguage();
  const [location] = useLocation();
  const lang: Lang = contextLang === "ar" ? "ar" : "en";
  const path = location.split(/[?#]/)[0].replace(/\/+$/, "");
  const base = "/tas/help-center";
  const slug = path.startsWith(base + "/") ? decodeURIComponent(path.slice(base.length + 1)) : "";
  const guide = GUIDES.find((item) => item.slug === slug) ?? null;

  return (
    <CRMLayout>
      <div className="min-h-full bg-[#f5f1e8] p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-[1440px]">
          {guide ? <GuidePage guide={guide} lang={lang} /> : <Home lang={lang} />}
        </div>
      </div>
    </CRMLayout>
  );
}
