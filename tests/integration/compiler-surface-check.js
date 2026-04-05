import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileString, checkString, loadPhase1Contracts } from "../../compiler/src/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkRawFindCompilation() {
  const result = compileString('find "pricing" in { title: "Pricing" } as $match\n', "raw-find.rex");
  assert(result.ok, "raw find snippet should compile");
  assert(
    result.code.includes('__rex.find("pricing", title: "Pricing")') === false,
    "raw find should compile as a valid JS expression"
  );
  assert(
    result.code.includes('__rex.find("pricing", { title: "Pricing" })'),
    "raw find should preserve raw source instead of compiling to null"
  );
}

function checkUseInsteadFormatting() {
  const source = 'use.instead:python {\nif True:\n  result = 1\n}\n';
  const result = compileString(source, "use-instead.rex");
  assert(result.ok, "use.instead python snippet should compile");
  assert(
    result.code.includes('content: "\\nif True:\\n  result = 1\\n"'),
    "use.instead should preserve multiline body formatting"
  );
}

function checkUnterminatedStringDiagnostic() {
  let hit = false;
  try {
    checkString('workspace "broken {\n', "unterminated.rex");
  } catch (err) {
    hit = err?.code === "ERR001" && String(err.message).includes("Unterminated string literal");
  }
  assert(hit, "unterminated string should raise a parser error");
}

function checkContractsResolution() {
  const contracts = loadPhase1Contracts(repoRoot);
  assert(contracts.diagnostics?.version, "contracts should resolve from the compiler directory");
  assert(contracts.astContracts?.version, "AST contracts should resolve from the compiler directory");
}

function checkCompileDryRun() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rexscript-dry-run-"));
  try {
    const sourceFile = path.join(tmpDir, "sample.rex");
    const outFile = path.join(tmpDir, "sample.js");
    fs.writeFileSync(sourceFile, 'workspace "dry-run" { }\n', "utf8");

    const proc = spawnSync(
      "node",
      [path.join(repoRoot, "compiler/scripts/rex-compile.js"), sourceFile, outFile, "--dry-run"],
      {
        cwd: repoRoot,
        encoding: "utf8"
      }
    );

    assert((proc.status ?? 1) === 0, `dry-run compile should succeed: ${proc.stderr || proc.stdout}`);
    assert(!fs.existsSync(outFile), "dry-run compile should not write the output file");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function checkExtremePrimitiveContracts() {
  const source = [
    'extract { price: number, inStock: boolean } from $page as $data',
    'verify $missing.price is "ok"',
    'watch "https://example.com" for "available" until 5q as $page',
    'budget max_unknown=1 { synthesise [$page] as $summary }'
  ];

  const extractResult = compileString(
    `observe page "data:text/html,<html><body>Price 19.99 In stock true</body></html>" as $page\n${source[0]}\n`,
    "extreme-contracts.rex"
  );
  assert(extractResult.ok, "extract contract snippet should compile");
  assert(
    extractResult.code.includes('__rex.extract({"price":"number","inStock":"boolean"}, $page)'),
    "extract should compile typed schema entries as string literals"
  );

  const verifyResult = checkString(`${source[1]}\n`, "verify-extreme.rex");
  assert(
    verifyResult.diagnostics.errors.some((diag) => diag.code === "ERR002"),
    "verify should fail when root variable is undeclared"
  );

  let invalidWatch = false;
  try {
    checkString(`${source[2]}\n`, "watch-invalid-unit.rex");
  } catch (err) {
    invalidWatch = err?.code === "ERR001";
  }
  assert(invalidWatch, "watch should reject invalid duration units");

  let invalidBudget = false;
  try {
    checkString(`${source[3]}\n`, "budget-invalid-key.rex");
  } catch (err) {
    invalidBudget = err?.code === "ERR001";
  }
  assert(invalidBudget, "budget should reject unknown constraint keys");
}

function main() {
  checkRawFindCompilation();
  checkUseInsteadFormatting();
  checkUnterminatedStringDiagnostic();
  checkContractsResolution();
  checkCompileDryRun();
  checkExtremePrimitiveContracts();
  console.log("Compiler surface check passed.");
}

main();
