from pathlib import Path

MARKER = "TAS_DEVHUB_NOOP_ATOMIC_REVALIDATION_V1"
ROOT = Path("/var/www/TAS-root")
p = ROOT / "server/routes/developerHub.ts"

if not p.exists():
    raise SystemExit("PATCH_FAIL:missing_target")

text = p.read_text()
if MARKER in text:
    print("PATCH_APPLIED=YES")
    print("FILE=server/routes/developerHub.ts")
    raise SystemExit(0)

old = '''    if (preview.expectedAction === "noop") {\n      const noOpSnapshot = await createWorkingTreeCandidateTree(auth.env);\n      const noOpRemote = await readRemoteBranchHead(state.githubBranch, auth.env);\n      if (noOpSnapshot.treeSha !== preview.candidateTree || noOpRemote !== preview.remoteSha) {\n        throw new Error("The project or GitHub branch changed after review. Review again before continuing.");\n      }\n'''

new = '''    if (preview.expectedAction === "noop") {\n      // TAS_DEVHUB_NOOP_ATOMIC_REVALIDATION_V1\n      // Rebuild the no-op candidate using the same base-tree strategy used by review.\n      // In atomic deployment mode, review overlays reviewable workspace changes on\n      // origin/<branch>; revalidating without that base produces a different tree.\n      const noOpBaseTree = ATOMIC_DEPLOYMENT_MODE && preview.remoteSha\n        ? `origin/${state.githubBranch}`\n        : "";\n      const noOpSnapshot = await createWorkingTreeCandidateTree(auth.env, noOpBaseTree);\n      const noOpRemote = await readRemoteBranchHead(state.githubBranch, auth.env);\n      if (noOpSnapshot.treeSha !== preview.candidateTree || noOpRemote !== preview.remoteSha) {\n        throw new Error("The project or GitHub branch changed after review. Review again before continuing.");\n      }\n'''

if old not in text:
    raise SystemExit("PATCH_FAIL:noop_revalidation_block_not_found")

text = text.replace(old, new, 1)
p.write_text(text)
print("PATCH_APPLIED=YES")
print("FILE=server/routes/developerHub.ts")
