#!/usr/bin/env python3
from pathlib import Path
import sys

PAGE_MARKER = "// TAS_AFTER_SALES_BAY_AVAILABILITY_V1"
SCHED_MARKER = "{/* TAS_AFTER_SALES_BAY_AVAILABILITY_LEGEND_V1 */}"

def patch_service_page(path: Path):
    text = path.read_text(encoding="utf-8")
    if PAGE_MARKER in text:
        print(f"SERVICE_PAGE_ALREADY_APPLIED={path}")
        return

    required = "// TAS_AFTER_SALES_SERVICE_SECTION_PAGES_V3"
    if required not in text:
        raise SystemExit(f"ERROR=MENU_V3_MARKER_NOT_FOUND:{path}")

    import_anchor = "import TASAvailabilityEngineV2Panel from '@/components/tas/TASAvailabilityEngineV2Panel';\n"
    scheduler_import = "import TASServiceScheduler from '@/components/tas/TASServiceScheduler';\n"
    if scheduler_import not in text:
        if import_anchor not in text:
            raise SystemExit(f"ERROR=AVAILABILITY_IMPORT_ANCHOR_NOT_FOUND:{path}")
        text = text.replace(import_anchor, import_anchor + scheduler_import, 1)

    old_render = "{section === 'availability' && <TASAvailabilityEngineV2Panel />}"
    new_render = """{section === 'availability' && (
          <>
            {/* TAS_AFTER_SALES_BAY_AVAILABILITY_V1 */}
            <TASServiceScheduler />
            <TASAvailabilityEngineV2Panel />
          </>
        )}"""
    if old_render not in text:
        raise SystemExit(f"ERROR=AVAILABILITY_RENDER_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(old_render, new_render, 1)

    path.write_text(text, encoding="utf-8")
    print(f"SERVICE_PAGE_PATCHED={path}")


def patch_scheduler(path: Path):
    text = path.read_text(encoding="utf-8")
    if SCHED_MARKER in text:
        print(f"SCHEDULER_ALREADY_APPLIED={path}")
        return

    old_legend = '''            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">{isRTL ? 'Confirmed' : 'Confirmed'}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{isRTL ? 'Pending' : 'Pending'}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{isRTL ? 'Completed' : 'Completed'}</span>
            </div>'''

    new_legend = '''            <div className="flex flex-wrap gap-2 text-[11px]">
              {/* TAS_AFTER_SALES_BAY_AVAILABILITY_LEGEND_V1 */}
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                {isRTL ? 'متاح = المساحة الفارغة' : 'Available = empty time'}
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">
                {isRTL ? 'محجوز = كارت حجز' : 'Booked = booking block'}
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">{isRTL ? 'Confirmed' : 'Confirmed'}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{isRTL ? 'Pending' : 'Pending'}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{isRTL ? 'Completed' : 'Completed'}</span>
            </div>'''

    if old_legend not in text:
        raise SystemExit(f"ERROR=SCHEDULER_LEGEND_ANCHOR_NOT_FOUND:{path}")
    text = text.replace(old_legend, new_legend, 1)

    path.write_text(text, encoding="utf-8")
    print(f"SCHEDULER_PATCHED={path}")


if len(sys.argv) != 3:
    raise SystemExit("USAGE: apply.py <TASServicePage.tsx> <TASServiceScheduler.tsx>")

patch_service_page(Path(sys.argv[1]))
patch_scheduler(Path(sys.argv[2]))
print("PATCH_RESULT=PASS")
