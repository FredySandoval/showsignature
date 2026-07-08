#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

for source_file in "${source_files[@]}"; do
  language_dir="$(dirname "$source_file")"
  source_name="$(basename "$source_file")"
  relative_source="${source_file#"$script_dir/"}"
  extension="${source_name#basic.}"

  for category in "${categories[@]}"; do
    target_file="$language_dir/$category.$extension"
    (cd "$script_dir" && showsignature map --only "$category" "$relative_source") > "$target_file"
    printf 'Generated %s\n' "$target_file"
  done
done
