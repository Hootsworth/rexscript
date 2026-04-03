import runtime from "../../packages/runtime/index.js";
import xrisk from "../../packages/xrisk/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  xrisk.resetTrace();

  await xrisk.before({
    action: "use.instead",
    capability: "FOREIGN_EXEC",
    target: JSON.stringify("auto"),
    loc: { line: 1, column: 1 }
  });

  const routed = await runtime.useInstead({
    content: "SELECT id FROM rows LIMIT 1",
    context: { rows: [{ id: 1 }, { id: 2 }] }
  });

  await xrisk.after({
    action: "use.instead",
    riskLevel: "LOW",
    result: routed,
    loc: { line: 1, column: 1 }
  });

  const trace = xrisk.getTrace();
  assert(Array.isArray(trace.actions), "trace.actions should be present");

  const useInstead = trace.actions.find((action) => action.action === "use.instead");
  assert(useInstead, "Expected use.instead action in trace");
  assert(useInstead.result && typeof useInstead.result === "object", "Expected trace result summary object");

  assert(useInstead.result.language === routed.language, "Trace language should match runtime-resolved language");
  assert(useInstead.result.executor === routed.executor, "Trace executor should match runtime executor");
  assert(useInstead.result.via === routed.via, "Trace via should match runtime routing source");
  assert(useInstead.result.confidence === routed.confidence, "Trace confidence should match runtime confidence");

  assert(useInstead.result.via === "rosetta", "Auto-routed use.instead should report via=rosetta");
  assert(useInstead.result.language === "sql", "SQL-shaped auto content should resolve to sql");
  assert(useInstead.result.executor === "native", "Resolved sql route should use native executor");
  assert("outputSummary" in useInstead.result, "Trace summary should include outputSummary");
  assert("policyReason" in useInstead, "use.instead action should always include policyReason field");

  console.log("use.instead trace consistency check passed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});