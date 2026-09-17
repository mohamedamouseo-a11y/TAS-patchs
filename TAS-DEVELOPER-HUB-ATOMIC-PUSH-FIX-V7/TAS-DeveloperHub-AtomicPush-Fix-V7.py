#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import shutil
import sys

BAD_LINE = "if (remoteExists if (remoteExists && !atomicReviewMode) {if (remoteExists && !atomicReviewMode) { !ATOMIC_DEPLOYMENT_MODE) {"
GOOD_LINE = "if (remoteExists && !atomicReviewMode) {"


def patch_text(text: str) -> tuple[str, str]:
    start = text.find("async function getAdvancedSyncPreview(")
    end = text.find("\ntype GitMutationSnapshot =", start)
    if start < 0 or end < 0:
        raise RuntimeError("getAdvancedSyncPreview boundaries not found")

    block = text[start:end]

    if BAD_LINE in block:
        if block.count(BAD_LINE) != 1:
            raise RuntimeError(f"malformed condition count != 1 ({block.count(BAD_LINE)})")
        block = block.replace(BAD_LINE, GOOD_LINE, 1)
        state = "FIXED"
    elif GOOD_LINE in block:
        state = "ALREADY_FIXED"
    else:
        raise RuntimeError("expected malformed or corrected remoteExists guard not found")

    # Safety validation: remove only the known corruption and verify the preview
    # now contains one clean remote/local-history guard.
    if "if (remoteExists if (" in block or "{if (remoteExists" in block:
        raise RuntimeError("malformed remoteExists guard still present")
    if block.count(GOOD_LINE) != 1:
        raise RuntimeError(f"correct remoteExists guard count != 1 ({block.count(GOOD_LINE)})")
    if "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;" not in block:
        raise RuntimeError("atomicReviewMode declaration missing")
    if "ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef" not in block:
        raise RuntimeError("atomic remote-base candidate logic missing")
    if 'expectedAction: "clean_snapshot_and_push" as const' not in block:
        raise RuntimeError("clean_snapshot_and_push plan missing")

    updated = text[:start] + block + text[end:]
    return updated, state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    prepared: list[tuple[pathlib.Path, str, str]] = []
    try:
        for raw in args.paths:
            path = pathlib.Path(raw).resolve()
            if not path.is_file():
                raise RuntimeError(f"not a file: {path}")
            original = path.read_text(encoding="utf-8")
            updated, state = patch_text(original)
            prepared.append((path, updated, state))
    except Exception as exc:
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR={exc}")
        return 1

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backups: list[tuple[pathlib.Path, pathlib.Path]] = []
    changed = 0
    try:
        for path, updated, state in prepared:
            original = path.read_text(encoding="utf-8")
            print(f"TARGET={path}")
            print(f"STATE={state}")
            if updated == original:
                continue

            backup = path.with_name(path.name + f".before-malformed-guard-fix-v7.{stamp}")
            shutil.copy2(path, backup)
            backups.append((path, backup))

            tmp = path.with_name(path.name + f".tmp-malformed-guard-fix-v7.{stamp}")
            tmp.write_text(updated, encoding="utf-8")
            tmp.replace(path)
            changed += 1
            print(f"BACKUP={backup}")

        # Re-read every target after writes and validate final state.
        for path, _, _ in prepared:
            final = path.read_text(encoding="utf-8")
            _, final_state = patch_text(final)
            if final_state != "ALREADY_FIXED":
                raise RuntimeError(f"post-write validation failed for {path}")

        print("PATCH_VALIDATION=PASS")
        print(f"CHANGED_COUNT={changed}")
        print("PUSHED=NO")
        return 0

    except Exception as exc:
        for path, backup in reversed(backups):
            try:
                shutil.copy2(backup, path)
                print(f"RESTORED={path}")
            except Exception as restore_exc:
                print(f"RESTORE_ERROR={path}:{restore_exc}")
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR={exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
