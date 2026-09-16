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
    // Runtime is an atomic release, but Developer Hub reviews/pushes must read
    // the canonical writable Git worktree where current edits actually live.
    return repoDir;
  }
  throw new Error(
    `Developer Hub runtime/source mismatch: Git metadata is at ${repoDir}, but the active TAS source is ${runtimeDir}.`,
  );
}
'''.strip()

ATOMIC_HELPER = r'''
async function createAtomicRemoteOverlayCandidateTree(
  env: NodeJS.ProcessEnv,
  remoteRef: string,
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tas-github-atomic-review-index-"));
  const indexPath = path.join(tempDir, "index");
  const reviewEnv: NodeJS.ProcessEnv = { ...env, GIT_INDEX_FILE: indexPath };
  try {
    // Start from the reviewed GitHub branch tree, never stale local HEAD.
    await runGit(["read-tree", remoteRef], reviewEnv);

    // Overlay only current reviewable dirty paths from the canonical worktree.
    const dirtyEntries = await runGit(
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      env,
    )
      .then(({ stdout }) => parseGitStatusPorcelainZ(stdout))
      .then((entries) => entries.filter(isReviewableGitHubSourceStatusEntry));

    const removePaths = new Set<string>();
    const addPaths = new Set<string>();

    for (const entry of dirtyEntries) {
      const filePath = String(entry.path || "").replace(/\\/g, "/");
      const originalPath = String(entry.originalPath || "").replace(/\\/g, "/");

      if (
        entry.status.includes("R")
        && originalPath
        && isReviewableGitHubSourceStatusPath(originalPath)
      ) {
        removePaths.add(originalPath);
      }

      if (!filePath || !isReviewableGitHubSourceStatusPath(filePath)) continue;
      if (entry.status.includes("D")) removePaths.add(filePath);
      else addPaths.add(filePath);
    }

    const removals = Array.from(removePaths).sort();
    const additions = Array.from(addPaths).sort();

    for (let offset = 0; offset < removals.length; offset += 100) {
      await runGit(
        ["update-index", "--force-remove", "--", ...removals.slice(offset, offset + 100)],
        reviewEnv,
      );
    }
    for (let offset = 0; offset < additions.length; offset += 100) {
      await runGit(["add", "-f", "--", ...additions.slice(offset, offset + 100)], reviewEnv);
    }

    const treeSha = await runGit(["write-tree"], reviewEnv)
      .then(({ stdout }) => stdout.trim());
    if (!/^[a-f0-9]{40,64}$/i.test(treeSha)) {
      throw new Error("Unable to fingerprint the atomic reviewed TAS content.");
    }
    return { treeSha, excluded: [] as GitHubSourceExclusionSummary[], excludedPathCount: 0 };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
'''.strip()


def replace_region(text: str, start_token: str, end_token: str, replacement: str, label: str) -> str:
    start = text.find(start_token)
    if start < 0:
        raise RuntimeError(f"{label}: start token not found")
    end = text.find(end_token, start)
    if end < 0:
        raise RuntimeError(f"{label}: end token not found")
    return text[:start] + replacement + "\n\n" + text[end:]


def ensure_atomic_constant(text: str) -> str:
    # Remove any prior/partial V1/V2 declaration(s) safely.
    while True:
        start = text.find("const ATOMIC_DEPLOYMENT_MODE =")
        if start < 0:
            break
        end = text.find(");\n", start)
        if end < 0:
            raise RuntimeError("unterminated ATOMIC_DEPLOYMENT_MODE declaration")
        text = text[:start] + text[end + 3:]

    marker = "const ATOMIC_WORKSPACE_ISOLATION = Boolean("
    pos = text.find(marker)
    if pos < 0:
        raise RuntimeError("ATOMIC_WORKSPACE_ISOLATION declaration not found")
    declaration = (
        "const ATOMIC_DEPLOYMENT_MODE = Boolean(\n"
        "  REPO_RESOLUTION.repoDir\n"
        "  && hasAtomicDeveloperHubDeploymentMarkers(REPO_RESOLUTION.repoDir),\n"
        ");\n\n"
    )
    return text[:pos] + declaration + text[pos:]


def ensure_atomic_helper(text: str) -> str:
    helper_start = text.find("async function createAtomicRemoteOverlayCandidateTree(")
    parse_marker = "function parseGitTreeRecord(record: string) {"
    parse_pos = text.find(parse_marker)
    if parse_pos < 0:
        raise RuntimeError("parseGitTreeRecord marker not found")

    if helper_start >= 0:
        if helper_start > parse_pos:
            raise RuntimeError("atomic helper appears after parseGitTreeRecord")
        text = text[:helper_start] + ATOMIC_HELPER + "\n\n" + text[parse_pos:]
    else:
        text = text[:parse_pos] + ATOMIC_HELPER + "\n\n" + text[parse_pos:]
    return text


def replace_if_old(block: str, old: str, new: str, label: str) -> str:
    if new in block:
        return block
    if old not in block:
        raise RuntimeError(f"preview patch missing: {label}")
    return block.replace(old, new, 1)


def patch_preview(text: str) -> str:
    start = text.find("async function getAdvancedSyncPreview(")
    if start < 0:
        raise RuntimeError("getAdvancedSyncPreview start not found")
    end = text.find("\ntype GitMutationSnapshot =", start)
    if end < 0:
        raise RuntimeError("getAdvancedSyncPreview end not found")
    block = text[start:end]

    remote_marker = '    const remoteRef = `origin/${state.githubBranch}`;\n'
    atomic_line = "    const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;\n"
    if atomic_line not in block:
        if remote_marker not in block:
            raise RuntimeError("remoteRef marker not found")
        block = block.replace(remote_marker, remote_marker + atomic_line, 1)

    block = replace_if_old(
        block,
        "    if (remoteExists && !ATOMIC_WORKSPACE_ISOLATION) {",
        "    if (remoteExists && !atomicReviewMode) {",
        "localAhead/remoteAhead guard",
    )
    block = replace_if_old(
        block,
        "    const historiesRelated = ATOMIC_WORKSPACE_ISOLATION\n",
        "    const historiesRelated = atomicReviewMode\n",
        "historiesRelated",
    )

    # Replace the whole candidateSnapshot statement, accepting baseline or prior attempts.
    cand_start = block.find("    const candidateSnapshot =")
    cand_end = block.find("    const candidateTree =", cand_start)
    if cand_start < 0 or cand_end < 0:
        raise RuntimeError("candidateSnapshot statement not found")
    candidate_statement = (
        "    const candidateSnapshot = ATOMIC_DEPLOYMENT_MODE && remoteExists\n"
        "      ? await createAtomicRemoteOverlayCandidateTree(auth.env, remoteRef)\n"
        "      : await createWorkingTreeCandidateTree(auth.env);\n"
    )
    block = block[:cand_start] + candidate_statement + block[cand_end:]

    replacements = [
        ("    const atomicCandidateCommit = ATOMIC_WORKSPACE_ISOLATION && !remoteExists\n",
         "    const atomicCandidateCommit = atomicReviewMode && !remoteExists\n",
         "atomicCandidateCommit"),
        ("    const workingChanges = ATOMIC_WORKSPACE_ISOLATION\n",
         "    const workingChanges = atomicReviewMode\n",
         "workingChanges"),
        ("    const localCommitted = !ATOMIC_WORKSPACE_ISOLATION && remoteExists && localAhead > 0\n",
         "    const localCommitted = !atomicReviewMode && remoteExists && localAhead > 0\n",
         "localCommitted"),
        ("    const remoteChanges = !ATOMIC_WORKSPACE_ISOLATION && remoteExists && remoteAhead > 0\n",
         "    const remoteChanges = !atomicReviewMode && remoteExists && remoteAhead > 0\n",
         "remoteChanges"),
        ("    const needsTwoWayMerge = !ATOMIC_WORKSPACE_ISOLATION\n",
         "    const needsTwoWayMerge = !atomicReviewMode\n",
         "needsTwoWayMerge"),
        ("    const atomicWorkspaceChanged = ATOMIC_WORKSPACE_ISOLATION\n",
         "    const atomicWorkspaceChanged = atomicReviewMode\n",
         "atomicWorkspaceChanged"),
        ("    const blocked = cleanSnapshotRequired && ATOMIC_WORKSPACE_ISOLATION\n",
         "    const blocked = cleanSnapshotRequired && atomicReviewMode\n",
         "blocked scan"),
        ('    if (remoteExists && action !== "push" && (remoteAhead > 0 || ATOMIC_WORKSPACE_ISOLATION)) {\n',
         '    if (remoteExists && action !== "push" && (remoteAhead > 0 || atomicReviewMode)) {\n',
         "remote scan"),
        ("      if (!ATOMIC_WORKSPACE_ISOLATION) {\n",
         "      if (!atomicReviewMode) {\n",
         "remote history scan"),
        ("    if (remoteExists && !ATOMIC_WORKSPACE_ISOLATION && !historiesRelated) {\n",
         "    if (remoteExists && !atomicReviewMode && !historiesRelated) {\n",
         "unrelated history guard"),
        ('    if (!ATOMIC_WORKSPACE_ISOLATION && action !== "pull" && localAhead > 0) {\n',
         '    if (!atomicReviewMode && action !== "pull" && localAhead > 0) {\n',
         "local history scan"),
    ]
    for old, new, label in replacements:
        block = replace_if_old(block, old, new, label)

    # Keep cleanSnapshotRequired as whatever validated baseline currently uses.
    # atomicWorkspaceChanged now uses atomicReviewMode, so an atomic dirty candidate
    # automatically selects clean_snapshot_and_push without remoteAhead blocking.
    if "const cleanSnapshotRequired" not in block:
        raise RuntimeError("cleanSnapshotRequired declaration missing")

    fp = "      atomicWorkspaceIsolation: ATOMIC_WORKSPACE_ISOLATION,\n"
    dep = "      atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE,\n"
    if dep not in block:
        if fp not in block:
            raise RuntimeError("fingerprint atomicWorkspaceIsolation marker not found")
        block = block.replace(fp, dep + fp, 1)

    return text[:start] + block + text[end:]


def patch_source(text: str) -> str:
    original = text

    text = replace_region(
        text,
        "function resolveDeveloperHubWorkTreeRoot(repoDir: string) {",
        "/** Dynamically resolve the worktree",
        WORKTREE_FUNCTION,
        "worktree resolver",
    )
    text = ensure_atomic_constant(text)
    text = ensure_atomic_helper(text)
    text = patch_preview(text)

    validations = {
        "atomic constant count": text.count("const ATOMIC_DEPLOYMENT_MODE =") == 1,
        "atomic helper count": text.count("async function createAtomicRemoteOverlayCandidateTree(") == 1,
        "worktree resolver count": text.count("function resolveDeveloperHubWorkTreeRoot(") == 1,
        "atomic review mode": "const atomicReviewMode = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;" in text,
        "remote base read-tree": '["read-tree", remoteRef]' in text,
        "dirty overlay status": '["status", "--porcelain=v1", "-z", "--untracked-files=all"]' in text,
        "remote candidate helper": "createAtomicRemoteOverlayCandidateTree(auth.env, remoteRef)" in text,
        "fingerprint mode": "atomicDeploymentMode: ATOMIC_DEPLOYMENT_MODE" in text,
        "canonical atomic worktree": "return repoDir;" in WORKTREE_FUNCTION,
    }
    failed = [name for name, ok in validations.items() if not ok]
    if failed:
        raise RuntimeError("validation failed: " + ", ".join(failed))
    if text == original:
        raise RuntimeError("patch produced no changes")
    return text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    patched: list[tuple[pathlib.Path, pathlib.Path]] = []

    try:
        # Build all outputs in memory first: no target is touched unless every target validates.
        prepared: list[tuple[pathlib.Path, str]] = []
        for raw in args.paths:
            path = pathlib.Path(raw).resolve()
            if not path.is_file():
                raise RuntimeError(f"not a file: {path}")
            source = path.read_text(encoding="utf-8")
            prepared.append((path, patch_source(source)))

        for path, updated in prepared:
            backup = path.with_name(path.name + f".before-atomic-push-fix-v2.{stamp}")
            shutil.copy2(path, backup)
            tmp = path.with_name(path.name + f".tmp.atomic-v2.{stamp}")
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
