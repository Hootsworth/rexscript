import fs from "node:fs";
import path from "node:path";

const __pending = [];
const __actions = [];
const __diagnostics = {
  warnings: [],
  errors: []
};
const __sessionId = `session-${Math.floor(Date.now() / 1000)}`;

function nowIso() {
  return new Date().toISOString();
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(items, seed, offset = 0) {
  return items[(seed + offset) % items.length];
}

function buildHaiku(seedText) {
  const seed = hashString(seedText);
  const line1 = ["pages drift at dusk", "signals cross the wire", "footsteps in the logs", "queries touch the dark"];
  const line2 = [
    "the agent names each failure",
    "parallel thoughts hold the line",
    "traces bloom in silence",
    "context binds each decision"
  ];
  const line3 = ["nothing stays untraced", "the answer leaves a trail", "safety keeps the gate", "night remembers all"];
  return `${pick(line1, seed)} / ${pick(line2, seed, 3)} / ${pick(line3, seed, 7)}`;
}

function summarizeResult(result) {
  if (result == null) return null;
  if (typeof result === "string") return result.slice(0, 160);
  if (typeof result === "number" || typeof result === "boolean") return result;
  if (Array.isArray(result)) return { type: "array", length: result.length };
  if (typeof result === "object") {
    if (typeof result.language === "string" && ("executor" in result || "via" in result)) {
      const output = result.output;
      const outputSummary = {
        type: output == null ? "null" : Array.isArray(output) ? "array" : typeof output
      };
      if (output && typeof output === "object") {
        if (typeof output.rowCount === "number") outputSummary.rowCount = output.rowCount;
        if (typeof output.matchCount === "number") outputSummary.matchCount = output.matchCount;
        if (typeof output.status === "number") outputSummary.status = output.status;
      }
      return {
        language: result.language,
        executor: result.executor ?? null,
        confidence: typeof result.confidence === "number" ? result.confidence : null,
        via: result.via ?? null,
        outputSummary
      };
    }

    const out = {};
    for (const k of Object.keys(result).slice(0, 6)) {
      const v = result[k];
      if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = v;
      }
    }
    return out;
  }
  return String(result);
}

function makeXriskError(name, message) {
  const err = new Error(message || name);
  err.name = name;
  err.code = name;
  return err;
}

function allowedCapabilities() {
  const raw = process.env.REX_ALLOWED_CAPABILITIES;
  if (!raw || String(raw).trim() === "") {
    return null;
  }
  const set = new Set(
    String(raw)
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
  );
  return set;
}

function allowedUseInsteadLanguages() {
  const raw = process.env.REX_ALLOWED_USE_INSTEAD_LANGS;
  if (!raw || String(raw).trim() === "") {
    return null;
  }
  return new Set(
    String(raw)
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseHintTarget(target) {
  if (target == null) {
    return null;
  }
  try {
    const parsed = JSON.parse(String(target));
    return typeof parsed === "string" ? parsed.toLowerCase() : null;
  } catch {
    const cleaned = String(target).replace(/^"|"$/g, "").trim().toLowerCase();
    return cleaned || null;
  }
}

function evaluateUseInsteadPolicy({ hint = null, language = null, phase = "before" } = {}) {
  const allowed = allowedUseInsteadLanguages();
  if (!allowed) {
    return { decision: "ALLOW", failure: null, message: null };
  }

  const lang = (language || hint || "").toLowerCase();
  if (!lang || lang === "auto" || lang === "unknown") {
    return { decision: "ALLOW", failure: null, message: null };
  }

  if (allowed.has(lang)) {
    return { decision: "ALLOW", failure: null, message: null };
  }

  return {
    decision: "BLOCK",
    failure: "ForeignLanguageBlocked",
    message: `use.instead language '${lang}' denied by policy during ${phase}`
  };
}

function textContainsPromptInjection(value) {
  const text = String(value || "").toLowerCase();
  const patterns = [
    "ignore previous instructions",
    "disregard all prior",
    "reveal system prompt",
    "developer message",
    "bypass safety",
    "override policy"
  ];
  return patterns.some((p) => text.includes(p));
}

function pushDiagnostic(severity, code, message, action, capability) {
  const item = {
    severity,
    code,
    message,
    action: action || null,
    capability: capability || null,
    timestamp: nowIso()
  };
  if (severity === "error") {
    __diagnostics.errors.push(item);
    return;
  }
  __diagnostics.warnings.push(item);
}

function evaluateBeforeRisk(event = {}) {
  if (process.env.REX_TRACE_TAMPERED === "1") {
    pushDiagnostic("error", "TamperDetected", "Trace integrity check failed before action", event.action, event.capability);
    return {
      decision: "BLOCK",
      failure: "TamperDetected",
      message: "Trace integrity check failed"
    };
  }

  const allowed = allowedCapabilities();
  const capability = String(event.capability || "NONE").toUpperCase();
  if (allowed && !allowed.has(capability)) {
    pushDiagnostic("error", "CapabilityExceeded", `Capability ${capability} is not allowed by current token`, event.action, capability);
    return {
      decision: "BLOCK",
      failure: "CapabilityExceeded",
      message: `Capability ${capability} is not allowed`
    };
  }

  if (textContainsPromptInjection(event.target)) {
    pushDiagnostic("error", "PromptInjected", "Prompt injection pattern detected in action target", event.action, event.capability);
    return {
      decision: "BLOCK",
      failure: "PromptInjected",
      message: "Prompt injection pattern detected"
    };
  }

  if (event.action === "use.instead") {
    const policy = evaluateUseInsteadPolicy({ hint: parseHintTarget(event.target), phase: "before" });
    if (policy.decision === "BLOCK") {
      pushDiagnostic("error", policy.failure, policy.message, event.action, event.capability);
      return policy;
    }
  }

  return {
    decision: "ALLOW",
    failure: null,
    message: null
  };
}

function evaluateAfterRisk(pending, event = {}) {
  if (process.env.REX_TRACE_TAMPERED === "1") {
    pushDiagnostic("error", "TamperDetected", "Trace integrity check failed after action", pending.action, pending.capability);
    return {
      decision: "BLOCK",
      failure: "TamperDetected",
      message: "Trace integrity check failed"
    };
  }

  const resultText = JSON.stringify(event.result ?? "");
  if (textContainsPromptInjection(resultText)) {
    pushDiagnostic("error", "PromptInjected", "Prompt injection pattern detected in action result", pending.action, pending.capability);
    return {
      decision: "BLOCK",
      failure: "PromptInjected",
      message: "Prompt injection pattern detected in result"
    };
  }

  if (pending.action === "use.instead") {
    const resolvedLanguage = String(event?.result?.language || "").toLowerCase() || null;
    const policy = evaluateUseInsteadPolicy({ language: resolvedLanguage, phase: "after" });
    if (policy.decision === "BLOCK") {
      pushDiagnostic("error", policy.failure, policy.message, pending.action, pending.capability);
      return policy;
    }
  }

  return {
    decision: "ALLOW",
    failure: null,
    message: null
  };
}

function createTraceEnvelope() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const traceId = `rex-${y}${m}${d}-${String(__actions.length).padStart(4, "0")}`;
  const duration = __actions.reduce((sum, a) => sum + (a.duration || 0), 0);
  return {
    traceId,
    sessionId: __sessionId,
    file: process.env.REX_SOURCE_FILE || null,
    generatedAt: nowIso(),
    actionCount: __actions.length,
    duration,
    haiku: buildHaiku(`${traceId}:${__sessionId}:${__actions.length}`),
    actions: __actions,
    diagnostics: __diagnostics
  };
}

function flushTraceIfConfigured() {
  const out = process.env.REX_TRACE_OUT;
  if (!out) {
    return;
  }
  const trace = createTraceEnvelope();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(trace, null, 2), "utf8");
}

process.on("exit", () => {
  try {
    flushTraceIfConfigured();
  } catch {
    // no-op
  }
});

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

    const endedAt = Date.now();
    const duration = Math.max(0, endedAt - pending.startedAt);
    const action = pending.action;
    const risk = evaluateAfterRisk(pending, event);
    const decision = risk.decision === "BLOCK" ? "BLOCK" : pending.xriskDecision || "ALLOW";
    __actions.push({
      action,
      kind: action,
      riskLevel: event.riskLevel || "LOW",
      capability: pending.capability,
      target: pending.target,
      xriskDecision: decision,
      policyReason: risk.message ?? pending.policyReason ?? null,
      timestamp: pending.timestamp,
      duration,
      haiku: buildHaiku(`${pending.timestamp.slice(0, 10)}:${action}:${__actions.length}`),
      result: summarizeResult(event.result),
      loc: pending.loc ?? event.loc ?? null
    });
    if (risk.decision === "BLOCK") {
      throw makeXriskError(risk.failure, risk.message);
    }
    return { stored: true };
  },

  emit(event = {}) {
    const action = event.action || "emit";
    __actions.push({
      action,
      kind: "emit",
      riskLevel: "LOW",
      capability: "NONE",
      target: null,
      xriskDecision: "ALLOW",
      timestamp: nowIso(),
      duration: 0,
      haiku: buildHaiku(`${action}:${__actions.length}`),
      result: summarizeResult(event),
      loc: null
    });
    return true;
  },

  getTrace() {
    return createTraceEnvelope();
  },

  resetTrace() {
    __pending.length = 0;
    __actions.length = 0;
    __diagnostics.errors.length = 0;
    __diagnostics.warnings.length = 0;
  },

  writeTrace(outPath) {
    const trace = createTraceEnvelope();
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(trace, null, 2), "utf8");
    return outPath;
  }
};

export default xrisk;
