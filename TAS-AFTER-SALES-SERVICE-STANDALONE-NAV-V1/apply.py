#!/usr/bin/env python3
from pathlib import Path
import sys

MARKER = "// TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1"
OLD_STANDALONE = '''const standaloneSidebarItems = compactItems(
    toSidebarGroupItem("/dashboard"),
    toSidebarGroupItem("/inbox")
  );'''
NEW_STANDALONE = '''// TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1
  const standaloneSidebarItems = compactItems(
    toSidebarGroupItem("/dashboard"),
    toSidebarGroupItem("/inbox"),
    customSidebarItem(
      "/tas/service",
      isRTL ? "خدمة ما بعد البيع" : "After Sales Service",
      <Wrench size={18} />,
      TAS_SERVICE_ROLES
    )
  );'''
OLD_AUTOMOTIVE = '''        customSidebarItem("/tas/service", isRTL ? "عمليات الخدمة" : "Service Operations", <Wrench size={15} />, TAS_SERVICE_ROLES),
'''

def patch(path: Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print(f"ALREADY_APPLIED={path}")
        return
    if OLD_STANDALONE not in text:
        raise SystemExit(f"ERROR=STANDALONE_ANCHOR_NOT_FOUND:{path}")
    if OLD_AUTOMOTIVE not in text:
        raise SystemExit(f"ERROR=AUTOMOTIVE_SERVICE_ITEM_NOT_FOUND:{path}")
    text = text.replace(OLD_STANDALONE, NEW_STANDALONE, 1)
    text = text.replace(OLD_AUTOMOTIVE, "", 1)
    path.write_text(text, encoding="utf-8")
    print(f"PATCHED={path}")

for raw in sys.argv[1:]:
    patch(Path(raw))

print("PATCH_RESULT=PASS")
