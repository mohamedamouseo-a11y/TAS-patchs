#!/usr/bin/env bash
set -euo pipefail

TAS_WORKTREE="${1:-}"
SOURCE_COMMIT="${2:-c05ddf47a95e8f9d231b74d7eab35c3f98395fc1}"
OUTPUT_PATCH="${3:-/tmp/TAS-WHATSAPP-ACCOUNTS-UI-RENAME-FINAL.patch}"

if [[ -z "$TAS_WORKTREE" ]]; then
  echo "Usage: $0 <tas-worktree> [source-commit] [output-patch]" >&2
  exit 2
fi

git -C "$TAS_WORKTREE" fetch origin --prune
git -C "$TAS_WORKTREE" cat-file -e "${SOURCE_COMMIT}^{commit}"

mapfile -t FILES < <(git -C "$TAS_WORKTREE" diff --name-only origin/master "$SOURCE_COMMIT" | sort)
EXPECTED=(
  "client/src/pages/wa/WAGatewayAccounts.tsx"
  "server/routers.ts"
  "server/services/waGatewayIntegrationService.ts"
)
IFS=$'\n' EXPECTED_SORTED=($(printf '%s\n' "${EXPECTED[@]}" | sort)); unset IFS

if [[ "${FILES[*]}" != "${EXPECTED_SORTED[*]}" ]]; then
  echo "PATCH_BUILD=BLOCKED"
  echo "REASON=UNEXPECTED_DIFF_FILES"
  printf 'FOUND_FILE=%s\n' "${FILES[@]}"
  exit 1
fi

git -C "$TAS_WORKTREE" diff --binary origin/master "$SOURCE_COMMIT" -- \
  client/src/pages/wa/WAGatewayAccounts.tsx \
  server/services/waGatewayIntegrationService.ts \
  server/routers.ts \
  > "$OUTPUT_PATCH"

if [[ ! -s "$OUTPUT_PATCH" ]]; then
  echo "PATCH_BUILD=BLOCKED"
  echo "REASON=EMPTY_PATCH"
  exit 1
fi

echo "REMOTE_MASTER=$(git -C "$TAS_WORKTREE" rev-parse origin/master)"
echo "SOURCE_COMMIT=$SOURCE_COMMIT"
echo "PATCH_PATH=$OUTPUT_PATCH"
echo "PATCH_FILES=${EXPECTED_SORTED[*]}"
echo "WHATSAPP_ACCOUNTS_UI_RENAME_PATCH_BUILD=PASS"
