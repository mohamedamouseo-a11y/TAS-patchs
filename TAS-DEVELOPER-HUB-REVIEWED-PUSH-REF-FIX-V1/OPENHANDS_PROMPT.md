Apply the prepared patch only. Do NOT redesign or diagnose the feature.

TAS_ROOT=/var/www/TAS-root
ACTIVE=$(readlink -f /var/www/TAS-root/current)
PATCH_URL=https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-REVIEWED-PUSH-REF-FIX-V1/tas-developer-hub-reviewed-push-ref-fix-v1.patch
PATCH_FILE=/tmp/tas-developer-hub-reviewed-push-ref-fix-v1.patch

Goal:
Fix the recurring Developer Hub Execute Reviewed Push `cannot lock ref` failure.

Prepared fix behavior:
- For `clean_snapshot_and_push`, create the reviewed commit object with `git commit-tree` WITHOUT moving local HEAD and WITHOUT mutating `refs/heads/<branch>` before push.
- Push the exact reviewed commit SHA directly.
- Validate the pushed commit from the remote branch after push.
- Keep normal push / fast-forward / merge behavior unchanged.
- No force push.

STRICT:
- Apply ONLY the prepared patch.
- Do NOT manually rewrite developerHub.ts.
- Do NOT touch other files unless build tooling itself updates nothing tracked.
- Do NOT clear GitHub tokens/settings.
- Do NOT delete branches, reset history, or force push.
- Do NOT execute an actual GitHub push test from the UI/API; the user will test it.

Steps:
1. Download PATCH_URL to PATCH_FILE.
2. cd $TAS_ROOT.
3. Run: git apply --check $PATCH_FILE
4. If check fails, STOP and return PATCH_APPLY=FAIL with the git apply error. Do not improvise.
5. Run: git apply $PATCH_FILE
6. Run: git diff --check
7. Verify the ONLY tracked source file changed by this patch is:
   server/routes/developerHub.ts
8. Commit only that file with message:
   fix(developer-hub): stop clean snapshot from mutating branch refs
9. Copy the committed server/routes/developerHub.ts to the same relative path under $ACTIVE if $ACTIVE is a separate physical release.
10. Build in $ACTIVE:
    NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
11. Restart only PM2 process TAS:
    pm2 restart TAS
12. Confirm PM2 TAS is online.

Return only:
PATCH_APPLY=PASS|FAIL
FILES_CHANGED=
COMMIT_SHA=
BUILD=PASS|FAIL
PM2_RESTARTED=YES|NO
PM2_STATUS=
