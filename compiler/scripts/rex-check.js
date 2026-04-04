import path from "node:path";
import { checkFile } from "../src/index.js";
import { ParserError } from "../src/parser.js";

const target = process.argv[2];
const mode = process.argv.find(a => !a.startsWith("--") && a !== target) || "default";
const asJson = process.argv.includes("--json");

if (!target) {
  console.error("Usage: node scripts/rex-check.js <file.rex> [default|strict|dynamic]");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);
const options = {
  strict: mode === "strict",
  dynamicFeature: mode === "dynamic",
  allowedUseInsteadLanguages: process.env.REX_ALLOWED_USE_INSTEAD_LANGS || null
};

try {
  const result = checkFile(filePath, options);
  if (asJson) {
    console.log(JSON.stringify(result.diagnostics, null, 2));
    process.exit(result.diagnostics.errors.length > 0 ? 2 : 0);
  }
  if (result.formatted) {
    console.log(result.formatted);
  }
  const errorCount = result.diagnostics.errors.length;
  const warningCount = result.diagnostics.warnings.length;
  console.log(`\nSummary: errors=${errorCount}, warnings=${warningCount}`);
  process.exit(errorCount > 0 ? 2 : 0);
} catch (err) {
  if (asJson) {
     if (err instanceof ParserError) {
       console.log(JSON.stringify({ errors: [{ type: "error", code: err.code, message: err.message, loc: { line: err.line, column: err.column } }], warnings: [] }));
       process.exit(2);
     }
     console.log(JSON.stringify({ errors: [{ type: "error", code: "FATAL", message: err.message }], warnings: [] }));
     process.exit(1);
  }

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
