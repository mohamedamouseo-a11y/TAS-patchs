from pathlib import Path

MARKER = "TAS_DEVHUB_REVIEW_STALE_CLEAR_V1"
ROOT = Path("/var/www/TAS-root")

candidates = list((ROOT / "client/src").rglob("DeveloperHubTab.tsx"))
if not candidates:
    raise SystemExit("PATCH_FAIL:DeveloperHubTab.tsx_not_found")
if len(candidates) != 1:
    raise SystemExit("PATCH_FAIL:multiple_DeveloperHubTab.tsx:" + ",".join(str(p) for p in candidates))

p = candidates[0]
text = p.read_text()

if MARKER in text:
    print("PATCH_APPLIED=YES")
    print(f"FILE={p.relative_to(ROOT)}")
    raise SystemExit(0)

needle = '''} else if (operation.status === "error" && notify) {
      toast.error(operation.error || operationMessage(operation));
    }'''
replacement = '''} else if (operation.status === "error" && notify) {
      // TAS_DEVHUB_REVIEW_STALE_CLEAR_V1
      clearReview();
      toast.error(operation.error || operationMessage(operation));
    }'''

if needle not in text:
    # Idempotent compatibility: accept an already-applied clearReview fix even
    # when it was written before this prepared patch marker existed.
    fn = text.find("applyRecoveredOperation")
    if fn >= 0:
        window = text[fn:fn + 12000]
        err = window.find('operation.status === "error"')
        if err >= 0 and "clearReview()" in window[err:err + 1200]:
            insert_at = fn + err
            line_start = text.rfind("\n", 0, insert_at) + 1
            text = text[:line_start] + "      // TAS_DEVHUB_REVIEW_STALE_CLEAR_V1\n" + text[line_start:]
            p.write_text(text)
            print("PATCH_APPLIED=YES")
            print(f"FILE={p.relative_to(ROOT)}")
            raise SystemExit(0)
    raise SystemExit("PATCH_FAIL:expected_execute_error_branch_not_found")

text = text.replace(needle, replacement, 1)
p.write_text(text)

print("PATCH_APPLIED=YES")
print(f"FILE={p.relative_to(ROOT)}")
