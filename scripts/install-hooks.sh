#!/usr/bin/env bash
set -euo pipefail

if [[ -n "$(git config --get core.hooksPath || true)" ]]; then
  echo 'core.hooksPath is already configured; install scripts/post-checkout there manually.' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
hooks_dir="$(git rev-parse --git-common-dir)/hooks"
hook="$hooks_dir/post-checkout"

if [[ -e "$hook" || -L "$hook" ]]; then
  if ! cmp -s "$script_dir/post-checkout" "$hook"; then
    echo 'An existing post-checkout hook is installed; merge scripts/post-checkout into it manually.' >&2
    exit 1
  fi
fi

mkdir -p "$hooks_dir"
cp "$script_dir/post-checkout" "$hook"
chmod +x "$hook"
