Work on the existing TAS checkout only. Do not clone over it, deploy, restart PM2, commit, push, merge, or use Developer Hub push.

Goal: implement TAS-LEAD-RESIDENCE-CONTACT-VISIBILITY-V1 from:
https://github.com/mohamedamouseo-a11y/TAS-patchs/tree/main/TAS-LEAD-RESIDENCE-CONTACT-VISIBILITY-V1

Baseline reviewed by the patch author: TAS master commit 11b8efce. The current checkout may be newer, so preserve all newer work.

Required workflow:
1. Run git status --short and git rev-parse HEAD. Preserve all unrelated changes.
2. Read README.md and tas-lead-residence-contact-visibility-v1.patch in the patch folder. Treat the patch as an implementation blueprint. First run git apply --check against it; if any hunk does not match the current tree, port that hunk manually instead of forcing, overwriting, or resetting files.
3. Implement the complete requirement:
   - Add nullable leads.residence VARCHAR(255) to drizzle/schema.ts and shared/schema.ts.
   - Add an additive migration at drizzle/migrations/20260921_add_lead_residence.sql.
   - Accept residence in generic leads.create and leads.update with trim/max 255 validation.
   - Accept and persist residence in TAS manual Lead Dispatcher creation.
   - In listTASSalesDispatcherLeads, return residence plus computed hasSalesContact, lastSalesContactAt, and lastContactedByName.
   - Contacted means EXISTS a non-deleted activities row for that lead where type <> 'Note'. Notes must not count.
   - Support contactStatus values contacted and not_contacted server-side.
   - Include residence in dispatcher search.
   - In the dispatcher UI, add Residence to manual lead creation.
   - Add an authorized sales-contact tracking table/filter: All, Contacted, Not contacted. Show Residence, owner, contact badge, latest contact time, latest contacting user, stage, and existing reassignment action.
4. Keep access behind the current canUseDispatcher UI gate and assertTASSalesDispatchRead server gate. Do not widen SalesAgent visibility or bypass TAS RBAC/data scope.
5. Make migration execution safe:
   - Before applying SQL, query INFORMATION_SCHEMA.COLUMNS for leads.residence.
   - Apply ALTER TABLE only when the column is absent.
   - Never drop or rewrite existing lead data.
6. Add focused contract tests for:
   - residence schema/API wiring;
   - contact-status SQL semantics;
   - Note-only activity = not contacted;
   - dispatcher gate remains in place;
   - UI contains residence and the three-state filter.
7. Run:
   pnpm check
   pnpm vitest run <new focused test files>
   pnpm build
8. Show git diff --check and git status --short.
9. Report changed files, migration status, test/build results, and any baseline failures separately.

Stop after the local working tree is ready. Do not commit, push, deploy, restart services, or modify production data. The user will push manually from Developer Hub.
