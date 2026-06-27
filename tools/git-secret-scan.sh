#!/usr/bin/env bash
# git-secret-scan.sh — LOCAL, on-demand git-history secret scan (READ-ONLY).
# ============================================================================
# Run from anywhere in the repo:   bash tools/git-secret-scan.sh
# Complements the scheduled server audit (which can't see .git on the rsync
# deploy). Checks: tracked secret files, secret patterns in current tracked
# files, and secret patterns introduced anywhere in git HISTORY.
#
# READ-ONLY: only git ls-files / git grep / git log. Never edits anything.
# Secret VALUES are redacted in the output — it shows where, never the value.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || { echo "not a git repo"; exit 1; }

# redact the sensitive part of any matched token so values never print
redact='s/(sk-|AKIA|xox.-|AIza)[A-Za-z0-9_/+-]+/\1<redacted>/g'
PAT='\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{35}'

echo "=================================================="
echo "git secret scan — $(date -u +%FT%TZ)  (read-only, values redacted)"
echo "=================================================="

echo
echo "--- 1. tracked secret FILES (should be none) ---"
if git ls-files | grep -iE '(^|/)\.env($|\.)|\.pem$|\.key$|id_rsa|\.p12$|\.pfx$' | grep -vE '\.env\.example$'; then
  echo "  ^^ CRITICAL: a secret file is tracked by git. Untrack + rotate it."
else
  echo "  none tracked — good."
fi

echo
echo "--- 2. secret PATTERNS in current tracked files ---"
if git grep -nIE "$PAT" -- ':!*.env*' ':!*-lock.json' ':!tools/git-secret-scan.sh' ':!server/src/security-audit.ts' 2>/dev/null | sed -E "$redact"; then
  echo "  ^^ review the above (real secret? -> remove + rotate + move to .env)"
else
  echo "  none in current files — good."
fi

echo
echo "--- 3. secret PATTERNS ever added in HISTORY ---"
hits=$(git log -p --all 2>/dev/null | grep -nIE "^\+.*($PAT)" | sed -E "$redact" | head -40)
if [ -n "$hits" ]; then echo "$hits"; echo "  ^^ a secret pattern appears in history — even if removed later, rotate it (history is forever)."; else echo "  none found in history — good."; fi

echo
echo "--- 4. was any real .env ever committed? ---"
if git log --all --oneline --name-only -- '*.env' ':!*.env.example' 2>/dev/null | grep -qE '\.env'; then
  git log --all --oneline -- '*.env' ':!*.env.example' 2>/dev/null | head
  echo "  ^^ a .env was committed at some point — rotate every secret it held."
else
  echo "  never committed — good."
fi

echo
echo "=== done (read-only) ==="
