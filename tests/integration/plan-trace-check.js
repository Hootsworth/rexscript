import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileFile, parseFile } from "../../compiler/src/index.js";
import { buildTracePlan } from "../../compiler/src/trace-plan.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const fixture = path.join(repoRoot, "tests/fixtures/valid/plan_step_flow.rex");
  const tmpDir = path.join(repoRoot, "compiler/.rex-run");
  const compiledPath = path.join(tmpDir, "plan_step_flow.compiled.js");
  const runtimeTracePath = path.join(tmpDir, "plan_step_flow.runtime.trace.json");
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const result = compileFile(fixture, {
      generatedFile: compiledPath
    });

    assert(result.ok, "plan fixture should compile");
    const staticTrace = buildTracePlan(parseFile(fixture), fixture);
    assert(staticTrace.planCount === 1, "static plan trace should record one plan");
    assert(Array.isArray(staticTrace.plans) && staticTrace.plans[0]?.steps?.length === 2, "static plan trace should record both steps");
    fs.writeFileSync(compiledPath, result.code, "utf8");

    const proc = spawnSync("node", [compiledPath], {
      encoding: "utf8",
      cwd: path.join(repoRoot, "compiler"),
      env: {
        ...process.env,
        REX_SOURCE_FILE: fixture,
        REX_TRACE_OUT: runtimeTracePath
      }
    });

    if (proc.error) {
      throw proc.error;
    }

    assert((proc.status ?? 1) === 0, `compiled plan fixture failed to run: ${proc.stderr || proc.stdout}`);
    assert(fs.existsSync(runtimeTracePath), "runtime trace for plan fixture was not written");

    const trace = JSON.parse(fs.readFileSync(runtimeTracePath, "utf8"));
    assert(Array.isArray(trace.actions), "trace actions missing");
    assert(Array.isArray(trace.plans), "trace plans missing");
    assert(trace.planCount === 1, "trace planCount should be 1");

    const planSummary = trace.plans[0];
    assert(planSummary?.name === "Research pricing changes", "plan summary name mismatch");
    assert(Array.isArray(planSummary.steps) && planSummary.steps.length === 2, "plan should record two steps");
    assert(planSummary.steps[0]?.title === "Capture source page", "first step title mismatch");
    assert(planSummary.steps[1]?.title === "Summarise pricing notes", "second step title mismatch");

    const actionNames = trace.actions.map((action) => action.action);
    for (const name of ["plan_start", "step_start", "observe", "step_end", "synthesise", "plan_end"]) {
      assert(actionNames.includes(name), `expected action ${name} in runtime trace`);
    }

    console.log("Plan trace check passed.");
  } finally {
    fs.rmSync(compiledPath, { force: true });
    fs.rmSync(runtimeTracePath, { force: true });
  }
}

main();
