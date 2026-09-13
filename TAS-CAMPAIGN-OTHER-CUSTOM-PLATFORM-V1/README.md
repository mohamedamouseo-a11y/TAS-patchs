# TAS Campaign Other Custom Platform V1

Source TAS repository: `mohamedamouseo-a11y/TAS`  
Patch prepared against `master` commit: `928a88d54e6370dc2ecc1f862f2592acf03b91d7`

## Goal

Make the **Add Campaign** dialog behave correctly when **Platform = Other**:

- selecting **Other** reveals a text field for the real platform name;
- the field is required while **Other** is selected;
- the value is persisted separately as `campaigns.platformOther`;
- campaign lists show the custom platform label instead of the generic `Other`;
- selecting any normal platform keeps the current behavior unchanged.

## Scope

The patch only changes:

- `client/src/pages/AdminSettings.tsx`
- `server/routers.ts`
- `drizzle/schema.ts`
- adds `scripts/apply-campaign-other-platform-v1.ts`

## Database safety

The code introduces one additive nullable column:

```sql
campaigns.platformOther VARCHAR(255) NULL
```

The migration helper is **dry-run by default**. It will not execute DDL unless `--apply` is explicitly passed.

It also requires `TAS_EXPECTED_DATABASE_NAME` and refuses to run if the connected database name does not match.

## Apply to an isolated TAS branch

From the TAS repository:

```bash
git switch master
git pull --ff-only
git switch -c fix/campaign-other-custom-platform-v1

git apply --check /path/to/TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1/TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1.patch
git apply /path/to/TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1/TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1.patch

pnpm check
git diff --check
```

Do not push, merge, open a PR, or modify `master` from the automated execution session.

## Database preflight

Do **not** run the apply step from an untrusted or unknown environment.

When the release operator is ready to reconcile the intended database:

```bash
export TAS_EXPECTED_DATABASE_NAME='<expected_database_name>'
pnpm exec tsx scripts/apply-campaign-other-platform-v1.ts
```

Expected:

```text
TAS_CAMPAIGN_OTHER_PLATFORM_SCHEMA_DRY_RUN=PASS
```

Only after confirming the database backup and target database name:

```bash
pnpm exec tsx scripts/apply-campaign-other-platform-v1.ts --apply
```

Expected:

```text
TAS_CAMPAIGN_OTHER_PLATFORM_SCHEMA_APPLY=PASS
```

## Acceptance

1. Open `/settings` and the Campaigns section.
2. Click **Add Campaign**.
3. Choose **Other** under Platform.
4. A field labeled **Other platform name / اسم المنصة الأخرى** appears.
5. Saving with the field empty is blocked.
6. Enter a value such as `X` or `Telegram`, save the campaign, and confirm the campaign table displays that custom label.
7. Create a normal `Meta` campaign and confirm existing behavior is unchanged.
