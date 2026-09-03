# TAS WhatsApp Accounts UI + Rename Sync V1

## Goal

Fix the case where the approved WhatsApp Accounts UI polish + Rename implementation exists in the local TAS worktree but did not reach the real GitHub `master` or production, even though Developer Hub showed `Push — Synced`.

## Known state

- Real GitHub `master` before this fix: `42123f4ce5ec20dfb345980b8d3f5fdbaf434d1b`
- Local approved TAS `master` commit containing the complete change: `c05ddf47a95e8f9d231b74d7eab35c3f98395fc1`
- The local commit contains only these approved source files:
  - `client/src/pages/wa/WAGatewayAccounts.tsx`
  - `server/services/waGatewayIntegrationService.ts`
  - `server/routers.ts`

## Approved behavior

1. WhatsApp account cards use the polished action layout.
2. The display name can be renamed inline from the Accounts page.
3. Rename changes only `whatsapp_sessions.name`.
4. It must not change `session_key`, instance identity, phone number, QR pairing, connection state, chats, contacts, messages, assignments, or Google Drive configuration.
5. Rename is admin-only and audit logged.
6. No DB migration is required.

## Why this package exists

The Developer Hub local workspace reported a successful/synced push, but the real GitHub remote remained on `42123f4...`. Therefore this task must verify the real remote with `git ls-remote` and must not trust the Developer Hub status text alone.

## Execution strategy

Use the existing local TAS worktree that contains commit `c05ddf47...` as the source of truth for this exact approved change.

1. Verify the local commit exists and has exactly the three approved files.
2. Fetch the real `origin/master` and verify its SHA.
3. Generate a fresh binary-safe patch from the real remote base to `c05ddf47...`.
4. Verify the generated patch changes only the three approved files.
5. Apply the patch to a clean temporary worktree based on current `origin/master`.
6. Run `git diff --check`, `pnpm check`, and `pnpm run build`.
7. Commit locally on clean `master` only after checks pass.
8. Do not push from OpenHands if the configured token cannot write. The user can perform the reviewed push from Developer Hub after the local master is ready.
9. After a real remote push is confirmed, deploy the exact three-file change to production using the existing TAS atomic deploy mechanism. Do not directly edit `/var/www/TAS-root/current`.

## Hard safety rules

- Do not recreate the feature from memory if `c05ddf47...` is available locally.
- Do not include unrelated local changes.
- Do not force-push.
- Do not reset production data.
- Do not modify WhatsApp credentials or Google Drive configuration.
- Do not alter DB schema.
- Do not change Evolution/WhatsApp instance names while renaming the TAS display name.

## Expected production acceptance

After deployment and hard refresh:

- the Accounts action buttons use the new structured layout;
- a pencil/edit control appears beside the WhatsApp display name;
- clicking it enables inline Rename with Save/Cancel;
- saving updates the visible display name without disconnecting or recreating the WhatsApp session.
