import fs from "node:fs";
import path from "node:path";
import { compileFile } from "../src/index.js";
import { ParserError } from "../src/parser.js";

const args = process.argv.slice(2);
const KNOWN_MODES = new Set(["default", "strict", "dynamic"]);
const target = args.find(a => !a.startsWith("--"));
const nonFlags = args.filter(a => !a.startsWith("--") && a !== target);
const outArg = nonFlags.find(a => !KNOWN_MODES.has(a)) || null;
const mode = nonFlags.find(a => KNOWN_MODES.has(a)) || "default";
const withMap = args.includes("--map");
const dryRun = args.includes("--dry-run");

if (!target) {
  console.error("Usage: node scripts/rex-compile.js <file.rex> [out.js] [default|strict|dynamic] [--map]");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);
const outPath = outArg ? path.resolve(process.cwd(), outArg) : filePath.replace(/\.rex$/i, ".js");

let permittedCapabilities = null;
const capArg = process.argv.find(a => a.startsWith("--capabilities="));
if (capArg) {
  permittedCapabilities = capArg.split("=")[1].split(",").map(s => s.trim());
}

const options = {
  strict: mode === "strict",
  dynamicFeature: mode === "dynamic",
  allowedUseInsteadLanguages: process.env.REX_ALLOWED_USE_INSTEAD_LANGS || null,
  permittedCapabilities
};

try {
  const result = compileFile(filePath, {
    ...options,
    generatedFile: outPath
  });
  if (result.formatted) {
    console.log(result.formatted);
  }
  if (!result.ok) {
    console.error("\nCompilation failed.");
    process.exit(2);
  }

  let code = result.code;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (withMap && result.map) {
    const mapPath = `${outPath}.map`;
    fs.writeFileSync(mapPath, JSON.stringify(result.map, null, 2), "utf8");
    code = `${code}\n//# sourceMappingURL=${path.basename(mapPath)}\n`;
  }

  fs.writeFileSync(outPath, code, "utf8");
  console.log(`\nCompiled to ${outPath}`);
  process.exit(0);
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
