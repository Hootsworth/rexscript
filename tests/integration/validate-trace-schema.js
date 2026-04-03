import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

const tracePath = process.argv[2];
if (!tracePath) {
  console.error("Usage: node validate-trace-schema.js <trace.json>");
  process.exit(1);
}

const abs = path.resolve(process.cwd(), tracePath);
const trace = JSON.parse(fs.readFileSync(abs, "utf8"));

const requiredTop = ["traceId", "sessionId", "file", "generatedAt", "actionCount", "duration", "haiku", "actions", "diagnostics"];
for (const key of requiredTop) {
  if (!(key in trace)) {
    fail(`Missing top-level key: ${key}`);
  }
}

if (!Array.isArray(trace.actions)) {
  fail("actions must be an array");
}

for (let i = 0; i < trace.actions.length; i += 1) {
  const a = trace.actions[i];
  const requiredAction = ["action", "kind", "riskLevel", "capability", "xriskDecision", "timestamp", "duration", "haiku", "loc"];
  for (const key of requiredAction) {
    if (!(key in a)) {
      fail(`Action ${i} missing key: ${key}`);
    }
  }
}

if (!trace.diagnostics || !Array.isArray(trace.diagnostics.warnings) || !Array.isArray(trace.diagnostics.errors)) {
  fail("diagnostics must include warnings/errors arrays");
}

console.log("Trace schema validation passed.");
