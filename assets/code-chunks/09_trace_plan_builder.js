function deterministicDurationMs(stmt, index) {
  const base = 90 + (index * 37);
  const kindWeight = String(stmt.kind || "").length * 11;
  return base + kindWeight;
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

export function buildTracePlan(ast, filePath) {
  const actions = [];
  walkStatements(ast.body || [], actions);

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const traceId = `rex-${y}${m}${d}-${String(actions.length).padStart(4, "0")}`;

  return {
    traceId,
    sessionId: `session-${String(actions.length * 37).padStart(4, "0")}`,
    file: filePath,
    generatedAt: new Date().toISOString(),
    actionCount: actions.length,
    duration: actions.reduce((sum, a) => sum + (a.duration || 0), 0),
    haiku: buildHaiku(`${traceId}:${actions.length}`),
    actions
  };
}
