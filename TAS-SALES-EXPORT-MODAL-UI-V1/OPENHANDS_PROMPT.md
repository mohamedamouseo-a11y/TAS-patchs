# OpenHands Task — Apply TAS Sales Export Modal UI V1

You are already running on the server that contains the existing TAS working copy. Do **not** clone TAS over the current project and do **not** replace the working tree.

## Goal

Apply the prepared UI/UX patch for the **"Export Leads / تصدير العملاء إلى Excel"** modal on the TAS Sales page.

The patch is intentionally scoped to:

- `client/src/pages/tas/TASSalesPage.tsx`
- export-modal layout, spacing, RTL/LTR handling, date-input presentation, inline date-range feedback, and action-button styling
- preserving the existing export endpoint, role permissions, Excel generation/download behavior, loading state, and server-side/request behavior

Do not make unrelated changes.

## Patch

Pinned patch URL:

`https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/7ab75c87aad388e78d341c89a5e7b6ab73674433/TAS-SALES-EXPORT-MODAL-UI-V1/tas-sales-export-modal-ui-v1.patch`

The patch was prepared against the TAS `master` version where `client/src/pages/tas/TASSalesPage.tsx` had blob SHA:

`d4fca57fd925b873ab842a0283a63e8ee31882e7`

The server checkout may be ahead of that snapshot, so inspect the current working tree first and preserve any server-side/local changes.

## Required procedure

1. Locate and enter the existing TAS repository on this server. Confirm the repository before changing anything:

```bash
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
```

2. Do **not** run `git reset --hard`, `git checkout -- .`, `git restore .`, or any command that discards current changes. Do not stash or overwrite unrelated work.

3. Inspect the current target file and its status:

```bash
git status --short -- client/src/pages/tas/TASSalesPage.tsx
git hash-object client/src/pages/tas/TASSalesPage.tsx
```

If the file already has local changes, preserve them. Save a safety copy of the current file before applying this patch:

```bash
cp client/src/pages/tas/TASSalesPage.tsx /tmp/TASSalesPage.tsx.before-export-modal-ui-v1
```

4. Download the pinned patch to `/tmp`:

```bash
curl -fsSL \
  'https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/7ab75c87aad388e78d341c89a5e7b6ab73674433/TAS-SALES-EXPORT-MODAL-UI-V1/tas-sales-export-modal-ui-v1.patch' \
  -o /tmp/tas-sales-export-modal-ui-v1.patch
```

5. Inspect the patch before applying it:

```bash
sed -n '1,240p' /tmp/tas-sales-export-modal-ui-v1.patch
```

6. Run a dry check first:

```bash
git apply --check --whitespace=error-all /tmp/tas-sales-export-modal-ui-v1.patch
```

7. If the dry check succeeds, apply it:

```bash
git apply --whitespace=fix /tmp/tas-sales-export-modal-ui-v1.patch
```

8. If the dry check fails because the server version of `TASSalesPage.tsx` has drifted, **do not force the patch and do not use reset/reject in a way that can overwrite existing work**. Instead:
   - inspect the current export modal and nearby state in `client/src/pages/tas/TASSalesPage.tsx`;
   - manually port only the semantic changes contained in the patch;
   - preserve all current server changes and existing export functionality;
   - do not touch another file unless it is strictly required to compile, and explain first in the final report if that happened.

9. Review the resulting diff carefully:

```bash
git diff -- client/src/pages/tas/TASSalesPage.tsx
git diff --check
git diff --stat
```

The intended result is one scoped source file change. Confirm that the existing `/api/export/leads` request, role checks, Excel download logic, and required start/end-date behavior are unchanged.

10. Run verification from the TAS project root:

```bash
pnpm check
pnpm build
```

If either command fails, determine whether the failure is introduced by this patch or was already present. Do not hide errors and do not broaden the task into unrelated fixes.

11. Do **not** commit, push, deploy, restart services, run database migrations, or modify production data unless explicitly instructed in a separate request.

## UI acceptance criteria

The export modal should have:

- balanced modal width and consistent horizontal/vertical spacing;
- clear RTL Arabic alignment and correct LTR English behavior;
- title plus concise helper text;
- a compact export-period information block;
- two clean date fields presented side-by-side on wider screens and stacked on small screens;
- `min`/`max` constraints between the start and end date inputs;
- visible inline validation when the start date is after the end date;
- export button disabled for missing/invalid dates and while exporting;
- a visually primary TAS-gold **Export / تصدير** button and secondary **Cancel / إلغاء** button;
- existing close button behavior preserved;
- no API, database, permissions, or export-business-logic changes.

## Final report

Return exactly the following information when finished:

- `TAS_ROOT=`
- `STARTING_BRANCH=`
- `STARTING_HEAD=`
- `TARGET_FILE_HASH_BEFORE=`
- `PATCH_APPLY_MODE=CLEAN|MANUAL_PORT`
- `FILES_CHANGED=`
- `PNPM_CHECK=PASS|FAIL`
- `PNPM_BUILD=PASS|FAIL`
- `UNRELATED_CHANGES_CREATED=NO|YES`
- `DEPLOYED=NO`
- a short summary of what changed and any verification errors
