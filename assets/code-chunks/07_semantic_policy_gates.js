if (stmt.kind === "UseInsteadStatement") {
  if (includesSensitivePattern(stmt.content)) {
    pushDiagnostic(
      state,
      "error",
      "ERR006",
      "RiskBlocked at compile time due to known-dangerous credential pattern",
      stmt.loc
    );
  }

  const content = String(stmt.content || "").toLowerCase();
  const hasRexCore = /rex\s*-\s*core/.test(content) || content.includes("rex-core");
  if (state.options.dynamicFeature && hasRexCore) {
    pushDiagnostic(state, "error", "ERR007", "Dynamic feature isolation contract violation", stmt.loc);
  }

  if (stmt.languageHint === "bash") {
    pushDiagnostic(state, "warning", "WARN003", "use.instead:bash is high risk", stmt.loc);
  }

  const allowed = state.options.allowedUseInsteadLanguages;
  if (allowed && stmt.languageHint && stmt.languageHint !== "auto") {
    const hint = String(stmt.languageHint).toLowerCase();
    if (!allowed.has(hint)) {
      const allowedText = formatAllowedUseInsteadLanguages(allowed);
      pushDiagnostic(
        state,
        "error",
        "ERR006",
        `RiskBlocked at compile time: use.instead:${hint} denied by policy allowlist (allowed: ${allowedText})`,
        stmt.loc
      );
    }
  }
}
