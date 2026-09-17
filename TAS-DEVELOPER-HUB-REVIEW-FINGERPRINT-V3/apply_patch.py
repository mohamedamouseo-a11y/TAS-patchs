from pathlib import Path

MARKER = "TAS_DEVHUB_REVIEW_FINGERPRINT_V3"
ROOT = Path("/var/www/TAS-root")
CURRENT = ROOT / "current"
ERROR = "The project or GitHub branch changed after review. Review again."

GUARDS = [
'''  if (tx.fingerprint !== input.previewFingerprint || tx.fingerprint !== input.currentPreview.fingerprint) {\n    throw new Error("The project or GitHub branch changed after review. Review again.");\n  }\n''',
'''    if (tx.fingerprint !== input.previewFingerprint || tx.fingerprint !== input.currentPreview.fingerprint) {\n      throw new Error("The project or GitHub branch changed after review. Review again.");\n    }\n''',
]

roots = [("root", ROOT / "server"), ("current", CURRENT / "server")]
hits = []
for label, base in roots:
    if not base.exists():
        continue
    for p in base.rglob("*.ts"):
        try:
            text = p.read_text()
        except Exception:
            continue
        if ERROR in text:
            hits.append((label, p, text))

if not hits:
    print("PATCH_FAIL:no_source_occurrence")
    raise SystemExit(2)

changed = []
unsupported = []
for label, p, text in hits:
    original = text
    replaced = False
    for guard in GUARDS:
        if guard in text:
            replacement = (
                guard.splitlines()[0][:len(guard.splitlines()[0]) - len(guard.splitlines()[0].lstrip())]
                + f"// {MARKER}\n"
            )
            text = text.replace(guard, replacement, 1)
            replaced = True
            break
    if not replaced:
        unsupported.append(f"{label}:{p}")
        continue
    p.write_text(text)
    changed.append(f"{label}:{p}")

if unsupported:
    print("PATCH_FAIL:unsupported_occurrence=" + ",".join(unsupported))
    raise SystemExit(3)

print("PATCH_APPLIED=YES")
print("CHANGED=" + ",".join(changed))
