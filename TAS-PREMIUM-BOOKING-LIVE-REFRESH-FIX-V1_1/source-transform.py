#!/usr/bin/env python3
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: source-transform.py <source-root>")

root = Path(sys.argv[1]).resolve()
rel = "client/src/components/tas/TASPremiumBookingFlow.tsx"
p = root / rel
if not p.is_file():
    raise RuntimeError("missing source file: " + rel)

text = p.read_text(encoding="utf-8")
marker = "TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1"

required = [
    "utils.tas.service.listAppointments.invalidate()",
    "utils.tas.service.getScheduler.invalidate()",
    "utils.tas.service.getAvailableSlots.invalidate()",
    "utils.tas.service.getPartsPreparationBoard.invalidate()",
]

has_utils = "const utils = trpc.useUtils();" in text
has_all = all(item in text for item in required)

if marker in text:
    print("PREMIUM_BOOKING_LIVE_REFRESH_SOURCE_TRANSFORM=PASS")
    raise SystemExit(0)

if has_utils and has_all:
    anchor = "  const utils = trpc.useUtils();"
    if text.count(anchor) != 1:
        raise RuntimeError(f"equivalent behavior marker anchor: expected 1, found {text.count(anchor)}")
    text = text.replace(
        anchor,
        anchor + " // TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1",
        1,
    )
    p.write_text(text, encoding="utf-8")
    print("PREMIUM_BOOKING_LIVE_REFRESH_EQUIVALENT=YES")
    print("PREMIUM_BOOKING_LIVE_REFRESH_SOURCE_TRANSFORM=PASS")
    raise SystemExit(0)

if not has_utils:
    fn_anchor = """export default function TASPremiumBookingFlow({ onCreated }: Props) {
  const { isRTL } = useLanguage();
"""
    if text.count(fn_anchor) != 1:
        raise RuntimeError(f"utils function anchor: expected 1, found {text.count(fn_anchor)}")
    text = text.replace(
        fn_anchor,
        fn_anchor + "  const utils = trpc.useUtils(); // TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1\n",
        1,
    )
else:
    anchor = "  const utils = trpc.useUtils();"
    if text.count(anchor) != 1:
        raise RuntimeError(f"utils marker anchor: expected 1, found {text.count(anchor)}")
    text = text.replace(
        anchor,
        anchor + " // TAS_PREMIUM_BOOKING_LIVE_REFRESH_FIX_V1_1",
        1,
    )

missing = [item for item in required if item not in text]
if missing:
    if len(missing) != len(required):
        raise RuntimeError("partial invalidation state; refusing to duplicate an unknown mixed block")

    old = """      await onCreated?.();
      setStep(1);
"""
    new = """      await Promise.all([
        utils.tas.service.listAppointments.invalidate(),
        utils.tas.service.getScheduler.invalidate(),
        utils.tas.service.getAvailableSlots.invalidate(),
        utils.tas.service.getPartsPreparationBoard.invalidate(),
      ]);
      await onCreated?.();
      setStep(1);
"""
    if text.count(old) != 1:
        raise RuntimeError(f"success invalidation anchor: expected 1, found {text.count(old)}")
    text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8")
print("PREMIUM_BOOKING_LIVE_REFRESH_SOURCE_TRANSFORM=PASS")
