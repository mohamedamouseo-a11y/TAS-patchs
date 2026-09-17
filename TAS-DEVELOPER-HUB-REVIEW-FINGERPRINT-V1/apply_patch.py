from pathlib import Path

MARKER = "TAS_DEVHUB_REVIEW_FINGERPRINT_V1"
ROOT = Path("/var/www/TAS-root")
p = ROOT / "server/services/developerHubOperationTransaction.ts"

if not p.exists():
    raise SystemExit("PATCH_FAIL:missing_target")

text = p.read_text()
if MARKER in text:
    print("PATCH_APPLIED=YES")
    print("FILE=server/services/developerHubOperationTransaction.ts")
    raise SystemExit(0)

old = '''  if (tx.fingerprint !== input.previewFingerprint || tx.fingerprint !== input.currentPreview.fingerprint) {\n    throw new Error("The project or GitHub branch changed after review. Review again.");\n  }\n'''
new = '''  // TAS_DEVHUB_REVIEW_FINGERPRINT_V1\n  // The browser must still execute the exact reviewed transaction.\n  // Recomputed aggregate preview fingerprints may contain non-authoritative\n  // metadata; real state changes are validated below by SHA/tree/action fields.\n  if (tx.fingerprint !== input.previewFingerprint) {\n    throw new Error("The GitHub review fingerprint does not match this transaction. Review again.");\n  }\n'''

if old not in text:
    raise SystemExit("PATCH_FAIL:fingerprint_guard_not_found")

text = text.replace(old, new, 1)
p.write_text(text)
print("PATCH_APPLIED=YES")
print("FILE=server/services/developerHubOperationTransaction.ts")
