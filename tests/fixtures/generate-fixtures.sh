#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Always use the local build; a globally installed showsignature may be stale.
cli="$script_dir/../../dist/02-cli.js"
if [[ ! -f "$cli" ]]; then
  printf 'Local build not found at %s — run `pnpm build` first\n' "$cli" >&2
  exit 1
fi
showsignature() { node "$cli" "$@"; }

categories=(
  comments
  exports
  imports
  interfaces
  signatures
  types
  variables
)

mapfile -t source_files < <(find "$script_dir" -mindepth 2 -maxdepth 2 -type f -name 'basic.*' | sort)

if ((${#source_files[@]} == 0)); then
  printf 'No basic.* fixture sources found in immediate child folders of %s\n' "$script_dir" >&2
  exit 1
fi

# Snapshots are map OUTPUT, not source code — store them as .txt under
# expected/ so nothing (scans, agents, editors) mistakes them for source
# files in the language of their originating fixture.
expected_dir="$script_dir/expected"
mkdir -p "$expected_dir"
rm -f "$expected_dir"/*.txt

for source_file in "${source_files[@]}"; do
  language_dir="$(dirname "$source_file")"
  language="$(basename "$language_dir")"
  relative_source="${source_file#"$script_dir/"}"

  for category in "${categories[@]}"; do
    target_file="$expected_dir/$language.$category.txt"
    (cd "$script_dir" && showsignature map --only "$category" "$relative_source") > "$target_file"
    printf 'Generated %s\n' "$target_file"
  done
done
