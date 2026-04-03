import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

function isIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }
  const t = Date.parse(value);
  return Number.isFinite(t);
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

if (!Number.isInteger(trace.actionCount) || trace.actionCount < 0) {
  fail("actionCount must be a non-negative integer");
}

if (!Number.isInteger(trace.duration) || trace.duration < 0) {
  fail("duration must be a non-negative integer");
}

if (!isIsoDate(trace.generatedAt)) {
  fail("generatedAt must be an ISO-like timestamp");
}

for (let i = 0; i < trace.actions.length; i += 1) {
  const a = trace.actions[i];
  const requiredAction = ["action", "kind", "riskLevel", "capability", "xriskDecision", "timestamp", "duration", "haiku", "loc"];
  for (const key of requiredAction) {
    if (!(key in a)) {
      fail(`Action ${i} missing key: ${key}`);
    }
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(String(a.riskLevel))) {
    fail(`Action ${i} has invalid riskLevel: ${a.riskLevel}`);
  }

  if (!["ALLOW", "BLOCK"].includes(String(a.xriskDecision))) {
    fail(`Action ${i} has invalid xriskDecision: ${a.xriskDecision}`);
  }

  if (!isIsoDate(a.timestamp)) {
    fail(`Action ${i} has invalid timestamp`);
  }

  if (!Number.isInteger(a.duration) || a.duration < 0) {
    fail(`Action ${i} has invalid duration`);
  }

  if (a.loc !== null) {
    if (typeof a.loc !== "object") {
      fail(`Action ${i} loc must be object or null`);
    }

    const hasFlat = "line" in a.loc || "column" in a.loc;
    const hasRange = "start" in a.loc || "end" in a.loc;

    if (!hasFlat && !hasRange) {
      fail(`Action ${i} loc must include line/column or start/end`);
    }

    if (hasFlat) {
      if (!("line" in a.loc) || !("column" in a.loc)) {
        fail(`Action ${i} flat loc must include both line and column`);
      }
      if (a.loc.line !== null && !Number.isInteger(a.loc.line)) {
        fail(`Action ${i} loc.line must be integer or null`);
      }
      if (a.loc.column !== null && !Number.isInteger(a.loc.column)) {
        fail(`Action ${i} loc.column must be integer or null`);
      }
    }

    if (hasRange) {
      const points = [a.loc.start, a.loc.end];
      for (const point of points) {
        if (point === null) {
          continue;
        }
        if (typeof point !== "object") {
          fail(`Action ${i} loc.start/end must be object or null`);
        }
        if (!("line" in point) || !("column" in point)) {
          fail(`Action ${i} loc.start/end must include line and column`);
        }
        if (point.line !== null && !Number.isInteger(point.line)) {
          fail(`Action ${i} loc.start/end line must be integer or null`);
        }
        if (point.column !== null && !Number.isInteger(point.column)) {
          fail(`Action ${i} loc.start/end column must be integer or null`);
        }
      }
    }
  }
}

if (!trace.diagnostics || !Array.isArray(trace.diagnostics.warnings) || !Array.isArray(trace.diagnostics.errors)) {
  fail("diagnostics must include warnings/errors arrays");
}

console.log("Trace schema validation passed.");
