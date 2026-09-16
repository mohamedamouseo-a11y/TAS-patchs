#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
import shutil
import sys

WORKTREE_FUNCTION = r"""
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
    // In atomic deployments the running process lives in releases/<id>, but
    // Developer Hub reviews must read the canonical writable Git worktree.
    return repoDir;
  }
  throw new Error(
    `Developer Hub runtime/source mismatch: Git metadata is at ${repoDir}, but the active TAS source is ${runtimeDir}.`,
  );
}
""".strip()

CANDIDATE_FUNCTION = r"""
async function createWorkingTreeCandidateTree(
  env: NodeJS.ProcessEnv,
  baseTreeish = "",
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tas-github-review-index-"));
  const indexPath = path.join(tempDir, "index");
  const reviewEnv: NodeJS.ProcessEnv = { ...env, GIT_INDEX_FILE: indexPath };

  // Atomic deployment review is based on the reviewed remote tree, then
  // overlays ONLY the canonical worktree's current dirty paths. This prevents
  // stale local HEAD history from leaking into a Developer Hub Review/Push.
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
        const pathValue = String(entry.path || "").replace(/\\/g, "/");
        const originalValue = String(entry.originalPath || "").replace(/\\/g, "/");

        if (entry.status.includes("R") && originalValue && isReviewableGitHubSourceStatusPath(originalValue)) {
          removePaths.add(originalValue);
        }

        if (!pathValue || !isReviewableGitHubSourceStatusPath(pathValue)) continue;
        if (entry.status.includes("D")) removePaths.add(pathValue);
        else addPaths.add(pathValue);
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
    if (!/^[a-f0-9]{40,64}$/i.test(treeSha)) throw new Error("Unable to fingerprint the reviewed TAS content.");
    return { treeSha, excluded, excludedPathCount };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
""".strip()

def replace_once(text, pattern, replacement, label, flags=re.S):
    new, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, got {count}")
    return new

def patch_preview_function(text: str) -> str:
    start = text.find("async function getAdvancedSyncPreview(")
    if start < 0:
        raise RuntimeError("getAdvancedSyncPreview start not found")
    end = text.find("\ntype GitMutationSnapshot =", start)
    if end < 0:
        raise RuntimeError("getAdvancedSyncPreview end not found")
    block = text[start:end]

    marker = '    const remoteRef = `origin/${state.githubBranch}`;\n'
    if marker not in block:
        raise RuntimeError("remoteRef marker not found")
    if "const atomicReviewMode =" not in block:
        block = block.replace(
            marker,
            marker + "    const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;\n",
            1,
        )

    block = block.replace(
        "    if (remoteExists && !ATOMIC_WORKSPACE_ISOLATION) {",
        "    if (remoteExists && !atomicReviewMode) {",
        1,
    )
    block = block.replace(
        "    const historiesRelated = ATOMIC_WORKSPACE_ISOLATION\n",
        "    const historiesRelated = atomicReviewMode\n",
        1,
    )

    old_candidate = "    const candidateSnapshot = await createWorkingTreeCandidateTree(auth.env);\n"
    new_candidate = (
        "    const candidateSnapshot = await createWorkingTreeCandidateTree(\n"
        "      auth.env,\n"
        "      ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef : \"\",\n"
        "    );\n"
    )
    if old_candidate in block:
        block = block.replace(old_candidate, new_candidate, 1)
    elif new_candidate not in block:
        raise RuntimeError("candidate snapshot call not found")

    reps = [
        ("    const atomicCandidateCommit = ATOMIC_WORKSPACE_ISOLATION && !remoteExists\n",
         "    const atomicCandidateCommit = atomicReviewMode && !remoteExists\n"),
        ("    const workingChanges = ATOMIC_WORKSPACE_ISOLATION\n",
         "    const workingChanges = atomicReviewMode\n"),
        ("    const localCommitted = !ATOMIC_WORKSPACE_ISOLATION && remoteExists && localAhead > 0\n",
         "    const localCommitted = !atomicReviewMode && remoteExists && localAhead > 0\n"),
        ("    const remoteChanges = !ATOMIC_WORKSPACE_ISOLATION && remoteExists && remoteAhead > 0\n",
         "    const remoteChanges = !atomicReviewMode && remoteExists && remoteAhead > 0\n"),
        ("    const needsTwoWayMerge = !ATOMIC_WORKSPACE_ISOLATION\n",
         "    const needsTwoWayMerge = !atomicReviewMode\n"),
        ("    const atomicWorkspaceChanged = ATOMIC_WORKSPACE_ISOLATION\n",
         "    const atomicWorkspaceChanged = atomicReviewMode\n"),
        ("    const blocked = cleanSnapshotRequired && ATOMIC_WORKSPACE_ISOLATION\n",
         "    const blocked = cleanSnapshotRequired && atomicReviewMode\n"),
        ('    if (remoteExists && action !== "push" && (remoteAhead > 0 || ATOMIC_WORKSPACE_ISOLATION)) {\n',
         '    if (remoteExists && action !== "push" && (remoteAhead > 0 || atomicReviewMode)) {\n'),
        ("      if (!ATOMIC_WORKSPACE_ISOLATION) {\n",
         "      if (!atomicReviewMode) {\n"),
        ("    if (remoteExists && !ATOMIC_WORKSPACE_ISOLATION && !historiesRelated) {\n",
         "    if (remoteExists && !atomicReviewMode && !historiesRelated) {\n"),
        ('    if (!ATOMIC_WORKSPACE_ISOLATION && action !== "pull" && localAhead > 0) {\n',
         '    if (!atomicReviewMode && action !== "pull" && localAhead > 0) {\n'),
    ]
    for old, new in reps:
        if old in block:
            block = block.replace(old, new, 1)
        elif new not in block:
            raise RuntimeError(f"preview snippet missing: {old.strip()}")

    fp = "      atomicWorkspaceIsolation: ATOMIC_WORKSPACE_ISOLATION,\n"
    if "atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE" not in block:
        if fp not in block:
            raise RuntimeError("fingerprint marker not found")
        block = block.replace(
            fp,
            "      atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE,\n" + fp,
            1,
        )

    # Normalize any previous experimental cleanSnapshotRequired variant.
    block, count = re.subn(
        r'    const cleanSnapshotRequired = action !== "pull"\s*&&\s*\(\s*!remoteExists\s*\|\|\s*atomicWorkspaceChanged(?:\s*\|\|\s*\(ATOMIC_WORKSPACE_ISOLATION\s*&&\s*action\s*===\s*"push"\))?\s*\);',
        '    const cleanSnapshotRequired = action !== "pull"\n'
        '      && (!remoteExists || atomicWorkspaceChanged);',
        block,
        count=1,
        flags=re.S,
    )
    if count != 1 and 'const cleanSnapshotRequired = action !== "pull"\n      && (!remoteExists || atomicWorkspaceChanged);' not in block:
        raise RuntimeError("cleanSnapshotRequired block not normalized")

    return text[:start] + block + text[end:]

def patch_source(text: str) -> str:
    original = text

    text = replace_once(
        text,
        r'function resolveDeveloperHubWorkTreeRoot\(repoDir: string\) \{.*?\n\}\n\n/\*\* Dynamically resolve the worktree',
        WORKTREE_FUNCTION + "\n\n/** Dynamically resolve the worktree",
        "resolveDeveloperHubWorkTreeRoot",
    )

    # Remove any broken duplicate atomic deployment declarations from failed attempts.
    text = re.sub(
        r'const ATOMIC_DEPLOYMENT_MODE = Boolean\(.*?\n\);\n',
        '',
        text,
        flags=re.S,
    )

    m = re.search(
        r'const ATOMIC_WORKSPACE_ISOLATION = Boolean\(\n.*?\n\);\n',
        text,
        flags=re.S,
    )
    if not m:
        raise RuntimeError("ATOMIC_WORKSPACE_ISOLATION block not found")
    atomic_deploy = (
        "const ATOMIC_DEPLOYMENT_MODE = Boolean(\n"
        "  REPO_RESOLUTION.repoDir\n"
        "  && hasAtomicDeveloperHubDeploymentMarkers(REPO_RESOLUTION.repoDir),\n"
        ");\n"
    )
    text = text[:m.start()] + atomic_deploy + m.group(0) + text[m.end():]

    text = replace_once(
        text,
        r'async function createWorkingTreeCandidateTree\(.*?\n\}\n\nfunction parseGitTreeRecord',
        CANDIDATE_FUNCTION + "\n\nfunction parseGitTreeRecord",
        "createWorkingTreeCandidateTree",
    )

    text = patch_preview_function(text)

    if text.count("const ATOMIC_DEPLOYMENT_MODE =") != 1:
        raise RuntimeError("ATOMIC_DEPLOYMENT_MODE count != 1")
    if text.count("async function createWorkingTreeCandidateTree(") != 1:
        raise RuntimeError("candidate function count != 1")
    if text.count("function resolveDeveloperHubWorkTreeRoot(") != 1:
        raise RuntimeError("worktree resolver count != 1")

    required = [
        "ATOMIC_DEPLOYMENT_MODE && remoteExists ? remoteRef",
        "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;",
        "atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE",
        '["read-tree", baseTreeish]',
        '["status", "--porcelain=v1", "-z", "--untracked-files=all"]',
    ]
    for token in required:
        if token not in text:
            raise RuntimeError(f"missing validation token: {token}")

    if text == original:
        raise RuntimeError("patch produced no changes")
    return text

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("paths", nargs="+")
    args = p.parse_args()
    stamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    patched = []
    try:
        for raw in args.paths:
            path = pathlib.Path(raw).resolve()
            if not path.is_file():
                raise RuntimeError(f"not a file: {path}")
            updated = patch_source(path.read_text(encoding="utf-8"))
            backup = path.with_name(path.name + f".before-atomic-review-fix.{stamp}")
            shutil.copy2(path, backup)
            tmp = path.with_name(path.name + f".tmp.{stamp}")
            tmp.write_text(updated, encoding="utf-8")
            tmp.replace(path)
            patched.append((path, backup))
            print(f"PATCHED={path}")
            print(f"BACKUP={backup}")

        print("PATCH_VALIDATION=PASS")
        print("PUSHED=NO")
        return 0
    except Exception as exc:
        print(f"ERROR={exc}", file=sys.stderr)
        for path, backup in reversed(patched):
            try:
                shutil.copy2(backup, path)
                print(f"RESTORED={path}", file=sys.stderr)
            except Exception as restore_exc:
                print(f"RESTORE_ERROR={path}:{restore_exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
