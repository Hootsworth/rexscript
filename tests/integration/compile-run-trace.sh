#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPILER_DIR="$ROOT/compiler"
FIXTURE_REL="../tests/fixtures/valid/when_use_instead.rex"
OUT_JS="$COMPILER_DIR/.rex-run/integration_when_use_instead.compiled.js"
OUT_TRACE="$ROOT/tests/integration/integration_when_use_instead.trace.json"
OUT_RUNTIME_TRACE="$ROOT/tests/integration/integration_when_use_instead.runtime.trace.json"

cd "$COMPILER_DIR"

npm run -s rex:compile -- "$FIXTURE_REL" "$OUT_JS" default --map >/tmp/rex_int_compile.log
npm run -s rex:run -- "$FIXTURE_REL" default --trace-out "$OUT_RUNTIME_TRACE" >/tmp/rex_int_run.log
npm run -s rex:trace -- "$FIXTURE_REL" "$OUT_TRACE" default >/tmp/rex_int_trace.log

echo "Integration pipeline complete"
echo "Compiled: $OUT_JS"
echo "Trace: $OUT_TRACE"
echo "Runtime Trace: $OUT_RUNTIME_TRACE"
