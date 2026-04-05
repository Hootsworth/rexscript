// Abstracted for edge implementations
const CODE_SUGGESTIONS = {
  ERR001: "Check spelling or remove unknown keyword.",
  ERR002: "Declare the variable before first use.",
  ERR003: "Move action statements out of observation-only contexts.",
  ERR004: "Add an alias using 'as $name'.",
  ERR005: "Use explicit language hint: use.instead:<language> { ... }.",
  ERR006: "Revise content or policy flags to satisfy risk constraints.",
  ERR007: "Remove rex-core access and keep dynamic feature operations isolated.",
  ERR008: "Move otherwise * to the end of the recovery chain.",
  ERR009: "Add a then handler to parallel block.",
  ERR010: "Provide at least one input to synthesise.",
  ERR011: "Create or reopen session before use.",
  ERR012: "Add remember before recall or guard recall with conditions.",
  ERR013: "Ensure tags exist in memory before forgetting.",
  ERR014: "Set an explicit limit on nested parallel blocks.",
  WARN001: "Wrap observe in expect/otherwise or add a fallback path.",
  WARN002: "Wrap navigate in expect/otherwise or add a fallback path.",
  WARN003: "Use explicit policy flags and review high-risk command surface.",
  WARN004: "Set parallel limit to prevent unbounded concurrency.",
  WARN005: "Check synthesis confidence before downstream actions.",
  WARN006: "Use explicit language hint for deterministic routing.",
  WARN007: "Avoid $agent access unless dynamic context truly requires it.",
  WARN020: "Configure security { sandbox: ..., lockdown: strict } before use.instead execution.",
  WARN021: "Wrap interaction primitives in attempt/recover or expect/otherwise.",
  WARN022: "Wrap watch in attempt/recover or expect/otherwise."
};

let DIAG_RISK_INDEX = new Map([
  ["ERR001", "NONE"],
  ["ERR002", "MEDIUM"],
  ["ERR003", "HIGH"],
  ["ERR004", "MEDIUM"],
  ["ERR005", "MEDIUM"],
  ["ERR006", "HIGH"],
  ["ERR007", "HIGH"],
  ["ERR008", "LOW"],
  ["ERR009", "LOW"],
  ["ERR010", "MEDIUM"],
  ["ERR011", "MEDIUM"],
  ["ERR012", "LOW"],
  ["ERR013", "LOW"],
  ["ERR014", "MEDIUM"],
  ["ERR015", "UNKNOWN"],
  ["ERR016", "UNKNOWN"],
  ["WARN001", "MEDIUM"],
  ["WARN002", "MEDIUM"],
  ["WARN003", "HIGH"],
  ["WARN004", "MEDIUM"],
  ["WARN005", "LOW"],
  ["WARN006", "MEDIUM"],
  ["WARN007", "LOW"],
  ["WARN020", "MEDIUM"],
  ["WARN021", "MEDIUM"],
  ["WARN022", "MEDIUM"]
]);

function diagnosticRisk(code) {
  return DIAG_RISK_INDEX.get(code) || "UNKNOWN";
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
