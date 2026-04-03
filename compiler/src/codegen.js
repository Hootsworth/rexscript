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

function actionMeta(stmt) {
  const loc = stmt?.loc?.start
    ? {
        line: stmt.loc.start.line ?? null,
        column: stmt.loc.start.column ?? null
      }
    : null;

  switch (stmt.kind) {
    case "ObserveStatement":
      return { action: "observe", capability: "NETWORK", riskLevel: "LOW", target: toJsValue(stmt.url), loc };
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
    lines.push(`${indent}const ${assignTo} = ${resultTemp};`);
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
        `__rex.observe(${toJsValue(stmt.url)}, { session: ${stmt.session || "null"} })`,
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
      const sourceExpr = stmt.sourceType === "raw" ? "null" : stmt.source || "null";
      return emitRiskWrapped(ctx, indent, meta, `__rex.find(${stmt.selector}, ${sourceExpr})`, stmt.alias);
    }

    case "RememberStatement":
      return emitRiskWrapped(ctx, indent, meta, `__rex.remember(${stmt.data}, [${(stmt.tags || []).join(", ")}])`, null);

    case "ForgetStatement":
      return emitRiskWrapped(ctx, indent, meta, `__rex.forget([${(stmt.tags || []).join(", ")}])`, null);

    case "RecallStatement": {
      const options = stmt.threshold ? `, { threshold: ${stmt.threshold.amount} }` : "";
      return emitRiskWrapped(
        ctx,
        indent,
        meta,
        `__rex.recall([${(stmt.tags || []).join(", ")}]${options})`,
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

      return `${preDecl}${indent}const ${parallelVar} = await __rex.parallel([\n${tasks}\n${indent}], { limit: ${stmt.limit ?? "Infinity"} });${assignSwitch ? `\n${assignSwitch}` : ""}${thenCode}`;
    }

    case "HostJsStatement":
      return `${indent}${stmt.raw};`;

    default:
      return `${indent}/* unhandled node: ${stmt.kind} */`;
  }
}

export function generate(ast, options = {}) {
  const ctx = { counter: 0 };
  const header = [
    "// ╔══════════════════════════════════════════════════╗",
    "// ║  Compiled by RexScript v0.1.0 · Hatchling        ║",
    "// ║  \"Agents don't browse. They hunt.\"               ║",
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
