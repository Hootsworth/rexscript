import fs from "node:fs";
import path from "node:path";
import { tokenizeFile, parseFile, analyzeFile, loadPhase1Contracts } from "../src/index.js";
import { ParserError } from "../src/parser.js";

const compilerRoot = path.resolve(process.cwd());
const workspaceRoot = path.resolve(compilerRoot, "..");
const fixturesRoot = path.resolve(workspaceRoot, "tests/fixtures");

function readManifest() {
  const manifestPath = path.resolve(fixturesRoot, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function formatLoc(loc) {
  if (!loc || !loc.start) {
    return "?:?";
  }
  const line = loc.start.line ?? "?";
  const column = loc.start.column ?? "?";
  return `${line}:${column}`;
}

function optionsFromMode(mode, entry = {}) {
  return {
    strict: mode === "strict",
    dynamicFeature: mode === "dynamic",
    allowedUseInsteadLanguages: entry.allowedUseInsteadLanguages || null
  };
}

function run() {
  const contracts = loadPhase1Contracts(compilerRoot);
  const manifest = readManifest();

  const summary = [];

  for (const entry of manifest.valid) {
    const absPath = path.resolve(fixturesRoot, entry.file);
    const tokens = tokenizeFile(absPath);
    const ast = parseFile(absPath);
    const diagnostics = analyzeFile(absPath, optionsFromMode(entry.mode, entry));

    summary.push({
      file: entry.file,
      type: "valid",
      tokenCount: tokens.length,
      hasUnknownTokens: tokens.some((t) => t.type === "UNKNOWN"),
      astNodes: ast.body.length,
      errors: diagnostics.errors.map((e) => e.code),
      warnings: diagnostics.warnings.map((w) => w.code),
      diagnostics
    });
  }

  for (const entry of manifest.invalid) {
    const absPath = path.resolve(fixturesRoot, entry.file);
    const tokens = tokenizeFile(absPath);

    let hitCode = null;
    try {
      parseFile(absPath);
      const diagnostics = analyzeFile(absPath, optionsFromMode(entry.mode, entry));
      hitCode = diagnostics.errors[0]?.code || null;
      summary.push({
        file: entry.file,
        type: "invalid",
        tokenCount: tokens.length,
        hasUnknownTokens: tokens.some((t) => t.type === "UNKNOWN"),
        expected: entry.expectError,
        actual: hitCode,
        pass: hitCode === entry.expectError,
        diagnostics,
        mode: entry.mode || "default"
      });
    } catch (err) {
      if (err instanceof ParserError) {
        hitCode = err.code;
        summary.push({
          file: entry.file,
          type: "invalid",
          tokenCount: tokens.length,
          hasUnknownTokens: tokens.some((t) => t.type === "UNKNOWN"),
          expected: entry.expectError,
          actual: hitCode,
          pass: hitCode === entry.expectError,
          diagnostics: {
            errors: [
              {
                code: err.code,
                message: err.message,
                loc: { start: { line: err.line, column: err.column } }
              }
            ],
            warnings: []
          },
          mode: entry.mode || "default"
        });
      } else {
        throw err;
      }
    }
  }

  for (const entry of manifest.warnings) {
    const absPath = path.resolve(fixturesRoot, entry.file);
    const tokens = tokenizeFile(absPath);
    const diagnostics = analyzeFile(absPath, optionsFromMode(entry.mode, entry));

    const warningCodes = diagnostics.warnings.map((w) => w.code);
    summary.push({
      file: entry.file,
      type: "warning",
      tokenCount: tokens.length,
      hasUnknownTokens: tokens.some((t) => t.type === "UNKNOWN"),
      expected: entry.expectWarning,
      warnings: warningCodes,
      pass: warningCodes.includes(entry.expectWarning),
      diagnostics,
      mode: entry.mode || "default"
    });
  }

  console.log("Phase 1 smoke check complete");
  console.log(`AST contract version: ${contracts.astContracts.version}`);
  console.log(`Diagnostics version: ${contracts.diagnostics.version}`);
  for (const row of summary) {
    if (row.type === "invalid" || row.type === "warning") {
      const firstDiag =
        row.type === "invalid"
          ? row.diagnostics?.errors?.[0]
          : row.diagnostics?.warnings?.find((d) => d.code === row.expected);
      const locText = firstDiag ? formatLoc(firstDiag.loc) : "?:?";
      console.log(
        `- ${row.file} [${row.mode || "default"}]: tokens=${row.tokenCount}, unknown=${row.hasUnknownTokens}, expected=${row.expected}, pass=${row.pass}, at=${locText}`
      );
      continue;
    }
    console.log(
      `- ${row.file}: tokens=${row.tokenCount}, unknown=${row.hasUnknownTokens}, astNodes=${row.astNodes}, errors=${row.errors.length}`
    );
  }
}

run();
