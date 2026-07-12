#!/usr/bin/env bash
# ============================================================================
# Comprehension model evaluation
#
# Goal: evaluate how good the instruction set in src/00-instructions.ts is.
# A pi agent is given NO extra documentation — pi already exposes
# showsignature_map / showsignature_read as native tools whose descriptions
# come from src/00-instructions.ts. The agent must predict the tool's output
# from those descriptions alone, run it, and report the differences. A gap
# between prediction and reality is a candidate instruction improvement.
#
# Usage: ./run-experiment.sh <model> <map|read> <argument>
#   e.g. ./run-experiment.sh "poolside/laguna-m.1:free" map symbolSummary
# One argument per run, to keep it simple for the LLMs.
#
# Where it runs: ../showsignature-testing — a FULL COPY of tests/fixtures/
# recreated fresh on every run, excluding expected/ and generate-fixtures.sh
# (so expected outputs can't leak into the model's guess). Copies, not
# symlinks: showsignature does not follow symlinks (see TODO.md).
#
# Result: ./results/<sub>-<arg>.<model>.<timestamp>.txt (thinking + response
# stream). Timestamped so reruns of the same flag never overwrite.
#
# Workflow per flag (track progress in TODO.md):
#   1. Run this script; read the result file.
#   2. Ask: could better instructions in src/00-instructions.ts have closed
#      the gap between the model's guess and the actual output?
#   3. If yes: edit src/00-instructions.ts and rerun the same model + flag
#      to verify. (This script runs pnpm gen + pnpm build automatically on
#      every launch, since pi loads tool descriptions from dist/, not src/.)
#   4. Mark the flag in TODO.md ([x], model tested, whether instructions
#      were optimized) and present findings for discussion before moving to
#      the next model.
#   5. If the model reports genuine tool-behavior surprises (not doc gaps),
#      log them under "Tool findings" in TODO.md.
#
# Models (openrouter, free tier — some are flaky at tool calling; nemotron
# emits malformed tool calls in ~half its runs, retry or move on):
#   1. nvidia/nemotron-3-ultra-550b-a55b:free
#   2. poolside/laguna-m.1:free
#   3. cohere/north-mini-code:free
#   4. google/gemma-4-31b-it:free
#   5. tencent/hy3:free
#
# Flags to cover (mirror of the TODO.md checklist):
#   map : paths take skip only symbolSummary lang maxDepth includeTests noLineNumber
#   read: file offset limit lang outline framing
#
# Lessons already learned (don't re-litigate):
#   - Don't paste SKILL.md into the prompt; pi provides the tool surface.
#   - pnpm gen alone does NOT update what pi sees — dist/ must be rebuilt;
#     this script now does gen+build itself on every launch.
#   - Weak free models may quote the correct description and still predict
#     wrong; past a point the gap is model reasoning, not docs.
# ============================================================================
set -euo pipefail
MODEL="$1"; SUB="$2"; ARG="$3"
REPO="$(cd "$(dirname "$0")" && pwd)"

# Always regenerate + rebuild so pi serves the CURRENT instructions (pi loads
# tool descriptions from dist/). Silent on success, loud on failure.
(cd "$REPO" && pnpm gen >/dev/null && pnpm build >/dev/null) \
  || { echo "ERROR: pnpm gen/build failed — fix before running experiments" >&2; exit 1; }

# Full copy (not symlinks): showsignature does not follow symlinks, and
# symlinked files also turn map's relative-path headers absolute.
# Excludes expected/ and generate-fixtures.sh so expected outputs can't leak.
TESTDIR="$REPO/../showsignature-testing"
rm -rf "$TESTDIR"
mkdir -p "$TESTDIR"
for d in "$REPO"/tests/fixtures/*/; do
  name="$(basename "$d")"
  [ "$name" = expected ] && continue
  cp -r "$d" "$TESTDIR/$name"
done

mkdir -p "$REPO/results"
OUT="$REPO/results/$SUB-$ARG.${MODEL//[^a-zA-Z0-9.-]/_}.$(date +%Y%m%d-%H%M%S).txt"

PROMPT="you are in a fixtures folder, please use showsignature $SUB $ARG.

Task:
1. use \`fd\` to show all files you have available.
2. use \`cat\` to see the actual content of any file you pick (you can pick any file you want).
3. Show us (print) what arguments you will use exactly along with a guess of what the output of showsignature $SUB $ARG you expect to look like based on the information you have about the tool.
4. Run the actual command with those same arguments, and describe the differences of what you were expecting compared with the output you received.
5. Your task ends."

cd "$TESTDIR"
pi -p --provider openrouter --model "$MODEL" --mode json --thinking high "$PROMPT" \
| jq -rj 'select(.type=="message_update") | .assistantMessageEvent |
    if .type=="thinking_start" then "\n[thinking]\n"
    elif .type=="text_start" then "\n\n[response]\n"
    elif .type=="thinking_delta" or .type=="text_delta" then .delta
    else empty end' > "$OUT" 2>&1
echo "exit=$? wrote $OUT"
