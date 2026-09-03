#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const sourceCommit = process.argv[3] || 'c05ddf47a95e8f9d231b74d7eab35c3f98395fc1';
if (!root) {
  console.error('Usage: node verify-whatsapp-accounts-ui-rename-sync-v1.mjs <tas-worktree> [source-commit]');
  process.exit(2);
}

const run = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`VERIFY_FAIL=${msg}`); process.exit(1); };

try { run('cat-file', '-e', `${sourceCommit}^{commit}`); } catch { fail('SOURCE_COMMIT_MISSING'); }

try { run('fetch', 'origin', '--prune'); } catch { fail('FETCH_ORIGIN_FAILED'); }

const allowed = [
  'client/src/pages/wa/WAGatewayAccounts.tsx',
  'server/routers.ts',
  'server/services/waGatewayIntegrationService.ts',
].sort();

const names = run('diff', '--name-only', 'origin/master', sourceCommit).split('\n').filter(Boolean).sort();
if (JSON.stringify(names) !== JSON.stringify(allowed)) {
  console.error(`FOUND_FILES=${names.join(',')}`);
  fail('UNEXPECTED_DIFF_FILES');
}

const ui = readFileSync(join(root, 'client/src/pages/wa/WAGatewayAccounts.tsx'), 'utf8');
const router = readFileSync(join(root, 'server/routers.ts'), 'utf8');
const service = readFileSync(join(root, 'server/services/waGatewayIntegrationService.ts'), 'utf8');

const requiredUi = ['renameAccount', 'sm:grid-cols-2', 'whitespace-nowrap'];
for (const marker of requiredUi) if (!ui.includes(marker)) fail(`UI_MARKER_MISSING:${marker}`);
if (!/Pencil|PenLine|Edit(?:2|3)?/.test(ui)) fail('RENAME_ICON_MISSING');
if (!router.includes('renameAccount')) fail('ROUTER_RENAME_MUTATION_MISSING');
if (!router.includes('renameWAGatewayAccount')) fail('ROUTER_SERVICE_IMPORT_MISSING');
if (!service.includes('renameWAGatewayAccount')) fail('SERVICE_RENAME_FUNCTION_MISSING');
if (!service.includes('whatsappSessions.name')) fail('DISPLAY_NAME_UPDATE_MISSING');

console.log(`SOURCE_COMMIT=${sourceCommit}`);
console.log(`REMOTE_MASTER=${run('rev-parse', 'origin/master')}`);
console.log(`PATCH_FILES=${allowed.join(',')}`);
console.log('WHATSAPP_ACCOUNTS_UI_RENAME_SYNC_VERIFY=PASS');
