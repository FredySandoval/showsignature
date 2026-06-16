#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

languages=(
  go
  lua
  python
  rust
  typescript
)

categories=(
  comments
  exports
  imports
  interfaces
  signatures
  types
  variables
)

declare -A extensions=(
  [go]=go
  [lua]=lua
  [python]=py
  [rust]=rs
  [typescript]=ts
)

for language in "${languages[@]}"; do
  language_dir="$script_dir/$language"
  extension="${extensions[$language]}"
  source_file="$language_dir/basic.$extension"

  mkdir -p "$language_dir"

  for category in "${categories[@]}"; do
    target_file="$language_dir/$category.$extension"
    showsignature --show-only "$category" --file "$source_file" > "$target_file"
    printf 'Generated %s\n' "$target_file"
  done
done
