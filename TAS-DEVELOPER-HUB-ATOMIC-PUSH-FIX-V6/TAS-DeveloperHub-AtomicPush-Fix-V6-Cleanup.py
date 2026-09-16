#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys

REQUIRED_MARKERS = [
    "const ATOMIC_DEPLOYMENT_MODE = Boolean(",
    "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;",
    "ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef",
    "const workingChanges = atomicReviewMode",
    "const atomicWorkspaceChanged = atomicReviewMode",
]

BACKUP_GLOBS = [
    "developerHub.ts.before-atomic-push-fix-v3.*",
    "developerHub.ts.before-atomic-review-fix.*",
]


def verify_target(path: pathlib.Path) -> tuple[bool, list[str]]:
    text = path.read_text(encoding="utf-8")
    missing = [marker for marker in REQUIRED_MARKERS if marker not in text]
    return (not missing, missing)


def main() -> int:
    targets = [
        pathlib.Path("/var/www/TAS-root/server/routes/developerHub.ts").resolve(),
        pathlib.Path("/var/www/TAS-root/current/server/routes/developerHub.ts").resolve(),
    ]

    seen = set()
    unique_targets = []
    for target in targets:
        if target in seen:
            continue
        seen.add(target)
        unique_targets.append(target)

    failures = []
    for target in unique_targets:
        if not target.is_file():
            failures.append(f"missing target: {target}")
            continue
        ok, missing = verify_target(target)
        if not ok:
            failures.append(f"{target}: missing markers: {' | '.join(missing)}")

    if failures:
        print("PATCH_VALIDATION=FAIL")
        print("ERROR=" + " || ".join(failures))
        return 1

    deleted = []
    for target in unique_targets:
        parent = target.parent
        for pattern in BACKUP_GLOBS:
            for backup in sorted(parent.glob(pattern)):
                if not backup.is_file() or backup.is_symlink():
                    continue
                backup.unlink()
                deleted.append(str(backup))

    leftovers = []
    for target in unique_targets:
        parent = target.parent
        for pattern in BACKUP_GLOBS:
            leftovers.extend(str(p) for p in parent.glob(pattern) if p.exists())

    if leftovers:
        print("PATCH_VALIDATION=FAIL")
        print("ERROR=backup cleanup incomplete: " + " | ".join(sorted(set(leftovers))))
        return 1

    print("PATCH_VALIDATION=PASS")
    print("PATCH_STATE=ALREADY_APPLIED")
    print("DELETED_COUNT=" + str(len(deleted)))
    print("DELETED_FILES=" + (" | ".join(deleted) if deleted else "NONE"))
    print("REALPATH_1=" + str(targets[0]))
    print("REALPATH_2=" + str(targets[1]))
    print("ERROR=NONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
