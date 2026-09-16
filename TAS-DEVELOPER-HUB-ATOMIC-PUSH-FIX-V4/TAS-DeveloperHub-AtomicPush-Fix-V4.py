#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import tempfile

OLD_SENTINEL = 'sentinel = "__KEEP_ATOMIC_WORKSPACE_ISOLATION__"'
NEW_SENTINEL = 'sentinel = "__KEEP_AWI_FLAG__"'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--v3", required=True, help="Exact downloaded V3 patch script")
    parser.add_argument("targets", nargs="+", help="developerHub.ts target files")
    args = parser.parse_args()

    v3_path = pathlib.Path(args.v3).resolve()
    if not v3_path.is_file():
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR=V3 patch not found: {v3_path}")
        return 1

    source = v3_path.read_text(encoding="utf-8")
    if source.count(OLD_SENTINEL) != 1:
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR=Expected exactly one V3 sentinel declaration, found {source.count(OLD_SENTINEL)}")
        return 1

    fixed = source.replace(OLD_SENTINEL, NEW_SENTINEL, 1)

    # Verify the exact bug is gone before running anything against TAS source.
    if OLD_SENTINEL in fixed or fixed.count(NEW_SENTINEL) != 1:
        print("PATCH_VALIDATION=FAIL")
        print("ERROR=Sentinel correction validation failed")
        return 1

    # Compile the corrected V3 first. This does not touch TAS source files.
    try:
        compile(fixed, "TAS-DeveloperHub-AtomicPush-Fix-V4-generated.py", "exec")
    except Exception as exc:
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR=Corrected V3 does not compile: {exc}")
        return 1

    with tempfile.TemporaryDirectory(prefix="tas-atomic-push-fix-v4-") as tmpdir:
        generated = pathlib.Path(tmpdir) / "TAS-DeveloperHub-AtomicPush-Fix-V4-generated.py"
        generated.write_text(fixed, encoding="utf-8")
        cmd = [sys.executable, str(generated), *args.targets]
        result = subprocess.run(cmd, text=True)
        return int(result.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
