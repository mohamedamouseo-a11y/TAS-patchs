from pathlib import Path
import hashlib
import shutil

ROOT = Path('/var/www/TAS-root')
CURRENT_LINK = ROOT / 'current'

if not CURRENT_LINK.exists():
    raise SystemExit('PATCH_FAIL:current_missing')

CURRENT = CURRENT_LINK.resolve()
if not CURRENT.exists():
    raise SystemExit('PATCH_FAIL:current_target_missing')

FILES = [
    'client/src/pages/LeadsList.tsx',
    'server/routers.ts',
    'server/db.ts',
]

CHECKS = {
    'client/src/pages/LeadsList.tsx': [
        'trpc.tas.vehicleBrands.list.useQuery',
        'vehicleBrandId',
        'autoAssign',
        'Vehicle Brand',
        'Automatic Distribution',
    ],
    'server/routers.ts': [
        'vehicleBrandId',
        'autoAssign',
        'assignLeadRoundRobin(input.campaignName, true)',
    ],
    'server/db.ts': [
        'assignLeadRoundRobin(campaignName: string, force = false)',
    ],
}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

for rel in FILES:
    src = ROOT / rel
    if not src.exists():
        raise SystemExit(f'PATCH_FAIL:source_missing:{rel}')
    text = src.read_text()
    missing = [token for token in CHECKS[rel] if token not in text]
    if missing:
        raise SystemExit(f"PATCH_FAIL:source_feature_missing:{rel}:{'|'.join(missing)}")

for rel in FILES:
    src = ROOT / rel
    dst = CURRENT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    if sha256(src) != sha256(dst):
        raise SystemExit(f'PATCH_FAIL:sync_hash_mismatch:{rel}')

print('PATCH_APPLIED=YES')
print(f'ACTIVE_RELEASE={CURRENT}')
print('FILES_SYNCED=' + ','.join(FILES))
print('SOURCE_FEATURES=PASS')
print('RUNTIME_SYNC=PASS')
