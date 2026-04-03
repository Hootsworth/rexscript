import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const root = path.resolve(process.cwd(), "../tests/integration/.dynamic-feature-lifecycle");
  const pendingDir = path.join(root, "pending");
  const approvedDir = path.join(root, "approved");
  const tracedDir = path.join(root, "traced");

  const sourceFile = path.join(pendingDir, "feature_when_use_instead.rex");
  const approvalFile = path.join(approvedDir, "feature_when_use_instead.approval.json");
  const compiledFile = path.join(approvedDir, "feature_when_use_instead.compiled.js");
  const compiledMapFile = `${compiledFile}.map`;
  const planTraceFile = path.join(tracedDir, "feature_when_use_instead.plan.trace.json");
  const runtimeTraceFile = path.join(tracedDir, "feature_when_use_instead.runtime.trace.json");
  const lifecycleFile = path.join(root, "lifecycle.report.json");

  assert(fs.existsSync(sourceFile), "Missing pending feature source");
  assert(fs.existsSync(approvalFile), "Missing approval artifact");
  assert(fs.existsSync(compiledFile), "Missing compiled feature artifact");
  assert(fs.existsSync(compiledMapFile), "Missing compiled source map artifact");
  assert(fs.existsSync(planTraceFile), "Missing planned trace artifact");
  assert(fs.existsSync(runtimeTraceFile), "Missing runtime trace artifact");
  assert(fs.existsSync(lifecycleFile), "Missing lifecycle report artifact");

  const approval = readJson(approvalFile);
  assert(approval.status === "approved", "Approval artifact status is not approved");

  const planTrace = readJson(planTraceFile);
  const runtimeTrace = readJson(runtimeTraceFile);
  const lifecycle = readJson(lifecycleFile);

  assert(Array.isArray(lifecycle.states), "Lifecycle report states missing");
  const names = lifecycle.states.map((s) => s.name);
  assert(
    names.join(",") === "pending,approved,compiled,traced",
    `Unexpected lifecycle order: ${names.join(",")}`
  );

  assert(Array.isArray(planTrace.actions), "Plan trace actions missing");
  assert(Array.isArray(runtimeTrace.actions), "Runtime trace actions missing");
  assert(runtimeTrace.actions.length > 0, "Runtime trace has no actions");

  const useInstead = runtimeTrace.actions.find((a) => a.action === "use.instead");
  assert(useInstead, "Runtime trace missing use.instead action");
  assert("xriskDecision" in useInstead, "use.instead missing xriskDecision");
  assert("policyReason" in useInstead, "use.instead missing policyReason");

  console.log("Dynamic feature lifecycle check passed.");
}

main();
