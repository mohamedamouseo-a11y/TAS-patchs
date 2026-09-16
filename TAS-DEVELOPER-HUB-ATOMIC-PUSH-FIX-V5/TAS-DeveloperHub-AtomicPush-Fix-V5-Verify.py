#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import pathlib
import sys

REQUIRED_MARKERS = [
    ("atomic_deployment_mode",
     "const ATOMIC_DEPLOYMENT_MODE = Boolean("),
    ("atomic_review_mode",
     "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;"),
    ("remote_base_candidate",
     'ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef : ""'),
    ("candidate_remote_tree",
     '["read-tree", baseTreeish]'),
    ("candidate_dirty_overlay",
     '["status", "--porcelain=v1", "-z", "--untracked-files=all"]'),
    ("working_changes_atomic",
     "const workingChanges = atomicReviewMode"),
    ("local_committed_non_atomic",
     "const localCommitted = !atomicReviewMode"),
    ("remote_changes_non_atomic",
     "const remoteChanges = !atomicReviewMode"),
    ("merge_non_atomic",
     "const needsTwoWayMerge = !atomicReviewMode"),
    ("atomic_workspace_changed",
     "const atomicWorkspaceChanged = atomicReviewMode"),
    ("fingerprint_atomic_mode",
     "atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE"),
]

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def get_block(text: str, start: str, end: str) -> str:
    i = text.find(start)
    if i < 0:
        return ""
    j = text.find(end, i)
    if j < 0:
        return ""
    return text[i:j]

def validate_file(path: pathlib.Path):
    real = path.resolve()
    data = real.read_bytes()
    text = data.decode("utf-8")
    missing = []

    for name, marker in REQUIRED_MARKERS:
        if marker not in text:
            missing.append(name)

    if text.count("const ATOMIC_DEPLOYMENT_MODE =") != 1:
        missing.append("atomic_deployment_mode_count")

    resolver = get_block(
        text,
        "function resolveDeveloperHubWorkTreeRoot(repoDir: string) {",
        "\n\n/** Dynamically resolve the worktree",
    )
    if not resolver:
        missing.append("worktree_resolver_block")
    else:
        release_branch_anchor = "path.dirname(runtimeDir) === releasesDir"
        if release_branch_anchor not in resolver or "return repoDir;" not in resolver:
            missing.append("canonical_worktree_return")

    candidate = get_block(
        text,
        "async function createWorkingTreeCandidateTree(",
        "\n\nfunction parseGitTreeRecord",
    )
    if not candidate:
        missing.append("candidate_function_block")
    else:
        for marker_name, marker in [
            ("candidate_base_treeish_arg", "baseTreeish ="),
            ("candidate_atomic_overlay_flag", "const atomicRemoteOverlay = ATOMIC_DEPLOYMENT_MODE && Boolean(baseTreeish);"),
            ("candidate_read_remote_tree", '["read-tree", baseTreeish]'),
            ("candidate_git_status", '["status", "--porcelain=v1", "-z", "--untracked-files=all"]'),
            ("candidate_write_tree", '["write-tree"]'),
        ]:
            if marker not in candidate:
                missing.append(marker_name)

    preview = get_block(
        text,
        "async function getAdvancedSyncPreview(",
        "\ntype GitMutationSnapshot =",
    )
    if not preview:
        missing.append("preview_function_block")
    else:
        clean_ok = (
            'const cleanSnapshotRequired = action !== "pull"' in preview
            and "(!remoteExists || atomicWorkspaceChanged)" in preview
        )
        if not clean_ok:
            missing.append("clean_snapshot_condition")
        plan_ok = (
            "expectedAction: \"clean_snapshot_and_push\" as const" in preview
            and "blockedReason: null" in preview
        )
        if not plan_ok:
            missing.append("clean_snapshot_plan")
        if "decideGitHubSyncPlan({" not in preview:
            missing.append("normal_sync_plan_fallback")

    return {
        "requested": str(path),
        "realpath": str(real),
        "sha256": sha256_bytes(data),
        "missing": sorted(set(missing)),
    }

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify TAS Developer Hub atomic Review/Push fix state without modifying files."
    )
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    results = []
    try:
        for raw in args.paths:
            path = pathlib.Path(raw)
            if not path.exists():
                raise RuntimeError(f"missing target: {path}")
            if not path.is_file():
                raise RuntimeError(f"target is not a file: {path}")
            results.append(validate_file(path))
    except Exception as exc:
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR={exc}")
        return 1

    any_missing = any(r["missing"] for r in results)
    if any_missing:
        print("PATCH_VALIDATION=FAIL")
        print("PATCH_STATE=INCOMPLETE")
        for i, result in enumerate(results, 1):
            print(f"TARGET_{i}={result['requested']}")
            print(f"REALPATH_{i}={result['realpath']}")
            print(f"SHA256_{i}={result['sha256']}")
            print(f"MISSING_{i}={','.join(result['missing']) if result['missing'] else 'NONE'}")
        print("ERROR=atomic Developer Hub fix is not fully present on every target")
        return 1

    print("PATCH_VALIDATION=PASS")
    print("PATCH_STATE=ALREADY_APPLIED")
    for i, result in enumerate(results, 1):
        print(f"TARGET_{i}={result['requested']}")
        print(f"REALPATH_{i}={result['realpath']}")
        print(f"SHA256_{i}={result['sha256']}")
        print(f"MISSING_{i}=NONE")
    print("ERROR=NONE")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
