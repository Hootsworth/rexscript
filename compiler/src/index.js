import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, REX_KEYWORDS, loadKeywordsFromString } from "./lexer.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";
import { generate } from "./codegen.js";
import { formatDiagnostics } from "./diagnostic-format.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const compilerRoot = path.resolve(moduleDir, "..");

function resolveCompilerContractPath(rootDir, relativePath) {
  const candidates = [
    path.resolve(rootDir, relativePath),
    path.resolve(rootDir, "compiler", relativePath),
    path.resolve(compilerRoot, relativePath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function readSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function loadKeywords(keywordsPath) {
  const p = keywordsPath || resolveCompilerContractPath(process.cwd(), "contracts/reserved-keywords.txt");
  if (fs.existsSync(p)) {
    return loadKeywordsFromString(fs.readFileSync(p, "utf8"));
  }
  return REX_KEYWORDS;
}

export function tokenizeFile(filePath) {
  const source = readSource(filePath);
  return tokenize(source);
}

export function parseFile(filePath) {
  const source = readSource(filePath);
  return parse(source);
}

export function analyzeFile(filePath, options = {}) {
  const ast = parseFile(filePath);
  return analyze(ast, options);
}

export function checkFile(filePath, options = {}) {
  const source = readSource(filePath);
  return checkString(source, filePath, options);
}

export function checkString(source, filePath = "snippet.rex", options = {}) {
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
  return compileString(source, filePath, options);
}

export function compileString(source, filePath = "snippet.rex", options = {}) {
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
  const diagnosticsPath = resolveCompilerContractPath(rootDir, "contracts/diagnostics.json");
  const astPath = resolveCompilerContractPath(rootDir, "contracts/ast-nodes.json");

  return {
    diagnostics: JSON.parse(fs.readFileSync(diagnosticsPath, "utf8")),
    astContracts: JSON.parse(fs.readFileSync(astPath, "utf8")),
    keywords: [...loadKeywords(resolveCompilerContractPath(rootDir, "contracts/reserved-keywords.txt"))]
  };
}
