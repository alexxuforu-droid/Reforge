#!/bin/sh
# pre-commit: block secret-shaped strings (API keys, tokens) from being committed.
# Install: copy to .git/hooks/pre-commit (no extension) and make executable.
# Patterns: OpenAI/Groq-style (sk-...), provider prefixes, generic assignments.
STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
[ -z "$STAGED" ] && exit 0
echo "$STAGED" | grep -v -E '^\.vault/|state\.json$|storageState' > /dev/null || true
HIT=0
for f in $STAGED; do
  case "$f" in
    *.vault/*|*data/state.json*|*session-*.json*|*account-*.json*) echo "BLOCKED path (vault/secret file): $f"; HIT=1;;
  esac
  if git show ":$f" 2>/dev/null | grep -n -E \
    -e 'sk-(or-v1|live|proj|test)-[A-Za-z0-9_-]{8,}' \
    -e 'sk-dgt[A-Za-z0-9]{10,}|sk-apx[A-Za-z0-9]{10,}|thk_[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{10,}' \
    -e '(api[_-]?key|apikey|api[_-]?secret|auth[_-]?token)["'\'']?\s*[:=]\s*["'\''][A-Za-z0-9_\-]{16,}["'\'']' \
  | grep -v -E 'keyPreview|MASKED|EXAMPLE|placeholder|YOUR_|test_key|plug_key|<key>|sk-\.\.\.| \.\.\.' \
  | grep -q .; then
    printf 'BLOCKED secret pattern in %s (content redacted)\n' "$f"
    HIT=1
  fi
done 2>/dev/null
if [ "$HIT" != "0" ]; then
  echo 'Commit blocked: secret-shaped content staged. Move it to .vault/ (gitignored) and retry.'
  exit 1
fi
exit 0
