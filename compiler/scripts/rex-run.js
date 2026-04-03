import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileFile } from "../src/index.js";
import { ParserError } from "../src/parser.js";

const target = process.argv[2];
const mode = process.argv[3] || "default";
const dryRun = process.argv.includes("--dry-run");
const traceOutIndex = process.argv.indexOf("--trace-out");
const traceOut = traceOutIndex >= 0 ? process.argv[traceOutIndex + 1] : null;

if (!target) {
  console.error("Usage: node scripts/rex-run.js <file.rex> [default|strict|dynamic] [--dry-run] [--trace-out <file.json>]");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);
const options = {
  strict: mode === "strict",
  dynamicFeature: mode === "dynamic",
  allowedUseInsteadLanguages: process.env.REX_ALLOWED_USE_INSTEAD_LANGS || null
};

try {
  const result = compileFile(filePath, options);
  if (result.formatted) {
    console.log(result.formatted);
  }
  if (!result.ok) {
    console.error("\nRun aborted: compilation failed.");
    process.exit(2);
  }

  const tmpDir = path.resolve(process.cwd(), ".rex-run");
  fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `${path.basename(filePath).replace(/\.rex$/i, "")}.compiled.js`);
  fs.writeFileSync(outPath, result.code, "utf8");

  if (dryRun) {
    console.log(`\nDry run complete. Compiled output at ${outPath}`);
    process.exit(0);
  }

  const env = {
    ...process.env
  };
  env.REX_SOURCE_FILE = filePath;
  if (traceOut) {
    env.REX_TRACE_OUT = path.resolve(process.cwd(), traceOut);
  }

  const proc = spawnSync("node", [outPath], { stdio: "inherit", env });
  if (proc.error) {
    console.error(`Execution failed: ${proc.error.message}`);
    process.exit(1);
  }
  process.exit(proc.status ?? 0);
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
