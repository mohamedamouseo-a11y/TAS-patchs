#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
path = root / "server/tasDb.ts"
text = path.read_text(encoding="utf-8")

marker = "TAS_PHASE11_SNAPSHOT_SOURCE_ALIGNMENT_V2"
if marker in text:
    print("SOURCE_TRANSFORM=ALREADY_APPLIED")
    raise SystemExit(0)

helper_start = text.find("const snapshotTASMaintenancePackageForBooking")
if helper_start < 0:
    raise SystemExit("ERROR=SNAPSHOT_HELPER_NOT_FOUND")
helper_end = text.find("const normalizeMaintenanceMappingText", helper_start)
if helper_end < 0:
    raise SystemExit("ERROR=SNAPSHOT_HELPER_END_NOT_FOUND")

helper = text[helper_start:helper_end]
old_filter = """      AND li.isActive=1
      AND mi.isActive=1
"""
new_filter = """      AND li.isActive=1
      -- TAS_PHASE11_SNAPSHOT_SOURCE_ALIGNMENT_V2:
      -- match Maintenance Items & Costs package semantics exactly.
"""
if old_filter not in helper:
    raise SystemExit("ERROR=SNAPSHOT_SOURCE_FILTER_ANCHOR_NOT_FOUND")
helper = helper.replace(old_filter, new_filter, 1)
text = text[:helper_start] + helper + text[helper_end:]

# If V1 hardening is already present, align its expected source-count query too.
hardening_marker = "TAS_PHASE11_SNAPSHOT_CREATION_HARDENING_V1"
if hardening_marker in text:
    hardening_start = text.find(hardening_marker)
    hardening_end = text.find("const maintenancePackage =", hardening_start)
    if hardening_end < 0:
        raise SystemExit("ERROR=HARDENING_BLOCK_END_NOT_FOUND")
    block = text[hardening_start:hardening_end]
    count_old = """          AND li.isActive = 1
          AND mi.isActive = 1
"""
    count_new = """          AND li.isActive = 1
"""
    if count_old in block:
        block = block.replace(count_old, count_new, 1)
        text = text[:hardening_start] + block + text[hardening_end:]

path.write_text(text, encoding="utf-8")
print("SOURCE_TRANSFORM=PASS")
