import path from "node:path";
import { checkFile } from "../../compiler/src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const target = path.resolve(process.cwd(), "../tests/fixtures/invalid/err006_use_instead_policy_blocked.rex");
  const result = checkFile(target, {
    allowedUseInsteadLanguages: ["sql"]
  });

  const out = result.formatted || "";
  assert(out.includes("Code: ERR006"), "Expected ERR006 code in formatted diagnostics");
  assert(out.includes("Suggestion:"), "Formatted diagnostics must include Suggestion");
  assert(out.includes("Risk:"), "Formatted diagnostics must include Risk");
  assert(out.includes("allowed:"), "Policy diagnostics should include allowed language context");

  console.log("Diagnostic format check passed.");
}

main();
