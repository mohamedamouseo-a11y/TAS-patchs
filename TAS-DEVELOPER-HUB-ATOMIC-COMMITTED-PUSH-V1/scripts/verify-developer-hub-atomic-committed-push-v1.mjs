#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const routePath = path.join(root, "server/routes/developerHub.ts");
const syncPath = path.join(root, "server/services/developerHubGitHubAdvancedSync.ts");
const testPath = path.join(root, "server/services/developerHubGitHubAdvancedSync.test.ts");

const failures = [];
function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing file: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}
function requireMatch(label, text, re) {
  if (!re.test(text)) failures.push(label);
}
function forbidMatch(label, text, re) {
  if (re.test(text)) failures.push(label);
}

const route = read(routePath);
const sync = read(syncPath);
const test = read(testPath);

requireMatch("route must import/use decideAtomicCommittedHead", route, /decideAtomicCommittedHead/);
requireMatch("route must calculate HEAD tree", route, /HEAD\^\{tree\}/);
requireMatch("route must expose push_local_head mode", route, /push_local_head/);
requireMatch("route must compare active candidate paths with local HEAD", route, /activeCandidateCompatibleWithLocalHead/);
requireMatch("route must include local committed diff in atomic mode", route, /const localCommitted\s*=\s*remoteExists\s*&&\s*localAhead\s*>\s*0/);
requireMatch("route must suppress active working changes for committed-head push", route, /atomicCommittedHead\.mode\s*===\s*["']push_local_head["'][\s\S]{0,80}\?\s*\[\]/);
requireMatch("route must suppress clean snapshot for committed-head push", route, /atomicWorkspaceChanged[\s\S]{0,180}atomicCommittedHead\.mode\s*!==\s*["']push_local_head["']/);
requireMatch("route must retain local commit history secret scan", route, /action\s*!==\s*["']pull["']\s*&&\s*localAhead\s*>\s*0[\s\S]{0,120}scanLocalCommitHistory/);
requireMatch("route must block atomic source divergence", route, /Developer Hub source/);
forbidMatch("ahead/behind must not be disabled by atomic isolation", route, /if\s*\(remoteExists\s*&&\s*!ATOMIC_WORKSPACE_ISOLATION\)\s*\{[\s\S]{0,180}rev-list/);
forbidMatch("localCommitted must not be disabled by atomic isolation", route, /const localCommitted\s*=\s*!ATOMIC_WORKSPACE_ISOLATION/);
forbidMatch("unrelated histories must not be ignored in atomic mode", route, /remoteExists\s*&&\s*!ATOMIC_WORKSPACE_ISOLATION\s*&&\s*!historiesRelated/);

requireMatch("sync helper must export decideAtomicCommittedHead", sync, /export function decideAtomicCommittedHead/);
requireMatch("sync helper must support push_local_head", sync, /push_local_head/);
requireMatch("sync helper must fail closed on dual source divergence", sync, /DUAL_SOURCE_DIVERGENCE/);
requireMatch("sync helper must block atomic both-ahead state", sync, /remoteAhead\s*>\s*0/);

requireMatch("test must cover compatible atomic committed head", test, /compatible/);
requireMatch("test must cover both-ahead block", test, /both-ahead/);
requireMatch("test must cover dual-source divergence", test, /DUAL_SOURCE_DIVERGENCE/);
requireMatch("test must verify existing push planner", test, /expectedAction\)\.toBe\(["']push["']\)/);

if (failures.length) {
  console.error("DEVELOPER_HUB_ATOMIC_COMMITTED_PUSH_VERIFY=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DEVELOPER_HUB_ATOMIC_COMMITTED_PUSH_VERIFY=PASS");
