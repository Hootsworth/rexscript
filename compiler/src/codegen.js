function toJsValue(expr) {
  if (!expr) {
    return "null";
  }
  if (typeof expr === "string") {
    return expr;
  }
  if (expr.value) {
    return expr.value;
  }
  if (expr.raw) {
    return expr.raw;
  }
  return "null";
}

function statementAlias(stmt) {
  if (!stmt) {
    return null;
  }
  if (stmt.kind === "ObserveStatement") return stmt.alias;
  if (stmt.kind === "FindStatement") return stmt.alias;
  if (stmt.kind === "RecallStatement") return stmt.alias;
  if (stmt.kind === "SynthesiseStatement") return stmt.alias || null;
  if (stmt.kind === "UseInsteadStatement") return stmt.outputAlias || null;
  return null;
}

function nextTemp(ctx, prefix = "tmp") {
  ctx.counter += 1;
  return `__rex_${prefix}_${ctx.counter}`;
}

function withHoistedAliases(ctx, aliases, fn) {
  ctx.hoistedAliasStack.push(new Set(aliases || []));
  try {
    return fn();
  } finally {
    ctx.hoistedAliasStack.pop();
  }
}

function isHoistedAlias(ctx, alias) {
  if (!alias) {
    return false;
  }
  return (ctx.hoistedAliasStack || []).some((scope) => scope.has(alias));
}

function collectAliases(statements, out = new Set()) {
  for (const stmt of statements || []) {
    if (!stmt || !stmt.kind) {
      continue;
    }

    const alias = statementAlias(stmt);
    if (alias) {
      out.add(alias);
    }

    if (stmt.kind === "StepStatement") {
      collectAliases(stmt.body || [], out);
      continue;
    }

    if (stmt.kind === "PlanStatement") {
      collectAliases(stmt.steps || [], out);
      continue;
    }

    if (stmt.kind === "TryCatchStatement" || stmt.kind === "AttemptStatement") {
      collectAliases(stmt.body || [], out);
      for (const c of stmt.catches || []) {
        collectAliases(c.body || [], out);
      }
      collectAliases(stmt.ensureBody || [], out);
      continue;
    }

    if (stmt.kind === "WhenStatement") {
      collectAliases(stmt.body || [], out);
      collectAliases(stmt.otherwise || [], out);
      continue;
    }

    if (stmt.kind === "ParallelStatement") {
      collectAliases(stmt.body || [], out);
      collectAliases(stmt.thenHandler ? [stmt.thenHandler] : [], out);
      continue;
    }

    if (stmt.kind === "UseInsteadStatement") {
      for (const c of stmt.catches || []) {
        collectAliases(c.body || [], out);
      }
    }
  }
  return out;
}

function actionMeta(stmt) {
  const loc = stmt?.loc?.start
    ? {
        line: stmt.loc.start.line ?? null,
        column: stmt.loc.start.column ?? null
      }
    : null;

  switch (stmt.kind) {
    case "ObserveStatement":
      return {
        action: stmt.verb === "hunt" ? "hunt" : "observe",
        capability: "NETWORK",
        riskLevel: "LOW",
        target: toJsValue(stmt.url),
        loc
      };
    case "NavigateStatement":
      return { action: "navigate", capability: "NETWORK", riskLevel: "LOW", target: toJsValue(stmt.url), loc };
    case "FindStatement":
      return { action: "find", capability: "READ", riskLevel: "LOW", target: stmt.selector, loc };
    case "RememberStatement":
      return { action: "remember", capability: "MEMORY", riskLevel: "LOW", target: stmt.data, loc };
    case "ForgetStatement":
      return { action: "forget", capability: "MEMORY", riskLevel: "LOW", target: "null", loc };
    case "RecallStatement":
      return { action: "recall", capability: "MEMORY", riskLevel: "LOW", target: `[${(stmt.tags || []).join(", ")}]`, loc };
    case "SynthesiseStatement":
      return { action: "synthesise", capability: "MODEL", riskLevel: "MEDIUM", target: "null", loc };
    case "UseInsteadStatement": {
      const hint = stmt.languageHint || "auto";
      const risk = hint === "bash" ? "HIGH" : hint === "python" ? "MEDIUM" : "LOW";
      return { action: "use.instead", capability: "FOREIGN_EXEC", riskLevel: risk, target: JSON.stringify(hint), loc };
    }
    default:
      return null;
  }
}

function indentBlock(block, prefix) {
  return (block || "")
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function emitRiskWrapped(ctx, indent, meta, callExpr, assignTo = null) {
  const resultTemp = nextTemp(ctx, "result");
  const loc = meta?.loc ? JSON.stringify(meta.loc) : "null";
  const lines = [];
  lines.push(
    `${indent}await __xrisk.before({ action: ${JSON.stringify(meta.action)}, target: ${meta.target || "null"}, capability: ${JSON.stringify(meta.capability)}, loc: ${loc} });`
  );
  lines.push(`${indent}const ${resultTemp} = await ${callExpr};`);
  lines.push(
    `${indent}await __xrisk.after({ action: ${JSON.stringify(meta.action)}, riskLevel: ${JSON.stringify(meta.riskLevel)}, result: ${resultTemp} ?? null, loc: ${loc} });`
  );
  if (assignTo) {
    lines.push(isHoistedAlias(ctx, assignTo) ? `${indent}${assignTo} = ${resultTemp};` : `${indent}const ${assignTo} = ${resultTemp};`);
  }
  return lines.join("\n");
}

function emitCatchBody(ctx, catches, indent) {
  if (!catches || catches.length === 0) {
    return `${indent}throw err;`;
  }

  return catches
    .map((c, idx) => {
      const prefix = idx === 0 ? "if" : "else if";
      const cond = c.failureType === "*" ? "true" : `__rex.isFailure(err, ${JSON.stringify(c.failureType)})`;
      const fallbackNode = (c.body || []).find((s) => s.kind === "UseDefaultStatement");
      const bodyStatements = (c.body || []).filter((s) => s.kind !== "UseDefaultStatement");
      const body = bodyStatements.map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const fallbackReturn = fallbackNode
        ? `\n${indent}  return ${toJsValue(fallbackNode.value)};`
        : "";
      return `${indent}${prefix} (${cond}) {\n${body}${fallbackReturn}\n${indent}}`;
    })
    .concat([`${indent}else {`, `${indent}  throw err;`, `${indent}}`])
    .join("\n");
}

function buildSourceMap(ast, sourceFile, generatedFile) {
  const statementMap = (ast.body || []).map((stmt, idx) => ({
    generatedStatementIndex: idx,
    sourceLine: stmt?.loc?.start?.line ?? null,
    sourceColumn: stmt?.loc?.start?.column ?? null,
    kind: stmt?.kind ?? "Unknown"
  }));

  return {
    version: 3,
    file: generatedFile,
    sources: [sourceFile],
    names: [],
    mappings: "",
    x_rexStatementMap: statementMap
  };
}

function emitWhenCondition(condition) {
  if (!condition) {
    return "false";
  }

  switch (condition.kind) {
    case "PageStateCondition":
      return `await __rex.check(${condition.variable}, ${JSON.stringify(condition.state)})`;
    case "SeemsUnreliableCondition":
      return `await __rex.check(${condition.variable}, \"seems_unreliable\")`;
    case "EmptyCondition":
      return `await __rex.check(${condition.variable}, \"empty\")`;
    case "ConfidenceCondition":
      return `(${condition.variable}.confidence ${condition.comparator} ${condition.value})`;
    case "JsCondition":
      return condition.raw || "false";
    default:
      return "false";
  }
}

function emitStatement(ctx, stmt, indent = "") {
  const meta = actionMeta(stmt);

  switch (stmt.kind) {
    case "ObserveStatement":
      return emitRiskWrapped(
        ctx,
        indent,
        meta,
        `__rex.${stmt.verb === "hunt" ? "hunt" : "observe"}(${toJsValue(stmt.url)}, { session: ${stmt.session || "null"} })`,
        stmt.alias
      );

    case "NavigateStatement": {
      if (stmt.direction === "back") {
        return emitRiskWrapped(ctx, indent, meta, "__rex.navigateBack()", null);
      }
      if (stmt.direction === "forward") {
        return emitRiskWrapped(ctx, indent, meta, "__rex.navigateForward()", null);
      }
      return emitRiskWrapped(
        ctx,
        indent,
        meta,
        `__rex.navigate(${toJsValue(stmt.url)}, { session: ${stmt.session || "null"}, headers: ${stmt.headers ? `{ ${stmt.headers} }` : "{}"} })`,
        null
      );
    }

    case "FindStatement": {
      const sourceExpr = stmt.sourceType === "raw" ? stmt.sourceRaw || "null" : stmt.source || "null";
      return emitRiskWrapped(ctx, indent, meta, `__rex.find(${stmt.selector}, ${sourceExpr})`, stmt.alias);
    }

    case "RememberStatement": {
      const optionsObj = [];
      if (stmt.mode) optionsObj.push(`mode: "${stmt.mode}"`);
      const optStr = optionsObj.length > 0 ? `, { ${optionsObj.join(", ")} }` : "";
      return emitRiskWrapped(ctx, indent, meta, `__rex.remember(${stmt.data}, [${(stmt.tags || []).join(", ")}]${optStr})`, null);
    }

    case "ForgetStatement":
      return emitRiskWrapped(ctx, indent, meta, `__rex.forget([${(stmt.tags || []).join(", ")}])`, null);

    case "RecallStatement": {
      const optionsObj = [];
      if (stmt.threshold) optionsObj.push(`threshold: ${stmt.threshold.amount}`);
      if (stmt.mode) optionsObj.push(`mode: "${stmt.mode}"`);
      const optStr = optionsObj.length > 0 ? `, { ${optionsObj.join(", ")} }` : "";
      return emitRiskWrapped(
        ctx,
        indent,
        meta,
        `__rex.recall([${(stmt.tags || []).join(", ")}]${optStr})`,
        stmt.alias
      );
    }

    case "SynthesiseStatement": {
      const alias = stmt.alias || nextTemp(ctx, "synth");
      return emitRiskWrapped(ctx, indent, meta, `__rex.synthesise([${(stmt.inputs || []).join(", ")}])`, alias);
    }

    case "SessionStatement":
      return `${indent}const ${stmt.name} = await __rex.session({ ${stmt.optionsRaw || ""} });`;

    case "FlagStatement":
      return `${indent}__rex.flag(${stmt.target}, ${JSON.stringify(stmt.label)});`;

    case "EmitStatement":
      return `${indent}__xrisk.emit({ ${stmt.fieldsRaw || ""} });`;

    case "RotateProxyStatement":
      return `${indent}await __rex.rotateProxy();`;

    case "UseDefaultStatement":
      return `${indent}const __rex_default = ${toJsValue(stmt.value)};`;

    case "SkipStatement":
      return `${indent}return;`;

    case "RetryStatement":
      return `${indent}return __rex.retry();`;

    case "WhenStatement": {
      const body = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const otherwise = (stmt.otherwise || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const elseBlock = otherwise ? ` else {\n${otherwise}\n${indent}}` : "";
      return `${indent}if (${emitWhenCondition(stmt.condition)}) {\n${body}\n${indent}}${elseBlock}`;
    }

    case "UseInsteadStatement": {
      const alias = stmt.outputAlias || nextTemp(ctx, "foreign");
      const callExpr = `__rex.useInstead({ hint: ${stmt.languageHint ? JSON.stringify(stmt.languageHint) : "null"}, content: ${JSON.stringify(stmt.content || "")} })`;
      const wrapped = emitRiskWrapped(ctx, indent, meta, callExpr, alias);
      if (!stmt.catches || stmt.catches.length === 0) {
        return wrapped;
      }
      const catchBody = emitCatchBody(ctx, stmt.catches, `${indent}  `);
      return `${indent}try {\n${wrapped}\n${indent}} catch (err) {\n${catchBody}\n${indent}}`;
    }

    case "TryCatchStatement": {
      const body = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const catches = emitCatchBody(ctx, stmt.catches || [], `${indent}  `);
      return `${indent}try {\n${body}\n${indent}} catch (err) {\n${catches}\n${indent}}`;
    }

    case "ParallelStatement": {
      const aliases = (stmt.body || []).map(statementAlias).filter(Boolean);
      const preDecl = aliases.length ? `${indent}let ${aliases.join(", ")};\n` : "";

      const tasks = (stmt.body || [])
        .map((s) => {
          const taskAlias = statementAlias(s);
          const taskBody = emitStatement(ctx, s, `${indent}    `);
          const ret = taskAlias ? `${indent}    return { name: ${JSON.stringify(taskAlias)}, value: ${taskAlias} };` : `${indent}    return null;`;
          return `${indent}  async () => {\n${taskBody}\n${ret}\n${indent}  }`;
        })
        .join(",\n");

      const parallelVar = nextTemp(ctx, "parallel");
      const assignSwitch = aliases.length
        ? `${indent}for (const __r of (${parallelVar}.results || [])) {\n${indent}  if (!__r || !__r.name) continue;\n${indent}  switch (__r.name) {\n${aliases
            .map((a) => `${indent}    case ${JSON.stringify(a)}: ${a} = __r.value; break;`)
            .join("\n")}\n${indent}    default: break;\n${indent}  }\n${indent}}`
        : "";

      const thenCode = stmt.thenHandler ? `\n${emitStatement(ctx, stmt.thenHandler, indent)}` : "";

      const opts = [];
      if (stmt.limit) opts.push(`limit: ${stmt.limit}`);
      if (stmt.distributed) opts.push(`distributed: true`);
      const optsArg = opts.length ? `, { ${opts.join(", ")} }` : "";

      return `${preDecl}${indent}const ${parallelVar} = await __rex.parallel([\n${tasks}\n${indent}]${optsArg});${assignSwitch ? `\n${assignSwitch}` : ""}${thenCode}`;
    }

    case "AttemptStatement": {
      const tryIndent = stmt.upto ? `${indent}  ` : indent;
      const body = (stmt.body || []).map((s) => emitStatement(ctx, s, `${tryIndent}  `)).join("\n");
      const catches = emitCatchBody(ctx, stmt.catches || [], `${tryIndent}  `);
      
      let attemptBlock = `${tryIndent}try {\n${body}`;
      if (stmt.upto) attemptBlock += `\n${tryIndent}  break;`;
      attemptBlock += `\n${tryIndent}} catch (err) {\n${catches}\n${tryIndent}}`;
      
      let loopBlock = attemptBlock;
      if (stmt.upto) {
        const attemptTemp = nextTemp(ctx, "attempt");
        loopBlock = `${indent}let ${attemptTemp} = 0;\n${indent}while (${attemptTemp} < ${stmt.upto}) {\n${indent}  ${attemptTemp}++;\n${attemptBlock}\n${indent}}`;
      }
      
      let result = loopBlock;
      if (stmt.ensureBody) {
         const ensureCode = stmt.ensureBody.map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
         const indentedLoop = indentBlock(loopBlock, `${indent}  `);
         result = `${indent}try {\n${indentedLoop}\n${indent}} finally {\n${ensureCode}\n${indent}}`;
      }

      const timeoutMs = Number.isFinite(stmt.timeoutMs) ? Number(stmt.timeoutMs) : null;
      if (timeoutMs && timeoutMs > 0) {
         const inner = indentBlock(result, `${indent}  `);
         return `${indent}await __xrisk.withTimeout(async () => {\n${inner}\n${indent}}, ${timeoutMs});`;
      }
      return result;
    }

    case "VariableDeclaration": {
      const jsDeclType = stmt.declType === "fact" ? "const" : "let";
      let rawHost = stmt.raw || "";
      if (rawHost.endsWith(";")) {
        rawHost = rawHost.slice(0, -1).trim();
      }
      const receiveRegex = /receive\s+from\s+(\$[A-Za-z0-9_]+)/g;
      if (receiveRegex.test(rawHost)) {
        rawHost = rawHost.replace(receiveRegex, "await __rex.receive($1)");
      }
      const vaultRegex = /vault\("([^"]+)"\)/g;
      if (vaultRegex.test(rawHost)) {
        rawHost = rawHost.replace(vaultRegex, "await __xrisk.vault(\"$1\")");
      }
      if (rawHost.includes(" | ")) {
         const assignParts = rawHost.split("=");
         if (assignParts.length === 2 && assignParts[1].includes(" | ")) {
           const parts = assignParts[1].split(" | ").map((x) => x.trim());
           rawHost = `${assignParts[0].trim()} = __rex.pipe(${parts.join(", ")})`;
         }
      }
      return `${indent}${jsDeclType} ${rawHost};`;
    }

    case "GoalStatement": {
      const goalBody = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const loc = stmt.loc ? JSON.stringify(stmt.loc.start) : "null";
      const constraintsStr = stmt.constraints ? JSON.stringify(stmt.constraints) : "null";
      return `${indent}await __xrisk.goalStart(${JSON.stringify(stmt.description)}, ${constraintsStr}, ${loc});\n${indent}try {\n${goalBody}\n${indent}} finally {\n${indent}  await __xrisk.goalEnd();\n${indent}}`;
    }

    case "PlanStatement": {
      const hoistedAliases = [...collectAliases(stmt.steps || [])];
      const prelude = hoistedAliases.length ? `${indent}let ${hoistedAliases.join(", ")};\n` : "";
      const planBody = withHoistedAliases(
        ctx,
        hoistedAliases,
        () => (stmt.steps || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n")
      );
      const loc = stmt.loc ? JSON.stringify(stmt.loc.start) : "null";
      return `${prelude}${indent}await __xrisk.planStart(${JSON.stringify(stmt.name)}, ${loc});\n${indent}try {\n${planBody}\n${indent}} finally {\n${indent}  await __xrisk.planEnd();\n${indent}}`;
    }

    case "StepStatement": {
      const stepBody = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      const loc = stmt.loc ? JSON.stringify(stmt.loc.start) : "null";
      return `${indent}await __xrisk.stepStart(${JSON.stringify(stmt.title)}, ${loc});\n${indent}try {\n${stepBody}\n${indent}} finally {\n${indent}  await __xrisk.stepEnd();\n${indent}}`;
    }

    case "WorkspaceStatement": {
      const wsBody = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
      return `${indent}await __rex.workspaceStart(${JSON.stringify(stmt.name)});\n${indent}try {\n${wsBody}\n${indent}} finally {\n${indent}  await __rex.workspaceEnd();\n${indent}}`;
    }

    case "AssessStatement": {
       const conditions = (stmt.cases || []).map((c) => c.condition);
       const assessVar = nextTemp(ctx, "assess");
       let blocks = `${indent}const ${assessVar} = await __rex.assess(${stmt.target}, ${JSON.stringify(conditions)});\n`;
       
       const cases = stmt.cases || [];
       for (let i = 0; i < cases.length; i++) {
          const c = cases[i];
          const prefix = i === 0 ? "if" : "else if";
          const blockBody = (c.body || []).map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
          blocks += `${indent}${prefix} (${assessVar} === ${JSON.stringify(c.condition)}) {\n${blockBody}\n${indent}}\n`;
       }
       if (stmt.otherwise && stmt.otherwise.length > 0) {
          const otherBody = stmt.otherwise.map((s) => emitStatement(ctx, s, `${indent}  `)).join("\n");
          if (cases.length > 0) blocks += `${indent}else {\n`;
          blocks += `${otherBody}`;
          if (cases.length > 0) blocks += `\n${indent}}\n`;
       }
       return blocks.trimEnd();
    }

    case "ToolDeclaration": {
       const params = stmt.params ? stmt.params.join(", ") : "";
       const toolBody = (stmt.body || []).map((s) => emitStatement(ctx, s, `${indent}    `)).join("\n");
       return `${indent}__rex.registerTool(${JSON.stringify(stmt.name)}, async (${params}) => {\n${toolBody}\n${indent}});`;
    }

    case "EquipStatement": {
       return `${indent}await __rex.equip(${JSON.stringify(stmt.name)});`;
    }

    case "SecurityStatement": {
       const opts = [];
       if (stmt.config.sandbox) opts.push(`sandbox: ${JSON.stringify(stmt.config.sandbox)}`);
       if (stmt.config.lockdown) opts.push(`lockdown: ${JSON.stringify(stmt.config.lockdown)}`);
       return `${indent}await __xrisk.configureSecurity({ ${opts.join(", ")} });`;
    }

    case "TelemetryStatement": {
       const opts = [];
       if (stmt.config.exporter) opts.push(`exporter: ${JSON.stringify(stmt.config.exporter)}`);
       if (stmt.config.endpoint) opts.push(`endpoint: ${JSON.stringify(stmt.config.endpoint)}`);
       if (stmt.config.key) opts.push(`key: ${stmt.config.key}`);
       return `${indent}await __xrisk.configureTelemetry({ ${opts.join(", ")} });`;
    }

    case "SpawnStatement": {
       const opts = stmt.options ? stmt.options : "null";
       return `${indent}const ${stmt.alias} = await __rex.spawn(${JSON.stringify(stmt.agentType)}, ${opts});`;
    }

    case "SendStatement": {
       const dataStr = stmt.data.startsWith("$") ? stmt.data : `{ ${stmt.data} }`;
       return `${indent}await __rex.send(${dataStr}, ${stmt.target});`;
    }

    case "RationaleStatement": {
      const loc = stmt.loc ? JSON.stringify(stmt.loc.start) : "null";
      return `${indent}await __xrisk.rationale(${JSON.stringify(stmt.reason)}, ${loc});`;
    }

    case "HostJsStatement": {
      let rawHost = stmt.raw || "";
      if (rawHost.endsWith(";")) {
        rawHost = rawHost.slice(0, -1).trim();
      }
      const receiveRegex = /receive\s+from\s+(\$[A-Za-z0-9_]+)/g;
      if (receiveRegex.test(rawHost)) {
        rawHost = rawHost.replace(receiveRegex, "await __rex.receive($1)");
      }
      const vaultRegex = /vault\("([^"]+)"\)/g;
      if (vaultRegex.test(rawHost)) {
        rawHost = rawHost.replace(vaultRegex, "await __xrisk.vault(\"$1\")");
      }
      if (rawHost.includes(" | ")) {
        const parts = rawHost.split(" | ").map((x) => x.trim());
        if (parts.length > 1) {
           rawHost = `__rex.pipe(${parts.join(", ")})`;
        }
      }
      return `${indent}${rawHost};`;
    }

    default:
      return `${indent}/* unhandled node: ${stmt.kind} */`;
  }
}

export function generate(ast, options = {}) {
  const ctx = { counter: 0, hoistedAliasStack: [] };
  const header = [
    "// ╔══════════════════════════════════════════════════╗",
    "// ║  Compiled by RexScript v0.1.0 · Hatchling        ║",
    "// ║  \"Agents don't browse. They hunt.\"             ║",
    "// ╚══════════════════════════════════════════════════╝",
    "//",
    "// Do not edit this file. Edit the source .rex file.",
    "import __rex from '@rexscript/runtime';",
    "import __xrisk from '@rexscript/xrisk';",
    "import __rosetta from '@rexscript/rosetta';",
    "",
    "async function __rex_main() {"
  ].join("\n");

  const body = (ast.body || []).map((stmt) => emitStatement(ctx, stmt, "  ")).join("\n");

  const footer = ["}", "", "await __rex_main();", ""].join("\n");

  const code = `${header}\n${body}\n${footer}`;
  const map = buildSourceMap(ast, options.sourceFile || "source.rex", options.generatedFile || "output.js");
  return {
    code,
    map
  };
}
