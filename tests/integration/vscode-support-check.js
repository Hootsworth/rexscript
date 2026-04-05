import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function includesAny(haystack, values) {
  return values.some((value) => haystack.includes(value));
}

function main() {
  const extensionRoot = path.join(repoRoot, "extensions", "vscode-rexscript");

  const manifestPath = path.join(extensionRoot, "package.json");
  const grammarPath = path.join(extensionRoot, "syntaxes", "rexscript.tmLanguage.json");
  const iconThemePath = path.join(extensionRoot, "icons", "rex-icon-theme.json");

  assert(fs.existsSync(manifestPath), "VS Code extension manifest missing");
  assert(fs.existsSync(grammarPath), "RexScript TextMate grammar missing");
  assert(fs.existsSync(iconThemePath), "RexScript icon theme mapping missing");

  const manifest = readJson(manifestPath);
  const grammar = readJson(grammarPath);
  const iconTheme = readJson(iconThemePath);
  const extensionSource = fs.readFileSync(path.join(extensionRoot, "extension.js"), "utf8");

  const contributes = manifest.contributes || {};
  const languages = contributes.languages || [];
  const grammars = contributes.grammars || [];
  const commands = contributes.commands || [];
  const activationEvents = manifest.activationEvents || [];

  const rexLanguage = languages.find((entry) => entry.id === "rexscript");
  assert(rexLanguage, "Manifest missing rexscript language contribution");
  assert(Array.isArray(rexLanguage.extensions) && rexLanguage.extensions.includes(".rex"), "rexscript language contribution must include .rex extension");
  assert(rexLanguage.icon && rexLanguage.icon.light && rexLanguage.icon.dark, "rexscript language contribution should define light/dark icon paths");

  const rexGrammar = grammars.find((entry) => entry.language === "rexscript");
  assert(rexGrammar, "Manifest missing rexscript grammar contribution");
  assert(rexGrammar.scopeName === "source.rexscript", "rexscript grammar scope name should be source.rexscript");
  assert(activationEvents.includes("onLanguage:rexscript"), "Manifest should activate on rexscript language");

  const requiredCommands = [
    "rexscript.openMenu",
    "rexscript.check",
    "rexscript.compile",
    "rexscript.run",
    "rexscript.trace"
  ];

  for (const commandName of requiredCommands) {
    const command = commands.find((entry) => entry.command === commandName);
    assert(command, `Missing command contribution: ${commandName}`);
    assert(command.category === "RexScript", `Command ${commandName} must be in RexScript category`);
  }

  const fileExtensions = iconTheme.fileExtensions || {};
  assert(fileExtensions.rex === "rexscript-file", "Icon theme should map .rex extension to rexscript-file icon");

  assert(grammar.scopeName === "source.rexscript", "Grammar root scope must be source.rexscript");
  assert(grammar.repository && grammar.repository.keywords, "Grammar repository is missing keywords section");

  const keywordPatterns = (grammar.repository.keywords.patterns || [])
    .map((entry) => String(entry.match || ""))
    .join(" ");

  const preferredRecoveryTokens = ["expect", "otherwise"];
  assert(includesAny(keywordPatterns, preferredRecoveryTokens), "Grammar keywords must include expect/otherwise flow tokens");
  assert(keywordPatterns.includes("try") && keywordPatterns.includes("catch"), "Grammar keywords should retain legacy try/catch compatibility tokens");
  assert(keywordPatterns.includes("use\\.instead"), "Grammar keywords should include use.instead token");
  assert(keywordPatterns.includes("extract") && keywordPatterns.includes("watch") && keywordPatterns.includes("verify"), "Grammar keywords should include extreme primitives");
  assert(extensionSource.includes("registerCompletionItemProvider"), "Extension should register completion provider");
  assert(extensionSource.includes("registerHoverProvider"), "Extension should register hover provider");
  assert(extensionSource.includes("registerCodeActionsProvider"), "Extension should register code action provider");

  console.log("VS Code RexScript support check passed.");
}

main();
