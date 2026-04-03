import path from "node:path";
import { compileFile } from "../../compiler/src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasInt(value) {
  return Number.isInteger(value);
}

function checkRecoveryCompile() {
  const fixture = path.resolve(process.cwd(), "../tests/fixtures/valid/recovery_statements.rex");
  const outFile = path.resolve(process.cwd(), "./.rex-run/recovery_statements.integration.js");

  const result = compileFile(fixture, {
    generatedFile: outFile
  });

  assert(result.ok, "Recovery fixture compilation failed");
  assert(result.code && typeof result.code === "string", "Compiled code missing");
  assert(result.map && typeof result.map === "object", "Source map missing");

  const code = result.code;
  assert(code.includes('if (__rex.isFailure(err, "BlockedByBot"))'), "Missing BlockedByBot recovery branch");
  assert(code.includes("return __rex.retry();"), "Missing retry recovery emission");
  assert(code.includes('else if (__rex.isFailure(err, "QueryFailed"))'), "Missing QueryFailed recovery branch");
  assert(/return\s*\[\s*\]\s*;/.test(code), "Missing use default [] fallback return");
  assert(code.includes("else if (true)"), "Missing wildcard recovery branch");

  const statementMap = result.map.x_rexStatementMap;
  assert(Array.isArray(statementMap), "x_rexStatementMap missing from source map");
  assert(statementMap.length > 0, "x_rexStatementMap must not be empty");

  for (const [i, entry] of statementMap.entries()) {
    assert(hasInt(entry.generatedStatementIndex), `Statement map[${i}] missing generatedStatementIndex`);
    assert(hasInt(entry.sourceLine), `Statement map[${i}] missing sourceLine`);
    assert(hasInt(entry.sourceColumn), `Statement map[${i}] missing sourceColumn`);
    assert(typeof entry.kind === "string" && entry.kind.length > 0, `Statement map[${i}] missing kind`);
  }
}

function checkExpectOtherwiseCompile() {
  const fixture = path.resolve(process.cwd(), "../tests/fixtures/valid/expect_otherwise_flow.rex");
  const outFile = path.resolve(process.cwd(), "./.rex-run/expect_otherwise_flow.integration.js");

  const result = compileFile(fixture, {
    generatedFile: outFile
  });

  assert(result.ok, "expect/otherwise fixture compilation failed");
  assert(result.code.includes("try {"), "Expected lowering to try/catch in generated JS");
  assert(result.code.includes("catch (err)"), "Expected catch block in generated JS");

  const top = result.map?.x_rexStatementMap?.[0];
  assert(top?.kind === "TryCatchStatement", "Top-level statement should map to TryCatchStatement");
  assert(top?.sourceLine === 1, "Top-level statement source line should be 1");
}

function main() {
  checkRecoveryCompile();
  checkExpectOtherwiseCompile();
  console.log("Recovery and source-map check passed.");
}

main();