#!/usr/bin/env python3
from pathlib import Path
import sys

OLD_MARKER = "// TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1"
NEW_MARKER = "// TAS_AFTER_SALES_SERVICE_AFTER_SALES_GROUP_V2"

OLD_BLOCK = '''// TAS_AFTER_SALES_SERVICE_STANDALONE_NAV_V1
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

NEW_BLOCK = '''// TAS_AFTER_SALES_SERVICE_AFTER_SALES_GROUP_V2
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

OLD_RENDER = '''        {standaloneSidebarItems.map((item) => renderSidebarLink(item))}
        {sidebarGroups.map((group) => renderSidebarGroup(group))}'''

NEW_RENDER = '''        {standaloneSidebarItems.map((item) => renderSidebarLink(item))}
        {sidebarGroups.flatMap((group) => [
          renderSidebarGroup(group),
          ...(group.key === "sales" && afterSalesServiceSidebarItem
            ? [renderSidebarLink(afterSalesServiceSidebarItem)]
            : []),
        ])}'''

def patch(path: Path):
    text = path.read_text(encoding="utf-8")
    if NEW_MARKER in text:
        print(f"ALREADY_APPLIED={path}")
        return
    if OLD_MARKER not in text:
        raise SystemExit(f"ERROR=V1_MARKER_NOT_FOUND:{path}")
    if OLD_BLOCK not in text:
        raise SystemExit(f"ERROR=V1_STANDALONE_BLOCK_NOT_FOUND:{path}")
    if OLD_RENDER not in text:
        raise SystemExit(f"ERROR=NAV_RENDER_ANCHOR_NOT_FOUND:{path}")

    text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
    text = text.replace(OLD_RENDER, NEW_RENDER, 1)

    # Safety checks: service entry must remain out of Automotive group.
    if 'customSidebarItem("/tas/service", isRTL ? "عمليات الخدمة" : "Service Operations"' in text:
        raise SystemExit(f"ERROR=OLD_AUTOMOTIVE_SERVICE_ENTRY_PRESENT:{path}")

    path.write_text(text, encoding="utf-8")
    print(f"PATCHED={path}")

for raw in sys.argv[1:]:
    patch(Path(raw))

print("PATCH_RESULT=PASS")
