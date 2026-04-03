import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { checkFile } from "../../compiler/src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const explicitFixture = path.resolve(process.cwd(), "../tests/fixtures/invalid/err006_use_instead_policy_blocked.rex");
  const explicitResult = checkFile(explicitFixture, {
    allowedUseInsteadLanguages: ["sql"]
  });

  const explicitErrorCodes = explicitResult.diagnostics.errors.map((d) => d.code);
  assert(explicitErrorCodes.includes("ERR006"), "Expected ERR006 for policy-blocked explicit use.instead language");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rexscript-compiler-policy-"));
  try {
    const inferredFixture = path.join(tmpDir, "inferred_policy_blocked.rex");
    fs.writeFileSync(
      inferredFixture,
      "use.instead as $rows {\n  SELECT id FROM rows LIMIT 1\n}\n",
      "utf8"
    );

    const inferredResult = checkFile(inferredFixture, {
      allowedUseInsteadLanguages: ["regex"]
    });

    const inferredErrorCodes = inferredResult.diagnostics.errors.map((d) => d.code);
    assert(inferredErrorCodes.includes("ERR006"), "Expected ERR006 for policy-blocked inferred use.instead language");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log("Compiler policy check passed.");
}

main();
