import path from "node:path";
import { checkFile } from "../src/index.js";
import { ParserError } from "../src/parser.js";

const target = process.argv[2];
const mode = process.argv[3] || "default";

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
  if (result.formatted) {
    console.log(result.formatted);
  }
  const errorCount = result.diagnostics.errors.length;
  const warningCount = result.diagnostics.warnings.length;
  console.log(`\nSummary: errors=${errorCount}, warnings=${warningCount}`);
  process.exit(errorCount > 0 ? 2 : 0);
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
