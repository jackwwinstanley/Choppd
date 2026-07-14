#!/usr/bin/env bash
# Install this repo's git hooks (idempotent). Run once per clone.
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
chmod +x "$REPO/scripts/hooks/pre-push"
ln -sf ../../scripts/hooks/pre-push "$REPO/.git/hooks/pre-push"
echo "✓ pre-push hook installed → .git/hooks/pre-push"
echo "  native-facing pushes (mvp/ · ios/ · capacitor.config.json) run native-verify."
echo "  bypass any time with: git push --no-verify"
