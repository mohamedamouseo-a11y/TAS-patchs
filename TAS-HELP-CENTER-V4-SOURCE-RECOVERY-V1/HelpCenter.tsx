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
  ExternalLink,
  Gauge,
  HelpCircle,
  Info,
  Lightbulb,
  PackageCheck,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

// TAS_HELP_CENTER_EGYPTIAN_PRO_AR_V4
// TAS_HELP_CENTER_V4_SOURCE_RECOVERY_V1

type Lang = "ar" | "en";

type ScreenshotMeta = {
  stepIndex: number;
  driveUrl?: string;
  captionAr?: string;
  captionEn?: string;
  highlightDescriptionAr?: string;
  highlightDescriptionEn?: string;
};

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
  exampleTitleAr: string;
  exampleTitleEn: string;
  exampleBodyAr: string;
  exampleBodyEn: string;
  links: { labelAr: string; labelEn: string; href: string }[];
  screenshots?: ScreenshotMeta[];
  termHelpAr?: { term: string; explanation: string }[];
  termHelpEn?: { term: string; explanation: string }[];
};

const GUIDES: Guide[] = [
  {
    slug: "service-setup",
    step: "01",
    icon: <Settings2 className="h-5 w-5" />,
    titleAr: "إعداد الفروع وورش الخدمة",
    titleEn: "Branch & workshop setup",
    descriptionAr: "جهّز الفرع ومواعيد الشغل وعدد أماكن الخدمة الفعلية عشان الحجز ما يتلخبطش.",
    descriptionEn: "Configure branches, working hours, and real service bay capacity to prevent booking conflicts.",
    stepsAr: [
      "افتح شاشة خدمة الصيانة من القائمة الرئيسية في TAS.",
      "راجع إعدادات الفرع وساعات الشغل اليومية وتأكد إنها صحيحة.",
      "أضف أماكن الخدمة المتاحة لكل فرع وحدد حالتها نشطة حسب الطاقة الفعلية للورشة.",
      "تأكد إن عدد الأماكن النشطة يطابق عدد الكوريكات أو ورش الشغل الحقيقية.",
    ],
    stepsEn: [
      "Open the Service screen from the main menu in TAS.",
      "Review branch settings and daily working hours to ensure accuracy.",
      "Add available service bays for each branch and set their status to active based on real workshop capacity.",
      "Ensure the number of active bays matches the actual lifting positions or work bays in the workshop.",
    ],
    resultAr: "TAS هيحسب التوافر الحقيقي ويمنع الحجز الزائد تلقائيًا.",
    resultEn: "TAS calculates real availability and prevents overbooking automatically.",
    exampleTitleAr: "مثال عملي",
    exampleTitleEn: "Practical example",
    exampleBodyAr: "فرع القاهرة: ساعات الشغل ٨ ص – ٦ م، ٤ أماكن خدمة نشطة، كل وردية بتستوعب ١٢ حجز بمتوسط مدة ٩٠ دقيقة.",
    exampleBodyEn: "Cairo branch: working hours 8 AM – 6 PM, 4 active service bays, each shift handles up to 12 bookings at an average duration of 90 minutes.",
    links: [{ labelAr: "فتح إعدادات الفروع وأماكن الخدمة", labelEn: "Open branch & bay settings", href: "/tas/service#service-bays" }],
    screenshots: [{ stepIndex: 2, captionAr: "إضافة أماكن الخدمة وتحديد الحالة", captionEn: "Adding service bays and setting status", highlightDescriptionAr: "زر إضافة مكان خدمة جديد", highlightDescriptionEn: "Add new service bay button" }],
    termHelpAr: [{ term: "مكان الخدمة", explanation: "المكان المخصص لاستقبال السيارة في الورشة سواء كان كوريك أو منطقة عمل ثابتة." }],
    termHelpEn: [{ term: "Service bay", explanation: "The designated position in the workshop where a vehicle is serviced, whether a lift or a fixed work area." }],
  },
  {
    slug: "maintenance-plans",
    step: "02",
    icon: <Wrench className="h-5 w-5" />,
    titleAr: "خطط الصيانة وفترات الخدمة",
    titleEn: "Maintenance plans & intervals",
    descriptionAr: "أنشئ خطة الصيانة وحدد فترات الكيلومترات ومدة كل خدمة عشان TAS يعرف المرحلة الصح.",
    descriptionEn: "Create maintenance plans and define mileage intervals and service duration so TAS resolves the correct stage.",
    stepsAr: [
      "افتح خطط الصيانة من شاشة الخدمة في TAS.",
      "أنشئ أو عدل خطة الصيانة المطلوبة حسب نوع المركبة.",
      "أضف فترات الصيانة وحدد الكيلومترات ومدة الخدمة لكل فترة.",
      "رتب الفترات بالترتيب الصحيح وتأكد إن اللي محتاج منها شغال مفعل.",
    ],
    stepsEn: [
      "Open Maintenance Plans from the Service screen in TAS.",
      "Create or edit the required maintenance plan based on vehicle type.",
      "Add intervals and set mileage plus service duration for each interval.",
      "Order the intervals correctly and keep the required ones active.",
    ],
    resultAr: "TAS هيحدد مرحلة الصيانة ومدة الخدمة المناسبة تلقائيًا حسب قراءة العداد.",
    resultEn: "TAS automatically resolves the correct maintenance stage and duration from the odometer reading.",
    exampleTitleAr: "مثال عملي",
    exampleTitleEn: "Practical example",
    exampleBodyAr: "خطة صيانة ١٠ آلاف كم: فترة أولى عند ١٠٬٠٠٠ كم لمدة ٩٠ دقيقة، فترة ثانية عند ٢٠٬٠٠٠ كم لمدة ١٢٠ دقيقة.",
    exampleBodyEn: "10K maintenance plan: first interval at 10,000 km for 90 minutes, second interval at 20,000 km for 120 minutes.",
    links: [{ labelAr: "فتح خطط الصيانة", labelEn: "Open maintenance plans", href: "/tas/service#maintenance-plans" }],
    screenshots: [{ stepIndex: 3, captionAr: "تحديد الكيلومترات والمدة لكل فترة", captionEn: "Setting mileage and duration per interval", highlightDescriptionAr: "حقول الكيلومترات والمدة", highlightDescriptionEn: "Mileage and duration fields" }],
    termHelpAr: [{ term: "فترة الصيانة", explanation: "مرحلة محددة من مراحل الصيانة مرتبطة بعدد كيلومترات معين مثل ١٠ آلاف أو ٢٠ ألف." }],
    termHelpEn: [{ term: "Maintenance interval", explanation: "A specific maintenance stage tied to a mileage threshold such as 10K or 20K." }],
  },
  {
    slug: "vehicle-mapping",
    step: "03",
    icon: <Car className="h-5 w-5" />,
    titleAr: "ربط المركبات بخطط الصيانة",
    titleEn: "Vehicle maintenance mapping",
    descriptionAr: "اربط كل مركبة بالخطة الصح حسب الطراز والسنة عشان الحجز يجيب الفترة الصحيحة تلقائيًا.",
    descriptionEn: "Map each vehicle to its correct plan by model and year so bookings resolve the right interval automatically.",
    stepsAr: [
      "افتح ربط المركبات بالصيانة من شاشة الخدمة.",
      "اختر المركبة أو الطراز والسنة المطلوبة.",
      "اربطها بخطة الصيانة المناسبة لهذا الموديل.",
      "راجع الأولوية والحالة النشطة عشان ما يحصلش تعارض بين ربطين لنفس المركبة.",
    ],
    stepsEn: [
      "Open Vehicle Maintenance Mapping from the Service screen.",
      "Choose the required vehicle, model, and year.",
      "Link it to the appropriate maintenance plan for that model.",
      "Review priority and active state to avoid conflicting mappings for the same vehicle.",
    ],
    resultAr: "لما تدخل الكيلومترات في الحجز، TAS هيجيب الخطة والفترة الصح من غير تدخل يدوي.",
    resultEn: "When you enter mileage in a booking, TAS resolves the correct plan and interval without manual intervention.",
    exampleTitleAr: "مثال عملي",
    exampleTitleEn: "Practical example",
    exampleBodyAr: "تويوتا كورولا ٢٠٢٣ مربوطة بخطة ١٠ آلاف كم؛ لما تسجل ١٥٬٠٠٠ كم في الحجز، النظام بيظهر فترة الـ ٢٠ ألف تلقائيًا.",
    exampleBodyEn: "Toyota Corolla 2023 mapped to the 10K plan; when you enter 15,000 km in the booking, the system surfaces the 20K interval automatically.",
    links: [{ labelAr: "فتح ربط المركبات", labelEn: "Open vehicle mapping", href: "/tas/service#maintenance-vehicle-mapping" }],
    screenshots: [{ stepIndex: 3, captionAr: "ربط المركبة بخطة الصيانة", captionEn: "Linking vehicle to maintenance plan", highlightDescriptionAr: "قائمة اختيار خطة الصيانة", highlightDescriptionEn: "Maintenance plan selection dropdown" }],
    termHelpAr: [{ term: "الربط", explanation: "العلاقة بين مركبة معينة وخطة صيانة محددة عشان النظام يعرف الباقة الصح تلقائيًا." }],
    termHelpEn: [{ term: "Mapping", explanation: "The association between a specific vehicle and a maintenance plan so the system resolves the correct package automatically." }],
  },
  {
    slug: "items-costs",
    step: "04",
    icon: <ClipboardList className="h-5 w-5" />,
    titleAr: "قطع الصيانة والتسعير",
    titleEn: "Maintenance items & pricing",
    descriptionAr: "حدد القطع والكميات والأسعار والضريبة وأي قطعة محتاجة تجهيز قبل الموعد.",
    descriptionEn: "Define items, quantities, pricing, VAT, and any parts that need preparation before the appointment.",
    stepsAr: [
      "افتح قطع الصيانة والتكلفة من شاشة الخدمة.",
      "اختر الخطة ثم الفترة المطلوبة.",
      "أضف القطعة وحدد الإجراء والكمية وسعر التكلفة وسعر البيع ونسبة الضريبة.",
      "فعّل خيار «يحتاج تجهيز» للقطع اللي لازم تتجهز قبل موعد العميل.",
    ],
    stepsEn: [
      "Open Maintenance Items & Costs from the Service screen.",
      "Choose the maintenance plan and interval.",
      "Add the item and set action, quantity, unit cost, unit price, and VAT rate.",
      "Enable preparation required for parts that must be prepared before the customer appointment.",
    ],
    resultAr: "كل فترة بيبقى ليها باقة واضحة بأسعارها جاهزة للحجز مباشرة.",
    resultEn: "Each interval has a clear package with pricing ready for immediate booking.",
    exampleTitleAr: "مثال عملي",
    exampleTitleEn: "Practical example",
    exampleBodyAr: "فلتر زيت: الكمية ٢، سعر التكلفة ١٠٠٫٠٧ جنيه، سعر البيع ١٥٠ جنيه، ضريبة ١٤٪، يحتاج تجهيز = نعم.",
    exampleBodyEn: "Oil filter: quantity 2, unit cost EGP 100.07, unit price EGP 150, VAT 14%, preparation required = yes.",
    links: [{ labelAr: "فتح قطع الصيانة والتكلفة", labelEn: "Open items & costs", href: "/tas/service#maintenance-items-costs" }],
    screenshots: [{ stepIndex: 4, captionAr: "إضافة قطعة وتحديد السعر والضريبة", captionEn: "Adding item with price and VAT", highlightDescriptionAr: "حقول السعر والضريبة وخيار التجهيز", highlightDescriptionEn: "Price, VAT fields and preparation toggle" }],
    termHelpAr: [{ term: "يحتاج تجهيز", explanation: "علامة بتقول إن القطعة دي لازم تتجهز أو تطلب من المخزن قبل موعد السيارة." }],
    termHelpEn: [{ term: "Preparation required", explanation: "A flag indicating this part must be prepared or ordered from stock before the vehicle appointment." }],
  },{
slug: "premium-booking",
step: "05",
icon: <CalendarDays className="h-5 w-5" />,
titleAr: "إنشاء حجز صيانة",
titleEn: "Create a service booking",
descriptionAr: "من بيانات العميل والعربية لحد اختيار الموعد وتعيين مكان الخدمة المناسب.",
descriptionEn: "From customer and vehicle details through slot selection and service bay assignment.",
stepsAr: [
"ابدأ إنشاء حجز مميز من شاشة الخدمة في TAS.",
"أدخل بيانات العميل والمركبة والكيلومترات الحالية بدقة.",
"راجع نتيجة تحديد الصيانة وتأكد إن الخطة والفترة صحيحة.",
"اختر الفرع وأحد المواعيد المتاحة اللي تناسب العميل.",
"راجع الملخص واضغط تأكيد الحجز.",
"TAS هيعيّن مكان خدمة متاح تلقائيًا عند التأكيد حسب الطاقة الفعلية.",
],
stepsEn: [
"Start a premium service booking from the Service screen in TAS.",
"Enter customer, vehicle, and current mileage accurately.",
"Review the maintenance resolution and confirm the plan and interval are correct.",
"Choose the branch and an available slot that suits the customer.",
"Review the summary and confirm the booking.",
"TAS automatically assigns an available service bay upon confirmation based on real capacity.",
],
resultAr: "الحجز بيتعمل بموعد ومدة ومكان خدمة صحيح من غير ما يحصل overbooking.",
resultEn: "The booking is created with the correct slot, duration, and bay without overbooking.",
exampleTitleAr: "مثال عملي",
exampleTitleEn: "Practical example",
exampleBodyAr: "عميل: أحمد محمود، مركبة: نيسان صني ٢٠٢٢، كيلومترات: ٣٠٬٠٠٠، فرع مدينة نصر، موعد ١٠ ص، تم تعيين مكان الخدمة ٢ تلقائيًا.",
exampleBodyEn: "Customer: Ahmed Mahmoud, vehicle: Nissan Sunny 2022, mileage: 30,000, Nasr City branch, 10 AM slot, bay 2 assigned automatically.",
links: [
{ labelAr: "فتح إنشاء حجز مميز", labelEn: "Open premium booking", href: "/tas/service#premium-booking" },
{ labelAr: "فتح جدول المواعيد", labelEn: "Open scheduler", href: "/tas/service#service-scheduler" },
],
screenshots: [{ stepIndex: 5, captionAr: "تأكيد الحجز وتعيين مكان الخدمة", captionEn: "Confirming booking and bay assignment", highlightDescriptionAr: "زر تأكيد الحجز", highlightDescriptionEn: "Confirm booking button" }],
termHelpAr: [{ term: "مكان الخدمة", explanation: "الكوريك أو منطقة الشغل المخصصة لاستقبال السيارة أثناء الصيانة." }],
termHelpEn: [{ term: "Service bay", explanation: "The lift or work area designated for servicing the vehicle during the appointment." }],
},
{
slug: "scheduler-lifecycle",
step: "06",
icon: <Clock3 className="h-5 w-5" />,
titleAr: "جدول المواعيد ودورة حالة الحجز",
titleEn: "Scheduler & booking lifecycle",
descriptionAr: "تابع المواعيد وتوزيع أماكن الخدمة وسجل تغييرات حالة كل حجز خطوة بخطوة.",
descriptionEn: "Track appointments, bay allocation, and booking status history step by step.",
stepsAr: [
"استخدم جدول المواعيد لمراجعة الحجوزات وأماكن الخدمة المخصصة.",
"افتح دورة حالة الحجز لأي حجز عشان تشوف التاريخ الكامل.",
"غيّر الحالة فقط عبر الانتقالات المسموحة في النظام.",
"راجع سجل الحالة لمعرفة مين غيّر وإمتى وليه.",
],
stepsEn: [
"Use the scheduler to review appointments and assigned service bays.",
"Open the booking lifecycle for any booking to see the full history.",
"Move the booking only through allowed status transitions in the system.",
"Review the status history to see who changed it, when, and why.",
],
resultAr: "دورة الحجز واضحة وكل تغيير قابل للتتبع والمراجعة.",
resultEn: "The booking lifecycle stays clear and fully traceable for audit.",
exampleTitleAr: "مثال عملي",
exampleTitleEn: "Practical example",
exampleBodyAr: "حجز رقم ١٢٣٤: الحالة اتغيرت من «بانتظار التأكيد» لـ «مؤكد» بواسطة المستخدم سارة يوم ٢٠٢٦-٠٩-٣٠ الساعة ٩:١٥ ص.",
exampleBodyEn: "Booking #1234: status changed from Pending Confirmation to Confirmed by user Sarah on 2026-09-30 at 09:15 AM.",
links: [
{ labelAr: "فتح جدول المواعيد", labelEn: "Open scheduler", href: "/tas/service#service-scheduler" },
{ labelAr: "فتح دورة حالة الحجز", labelEn: "Open booking lifecycle", href: "/tas/service#booking-lifecycle" },
],
screenshots: [{ stepIndex: 3, captionAr: "سجل تغييرات حالة الحجز", captionEn: "Booking status change history", highlightDescriptionAr: "جدول سجل الحالة", highlightDescriptionEn: "Status history table" }],
termHelpAr: [{ term: "دورة الحالة", explanation: "المسار المحدد اللي بيمشي فيه الحجز من الإنشاء لحد الانتهاء أو الإلغاء." }],
termHelpEn: [{ term: "Lifecycle", explanation: "The defined path a booking follows from creation through completion or cancellation." }],
},
{
slug: "booking-snapshot",
step: "07",
icon: <ShieldCheck className="h-5 w-5" />,
titleAr: "نسخة الصيانة المجمّدة",
titleEn: "Frozen maintenance snapshot",
descriptionAr: "افهم ليه الحجوزات القديمة مش بتتغير حتى لو عدلت الباقة الأصلية بعدها.",
descriptionEn: "Understand why historical bookings stay unchanged even after editing the original package.",
stepsAr: [
"لما بتعمل حجز، TAS بياخد نسخة ثابتة من باقة الصيانة في نفس اللحظة.",
"النسخة دي بتحفظ القطع والكميات والأسعار والضريبة وحالة التجهيز كما هي.",
"أي تعديل في الباقة الأصلية بعد كده مش بيأثر على الحجوزات القديمة.",
"راجع النسخة المجمّدة من دورة حالة الحجز > نسخة الصيانة.",
],
stepsEn: [
"When you create a booking, TAS takes a frozen copy of the maintenance package at that moment.",
"This snapshot preserves items, quantities, prices, VAT, and preparation state exactly as they were.",
"Any later edits to the original package do not affect historical bookings.",
"Review the frozen snapshot from Booking Lifecycle > Maintenance Snapshot.",
],
resultAr: "تفاصيل وأسعار الحجز تظل محفوظة زي ما كانت وقت الإنشاء مهما حصل بعدها.",
resultEn: "Historical booking details and pricing stay exactly as they were at creation time regardless of later changes.",
exampleTitleAr: "مثال عملي",
exampleTitleEn: "Practical example",
exampleBodyAr: "حجز قديم فيه فلتر زيت بسعر ١٥٠ جنيه؛ لما رفعت السعر لـ ١٧٠ جنيه في الباقة الأصلية، الحجز القديم فضل مسجل بـ ١٥٠ جنيه.",
exampleBodyEn: "An older booking lists an oil filter at EGP 150; after the base package price increases to EGP 170, the old booking still shows EGP 150.",
links: [{ labelAr: "فتح دورة حالة الحجز", labelEn: "Open booking lifecycle", href: "/tas/service#booking-lifecycle" }],
screenshots: [{ stepIndex: 4, captionAr: "عرض نسخة الصيانة المجمّدة", captionEn: "Viewing frozen maintenance snapshot", highlightDescriptionAr: "قسم نسخة الصيانة في تفاصيل الحجز", highlightDescriptionEn: "Maintenance snapshot section in booking details" }],
termHelpAr: [{ term: "نسخة مجمّدة", explanation: "صورة ثابتة من بيانات الباقة وقت الحجز مش بتتغير بأي تعديل لاحق." }],
termHelpEn: [{ term: "Frozen snapshot", explanation: "A fixed copy of the package data at booking time that never changes with later edits." }],
},
{
slug: "parts-preparation",
step: "08",
icon: <PackageCheck className="h-5 w-5" />,
titleAr: "تجهيز قطع الحجوزات القادمة",
titleEn: "Next-day parts preparation",
descriptionAr: "تابع المطلوب والمجهز والمتبقي والنواقص قبل ما العربية توصل الورشة.",
descriptionEn: "Track required, prepared, remaining, and shortage quantities before the vehicle arrives at the workshop.",
stepsAr: [
"افتح تجهيز القطع والمواد من شاشة الخدمة في TAS.",
"اختر يوم الخدمة المطلوب تراجع فيه التجهيزات.",
"راجع الكميات المطلوبة والمجهزة والمتبقية لكل قطعة.",
"استخدم «تم التجهيز» لما تكمل أو «نقص» مع كتابة السبب لو فيه مشكلة.",
"راجع نسبة الجاهزية قبل موعد وصول السيارة عشان ما تتأخرش.",
],
stepsEn: [
"Open Parts & Materials Preparation from the Service screen in TAS.",
"Choose the service day you want to review preparations for.",
"Review required, prepared, and remaining quantities for each part.",
"Use Prepared when complete or Shortage with a reason if there is an issue.",
"Review readiness percentage before vehicle arrival to avoid delays.",
],
resultAr: "فريق الصيانة بيبقى عارف قبل ما العربية توصل هل كل القطع جاهزة ولا فيه نقص.",
resultEn: "The service team knows in advance whether every required part is ready or if there are shortages.",
exampleTitleAr: "مثال عملي",
exampleTitleEn: "Practical example",
exampleBodyAr: "بكرة: ٣ حجوزات محتاجة فلتر زيت (المطلوب ٦، المجهز ٤، المتبقي ٢)، وتم تسجيل نقص بسبب تأخر المورد.",
exampleBodyEn: "Tomorrow: 3 bookings need oil filters (required 6, prepared 4, remaining 2), shortage logged due to supplier delay.",
links: [{ labelAr: "فتح تجهيز القطع", labelEn: "Open parts preparation", href: "/tas/service#parts-preparation" }],
screenshots: [{ stepIndex: 4, captionAr: "متابعة حالة تجهيز القطع", captionEn: "Tracking parts preparation status", highlightDescriptionAr: "أعمدة المطلوب والمجهز والمتبقي", highlightDescriptionEn: "Required, prepared, and remaining columns" }],
termHelpAr: [{ term: "نسبة الجاهزية", explanation: "النسبة المئوية للقطع اللي اتجهزت فعلاً مقارنة بالمطلوب الكلي للحجوزات." }],
termHelpEn: [{ term: "Readiness", explanation: "The percentage of parts actually prepared compared to the total required for bookings." }],
},
];
const FLOW = [
{ ar: "الإعداد", en: "Setup", icon: <Settings2 className="h-4 w-4" /> },
{ ar: "خطط الصيانة", en: "Maintenance plans", icon: <Wrench className="h-4 w-4" /> },
{ ar: "القطع والتسعير", en: "Items & pricing", icon: <ClipboardList className="h-4 w-4" /> },
{ ar: "الحجز", en: "Booking", icon: <CalendarDays className="h-4 w-4" /> },
{ ar: "دورة الحالة", en: "Lifecycle", icon: <Clock3 className="h-4 w-4" /> },
{ ar: "تجهيز القطع", en: "Parts prep", icon: <PackageCheck className="h-4 w-4" /> },
];
function TermHelp({ terms, lang }: { terms?: { term: string; explanation: string }[]; lang: Lang }) {
if (!terms || terms.length === 0) return null;
const [open, setOpen] = useState<string | null>(null);
return (
<div className="mt-4 flex flex-wrap gap-2">
{terms.map((t) => (
<div key={t.term} className="relative">
<button
onClick={() => setOpen(open === t.term ? null : t.term)}
className="inline-flex items-center gap-1 rounded-full border border-[#dce6f0] bg-[#eef3f8] px-2.5 py-1 text-[10px] font-bold text-[#0b2850] transition hover:bg-[#0b2850] hover:text-white"
>
<Info className="h-3 w-3" />
{t.term}
</button>
{open === t.term && (
<div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-[#eadfca] bg-white p-3 text-xs leading-5 text-slate-700 shadow-lg">
{t.explanation}
</div>
)}
</div>
))}
</div>
);
}
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
const fields = isAr
? [guide.titleAr, guide.descriptionAr, ...guide.stepsAr, guide.resultAr, guide.exampleTitleAr, guide.exampleBodyAr]
: [guide.titleEn, guide.descriptionEn, ...guide.stepsEn, guide.resultEn, guide.exampleTitleEn, guide.exampleBodyEn];
return GUIDES.filter((guide) =>
fields.join(" ").toLowerCase().includes(q),
);
}, [query, isAr]);
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
? "دليل عملي داخل TAS يوصلك من إعداد الورشة لحد الحجز وتجهيز القطع قبل وصول المركبة."
: "A practical guide inside TAS, from workshop setup to service booking and next-day parts preparation."}
</p>
<div className="relative mt-7 max-w-2xl">
<Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7c91] ${isAr ? "right-4" : "left-4"}`} />
<input
value={query}
onChange={(e) => setQuery(e.target.value)}
placeholder={isAr ? "ابحث عن حجز، باقة، قطع، مكان خدمة..." : "Search booking, package, parts, bay..."}
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
<section>
<div className="mb-4 flex items-center justify-between">
<h2 className="text-lg font-black text-[#0b2850]">{isAr ? "الأدلة التشغيلية" : "Operational guides"}</h2>
<span className="text-xs font-bold text-slate-400">{visibleGuides.length} / {GUIDES.length}</span>
</div>
{visibleGuides.length > 0 ? (
<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
{visibleGuides.map((guide) => (
<GuideCard key={guide.slug} guide={guide} lang={lang} />
))}
</div>
) : (
<div className="rounded-2xl border border-dashed border-[#d8c8a8] bg-white p-10 text-center text-sm text-slate-500">
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
<TermHelp terms={isAr ? guide.termHelpAr : guide.termHelpEn} lang={lang} />
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
<div className="mt-7 rounded-2xl border border-[#e8dcc8] bg-[#fdfbf6] p-5">
<div className="flex items-center gap-2 text-sm font-black text-[#9a6b12]">
<Lightbulb className="h-4 w-4" />
{isAr ? guide.exampleTitleAr : guide.exampleTitleEn}
</div>
<p className="mt-3 text-sm leading-7 text-slate-700">{isAr ? guide.exampleBodyAr : guide.exampleBodyEn}</p>
</div>
{guide.links.length > 0 && (
<div className="mt-6 flex flex-wrap gap-3">
{guide.links.map((link) => (
<a
key={link.href}
href={link.href}
className="inline-flex items-center gap-2 rounded-xl bg-[#0b2850] px-5 py-3 text-xs font-black text-white transition hover:bg-[#143a68]"
>
<ExternalLink className="h-3.5 w-3.5" />
{isAr ? link.labelAr : link.labelEn}
</a>
))}
</div>
)}
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
const path = location.split(/[?#]/)[0].