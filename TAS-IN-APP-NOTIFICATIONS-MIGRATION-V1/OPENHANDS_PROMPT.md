You are connected to the TAS project server.

Patch source is the GitHub repo `mohamedamouseo-a11y/TAS-patchs`:
`TAS-IN-APP-NOTIFICATIONS-MIGRATION-V1/in-app-notifications-migration.patch`

Do not search `/tmp` for the patch. Fetch that exact file from the patch repo, then apply it to a clean TAS worktree based on `928a88d54e6370dc2ecc1f862f2592acf03b91d7`.

Then run:
- `pnpm build`
- disposable MySQL test with table missing
- disposable MySQL test with table already present

Only these TAS files may change:
- `drizzle/0023_in_app_notifications.sql`
- `drizzle/meta/_journal.json`

Do not touch production and do not push. Push is manual from the system.

Return:
PATCH_APPLIED=
BUILD=
FRESH_DB_MIGRATION=
EXISTING_TABLE_MIGRATION=
CHANGED_FILES=
ERROR=
