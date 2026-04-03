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

# approval simulation
cat > "$APPROVAL_FILE" <<'JSON'
{
  "featureId": "feature_when_use_instead",
  "status": "approved"
}
JSON

# policy gate
npm run -s rex:check -- ../tests/fixtures/invalid/err007_dynamic_isolation_violation.rex dynamic >/tmp/rex_dynamic_gate.log || true
grep -q "ERR007" /tmp/rex_dynamic_gate.log

# lifecycle execution
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:check -- ../tests/fixtures/valid/when_use_instead.rex dynamic
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:compile -- ../tests/fixtures/valid/when_use_instead.rex "$COMPILED_JS" dynamic --map
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:run -- ../tests/fixtures/valid/when_use_instead.rex dynamic --trace-out "$RUNTIME_TRACE"
REX_ALLOWED_USE_INSTEAD_LANGS=sql npm run -s rex:trace -- ../tests/fixtures/valid/when_use_instead.rex "$PLAN_TRACE" dynamic
