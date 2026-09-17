#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
import shutil
import sys

GOOD_GUARD = "if (remoteExists && !atomicReviewMode) {"
DECL = "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;"
COUNTS = 'const counts = await runGit(["rev-list", "--left-right", "--count", `HEAD...${remoteRef}`], auth.env)'


def patch_preview(text: str) -> tuple[str, str]:
    start = text.find("async function getAdvancedSyncPreview(")
    end = text.find("\ntype GitMutationSnapshot =", start)
    if start < 0 or end < 0:
        raise RuntimeError("getAdvancedSyncPreview boundaries not found")

    block = text[start:end]
    if DECL not in block:
        raise RuntimeError("atomicReviewMode declaration missing")
    if COUNTS not in block:
        raise RuntimeError("rev-list counts statement missing")

    # Restrict surgery to the tiny localAhead/remoteAhead section only.
    section_start = block.find("    let localAhead = 0;")
    section_end = block.find("    const historiesRelated = atomicReviewMode", section_start)
    if section_start < 0 or section_end < 0:
        raise RuntimeError("localAhead/remoteAhead section not found")
    section = block[section_start:section_end]

    # If already correct and no corruption remains, do nothing.
    corruption_markers = (
        "if (remoteExists if (",
        "{if (remoteExists",
        "!ATOMIC_DEPLOYMENT_MODE) {",
    )
    if GOOD_GUARD in section and not any(m in section for m in corruption_markers):
        return text, "ALREADY_FIXED"

    # Replace exactly the malformed guard immediately preceding the counts query.
    # This is intentionally shape-based rather than relying on one exact corrupted string.
    pattern = re.compile(
        r"\n\s*if\s*\([^\n]*remoteExists[^\n]*\)\s*\{\s*\n\s*(?=const counts = await runGit\(\[\"rev-list\")"
    )
    matches = list(pattern.finditer(section))
    if len(matches) != 1:
        raise RuntimeError(f"malformed remoteExists guard candidates != 1 ({len(matches)})")

    section = pattern.sub("\n    " + GOOD_GUARD + "\n      ", section, count=1)

    # Normalize accidental duplicated guard fragments if a previous patch concatenated them
    # onto the same guard line before the counts query.
    lines = section.splitlines()
    count_idx = next((i for i, line in enumerate(lines) if "const counts = await runGit" in line), -1)
    if count_idx < 1:
        raise RuntimeError("counts line not found after patch")
    guard_idx = count_idx - 1
    while guard_idx >= 0 and not lines[guard_idx].strip():
        guard_idx -= 1
    if guard_idx < 0:
        raise RuntimeError("guard line missing after patch")
    lines[guard_idx] = "    " + GOOD_GUARD
    section = "\n".join(lines)
    if block[section_start:section_end].endswith("\n") and not section.endswith("\n"):
        section += "\n"

    if any(m in section for m in corruption_markers):
        raise RuntimeError("malformed remoteExists guard still present")
    if section.count(GOOD_GUARD) != 1:
        raise RuntimeError(f"correct remoteExists guard count != 1 ({section.count(GOOD_GUARD)})")

    updated_block = block[:section_start] + section + block[section_end:]
    if "ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef : \"\"" not in updated_block:
        raise RuntimeError("atomic remote-base candidate logic missing")
    if 'expectedAction: "clean_snapshot_and_push" as const' not in updated_block:
        raise RuntimeError("clean snapshot plan missing")

    return text[:start] + updated_block + text[end:], "FIXED"


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
            updated, state = patch_preview(original)
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

            # Keep backups outside the TAS source tree so they cannot enter a Review.
            backup = pathlib.Path("/tmp") / f"{path.name}.before-atomic-push-fix-v8.{stamp}.{changed}"
            shutil.copy2(path, backup)
            backups.append((path, backup))

            tmp = path.with_name(path.name + f".tmp-atomic-push-fix-v8.{stamp}")
            tmp.write_text(updated, encoding="utf-8")
            tmp.replace(path)
            changed += 1
            print(f"BACKUP={backup}")

        for path, _, _ in prepared:
            final = path.read_text(encoding="utf-8")
            _, final_state = patch_preview(final)
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
