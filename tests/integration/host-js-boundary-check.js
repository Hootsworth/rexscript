import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileFile } from "../../compiler/src/index.js";

function fail(message) {
  throw new Error(message);
}

function main() {
  const fixture = path.resolve(process.cwd(), "../tests/fixtures/valid/host_js_newline_boundaries.rex");
  const outDir = path.resolve(process.cwd(), ".rex-run");
  const outFile = path.join(outDir, "host_js_newline_boundaries.compiled.js");

  const result = compileFile(fixture, {
    strict: false,
    dynamicFeature: false,
    generatedFile: outFile
  });

  if (!result.ok) {
    fail("host JS boundary fixture failed compilation");
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, result.code, "utf8");

  const check = spawnSync("node", ["--check", outFile], {
    encoding: "utf8"
  });

  if (check.error) {
    fail(`node --check failed to execute: ${check.error.message}`);
  }

  if ((check.status ?? 0) !== 0) {
    const stderr = String(check.stderr || "").trim();
    fail(`compiled host JS output is invalid syntax: ${stderr || "unknown syntax error"}`);
  }

  console.log("Host JS boundary check passed.");
}

main();
