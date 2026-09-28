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
marker = "TAS_SERVICE_LIVE_QUERY_INVALIDATION_FIX_V1"
if marker in text:
    print("SERVICE_LIVE_QUERY_INVALIDATION_SOURCE_TRANSFORM=PASS")
    raise SystemExit(0)

old1 = """export default function TASPremiumBookingFlow({ onCreated }: Props) {
  const { isRTL } = useLanguage();

  const vehiclesQ = trpc.tas.catalog.listVehicles.useQuery({ activeOnly: true });
"""
new1 = """export default function TASPremiumBookingFlow({ onCreated }: Props) {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const vehiclesQ = trpc.tas.catalog.listVehicles.useQuery({ activeOnly: true });
"""
if text.count(old1) != 1:
    raise RuntimeError(f"utils anchor: expected 1, found {text.count(old1)}")
text = text.replace(old1, new1, 1)

old2 = """      await onCreated?.();
      setStep(1);
"""
new2 = """      // TAS_SERVICE_LIVE_QUERY_INVALIDATION_FIX_V1
      await Promise.all([
        onCreated?.(),
        utils.tas.service.listAppointments.invalidate(),
        utils.tas.service.getScheduler.invalidate(),
        utils.tas.service.getAvailableSlots.invalidate(),
        utils.tas.service.getPartsPreparationBoard.invalidate(),
      ]);
      setStep(1);
"""
if text.count(old2) != 1:
    raise RuntimeError(f"success refresh anchor: expected 1, found {text.count(old2)}")
text = text.replace(old2, new2, 1)

p.write_text(text, encoding="utf-8")
print("SERVICE_LIVE_QUERY_INVALIDATION_SOURCE_TRANSFORM=PASS")
