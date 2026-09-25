#!/usr/bin/env python3
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: source-transform.py <source-root>")

root = Path(sys.argv[1]).resolve()
rel = "server/routes/developerHub.ts"
path = root / rel
if not path.is_file():
    raise RuntimeError("missing " + rel)

text = path.read_text(encoding="utf-8")

if "ATOMIC_FULL_SOURCE_SNAPSHOT_V1" in text:
    print("ATOMIC_CLEAN_SNAPSHOT_TRANSFORM=ALREADY_PRESENT")
    raise SystemExit(0)

start_anchor = "async function createWorkingTreeCandidateTree(\n"
end_anchor = "\nfunction parseGitTreeRecord(record: string) {"

start = text.find(start_anchor)
end = text.find(end_anchor, start)
if start < 0 or end < 0:
    raise RuntimeError("candidate tree function anchors not found")

replacement = r'''async function createWorkingTreeCandidateTree(
  env: NodeJS.ProcessEnv,
  _baseTreeish = "",
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tas-github-review-index-"));
  const indexPath = path.join(tempDir, "index");
  const reviewEnv: NodeJS.ProcessEnv = { ...env, GIT_INDEX_FILE: indexPath };

  // ATOMIC_FULL_SOURCE_SNAPSHOT_V1
  // Atomic deployment releases can have source already committed in a divergent
  // local history while GitHub still lacks those files. Building the candidate
  // from the remote tree plus only dirty entries silently drops such source.
  // Instead, atomic review always snapshots the complete allowlisted canonical
  // TAS source into a clean temporary index.
  const atomicFullSourceSnapshot = ATOMIC_DEPLOYMENT_MODE || ATOMIC_WORKSPACE_ISOLATION;

  try {
    const hasHead = await runGit(["rev-parse", "--verify", "HEAD"], reviewEnv)
      .then(() => true)
      .catch(() => false);

    if (atomicFullSourceSnapshot || !hasHead) {
      await runGit(["read-tree", "--empty"], reviewEnv);
    } else {
      await runGit(["read-tree", "HEAD"], reviewEnv);
    }

    let excluded: GitHubSourceExclusionSummary[] = [];
    let excludedPathCount = 0;

    if (atomicFullSourceSnapshot) {
      const sourceSnapshot = await collectGitHubSourceAllowlist(requireDeveloperHubWorkTreeRoot());
      excluded = sourceSnapshot.excluded;
      excludedPathCount = sourceSnapshot.excludedPathCount;

      for (let offset = 0; offset < sourceSnapshot.files.length; offset += 100) {
        await runGit(
          ["add", "-f", "--", ...sourceSnapshot.files.slice(offset, offset + 100)],
          reviewEnv,
        );
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
'''

patched = text[:start] + replacement + text[end:]
path.write_text(patched, encoding="utf-8")
print("ATOMIC_CLEAN_SNAPSHOT_TRANSFORM=PASS")
