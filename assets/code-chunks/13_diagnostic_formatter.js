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
