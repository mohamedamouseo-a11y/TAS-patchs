# TAS In-App Notifications Migration V1

Standalone patch for the clean-deploy blocker where `drizzle/schema.ts` defines `in_app_notifications` and the notification engine uses it, but the migration set has no migration that creates the table.

## Base

- TAS master: `928a88d54e6370dc2ecc1f862f2592acf03b91d7`
- Patch repo only. Do not push TAS/master automatically.

## Patch

- Adds `drizzle/0023_in_app_notifications.sql`
- Adds journal entry `idx=9`, tag `0023_in_app_notifications`
- Uses `CREATE TABLE IF NOT EXISTS` so current production, where the table already exists, does not fail.
- Keeps `body` and `bodyAr` nullable because the current notification engine writes `null` for those fields.

## Important numbering note

The TAS repository already contains SQL migration files through `0022`, including `0009_backup_center.sql`, while `_journal.json` currently stops at journal entry `idx=8`. Therefore this patch keeps the next SQL filename as `0023` and adds it as journal entry `idx=9`.

## Validation required before manual push

1. Apply `in-app-notifications-migration.patch` to a clean worktree based on the stated master SHA.
2. Build with `pnpm build`.
3. Test migration against disposable MySQL for both a missing table and an already-existing table.
4. Confirm only the two migration files differ.
5. Do not touch production DB during patch validation.

No credentials, production data, or customer exports are included in this bundle.
