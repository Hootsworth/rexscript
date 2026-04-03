import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CODE_SUGGESTIONS = {
  ERR001: "Check spelling or remove unknown keyword.",
  ERR002: "Declare the variable before first use.",
  ERR003: "Move action statements out of observation-only contexts.",
  ERR004: "Add an alias using 'as $name'.",
  ERR005: "Use explicit language hint: use.instead:<language> { ... }.",
  ERR006: "Revise content or policy flags to satisfy risk constraints.",
  ERR007: "Remove rex-core access and keep dynamic feature operations isolated.",
  ERR008: "Move catch * to the end of the catch chain.",
  ERR009: "Add a then handler to parallel block.",
  ERR010: "Provide at least one input to synthesise.",
  ERR011: "Create or reopen session before use.",
  ERR012: "Add remember before recall or guard recall with conditions.",
  ERR013: "Ensure tags exist in memory before forgetting.",
  ERR014: "Set an explicit limit on nested parallel blocks.",
  WARN001: "Wrap observe in try/catch or add a fallback path.",
  WARN002: "Wrap navigate in try/catch or add a fallback path.",
  WARN003: "Use explicit policy flags and review high-risk command surface.",
  WARN004: "Set parallel limit to prevent unbounded concurrency.",
  WARN005: "Check synthesis confidence before downstream actions.",
  WARN006: "Use explicit language hint for deterministic routing.",
  WARN007: "Avoid $agent access unless dynamic context truly requires it."
};

let DIAG_RISK_INDEX = null;

function loadRiskIndex() {
  if (DIAG_RISK_INDEX) {
    return DIAG_RISK_INDEX;
  }

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.resolve(here, "../contracts/diagnostics.json");
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const out = new Map();
    for (const entry of [...(json.errors || []), ...(json.warnings || [])]) {
      if (entry?.id) {
        out.set(entry.id, String(entry.riskIfIgnored || "UNKNOWN").toUpperCase());
      }
    }
    DIAG_RISK_INDEX = out;
    return DIAG_RISK_INDEX;
  } catch {
    DIAG_RISK_INDEX = new Map();
    return DIAG_RISK_INDEX;
  }
}

function diagnosticRisk(code) {
  return loadRiskIndex().get(code) || "UNKNOWN";
}

function diagnosticSuggestion(code) {
  return CODE_SUGGESTIONS[code] || "Review this diagnostic and apply the smallest safe fix.";
}

function getLineText(source, line) {
  if (!source || !line || line < 1) {
    return "";
  }
  const lines = source.split(/\r?\n/);
  return lines[line - 1] || "";
}

function caretForColumn(column) {
  if (!column || column < 1) {
    return "^";
  }
  return `${" ".repeat(column - 1)}^`;
}

export function formatDiagnostic(diag, filePath, source = "") {
  const severity = diag.severity === "warning" ? "RexWarning" : "RexError";
  const line = diag?.loc?.start?.line ?? "?";
  const col = diag?.loc?.start?.column ?? "?";
  const lineText = getLineText(source, typeof line === "number" ? line : -1);
  const pointer = typeof col === "number" ? caretForColumn(col) : "^";

  let out = `${severity} [${filePath}:${line}:${col}]\n`;
  out += `  ${diag.message}\n`;
  if (lineText) {
    out += `\n  ${line} | ${lineText}\n`;
    out += `      ${pointer}\n`;
  }
  out += `\n  Code: ${diag.code}`;
  out += `\n  Suggestion: ${diagnosticSuggestion(diag.code)}`;
  out += `\n  Risk: ${diagnosticRisk(diag.code)}`;
  return out;
}

export function formatDiagnostics(diags, filePath, source = "") {
  return diags.map((d) => formatDiagnostic(d, filePath, source)).join("\n\n");
}

export function readSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}
