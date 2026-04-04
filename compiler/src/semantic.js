function createDiagnostic(severity, code, message, loc = null) {
  return { severity, code, message, loc };
}

const ALLOWED_FAILURE_TYPES = new Set([
  "BlockedByBot",
  "RateLimit",
  "Timeout",
  "DNSFailure",
  "ContentGated",
  "ContentEmpty",
  "ContentChanged",
  "Paywalled",
  "AmbiguousResult",
  "MemoryOverflow",
  "SynthesisFailed",
  "RiskBlocked",
  "PromptInjected",
  "CapabilityExceeded",
  "QueryFailed",
  "ForeignLanguageBlocked",
  "ExecutionTimeout",
  "ForeignExecutionDenied",
  "PythonExecutionError",
  "BashExecutionError",
  "PatternError",
  "ForeignRuntimeMissing",
  "TamperDetected",
  "SessionClosed",
  "*"
]);

function pushDiagnostic(state, severity, code, message, loc) {
  const diagnostic = createDiagnostic(severity, code, message, loc);
  if (severity === "error") {
    state.errors.push(diagnostic);
    return;
  }
  state.warnings.push(diagnostic);
}

function sortDiagnostics(items) {
  return [...items].sort((a, b) => {
    const aLine = a?.loc?.start?.line ?? Number.MAX_SAFE_INTEGER;
    const bLine = b?.loc?.start?.line ?? Number.MAX_SAFE_INTEGER;
    if (aLine !== bLine) {
      return aLine - bLine;
    }
    const aCol = a?.loc?.start?.column ?? Number.MAX_SAFE_INTEGER;
    const bCol = b?.loc?.start?.column ?? Number.MAX_SAFE_INTEGER;
    if (aCol !== bCol) {
      return aCol - bCol;
    }
    return String(a.code).localeCompare(String(b.code));
  });
}

function includesSensitivePattern(text) {
  const t = String(text || "").toLowerCase();
  return t.includes("password") || t.includes("credentials") || t.includes("auth");
}

function scoreLanguage(content, language) {
  const text = (content || "").toLowerCase();
  const signatures = {
    sql: ["select", "from", "where", "join", "insert", "update", "delete"],
    python: ["import ", "def ", "print(", "class ", "return "],
    bash: ["#!/", "echo ", "grep ", "curl ", "|", "$"],
    graphql: ["query", "mutation", "fragment", "__typename"],
    regex: ["/", "\\d", "\\w", "*", "+"],
    xpath: ["//", "@", "text()", "node()"],
    yaml: [": ", "---"],
    json: ["{", "}", "[", "]", "\"\""]
  };

  const hints = signatures[language] || [];
  if (hints.length === 0) {
    return 0;
  }

  let score = 0;
  for (const hint of hints) {
    if (text.includes(hint)) {
      score += 1;
    }
  }
  return score / hints.length;
}

function detectLanguage(content) {
  const candidates = ["sql", "python", "bash", "graphql", "regex", "xpath", "yaml", "json"];
  const ranked = candidates
    .map((language) => ({ language, confidence: scoreLanguage(content, language) }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    best: ranked[0],
    second: ranked[1]
  };
}

function normalizeAllowedUseInsteadLanguages(raw) {
  if (!raw) {
    return null;
  }

  if (Array.isArray(raw)) {
    const set = new Set(raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
    return set.size > 0 ? set : null;
  }

  if (typeof raw === "string") {
    const set = new Set(
      raw
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    );
    return set.size > 0 ? set : null;
  }

  return null;
}

function formatAllowedUseInsteadLanguages(allowed) {
  if (!allowed || allowed.size === 0) {
    return "none";
  }
  return [...allowed].sort().join(", ");
}

function containsActionKeyword(raw) {
  const text = String(raw || "").toLowerCase();
  return ["navigate", "observe", "remember", "forget", "parallel", "use.instead"].some((kw) =>
    text.includes(kw)
  );
}

function updateSessionCloseTracker(stmt, state) {
  const raw = String(stmt.raw || "").replace(/\s+/g, "").replace(/;+$/g, "");
  const closeMatch = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\.close\(\)$/);
  if (closeMatch && state.sessions.has(closeMatch[1])) {
    state.closedSessions.add(closeMatch[1]);
    state.hostCloseTracker = null;
    state.lastHostIdentifier = closeMatch[1];
    return;
  }

  if (typeof stmt.raw === "string" && stmt.raw.endsWith(".close")) {
    const sessionName = stmt.raw.slice(0, -6);
    if (state.sessions.has(sessionName)) {
      state.hostCloseTracker = {
        stage: "close",
        session: sessionName
      };
      return;
    }
  }

  if (stmt.raw === ".") {
    if (state.lastHostIdentifier && state.sessions.has(state.lastHostIdentifier)) {
      state.hostCloseTracker = {
        stage: "dot",
        session: state.lastHostIdentifier
      };
    }
    return;
  }

  if (stmt.raw === "close" && state.hostCloseTracker?.stage === "dot") {
    state.hostCloseTracker = {
      ...state.hostCloseTracker,
      stage: "close"
    };
    return;
  }

  if (stmt.raw === "(" && state.hostCloseTracker?.stage === "close") {
    state.closedSessions.add(state.hostCloseTracker.session);
    state.hostCloseTracker = null;
    return;
  }

  if (state.sessions.has(stmt.raw)) {
    state.lastHostIdentifier = stmt.raw;
    return;
  }

  if (![".", "close", "(", ")"].includes(stmt.raw)) {
    state.hostCloseTracker = null;
  }
}

function validateCatchClauses(catches, state) {
  for (const clause of catches || []) {
    if (!ALLOWED_FAILURE_TYPES.has(clause.failureType)) {
      pushDiagnostic(
        state,
        "error",
        "ERR001",
        `Unknown failure type '${clause.failureType}' in recovery block`,
        clause.loc || null
      );
    }
  }
}

function analyzeStatements(statements, state, inTryBody = false) {
  for (const stmt of statements) {
    if (!stmt || !stmt.kind) {
      continue;
    }

    if (stmt.kind === "SecurityStatement") {
      state.hasSecurityBlock = (stmt.config && stmt.config.sandbox);
      continue;
    }

    if (stmt.kind === "ObserveStatement") {
      if (state.options.permittedCapabilities && !state.options.permittedCapabilities.has("NETWORK")) {
          pushDiagnostic(state, "error", "ERR016", "Capability NETWORK is required but was dropped by compiler configuration", stmt.loc);
      }
      if (includesSensitivePattern(stmt.url?.value)) {
        pushDiagnostic(
          state,
          "error",
          "ERR006",
          "RiskBlocked at compile time due to known-dangerous credential pattern",
          stmt.loc
        );
      }
      if (stmt.session && state.closedSessions.has(stmt.session)) {
        pushDiagnostic(state, "error", "ERR011", "session used after close", stmt.loc);
      }
      if (!inTryBody) {
        pushDiagnostic(state, "warning", "WARN001", "observe without failure handler", stmt.loc);
      }
      if (stmt.alias) {
        state.variables.add(stmt.alias);
      }
      continue;
    }

    if (stmt.kind === "NavigateStatement") {
      if (includesSensitivePattern(stmt.url?.value)) {
        pushDiagnostic(
          state,
          "error",
          "ERR006",
          "RiskBlocked at compile time due to known-dangerous credential pattern",
          stmt.loc
        );
      }
      if (stmt.session && state.closedSessions.has(stmt.session)) {
        pushDiagnostic(state, "error", "ERR011", "session used after close", stmt.loc);
      }
      if (!inTryBody) {
        pushDiagnostic(state, "warning", "WARN002", "navigate without failure handler", stmt.loc);
      }
      continue;
    }

    if (stmt.kind === "RememberStatement") {
      state.rememberCount += 1;
      for (const tag of stmt.tags || []) {
        state.tagsRemembered.add(tag);
      }
      continue;
    }

    if (stmt.kind === "ForgetStatement") {
      const hasMatchingTag = (stmt.tags || []).some((tag) => state.tagsRemembered.has(tag) || tag === '"*"');
      if (!hasMatchingTag) {
        pushDiagnostic(state, "warning", "ERR013", "forget with no matching remember", stmt.loc);
      }
      continue;
    }

    if (stmt.kind === "FindStatement") {
      if (stmt.sourceType === "raw") {
        if (containsActionKeyword(stmt.sourceRaw)) {
          pushDiagnostic(state, "error", "ERR003", "Action statement in observation context", stmt.loc);
        }
      } else if (!state.variables.has(stmt.source)) {
        pushDiagnostic(
          state,
          "error",
          "ERR002",
          `Variable ${stmt.source} used before declaration`,
          stmt.loc
        );
      }
      if (stmt.alias) {
        state.variables.add(stmt.alias);
      }
      continue;
    }

    if (stmt.kind === "RecallStatement") {
      if (state.rememberCount === 0) {
        pushDiagnostic(state, "warning", "ERR012", "recall without prior remember", stmt.loc);
      }
      if (stmt.alias) {
        state.variables.add(stmt.alias);
      }
      continue;
    }

    if (stmt.kind === "SynthesiseStatement") {
      if ((stmt.inputs || []).length === 0) {
        pushDiagnostic(state, "error", "ERR010", "synthesise called with empty array", stmt.loc);
      }
      for (const input of stmt.inputs || []) {
        if (!state.variables.has(input)) {
          pushDiagnostic(state, "error", "ERR002", `Variable ${input} used before declaration`, stmt.loc);
        }
      }
      if (stmt.alias) {
        state.variables.add(stmt.alias);
        pushDiagnostic(
          state,
          "warning",
          "WARN005",
          "synthesise confidence not checked after call",
          stmt.loc
        );
      }
      continue;
    }

    if (stmt.kind === "TryCatchStatement" || stmt.kind === "AttemptStatement") {
      validateCatchClauses(stmt.catches, state);

      const starIndex = stmt.catches.findIndex((c) => c.failureType === "*");
      if (starIndex >= 0 && starIndex !== stmt.catches.length - 1) {
        pushDiagnostic(state, "error", "ERR008", "fallback * must be the last recovery block", stmt.loc);
      }

      if (stmt.kind === "AttemptStatement" && stmt.upto !== null && stmt.upto <= 0) {
        pushDiagnostic(state, "error", "ERR015", "attempt upto must be strictly positive", stmt.loc);
      }

      analyzeStatements(stmt.body, state, true);
      for (const c of stmt.catches) {
        analyzeStatements(c.body || [], state, false);
      }
      if (stmt.ensureBody) {
        analyzeStatements(stmt.ensureBody, state, false);
      }
      continue;
    }

    if (stmt.kind === "VariableDeclaration") {
      const matches = stmt.raw.match(/\$[A-Za-z0-9_]+/g);
      if (matches) {
          for (const m of matches) state.variables.add(m);
      }
      continue;
    }

    if (stmt.kind === "GoalStatement" || stmt.kind === "WorkspaceStatement") {
      if (stmt.kind === "GoalStatement" && stmt.constraints) {
        if (stmt.constraints.budget !== undefined && stmt.constraints.budget <= 0) {
           pushDiagnostic(state, "error", "ERR015", "Goal budget must be positive", stmt.loc);
        }
        if (stmt.constraints.timeoutMs !== undefined && stmt.constraints.timeoutMs <= 0) {
           pushDiagnostic(state, "error", "ERR015", "Goal timeout must be positive", stmt.loc);
        }
      }
      analyzeStatements(stmt.body || [], state, false);
      continue;
    }

    if (stmt.kind === "RationaleStatement") {
      continue;
    }

    if (stmt.kind === "ParallelStatement") {
      if (state.parallelDepth > 0 && (stmt.limit === null || stmt.limit === undefined)) {
        pushDiagnostic(state, "warning", "ERR014", "Nested parallel without limit", stmt.loc);
      }
      if (stmt.limit === null || stmt.limit === undefined) {
        pushDiagnostic(state, "warning", "WARN004", "parallel limit not set defaults to Infinity", stmt.loc);
      }
      if (!stmt.thenHandler) {
        const severity = state.options.strict ? "error" : "warning";
        pushDiagnostic(state, severity, "ERR009", "parallel has no then handler", stmt.loc);
      }

      state.parallelDepth += 1;
      analyzeStatements(stmt.body || [], state, false);
      state.parallelDepth -= 1;

      if (stmt.thenHandler && stmt.thenHandler.kind === "SynthesiseStatement") {
        analyzeStatements([stmt.thenHandler], state, false);
      }
      continue;
    }

    if (stmt.kind === "UseInsteadStatement") {
      if (state.options.permittedCapabilities && !state.options.permittedCapabilities.has("FOREIGN_EXEC")) {
          pushDiagnostic(state, "error", "ERR016", "Capability FOREIGN_EXEC is required but was dropped by compiler configuration", stmt.loc);
      }
      if (!state.hasSecurityBlock) {
          pushDiagnostic(state, "warning", "WARN020", "Executing use.instead without a configured security sandbox", stmt.loc);
      }
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

      if (!stmt.languageHint) {
        const detection = detectLanguage(stmt.content);
        const confidence = detection.best?.confidence || 0;
        const detected = String(detection.best?.language || "unknown").toLowerCase();
        const allowedDetected = state.options.allowedUseInsteadLanguages;
        if (allowedDetected && detected !== "unknown" && !allowedDetected.has(detected)) {
          const allowedText = formatAllowedUseInsteadLanguages(allowedDetected);
          pushDiagnostic(
            state,
            "error",
            "ERR006",
            `RiskBlocked at compile time: inferred use.instead language '${detected}' denied by policy allowlist (allowed: ${allowedText})`,
            stmt.loc
          );
        }
        if (confidence < 0.6) {
          pushDiagnostic(
            state,
            "error",
            "ERR005",
            "use.instead block is ambiguous; add explicit language hint",
            stmt.loc
          );
        } else if (confidence < 0.8) {
          pushDiagnostic(
            state,
            "warning",
            "WARN006",
            `use.instead detected as ${detection.best.language} with low confidence`,
            stmt.loc
          );
        }
      }
      if (stmt.outputAlias) {
        state.variables.add(stmt.outputAlias);
      }
      validateCatchClauses(stmt.catches, state);
      for (const c of stmt.catches || []) {
        analyzeStatements(c.body || [], state, false);
      }
      continue;
    }

    if (stmt.kind === "WhenStatement") {
      const cond = stmt.condition;
      if (cond && ["PageStateCondition", "SeemsUnreliableCondition", "EmptyCondition", "ConfidenceCondition"].includes(cond.kind)) {
        if (!state.variables.has(cond.variable)) {
          pushDiagnostic(
            state,
            "error",
            "ERR002",
            `Variable ${cond.variable} used before declaration`,
            stmt.loc
          );
        }
      }
      analyzeStatements(stmt.body || [], state, false);
      analyzeStatements(stmt.otherwise || [], state, false);
      continue;
    }

    if (stmt.kind === "AssessStatement") {
      if (!state.variables.has(stmt.target)) {
        pushDiagnostic(state, "error", "ERR002", `Variable ${stmt.target} used before declaration`, stmt.loc);
      }
      for (const c of stmt.cases || []) {
        analyzeStatements(c.body || [], state, false);
      }
      if (stmt.otherwise) {
        analyzeStatements(stmt.otherwise, state, false);
      }
      continue;
    }

    if (stmt.kind === "ToolDeclaration") {
      const preParams = new Set(state.variables);
      for (const p of stmt.params || []) {
        state.variables.add(p);
      }
      analyzeStatements(stmt.body || [], state, false);
      state.variables = preParams;
      state.tools.add(stmt.name);
      continue;
    }

    if (stmt.kind === "EquipStatement") {
      if (!state.tools.has(stmt.name)) {
        pushDiagnostic(state, "warning", "WARN008", `Equipping tool ${stmt.name} which was not declared`, stmt.loc);
      }
      continue;
    }

    if (stmt.kind === "TelemetryStatement") {
      if (stmt.config.key && stmt.config.key.startsWith("$")) {
        if (!state.variables.has(stmt.config.key)) {
          pushDiagnostic(state, "error", "ERR002", `Variable ${stmt.config.key} used before declaration in telemetry`, stmt.loc);
        }
      }
      continue;
    }

    if (stmt.kind === "SpawnStatement") {
      state.variables.add(stmt.alias);
      continue;
    }

    if (stmt.kind === "SendStatement") {
      if (!state.variables.has(stmt.target)) {
        pushDiagnostic(state, "error", "ERR002", `Target ${stmt.target} used before declaration in send statement`, stmt.loc);
      }
      continue;
    }

    if (stmt.kind === "SessionStatement") {
      state.sessions.add(stmt.name);
      continue;
    }

    if (stmt.kind === "HostJsStatement") {
      if (stmt.raw === "$agent" && state.options.dynamicFeature) {
        pushDiagnostic(state, "warning", "WARN007", "$agent accessed in dynamic feature", stmt.loc);
      }
      updateSessionCloseTracker(stmt, state);
      continue;
    }
  }
}

export function analyze(ast, options = {}) {
  const state = {
    variables: new Set(["$agent", "$session", "$trace", "$memory", "$risk", "$trail"]),
    tools: new Set(),
    sessions: new Set(),
    closedSessions: new Set(),
    tagsRemembered: new Set(),
    rememberCount: 0,
    parallelDepth: 0,
    hostCloseTracker: null,
    lastHostIdentifier: null,
    errors: [],
    warnings: [],
    options: {
      strict: Boolean(options.strict),
      dynamicFeature: Boolean(options.dynamicFeature),
      allowedUseInsteadLanguages: normalizeAllowedUseInsteadLanguages(options.allowedUseInsteadLanguages),
      permittedCapabilities: options.permittedCapabilities ? new Set(options.permittedCapabilities) : null
    },
    hasSecurityBlock: false
  };

  analyzeStatements(ast.body || [], state, false);

  return {
    errors: sortDiagnostics(state.errors),
    warnings: sortDiagnostics(state.warnings)
  };
}
