import fs from "node:fs";
import path from "node:path";
import { tokenize, loadKeywords } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { generate } from "./codegen.js";
import { formatDiagnostics, readSource } from "./diagnostic-format.js";

export function tokenizeFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return tokenize(source);
}

export function parseFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return parse(source);
}

export function analyzeFile(filePath, options = {}) {
  const ast = parseFile(filePath);
  return analyze(ast, options);
}

export function checkFile(filePath, options = {}) {
  const source = readSource(filePath);
  const ast = parse(source);
  const diagnostics = analyze(ast, options);
  const merged = [...diagnostics.errors, ...diagnostics.warnings];
  return {
    diagnostics,
    formatted: formatDiagnostics(merged, filePath, source)
  };
}

export function compileFile(filePath, options = {}) {
  const source = readSource(filePath);
  const ast = parse(source);
  const diagnostics = analyze(ast, options);
  if (diagnostics.errors.length > 0) {
    return {
      ok: false,
      diagnostics,
      code: null,
      formatted: formatDiagnostics([...diagnostics.errors, ...diagnostics.warnings], filePath, source)
    };
  }

  const generatedFile = options.generatedFile || filePath.replace(/\.rex$/i, ".js");
  const generated = generate(ast, {
    sourceFile: filePath,
    generatedFile
  });

  return {
    ok: true,
    diagnostics,
    code: generated.code,
    map: generated.map,
    formatted: formatDiagnostics(diagnostics.warnings, filePath, source)
  };
}

export function loadPhase1Contracts(rootDir = process.cwd()) {
  const diagnosticsPath = path.resolve(rootDir, "contracts/diagnostics.json");
  const astPath = path.resolve(rootDir, "contracts/ast-nodes.json");

  return {
    diagnostics: JSON.parse(fs.readFileSync(diagnosticsPath, "utf8")),
    astContracts: JSON.parse(fs.readFileSync(astPath, "utf8")),
    keywords: [...loadKeywords(path.resolve(rootDir, "contracts/reserved-keywords.txt"))]
  };
}
