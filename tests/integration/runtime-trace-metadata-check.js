import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function main() {
  const tracePath = path.resolve(process.cwd(), "../tests/integration/integration_when_use_instead.runtime.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));

  if (!Array.isArray(trace.actions)) {
    fail("Trace actions missing");
  }

  const useInstead = trace.actions.find((a) => a.action === "use.instead");
  if (!useInstead) {
    fail("No use.instead action found in runtime trace");
  }

  const observe = trace.actions.find((a) => a.action === "observe" || a.action === "hunt");
  if (!observe) {
    fail("No observe/hunt action found in runtime trace");
  }

  if (!observe.result || typeof observe.result !== "object") {
    fail("observe/hunt trace result summary missing");
  }

  if (typeof observe.result.adapter !== "string" || observe.result.adapter.length === 0) {
    fail("observe/hunt trace result summary missing adapter telemetry");
  }

  if (!useInstead.result || typeof useInstead.result !== "object") {
    fail("use.instead trace result summary missing");
  }

  const required = ["language", "executor", "confidence", "via", "outputSummary"];
  for (const key of required) {
    if (!(key in useInstead.result)) {
      fail(`use.instead result summary missing key: ${key}`);
    }
  }

  if (!("policyReason" in useInstead)) {
    fail("use.instead action missing policyReason field");
  }

  console.log("Runtime trace metadata check passed.");
}

main();
