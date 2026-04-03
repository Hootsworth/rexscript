#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPILER_DIR="$ROOT/compiler"
WORK_DIR="$ROOT/tests/integration/.dynamic-feature-lifecycle"

PENDING_DIR="$WORK_DIR/pending"
APPROVED_DIR="$WORK_DIR/approved"
TRACED_DIR="$WORK_DIR/traced"

FEATURE_SOURCE="$PENDING_DIR/feature_when_use_instead.rex"
APPROVAL_FILE="$APPROVED_DIR/feature_when_use_instead.approval.json"
COMPILED_JS="$APPROVED_DIR/feature_when_use_instead.compiled.js"
PLAN_TRACE="$TRACED_DIR/feature_when_use_instead.plan.trace.json"
RUNTIME_TRACE="$TRACED_DIR/feature_when_use_instead.runtime.trace.json"
LIFECYCLE_REPORT="$WORK_DIR/lifecycle.report.json"

FIXTURE_REL="../tests/fixtures/valid/when_use_instead.rex"

rm -rf "$WORK_DIR"
mkdir -p "$PENDING_DIR" "$APPROVED_DIR" "$TRACED_DIR"
cp "$ROOT/tests/fixtures/valid/when_use_instead.rex" "$FEATURE_SOURCE"

# approval simulation
cat > "$APPROVAL_FILE" <<'JSON'
{
  "featureId": "feature_when_use_instead",
  "status": "approved",
  "approvedBy": "phase5-integration",
  "reason": "Lifecycle simulation for release-readiness gate"
}
JSON

if [[ ! -f "$APPROVAL_FILE" ]]; then
  echo "Approval gate failed: missing approval file"
  exit 2
fi

if ! grep -q '"status": "approved"' "$APPROVAL_FILE"; then
  echo "Approval gate failed: feature is not approved"
  exit 2
fi

cd "$COMPILER_DIR"

# policy gate
npm run -s rex:check -- ../tests/fixtures/invalid/err007_dynamic_isolation_violation.rex dynamic >/tmp/rex_dynamic_gate.log || true
if ! grep -q "ERR007" /tmp/rex_dynamic_gate.log; then
  echo "Policy gate failed: ERR007 not emitted for dynamic isolation violation"
  cat /tmp/rex_dynamic_gate.log
  exit 2
fi

# lifecycle execution
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:check -- "$FIXTURE_REL" dynamic >/tmp/rex_dynamic_feature_check.log
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:compile -- "$FIXTURE_REL" "$COMPILED_JS" dynamic --map >/tmp/rex_dynamic_feature_compile.log
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:run -- "$FIXTURE_REL" dynamic --trace-out "$RUNTIME_TRACE" >/tmp/rex_dynamic_feature_run.log
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:trace -- "$FIXTURE_REL" "$PLAN_TRACE" dynamic >/tmp/rex_dynamic_feature_trace.log

cat > "$LIFECYCLE_REPORT" <<JSON
{
  "featureId": "feature_when_use_instead",
  "states": [
    {
      "name": "pending",
      "at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "source": "$FEATURE_SOURCE"
    },
    {
      "name": "approved",
      "at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "approval": "$APPROVAL_FILE"
    },
    {
      "name": "compiled",
      "at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "compiled": "$COMPILED_JS",
      "map": "$COMPILED_JS.map"
    },
    {
      "name": "traced",
      "at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "planTrace": "$PLAN_TRACE",
      "runtimeTrace": "$RUNTIME_TRACE"
    }
  ]
}
JSON

node ../tests/integration/dynamic-feature-lifecycle-check.js

echo "Dynamic feature lifecycle pipeline complete"
echo "Work dir: $WORK_DIR"
echo "Lifecycle report: $LIFECYCLE_REPORT"
