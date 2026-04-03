import path from "node:path";
import { checkFile } from "../../compiler/src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const fixture = path.resolve(process.cwd(), "../tests/fixtures/invalid/err006_use_instead_policy_blocked.rex");
  const result = checkFile(fixture, {
    allowedUseInsteadLanguages: ["sql"]
  });

  const errorCodes = result.diagnostics.errors.map((d) => d.code);
  assert(errorCodes.includes("ERR006"), "Expected ERR006 for policy-blocked use.instead language");
  console.log("Compiler policy check passed.");
}

main();
