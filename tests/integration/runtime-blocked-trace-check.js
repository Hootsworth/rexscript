import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  throw new Error(message);
}

function main() {
  const compilerDir = process.cwd();
  const fixtureRel = "../tests/fixtures/valid/when_use_instead.rex";
  const traceRel = "../tests/integration/integration_when_use_instead.blocked.runtime.trace.json";
  const traceAbs = path.resolve(compilerDir, traceRel);

  try {
    fs.unlinkSync(traceAbs);
  } catch {
    // no-op
  }

  const proc = spawnSync(
    "node",
    ["./scripts/rex-run.js", fixtureRel, "default", "--trace-out", traceRel],
    {
      cwd: compilerDir,
      encoding: "utf8",
      env: {
        ...process.env,
        REX_ALLOWED_CAPABILITIES: "READ"
      }
    }
  );

  if (proc.error) {
    fail(`Failed to execute rex-run for blocked trace check: ${proc.error.message}`);
  }

  if (!fs.existsSync(traceAbs)) {
    fail("Blocked runtime trace file was not produced");
  }

  const trace = JSON.parse(fs.readFileSync(traceAbs, "utf8"));
  if (!Array.isArray(trace.actions) || trace.actions.length === 0) {
    fail("Blocked runtime trace has no actions");
  }

  const blocked = trace.actions.find((a) => a.xriskDecision === "BLOCK");
  if (!blocked) {
    fail("Blocked runtime trace missing BLOCK action");
  }

  const requiredActionKeys = [
    "action",
    "kind",
    "riskLevel",
    "capability",
    "xriskDecision",
    "timestamp",
    "duration",
    "haiku",
    "loc"
  ];

  for (const key of requiredActionKeys) {
    if (!(key in blocked)) {
      fail(`Blocked action missing key: ${key}`);
    }
  }

  if (blocked.capability !== "NETWORK") {
    fail(`Expected blocked capability NETWORK, got ${blocked.capability}`);
  }

  if (!blocked.result || blocked.result.blocked !== true) {
    fail("Blocked action result summary missing blocked=true marker");
  }

  if (!trace.diagnostics || !Array.isArray(trace.diagnostics.errors)) {
    fail("Trace diagnostics errors array missing");
  }

  const capabilityError = trace.diagnostics.errors.find((d) => d.code === "CapabilityExceeded");
  if (!capabilityError) {
    fail("Expected CapabilityExceeded diagnostic in blocked trace");
  }

  console.log("Blocked runtime trace check passed.");
}

main();
