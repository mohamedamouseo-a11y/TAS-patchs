# TAS Service Types Settings UI V1.1

Cache-safe retry of V1 after manual UAT exposed an empty Service Type dropdown.

V1.1 uses a new raw GitHub path so OpenHands cannot receive the stale V1 transformer that expected only one service-route anchor.

The transformer explicitly requires and patches both mirrored service routers:
- tas.service
- automotive.service

No schema migration, no seeds, no booking mutations, no commit/push/stash/reset.

Expected success ends with:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
DEPLOY=PASS
SERVICE_TYPES_SETTINGS_UI=ACTIVE
SERVICE_TYPES_ADMIN_LIST=ACTIVE
SERVICE_TYPES_UPDATE=ACTIVE
OPERATIONAL_LIST_ACTIVE_ONLY=PRESERVED
DB_SCHEMA_CHANGE=NONE
SOURCE_DATA_SEED=NONE
PHASE1_TO_12=PRESERVED
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
