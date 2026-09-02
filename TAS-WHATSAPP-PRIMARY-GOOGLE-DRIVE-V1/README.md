# TAS-WHATSAPP-PRIMARY-GOOGLE-DRIVE-V1

## Goal

Fix the WhatsApp Gateway storage integration so WhatsApp uses the **same TAS Google Drive Primary Storage connection already configured in the system**. Do not require a second Google Service Account credential just for WhatsApp.

## Root cause

TAS primary Google Drive storage already uses `tasGoogleDriveOAuthService` and `getTasGoogleDriveClient()`. However, WhatsApp readiness currently mixes that primary-storage configuration with `GoogleBackupService`, which only authenticates through `GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON` / `GOOGLE_BACKUP_SERVICE_ACCOUNT_FILE`. In addition, `waGatewayRuntimeConfig.ts` rejects WhatsApp runtime startup when those Service Account variables are missing.

This causes WhatsApp to stay Offline even when the existing TAS Google Drive connection is already enabled, connected and tested.

## Required behavior after patch

WhatsApp storage must follow this path:

`WhatsApp -> TAS Google Drive Primary Storage -> existing TAS Google Drive OAuth connection`

It must NOT require:

- `GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON`
- `GOOGLE_BACKUP_SERVICE_ACCOUNT_FILE`

for WhatsApp runtime readiness.

The backup subsystem may continue using `GoogleBackupService`; this patch must not globally remove or alter backup Service Account support.

## Files in scope

1. `server/services/waGatewayRuntimeConfig.ts`
2. `server/services/waGatewayRuntimeConfig.test.ts`
3. `server/services/waGatewayDriveReadiness.ts`
4. `server/services/waGatewayDriveReadiness.test.ts` only if additional tests are needed

Do not change unrelated Google Drive or backup behavior.

## Implementation requirements

### 1. WhatsApp runtime validation

In `waGatewayRuntimeConfig.ts`, remove the synchronous requirement that WhatsApp must have either `GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON` or `GOOGLE_BACKUP_SERVICE_ACCOUNT_FILE`.

Keep validation for:

- WA gateway instance identity
- public HTTPS origin
- integration/encryption secret

Google Drive readiness is validated asynchronously by the existing Drive readiness service and must not be represented as a second Service Account env requirement.

### 2. WhatsApp Drive authentication

In `waGatewayDriveReadiness.ts`:

- stop importing `getGoogleDriveClient` from `GoogleBackupService.js`;
- use the existing TAS Google Drive OAuth client from `tasGoogleDriveOAuthService.js`;
- continue using `getGoogleDrivePrimaryStorageConfig()` for the unified Primary Storage configuration;
- use the connected TAS Google Drive OAuth settings to build an internal SHA-256 fingerprint so readiness is invalidated when the connected Google credential changes;
- never log or expose refresh tokens/client secrets.

### 3. No Shared Drive-only restriction

The existing TAS OAuth storage supports the primary root folder selected/created by the app. WhatsApp must use that same primary root folder.

Do not require `driveId` to be present merely because the old implementation assumed a Service Account/Shared Drive.

For the existing persisted `sharedDriveId` readiness field, use a stable internal drive-space identity such as the real `driveId` when present and a constant value such as `oauth-my-drive` when the primary root is in My Drive. Avoid a DB/schema migration.

### 4. Permission checks

Keep real capability/probe checks:

- root folder exists and is active;
- connected Google account can add children;
- readiness probe must create a harmless test file, read it back, and delete it;
- probe cleanup remains mandatory.

Do not use Service Account-specific user-facing errors. Errors should refer to the connected TAS Google Drive account/storage.

### 5. Tests

Update `waGatewayRuntimeConfig.test.ts` so a clean WhatsApp runtime passes without any `GOOGLE_BACKUP_SERVICE_ACCOUNT_*` variable.

Add/keep tests proving:

- WhatsApp runtime validation does not require a second Service Account credential;
- existing gateway instance/public URL/secret validation still works;
- Drive readiness invalidates when the OAuth credential fingerprint changes;
- readiness still invalidates for folder/instance changes;
- existing probe freshness behavior remains.

Run focused tests:

```bash
pnpm exec vitest run \
  server/services/waGatewayRuntimeConfig.test.ts \
  server/services/waGatewayDriveReadiness.test.ts
```

Also run relevant Google Drive tests if present.

Run:

```bash
pnpm check
```

Report baseline vs new TypeScript errors. This patch must introduce **0 new TypeScript errors**.

## Production acceptance

After deployment, with the existing TAS Google Drive connection already configured and passing its normal storage test:

- WhatsApp must no longer show `Google Drive Service Account credentials are required`;
- `validateWAGatewayRuntimeEnvironment()` must have no Google Service Account issue;
- WhatsApp Drive readiness must authenticate with the same connected TAS Google Drive account;
- readiness probe must pass create/read/delete;
- `storageReady=true`;
- WhatsApp Gateway health/testConnection should no longer be blocked by the missing Service Account env variables;
- 0/0 WhatsApp accounts remains acceptable until an account is created.

## Safety

Do NOT:

- create a new Google Service Account;
- add fake credentials;
- modify production Google OAuth tokens;
- change DB schema;
- change default RBAC permissions;
- globally remove backup Service Account support;
- push/merge from OpenHands.

OpenHands must commit locally and stop before push.