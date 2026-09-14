Use `TAS-IN-APP-NOTIFICATIONS-MIGRATION-V1` from `TAS-patchs`.

Apply `in-app-notifications-migration.patch` to a clean TAS worktree based on `928a88d54e6370dc2ecc1f862f2592acf03b91d7`.

Then:
- `pnpm build`
- test migration on disposable MySQL with table missing
- test again with table already present
- confirm only `drizzle/0023_in_app_notifications.sql` and `drizzle/meta/_journal.json` changed

Do not touch production. Do not push. I will push manually from the system.

Return:
PATCH_APPLIED=
BUILD=
FRESH_DB_MIGRATION=
EXISTING_TABLE_MIGRATION=
CHANGED_FILES=
ERROR=
