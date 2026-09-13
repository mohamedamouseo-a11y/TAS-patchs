You are working in the target repository `mohamedamouseo-a11y/TAS`.

Implement only the prepared patch **TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1**.

Important rules:
- Work on a new local branch named `fix/campaign-other-custom-platform-v1`.
- Do NOT push.
- Do NOT merge.
- Do NOT open a PR.
- Do NOT modify or commit directly on `master`.
- After verification, create one local commit on the feature branch only.
- Do NOT run database DDL or the migration script with `--apply`.
- I will review and push the local feature-branch commit myself from Developer Hub.

Patch source:
- Repository: `https://github.com/mohamedamouseo-a11y/TAS-patchs`
- Branch: `patch/campaign-other-custom-platform-v1`
- File: `TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1/TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1.patch`
- Expected SHA-256: `503696f8ec1f47193eb6388b750f3a6ee8ce4b122e789c178cd7d8451eff966a`
- Patch was prepared against TAS `master` commit `928a88d54e6370dc2ecc1f862f2592acf03b91d7`.

Execution steps:

1. Inspect the current TAS git status and current commit. If there are unrelated local changes, STOP and report them; do not overwrite them.
2. Ensure the base is the current `master`, then create/switch to local branch:
   `fix/campaign-other-custom-platform-v1`
3. Clone/fetch the patch repository into a temporary directory and checkout branch:
   `patch/campaign-other-custom-platform-v1`
4. Verify the SHA-256 of `TAS-CAMPAIGN-OTHER-CUSTOM-PLATFORM-V1.patch` matches:
   `503696f8ec1f47193eb6388b750f3a6ee8ce4b122e789c178cd7d8451eff966a`
5. Run:
   `git apply --check <patch-file>`
   Do not use fuzz, manual hunk edits, or partial application.
6. If the check passes, apply it with:
   `git apply <patch-file>`
7. Review the diff and confirm the only intended changes are:
   - `client/src/pages/AdminSettings.tsx`
   - `server/routers.ts`
   - `drizzle/schema.ts`
   - new `scripts/apply-campaign-other-platform-v1.ts`
8. Run:
   - `pnpm check`
   - `git diff --check`
9. Do not execute `scripts/apply-campaign-other-platform-v1.ts --apply`.
10. If both checks pass, create one local commit on `fix/campaign-other-custom-platform-v1` with commit message:
    `fix(settings): allow custom campaign platform for Other`
11. Do NOT push that commit. I will push it myself from Developer Hub.
12. Report:
   - branch name
   - commit SHA
   - changed files
   - `pnpm check` result
   - `git diff --check` result
   - whether the patch SHA matched
   - any blockers

Functional requirement:
In Settings > Campaigns > Add Campaign, when Platform is `Other`, show a required text input where the user can type the actual platform name. Save that custom value in `campaigns.platformOther`, and display the custom value in the campaigns table instead of the generic word `Other`. Existing platforms and Round Robin behavior must remain unchanged.
