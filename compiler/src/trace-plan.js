function riskForAction(stmt) {
  switch (stmt.kind) {
    case "ObserveStatement":
    case "NavigateStatement":
    case "FindStatement":
    case "RememberStatement":
    case "RecallStatement":
    case "ForgetStatement":
      return "LOW";
    case "SynthesiseStatement":
      return "MEDIUM";
    case "UseInsteadStatement":
      if (stmt.languageHint === "bash") return "HIGH";
      if (stmt.languageHint === "python") return "MEDIUM";
      return "MEDIUM";
    default:
      return "LOW";
  }
}

function capabilityForAction(stmt) {
  switch (stmt.kind) {
    case "ObserveStatement":
    case "NavigateStatement":
      return "NETWORK";
    case "FindStatement":
      return "READ";
    case "RememberStatement":
    case "RecallStatement":
    case "ForgetStatement":
      return "MEMORY";
    case "SynthesiseStatement":
      return "MODEL";
    case "UseInsteadStatement":
      return "FOREIGN_EXEC";
    default:
      return "NONE";
  }
}

function actionName(stmt) {
  switch (stmt.kind) {
    case "ObserveStatement": return "observe";
    case "NavigateStatement": return "navigate";
    case "FindStatement": return "find";
    case "RememberStatement": return "remember";
    case "RecallStatement": return "recall";
    case "ForgetStatement": return "forget";
    case "SynthesiseStatement": return "synthesise";
    case "UseInsteadStatement": return "use.instead";
    case "SessionStatement": return "session";
    case "FlagStatement": return "flag";
    case "EmitStatement": return "emit";
    case "ParallelStatement": return "parallel";
    default: return stmt.kind;
  }
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

function deterministicDurationMs(stmt, index) {
  const base = 90 + (index * 37);
  const kindWeight = String(stmt.kind || "").length * 11;
  return base + kindWeight;
}

function targetForAction(stmt) {
  if (stmt.kind === "ObserveStatement") return stmt.url?.value || null;
  if (stmt.kind === "NavigateStatement") return stmt.url?.value || stmt.direction || null;
  if (stmt.kind === "FindStatement") return stmt.selector || null;
  if (stmt.kind === "UseInsteadStatement") return stmt.languageHint || "auto";
  return null;
}

function walkStatements(statements, out) {
  for (const stmt of statements || []) {
    if (!stmt || !stmt.kind) continue;

    const index = out.length;
    const timestamp = new Date().toISOString();
    const duration = deterministicDurationMs(stmt, index);
    const action = actionName(stmt);
    const seedText = `${timestamp.slice(0, 10)}:${action}:${index}`;
    out.push({
      action,
      kind: stmt.kind,
      riskLevel: riskForAction(stmt),
      capability: capabilityForAction(stmt),
      target: targetForAction(stmt),
      xriskDecision: "ALLOW",
      timestamp,
      duration,
      haiku: buildHaiku(seedText),
      loc: stmt.loc || null
    });

    if (stmt.kind === "TryCatchStatement") {
      walkStatements(stmt.body || [], out);
      for (const c of stmt.catches || []) {
        walkStatements(c.body || [], out);
      }
      continue;
    }

    if (stmt.kind === "ParallelStatement") {
      walkStatements(stmt.body || [], out);
      if (stmt.thenHandler) {
        walkStatements([stmt.thenHandler], out);
      }
      continue;
    }

    if (stmt.kind === "WhenStatement") {
      walkStatements(stmt.body || [], out);
      walkStatements(stmt.otherwise || [], out);
      continue;
    }

    if (stmt.kind === "UseInsteadStatement") {
      for (const c of stmt.catches || []) {
        walkStatements(c.body || [], out);
      }
    }
  }
}

export function buildTracePlan(ast, filePath) {
  const actions = [];
  walkStatements(ast.body || [], actions);

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const traceId = `rex-${y}${m}${d}-${String(actions.length).padStart(4, "0")}`;
  const sessionId = `session-${String(actions.length * 37).padStart(4, "0")}`;
  const durationTotal = actions.reduce((sum, a) => sum + (a.duration || 0), 0);
  const sessionHaiku = buildHaiku(`${traceId}:${sessionId}:${actions.length}`);

  return {
    traceId,
    sessionId,
    file: filePath,
    generatedAt: new Date().toISOString(),
    actionCount: actions.length,
    duration: durationTotal,
    haiku: sessionHaiku,
    actions
  };
}
