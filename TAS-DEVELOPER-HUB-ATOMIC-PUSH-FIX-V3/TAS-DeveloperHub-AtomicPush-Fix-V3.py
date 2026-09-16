#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
import shutil
import sys

WORKTREE_FUNCTION = r'''
function resolveDeveloperHubWorkTreeRoot(repoDir: string) {
  const runtimeDir = canonicalDirectory(process.cwd());
  if (!runtimeDir || !hasSourceProjectMarkers(runtimeDir)) return repoDir;
  if (runtimeDir === repoDir) return repoDir;

  const releasesDir = canonicalDirectory(path.join(repoDir, "releases"));
  const currentTarget = canonicalDirectory(path.join(repoDir, "current"));
  if (
    releasesDir
    && currentTarget === runtimeDir
    && path.dirname(runtimeDir) === releasesDir
  ) {
    // Runtime is an atomic release, but Developer Hub reviews the canonical
    // writable Git worktree at repoDir.
    return repoDir;
  }
  throw new Error(
    `Developer Hub runtime/source mismatch: Git metadata is at ${repoDir}, but the active TAS source is ${runtimeDir}.`,
  );
}
'''.strip()

CANDIDATE_FUNCTION = r'''
async function createWorkingTreeCandidateTree(
  env: NodeJS.ProcessEnv,
  baseTreeish = "",
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tas-github-review-index-"));
  const indexPath = path.join(tempDir, "index");
  const reviewEnv: NodeJS.ProcessEnv = { ...env, GIT_INDEX_FILE: indexPath };

  const atomicRemoteOverlay = ATOMIC_DEPLOYMENT_MODE && Boolean(baseTreeish);
  const dirtyEntries = atomicRemoteOverlay
    ? await runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], env)
      .then(({ stdout }) => parseGitStatusPorcelainZ(stdout))
      .then((entries) => entries.filter(isReviewableGitHubSourceStatusEntry))
    : [];

  try {
    const hasHead = await runGit(["rev-parse", "--verify", "HEAD"], reviewEnv)
      .then(() => true)
      .catch(() => false);

    if (atomicRemoteOverlay) {
      await runGit(["read-tree", baseTreeish], reviewEnv);
    } else {
      await runGit(ATOMIC_WORKSPACE_ISOLATION || !hasHead
        ? ["read-tree", "--empty"]
        : ["read-tree", "HEAD"], reviewEnv);
    }

    let excluded: GitHubSourceExclusionSummary[] = [];
    let excludedPathCount = 0;

    if (atomicRemoteOverlay) {
      const removePaths = new Set<string>();
      const addPaths = new Set<string>();

      for (const entry of dirtyEntries) {
        const nextPath = String(entry.path || "").replace(/\\/g, "/");
        const oldPath = String(entry.originalPath || "").replace(/\\/g, "/");

        if ((entry.status.includes("R") || entry.status.includes("C"))
          && oldPath
          && isReviewableGitHubSourceStatusPath(oldPath)) {
          removePaths.add(oldPath);
        }

        if (!nextPath || !isReviewableGitHubSourceStatusPath(nextPath)) continue;
        if (entry.status.includes("D")) removePaths.add(nextPath);
        else addPaths.add(nextPath);
      }

      const removeList = Array.from(removePaths).sort();
      const addList = Array.from(addPaths).sort();

      for (let offset = 0; offset < removeList.length; offset += 100) {
        await runGit(
          ["update-index", "--force-remove", "--", ...removeList.slice(offset, offset + 100)],
          reviewEnv,
        );
      }
      for (let offset = 0; offset < addList.length; offset += 100) {
        await runGit(["add", "-f", "--", ...addList.slice(offset, offset + 100)], reviewEnv);
      }
    } else if (ATOMIC_WORKSPACE_ISOLATION) {
      const sourceSnapshot = await collectGitHubSourceAllowlist(requireDeveloperHubWorkTreeRoot());
      excluded = sourceSnapshot.excluded;
      excludedPathCount = sourceSnapshot.excludedPathCount;
      for (let offset = 0; offset < sourceSnapshot.files.length; offset += 100) {
        await runGit(["add", "-f", "--", ...sourceSnapshot.files.slice(offset, offset + 100)], reviewEnv);
      }
    } else {
      await runGit(["add", "-A", "--", "."], reviewEnv);
      const indexedPaths = await runGit(["ls-files", "-z", "--cached"], reviewEnv)
        .then(({ stdout }) => stdout.split("\0").filter(Boolean));
      const removablePaths = indexedPaths.filter((filePath) => Boolean(getBlockedGitPathReason(filePath)));
      for (let offset = 0; offset < removablePaths.length; offset += 100) {
        await runGit(
          ["update-index", "--force-remove", "--", ...removablePaths.slice(offset, offset + 100)],
          reviewEnv,
        );
      }
    }

    const treeSha = await runGit(["write-tree"], reviewEnv).then(({ stdout }) => stdout.trim());
    if (!/^[a-f0-9]{40,64}$/i.test(treeSha)) {
      throw new Error("Unable to fingerprint the reviewed TAS content.");
    }
    return { treeSha, excluded, excludedPathCount };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
'''.strip()


def replace_function(text: str, start_signature: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_signature)
    if start < 0:
        raise RuntimeError(f"{label}: start not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    return text[:start] + replacement + text[end:]


def patch_preview(text: str) -> str:
    start_sig = "async function getAdvancedSyncPreview("
    end_marker = "\ntype GitMutationSnapshot ="
    start = text.find(start_sig)
    end = text.find(end_marker, start)
    if start < 0 or end < 0:
        raise RuntimeError("getAdvancedSyncPreview boundaries not found")

    block = text[start:end]

    remote_ref_pat = r'(\n\s*const remoteRef = `origin/\$\{state\.githubBranch\}`;\n)'
    if "const atomicReviewMode =" not in block:
        block, n = re.subn(
            remote_ref_pat,
            r'\1    const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;\n',
            block,
            count=1,
        )
        if n != 1:
            raise RuntimeError("getAdvancedSyncPreview: remoteRef anchor not found")
    else:
        block = re.sub(
            r'const atomicReviewMode\s*=\s*[^;]+;',
            'const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;',
            block,
            count=1,
        )

    sentinel = "__KEEP_ATOMIC_WORKSPACE_ISOLATION__"
    definition = "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;"
    block = block.replace(definition, definition.replace("ATOMIC_WORKSPACE_ISOLATION", sentinel), 1)
    block = block.replace("ATOMIC_WORKSPACE_ISOLATION", "atomicReviewMode")
    block = block.replace(sentinel, "ATOMIC_WORKSPACE_ISOLATION", 1)

    candidate_pat = re.compile(
        r'    const candidateSnapshot = await createWorkingTreeCandidateTree\(\s*auth\.env(?:\s*,\s*[^)]*)?\s*\);\n',
        re.S,
    )
    candidate_repl = (
        '    const candidateSnapshot = await createWorkingTreeCandidateTree(\n'
        '      auth.env,\n'
        '      ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef : "",\n'
        '    );\n'
    )
    block, n = candidate_pat.subn(candidate_repl, block, count=1)
    if n != 1:
        raise RuntimeError("getAdvancedSyncPreview: candidateSnapshot call not found")

    clean_pat = re.compile(
        r'    const cleanSnapshotRequired\s*=\s*action\s*!==\s*"pull".*?;\n',
        re.S,
    )
    clean_repl = (
        '    const cleanSnapshotRequired = action !== "pull"\n'
        '      && (!remoteExists || atomicWorkspaceChanged);\n'
    )
    block, n = clean_pat.subn(clean_repl, block, count=1)
    if n != 1:
        raise RuntimeError("getAdvancedSyncPreview: cleanSnapshotRequired declaration not found")

    if "atomicDeploymentMode:" not in block:
        fp_pat = re.compile(r'(\n\s*atomicWorkspaceIsolation:\s*[^,]+,\n)')
        block, n = fp_pat.subn(
            '\n      atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE,\\1',
            block,
            count=1,
        )
        if n != 1:
            raise RuntimeError("getAdvancedSyncPreview: fingerprint atomicWorkspaceIsolation field not found")

    required = [
        "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;",
        "ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef",
        "const workingChanges = atomicReviewMode",
        "const localCommitted = !atomicReviewMode",
        "const remoteChanges = !atomicReviewMode",
        "const needsTwoWayMerge = !atomicReviewMode",
        "const atomicWorkspaceChanged = atomicReviewMode",
        "atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE",
        'const cleanSnapshotRequired = action !== "pull"',
    ]
    missing = [token for token in required if token not in block]
    if missing:
        raise RuntimeError("getAdvancedSyncPreview semantic validation missing: " + " | ".join(missing))

    return text[:start] + block + text[end:]


def patch_source(text: str) -> str:
    original = text

    text = replace_function(
        text,
        "function resolveDeveloperHubWorkTreeRoot(repoDir: string) {",
        "\n\n/** Dynamically resolve the worktree",
        WORKTREE_FUNCTION,
        "resolveDeveloperHubWorkTreeRoot",
    )

    text = re.sub(
        r'const ATOMIC_DEPLOYMENT_MODE\s*=\s*Boolean\(.*?\n\);\n',
        '',
        text,
        flags=re.S,
    )
    anchor = "const ATOMIC_WORKSPACE_ISOLATION = Boolean("
    idx = text.find(anchor)
    if idx < 0:
        raise RuntimeError("ATOMIC_WORKSPACE_ISOLATION anchor not found")
    deploy_decl = (
        "const ATOMIC_DEPLOYMENT_MODE = Boolean(\n"
        "  REPO_RESOLUTION.repoDir\n"
        "  && hasAtomicDeveloperHubDeploymentMarkers(REPO_RESOLUTION.repoDir),\n"
        ");\n"
    )
    text = text[:idx] + deploy_decl + text[idx:]

    text = replace_function(
        text,
        "async function createWorkingTreeCandidateTree(",
        "\n\nfunction parseGitTreeRecord",
        CANDIDATE_FUNCTION,
        "createWorkingTreeCandidateTree",
    )

    text = patch_preview(text)

    if text.count("const ATOMIC_DEPLOYMENT_MODE =") != 1:
        raise RuntimeError("ATOMIC_DEPLOYMENT_MODE declaration count is not 1")
    if text.count("async function createWorkingTreeCandidateTree(") != 1:
        raise RuntimeError("candidate function count is not 1")
    if text.count("function resolveDeveloperHubWorkTreeRoot(") != 1:
        raise RuntimeError("worktree resolver count is not 1")
    if text == original:
        raise RuntimeError("patch produced no changes")
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    prepared: list[tuple[pathlib.Path, str]] = []

    try:
        for raw in args.paths:
            path = pathlib.Path(raw).resolve()
            if not path.is_file():
                raise RuntimeError(f"not a file: {path}")
            prepared.append((path, patch_source(path.read_text(encoding="utf-8"))))
    except Exception as exc:
        print("PATCH_VALIDATION=FAIL")
        print(f"ERROR={exc}")
        return 1

    backups: list[tuple[pathlib.Path, pathlib.Path]] = []
    try:
        for path, updated in prepared:
            backup = path.with_name(path.name + f".before-atomic-push-fix-v3.{stamp}")
            shutil.copy2(path, backup)
            backups.append((path, backup))
            tmp = path.with_name(path.name + f".tmp.atomic-push-fix-v3.{stamp}")
            tmp.write_text(updated, encoding="utf-8")
            tmp.replace(path)
            print(f"PATCHED={path}")
            print(f"BACKUP={backup}")
        print("PATCH_VALIDATION=PASS")
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
