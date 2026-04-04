import fs from "node:fs";
import path from "node:path";
import { parseFile, analyzeFile } from "../src/index.js";
import { buildTracePlan } from "../src/trace-plan.js";
import { ParserError } from "../src/parser.js";

const target = process.argv[2];
const secondArg = process.argv[3] || null;
const thirdArg = process.argv[4] || null;
const KNOWN_MODES = new Set(["default", "strict", "dynamic"]);

const outArg = secondArg && !KNOWN_MODES.has(secondArg) ? secondArg : null;
const mode = outArg ? (thirdArg || "default") : (secondArg || "default");

if (!target) {
  console.error("Usage: node scripts/rex-trace.js <file.rex> [out.json] [default|strict|dynamic]");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);
const options = {
  strict: mode === "strict",
  dynamicFeature: mode === "dynamic"
};

try {
  const diagnostics = analyzeFile(filePath, options);
  if (diagnostics.errors.length > 0) {
    console.error(`Trace aborted: ${diagnostics.errors.length} compile error(s).`);
    process.exit(2);
  }

  const ast = parseFile(filePath);
  const trace = buildTracePlan(ast, filePath);
  trace.diagnostics = {
    warnings: diagnostics.warnings,
    errors: diagnostics.errors
  };

  const out = JSON.stringify(trace, null, 2);
  if (outArg) {
    const outPath = path.resolve(process.cwd(), outArg);
    fs.writeFileSync(outPath, out, "utf8");
    console.log(`Trace written to ${outPath}`);
  } else {
    console.log(out);
  }
} catch (err) {
  if (err instanceof ParserError) {
    const line = err.line ?? "?";
    const col = err.column ?? "?";
    console.error(`RexError [${filePath}:${line}:${col}]`);
    console.error(`  ${err.message}`);
    console.error(`\n  Code: ${err.code}`);
    process.exit(2);
  }
  console.error(err.message);
  process.exit(1);
}
