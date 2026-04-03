const xrisk = {
  async before(event = {}) {
    const risk = evaluateBeforeRisk(event);
    __pending.push({
      action: event.action || "unknown",
      capability: event.capability || "NONE",
      target: event.target ?? null,
      loc: event.loc ?? null,
      xriskDecision: risk.decision,
      policyReason: risk.message ?? null,
      startedAt: Date.now(),
      timestamp: nowIso()
    });
    if (risk.decision === "BLOCK") {
      throw makeXriskError(risk.failure, risk.message);
    }
    return { decision: risk.decision };
  },

  async after(event = {}) {
    const pending = __pending.pop() || {
      action: event.action || "unknown",
      capability: "NONE",
      target: null,
      startedAt: Date.now(),
      timestamp: nowIso()
    };

    const risk = evaluateAfterRisk(pending, event);
    const decision = risk.decision === "BLOCK" ? "BLOCK" : pending.xriskDecision || "ALLOW";
    __actions.push({
      action: pending.action,
      kind: pending.action,
      riskLevel: event.riskLevel || "LOW",
      capability: pending.capability,
      target: pending.target,
      xriskDecision: decision,
      policyReason: risk.message ?? pending.policyReason ?? null,
      timestamp: pending.timestamp,
      result: summarizeResult(event.result),
      loc: pending.loc ?? event.loc ?? null
    });

    if (risk.decision === "BLOCK") {
      throw makeXriskError(risk.failure, risk.message);
    }
    return { stored: true };
  }
};
