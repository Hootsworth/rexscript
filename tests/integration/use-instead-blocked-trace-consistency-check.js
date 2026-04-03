import xrisk from "../../packages/xrisk/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreEnv(name, previous) {
  if (previous == null) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

async function main() {
  xrisk.resetTrace();

  const previousAllowed = process.env.REX_ALLOWED_USE_INSTEAD_LANGS;
  process.env.REX_ALLOWED_USE_INSTEAD_LANGS = "sql";

  try {
    await xrisk.before({
      action: "use.instead",
      capability: "FOREIGN_EXEC",
      target: JSON.stringify("auto"),
      loc: { line: 1, column: 1 }
    });

    let blocked = false;
    try {
      await xrisk.after({
        action: "use.instead",
        riskLevel: "LOW",
        result: {
          language: "bash",
          executor: "native",
          confidence: 0.82,
          via: "rosetta",
          output: {
            command: "echo",
            stdout: "blocked"
          }
        },
        loc: { line: 1, column: 1 }
      });
    } catch (err) {
      blocked = err?.name === "ForeignLanguageBlocked" || err?.code === "ForeignLanguageBlocked";
    }

    assert(blocked, "Expected ForeignLanguageBlocked from xrisk.after use.instead policy enforcement");

    const trace = xrisk.getTrace();
    assert(Array.isArray(trace.actions), "trace.actions should be present");

    const useInstead = trace.actions.find((action) => action.action === "use.instead");
    assert(useInstead, "Expected use.instead action in trace");
    assert(useInstead.xriskDecision === "BLOCK", "Expected BLOCK decision for disallowed resolved language");
    assert(typeof useInstead.policyReason === "string" && useInstead.policyReason.includes("denied by policy"), "Expected policyReason to describe deny decision");

    assert(useInstead.result && typeof useInstead.result === "object", "Expected use.instead result summary object");
    const required = ["language", "executor", "confidence", "via", "outputSummary"];
    for (const key of required) {
      assert(key in useInstead.result, `Blocked use.instead trace summary missing key: ${key}`);
    }
    assert(useInstead.result.language === "bash", "Expected blocked trace summary to preserve resolved language");
    assert(useInstead.result.via === "rosetta", "Expected blocked trace summary to preserve routing source");

    const errors = trace?.diagnostics?.errors || [];
    const policyErr = errors.find((d) => d.code === "ForeignLanguageBlocked");
    assert(policyErr, "Expected ForeignLanguageBlocked diagnostic in trace errors");

    console.log("use.instead blocked trace consistency check passed.");
  } finally {
    restoreEnv("REX_ALLOWED_USE_INSTEAD_LANGS", previousAllowed);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});