import { tokenize } from "./lexer.js";

class ParserError extends Error {
  constructor(code, message, token) {
    super(message);
    this.name = "ParserError";
    this.code = code;
    this.token = token || null;
    this.line = token?.line ?? null;
    this.column = token?.column ?? null;
  }
}

class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  skipNewlines() {
    while (this.pos < this.tokens.length && this.tokens[this.pos]?.type === "NEWLINE") {
      this.pos += 1;
    }
  }

  eofRaw() {
    return this.pos >= this.tokens.length;
  }

  eof() {
    this.skipNewlines();
    return this.pos >= this.tokens.length;
  }

  peekRaw(offset = 0) {
    return this.tokens[this.pos + offset] || null;
  }

  peek(offset = 0) {
    this.skipNewlines();
    return this.peekRaw(offset);
  }

  nextRaw() {
    const token = this.peekRaw();
    if (token) {
      this.pos += 1;
    }
    return token;
  }

  next() {
    this.skipNewlines();
    const token = this.peek();
    if (token) {
      this.pos += 1;
    }
    return token;
  }

  matchValue(value) {
    const token = this.peek();
    return Boolean(token && token.value === value);
  }

  consumeValue(value, code = "ERR001", message = `Expected '${value}'`) {
    const token = this.peek();
    if (!token || token.value !== value) {
      throw new ParserError(code, message, token || this.peek(-1));
    }
    this.pos += 1;
    return token;
  }

  consumeType(type, code = "ERR001", message = `Expected token type ${type}`) {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new ParserError(code, message, token || this.peek(-1));
    }
    this.pos += 1;
    return token;
  }
}

const REX_STATEMENT_KEYWORDS = new Set([
  "observe",
  "hunt",
  "navigate",
  "find",
  "remember",
  "forget",
  "recall",
  "emit",
  "flag",
  "session",
  "parallel",
  "synthesise",
  "attempt",
  "expect",
  "when",
  "use.instead",
  "skip",
  "retry",
  "rotate",
  "use",
  "goal",
  "workspace",
  "rationale",
  "fact",
  "state",
  "assess",
  "tool",
  "equip",
  "telemetry",
  "spawn",
  "send",
  "security"
]);

function withLoc(startToken, node, endToken = startToken) {
  return {
    ...node,
    loc: {
      start: {
        line: startToken?.line ?? null,
        column: startToken?.column ?? null
      },
      end: {
        line: endToken?.line ?? null,
        column: endToken?.column ?? null
      }
    }
  };
}

function parseUrlLike(stream) {
  const token = stream.peek();
  if (!token) {
    throw new ParserError("ERR001", "Expected URL expression", token);
  }
  if (["STRING", "VARIABLE", "IDENTIFIER"].includes(token.type)) {
    stream.next();
    return { type: "Expression", value: token.value };
  }
  throw new ParserError("ERR001", "Invalid URL expression", token);
}

function parseVariable(stream, code = "ERR001", message = "Expected variable") {
  const token = stream.consumeType("VARIABLE", code, message);
  return token.value;
}

function parseIdentifier(stream) {
  const token = stream.consumeType("IDENTIFIER", "ERR001", "Expected identifier");
  return token.value;
}

function parseStringList(stream) {
  const values = [];
  values.push(stream.consumeType("STRING", "ERR001", "Expected string literal").value);
  while (stream.matchValue(",")) {
    stream.next();
    values.push(stream.consumeType("STRING", "ERR001", "Expected string literal").value);
  }
  return values;
}

function parseBracedRaw(stream) {
  stream.consumeValue("{");
  let depth = 1;
  const body = [];

  while (!stream.eof() && depth > 0) {
    const token = stream.next();
    if (!token) {
      break;
    }
    if (token.value === "{") {
      depth += 1;
      body.push(token);
      continue;
    }
    if (token.value === "}") {
      depth -= 1;
      if (depth === 0) {
        break;
      }
      body.push(token);
      continue;
    }
    body.push(token);
  }

  return body.map((t) => t.value).join(" ");
}

function parseBlock(stream) {
  stream.consumeValue("{");
  const body = [];
  while (!stream.eof() && !stream.matchValue("}")) {
    body.push(parseStatement(stream));
  }
  stream.consumeValue("}");
  return body;
}

function parseObserve(stream, verb = "observe") {
  const start = stream.consumeValue(verb);
  stream.consumeValue("page");
  const url = parseUrlLike(stream);

  let session = null;
  if (stream.matchValue("with")) {
    stream.next();
    stream.consumeValue("session");
    session = parseIdentifier(stream);
  }

  if (!stream.matchValue("as")) {
    throw new ParserError("ERR004", "observe requires 'as $alias'", stream.peek() || stream.peek(-1));
  }
  stream.next();
  const alias = parseVariable(stream, "ERR004", "observe requires variable alias");

  return withLoc(start, { kind: "ObserveStatement", verb, url, session, alias }, stream.peek(-1));
}

function parseHostJsStatement(stream) {
  while (!stream.eofRaw() && stream.peekRaw()?.type === "NEWLINE") {
    stream.nextRaw();
  }

  const start = stream.peekRaw();
  if (!start) {
    return null;
  }

  const rawTokens = [];
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  while (!stream.eofRaw()) {
    const token = stream.peekRaw();
    if (!token) {
      break;
    }

    if (token.type === "NEWLINE") {
      stream.nextRaw();
      if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && rawTokens.length > 0) {
        break;
      }
      continue;
    }

    if (token.type === "UNKNOWN") {
      throw new ParserError("ERR001", `Unknown token '${token.value}'`, token);
    }

    if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      if (rawTokens.length > 0 && token.type === "KEYWORD" && REX_STATEMENT_KEYWORDS.has(token.value)) {
        break;
      }
      if (rawTokens.length > 0 && token.value === "}") {
        break;
      }
    }

    const current = stream.nextRaw();
    rawTokens.push(current.value);

    if (current.value === "(") {
      parenDepth += 1;
      continue;
    }
    if (current.value === ")" && parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }
    if (current.value === "[") {
      bracketDepth += 1;
      continue;
    }
    if (current.value === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }
    if (current.value === "{") {
      braceDepth += 1;
      continue;
    }
    if (current.value === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && current.value === ";") {
      break;
    }
  }

  return withLoc(start, { kind: "HostJsStatement", raw: rawTokens.join(" ") }, stream.peekRaw(-1) || start);
}

function parseNavigate(stream) {
  const start = stream.consumeValue("navigate");
  if (stream.matchValue("back") || stream.matchValue("forward")) {
    return withLoc(
      start,
      { kind: "NavigateStatement", direction: stream.next().value, url: null, session: null, headers: null },
      stream.peek(-1)
    );
  }

  stream.consumeValue("to");
  const url = parseUrlLike(stream);
  let session = null;
  let headers = null;

  while (stream.matchValue("with")) {
    stream.next();
    if (stream.matchValue("session")) {
      stream.next();
      session = parseIdentifier(stream);
      continue;
    }
    if (stream.matchValue("{")) {
      headers = parseBracedRaw(stream);
      continue;
    }
    throw new ParserError("ERR001", "Invalid navigate with-clause", stream.peek());
  }

  return withLoc(start, { kind: "NavigateStatement", direction: "to", url, session, headers }, stream.peek(-1));
}

function parseFind(stream) {
  const start = stream.consumeValue("find");
  const selector = stream.consumeType("STRING", "ERR001", "find requires string selector").value;
  stream.consumeValue("in");
  let source = null;
  let sourceType = "variable";
  let sourceRaw = null;

  if (stream.matchValue("{")) {
    sourceType = "raw";
    sourceRaw = parseBracedRaw(stream);
  } else {
    source = parseVariable(stream);
  }

  if (!stream.matchValue("as")) {
    throw new ParserError("ERR004", "find requires 'as $alias'", stream.peek() || stream.peek(-1));
  }
  stream.next();
  const alias = parseVariable(stream, "ERR004", "find requires variable alias");

  return withLoc(
    start,
    { kind: "FindStatement", selector, source, sourceType, sourceRaw, alias },
    stream.peek(-1)
  );
}

function parseRemember(stream) {
  const start = stream.consumeValue("remember");
  const data = parseVariable(stream);
  stream.consumeValue("tagged");
  const tags = parseStringList(stream);
  
  let mode = null;
  if (stream.matchValue("mode")) {
    stream.next();
    const modeTok = stream.next();
    if (!modeTok) throw new ParserError("ERR001", "Expected mode value", stream.peek(-1));
    mode = modeTok.value;
  }
  
  return withLoc(start, { kind: "RememberStatement", data, tags, mode }, stream.peek(-1));
}

function parseForget(stream) {
  const start = stream.consumeValue("forget");
  stream.consumeValue("tagged");
  const tags = parseStringList(stream);
  return withLoc(start, { kind: "ForgetStatement", tags }, stream.peek(-1));
}

function parseRecall(stream) {
  const start = stream.consumeValue("recall");
  stream.consumeValue("tagged");
  const tags = parseStringList(stream);

  let threshold = null;
  if (stream.matchValue("where")) {
    stream.next();
    stream.consumeValue("relevance");
    let comparator = ">";
    if (stream.peek()?.type === "SYMBOL") {
      comparator = stream.next().value;
    }
    const amount = stream.consumeType("NUMBER", "ERR001", "Expected relevance number").value;
    threshold = { comparator, amount: Number(amount) };
  }

  let mode = null;
  if (stream.matchValue("mode")) {
    stream.next();
    const modeTok = stream.next();
    if (!modeTok) throw new ParserError("ERR001", "Expected mode value", stream.peek(-1));
    mode = modeTok.value;
  }

  if (!stream.matchValue("as")) {
    throw new ParserError("ERR004", "recall requires 'as $alias'", stream.peek() || stream.peek(-1));
  }
  stream.next();
  const alias = parseVariable(stream, "ERR004", "recall requires variable alias");

  return withLoc(start, { kind: "RecallStatement", tags, threshold, mode, alias }, stream.peek(-1));
}

function parseEmit(stream) {
  const start = stream.consumeValue("emit");
  const raw = parseBracedRaw(stream);
  return withLoc(start, { kind: "EmitStatement", fieldsRaw: raw }, stream.peek(-1));
}

function parseFlag(stream) {
  const start = stream.consumeValue("flag");
  const target = parseVariable(stream);
  stream.consumeValue("as");
  const label = parseIdentifier(stream);
  return withLoc(start, { kind: "FlagStatement", target, label }, stream.peek(-1));
}

function parseSession(stream) {
  const start = stream.consumeValue("session");
  const name = parseIdentifier(stream);
  stream.consumeValue("with");
  const optionsRaw = parseBracedRaw(stream);
  return withLoc(start, { kind: "SessionStatement", name, optionsRaw }, stream.peek(-1));
}

function parseSynthesise(stream) {
  const start = stream.consumeValue("synthesise");
  stream.consumeValue("[");
  const inputs = [];
  if (!stream.matchValue("]")) {
    inputs.push(parseVariable(stream));
    while (stream.matchValue(",")) {
      stream.next();
      inputs.push(parseVariable(stream));
    }
  }
  stream.consumeValue("]");

  let alias = null;
  if (stream.matchValue("as")) {
    stream.next();
    alias = parseVariable(stream);
  }
  return withLoc(start, { kind: "SynthesiseStatement", inputs, alias }, stream.peek(-1));
}

function parseParallel(stream) {
  const start = stream.consumeValue("parallel");
  let distributed = false;
  if (stream.matchValue("distributed")) {
    stream.next();
    distributed = true;
  }
  let limit = null;
  if (stream.matchValue("limit")) {
    stream.next();
    limit = Number(stream.consumeType("NUMBER", "ERR001", "parallel limit must be a number").value);
  }

  const body = parseBlock(stream);
  let thenHandler = null;
  if (stream.matchValue("then")) {
    stream.next();
    if (stream.matchValue("synthesise")) {
      thenHandler = parseSynthesise(stream);
    } else {
      thenHandler = { kind: "HostExpression", raw: stream.next()?.value || null };
    }
  }

  return withLoc(start, { kind: "ParallelStatement", distributed, limit, body, thenHandler }, stream.peek(-1));
}

function parseSpawn(stream) {
  const start = stream.consumeValue("spawn");
  stream.consumeValue("agent");
  const token = stream.peek();
  let agentType;
  if (token && (token.type === "STRING" || token.type === "IDENTIFIER")) {
      agentType = stream.next().value;
  } else {
      throw new ParserError("ERR001", "Expected agent type", token);
  }

  let options = null;
  if (stream.matchValue("with")) {
      stream.next();
      if (stream.peek().type === "VARIABLE") {
          options = stream.next().value;
      } else {
          options = parseBracedRaw(stream);
      }
  }

  stream.consumeValue("as");
  const alias = parseVariable(stream);
  if (stream.matchValue(";")) stream.next();

  return withLoc(start, { kind: "SpawnStatement", agentType, options, alias }, stream.peek(-1));
}

function parseSend(stream) {
  const start = stream.consumeValue("send");
  let data;
  if (stream.matchValue("{")) {
     data = parseBracedRaw(stream);
  } else {
     data = parseVariable(stream);
  }
  stream.consumeValue("to");
  const target = parseVariable(stream);
  if (stream.matchValue(";")) stream.next();
  return withLoc(start, { kind: "SendStatement", data, target }, stream.peek(-1));
}

function parseRecover(stream) {
  const start = stream.consumeValue("recover");
  const token = stream.peek();
  let failureType = "*";
  if (token && token.value !== "{") {
    failureType = stream.next().value;
  }
  const body = parseBlock(stream);
  return withLoc(start, { kind: "CatchClause", failureType, body }, stream.peek(-1));
}

function parseCatch(stream) {
  const start = stream.consumeValue("catch");
  const token = stream.peek();
  let failureType = "*";
  if (token && token.value !== "{") {
    failureType = stream.next().value;
  }
  const body = parseBlock(stream);
  return withLoc(start, { kind: "CatchClause", failureType, body }, stream.peek(-1));
}

function parseOtherwise(stream) {
  const start = stream.consumeValue("otherwise");
  const token = stream.peek();
  let failureType = "*";
  if (token && token.value !== "{") {
    failureType = stream.next().value;
  }
  const body = parseBlock(stream);
  return withLoc(start, { kind: "CatchClause", failureType, body }, stream.peek(-1));
}

function parseAttempt(stream) {
  const start = stream.consumeValue("attempt");
  const body = parseBlock(stream);
  
  let upto = null;
  if (stream.matchValue("upto")) {
    stream.next();
    upto = Number(stream.consumeType("NUMBER", "ERR001", "attempt upto must be a number").value);
  }
  
  let timeout = null;
  if (stream.matchValue("timeout")) {
    stream.next();
    const timeNum = stream.consumeType("NUMBER").value;
    const timeUnit = stream.consumeType("IDENTIFIER").value;
    timeout = timeNum + timeUnit;
  }

  const catches = [];
  while (stream.matchValue("recover") || stream.matchValue("otherwise")) {
    if (stream.matchValue("recover")) {
      catches.push(parseRecover(stream));
    } else {
      catches.push(parseOtherwise(stream));
    }
  }
  
  let ensureBody = null;
  if (stream.matchValue("ensure")) {
    stream.next();
    ensureBody = parseBlock(stream);
  }

  return withLoc(start, { kind: "AttemptStatement", body, upto, timeout, catches, ensureBody }, stream.peek(-1));
}

function parseExpectOtherwise(stream) {
  const start = stream.consumeValue("expect");
  const body = parseBlock(stream);
  const catches = [];

  while (stream.matchValue("otherwise")) {
    catches.push(parseOtherwise(stream));
  }

  if (catches.length === 0) {
    throw new ParserError("ERR001", "expect must include at least one otherwise block", stream.peek());
  }

  return withLoc(start, { kind: "TryCatchStatement", body, catches }, stream.peek(-1));
}

function parseSimpleKeyword(stream, keyword, kind) {
  const start = stream.consumeValue(keyword);
  return withLoc(start, { kind }, start);
}

function parseUseDefault(stream) {
  const start = stream.consumeValue("use");
  stream.consumeValue("default");
  const firstToken = stream.next();
  if (!firstToken) {
    throw new ParserError("ERR001", "use default requires a fallback expression", stream.peek(-1));
  }

  const bracketPairs = {
    "[": "]",
    "{": "}",
    "(": ")"
  };

  const valueTokens = [firstToken];
  if (Object.prototype.hasOwnProperty.call(bracketPairs, firstToken.value)) {
    const stack = [bracketPairs[firstToken.value]];
    while (!stream.eof() && stack.length > 0) {
      const token = stream.next();
      if (!token) {
        break;
      }
      valueTokens.push(token);

      if (Object.prototype.hasOwnProperty.call(bracketPairs, token.value)) {
        stack.push(bracketPairs[token.value]);
        continue;
      }
      if (token.value === stack[stack.length - 1]) {
        stack.pop();
      }
    }
  }

  const rawValue = valueTokens.map((t) => t.value).join(" ");
  const endToken = valueTokens[valueTokens.length - 1] || firstToken;

  return withLoc(
    start,
    {
      kind: "UseDefaultStatement",
      value: {
        type: firstToken.type,
        raw: rawValue
      }
    },
    endToken
  );
}

function parseRotateProxy(stream) {
  const start = stream.consumeValue("rotate");
  stream.consumeValue("proxy");
  return withLoc(start, { kind: "RotateProxyStatement" }, stream.peek(-1));
}

function readConditionTokensUntilBlock(stream) {
  const parts = [];
  while (!stream.eof() && !stream.matchValue("{")) {
    const token = stream.next();
    if (token) {
      parts.push(token);
    }
  }
  return parts;
}

function parseWhenCondition(tokens) {
  const raw = tokens.map((t) => t.value).join(" ");

  if (tokens.length === 3 && tokens[0].type === "VARIABLE" && tokens[1].value === "is") {
    if (tokens[2].value === "empty") {
      return {
        kind: "EmptyCondition",
        variable: tokens[0].value,
        raw
      };
    }
    return {
      kind: "PageStateCondition",
      variable: tokens[0].value,
      state: tokens[2].value,
      raw
    };
  }

  if (tokens.length === 2 && tokens[0].type === "VARIABLE" && tokens[1].value === "seems_unreliable") {
    return {
      kind: "SeemsUnreliableCondition",
      variable: tokens[0].value,
      raw
    };
  }

  if (
    tokens.length === 4 &&
    tokens[0].type === "VARIABLE" &&
    tokens[1].value === "confidence" &&
    [">", "<", "=", ">=", "<=", "!=", "=="].includes(tokens[2].value) &&
    tokens[3].type === "NUMBER"
  ) {
    return {
      kind: "ConfidenceCondition",
      variable: tokens[0].value,
      comparator: tokens[2].value,
      value: Number(tokens[3].value),
      raw
    };
  }

  return {
    kind: "JsCondition",
    raw
  };
}

function parseWhen(stream) {
  const start = stream.consumeValue("when");
  const conditionTokens = readConditionTokensUntilBlock(stream);
  const condition = parseWhenCondition(conditionTokens);
  const body = parseBlock(stream);
  let otherwise = null;
  if (stream.matchValue("otherwise")) {
    stream.next();
    otherwise = parseBlock(stream);
  }
  return withLoc(
    start,
    {
      kind: "WhenStatement",
      condition,
      conditionRaw: condition.raw,
      body,
      otherwise
    },
    stream.peek(-1)
  );
}

function parseUseInstead(stream) {
  const start = stream.consumeValue("use.instead");
  let languageHint = null;
  let outputAlias = null;

  if (stream.matchValue(":")) {
    stream.next();
    const hintToken = stream.next();
    languageHint = hintToken?.value || null;
  }

  if (stream.matchValue("as")) {
    stream.next();
    outputAlias = parseVariable(stream, "ERR001", "use.instead alias must be a variable");
  }

  const content = parseBracedRaw(stream);
  const catches = [];
  while (stream.matchValue("catch")) {
    catches.push(parseCatch(stream));
  }

  return withLoc(
    start,
    { kind: "UseInsteadStatement", languageHint, outputAlias, content, catches },
    stream.peek(-1)
  );
}

function parseVariableDeclaration(stream, declType) {
  const start = stream.consumeValue(declType);
  const rawTokens = [];
  while (!stream.eofRaw()) {
     const t = stream.peekRaw();
     if (!t || t.type === "NEWLINE" || t.value === ";") {
         if (t && t.value === ";") rawTokens.push(stream.nextRaw().value);
         break;
     }
     rawTokens.push(stream.nextRaw().value);
  }
  return withLoc(start, { kind: "VariableDeclaration", declType, raw: rawTokens.join(" ") }, stream.peekRaw(-1) || start);
}

function parseGoal(stream) {
  const start = stream.consumeValue("goal");
  const description = stream.consumeType("STRING").value;
  let constraints = null;
  if (stream.matchValue("constraint")) {
    stream.next();
    stream.consumeValue("{");
    constraints = {};
    while (!stream.eof() && !stream.matchValue("}")) {
      const field = stream.next().value;
      let op = null;
      if (stream.peek()?.type === "SYMBOL") {
        op = stream.next().value;
      }
      if (field === "budget") {
        constraints.budget = Number(stream.consumeType("NUMBER").value);
      } else if (field === "timeout") {
        const num = Number(stream.consumeType("NUMBER").value);
        let unit = "ms";
        if (stream.matchValue("s") || stream.matchValue("ms")) {
          unit = stream.next().value;
        }
        constraints.timeoutMs = unit === "s" ? num * 1000 : num;
      } else {
        throw new ParserError("ERR001", "Unknown constraint inside goal", stream.peek(-1));
      }
    }
    stream.consumeValue("}");
  }
  const body = parseBlock(stream);
  return withLoc(start, { kind: "GoalStatement", description, constraints, body }, stream.peek(-1));
}

function parseWorkspace(stream) {
  const start = stream.consumeValue("workspace");
  const name = stream.consumeType("STRING").value;
  const body = parseBlock(stream);
  return withLoc(start, { kind: "WorkspaceStatement", name, body }, stream.peek(-1));
}

function parseRationale(stream) {
  const start = stream.consumeValue("rationale");
  const reason = stream.consumeType("STRING").value;
  if (stream.matchValue(";")) stream.next();
  return withLoc(start, { kind: "RationaleStatement", reason }, stream.peek(-1));
}

function parseAssessCase(stream) {
  const start = stream.consumeValue("case");
  const condition = stream.consumeType("STRING", "ERR001", "assess case requires a string condition").value;
  if (stream.matchValue(":")) stream.next();
  
  const body = [];
  while (!stream.eof() && !stream.matchValue("case") && !stream.matchValue("otherwise") && !stream.matchValue("}")) {
      body.push(parseStatement(stream));
  }
  return withLoc(start, { kind: "AssessCase", condition, body }, stream.peek(-1) || start);
}

function parseAssess(stream) {
  const start = stream.consumeValue("assess");
  const target = parseVariable(stream, "ERR001", "assess requires a variable");
  stream.consumeValue("{");
  const cases = [];
  let otherwise = null;
  
  while (!stream.eof() && !stream.matchValue("}")) {
    if (stream.matchValue("case")) {
      cases.push(parseAssessCase(stream));
    } else if (stream.matchValue("otherwise")) {
      stream.next();
      if (stream.matchValue(":")) stream.next();
      otherwise = [];
      while (!stream.eof() && !stream.matchValue("}")) {
        otherwise.push(parseStatement(stream));
      }
    } else {
      throw new ParserError("ERR001", "Expected case or otherwise inside assess block", stream.peek());
    }
  }
  stream.consumeValue("}");
  
  return withLoc(start, { kind: "AssessStatement", target, cases, otherwise }, stream.peek(-1));
}

function parseTool(stream) {
  const start = stream.consumeValue("tool");
  const name = parseIdentifier(stream);
  stream.consumeValue("(");
  const params = [];
  if (!stream.matchValue(")")) {
    params.push(parseVariable(stream));
    while (stream.matchValue(",")) {
      stream.next();
      params.push(parseVariable(stream));
    }
  }
  stream.consumeValue(")");
  const body = parseBlock(stream);
  
  return withLoc(start, { kind: "ToolDeclaration", name, params, body }, stream.peek(-1));
}

function parseEquip(stream) {
  const start = stream.consumeValue("equip");
  const name = parseIdentifier(stream);
  if (stream.matchValue(";")) stream.next();
  return withLoc(start, { kind: "EquipStatement", name }, stream.peek(-1));
}

function parseSecurity(stream) {
  const start = stream.consumeValue("security");
  stream.consumeValue("{");
  const config = {};
  while (!stream.eof() && !stream.matchValue("}")) {
     const field = stream.next().value;
     if (field === "sandbox") {
        config.sandbox = stream.consumeType("STRING").value;
     } else if (field === "lockdown") {
        config.lockdown = stream.next().value;
     } else {
        throw new ParserError("ERR001", `Unknown security field: ${field}`, stream.peek(-1));
     }
  }
  stream.consumeValue("}");
  return withLoc(start, { kind: "SecurityStatement", config }, stream.peek(-1));
}

function parseTelemetry(stream) {
  const start = stream.consumeValue("telemetry");
  stream.consumeValue("{");
  const config = {};
  while (!stream.eof() && !stream.matchValue("}")) {
     const field = stream.next().value;
     if (field === "exporter") {
        config.exporter = stream.consumeType("STRING").value;
     } else if (field === "endpoint") {
        config.endpoint = stream.consumeType("STRING").value;
     } else if (field === "key") {
        config.key = parseVariable(stream);
     } else {
        throw new ParserError("ERR001", "Unknown telemetry field", stream.peek(-1));
     }
  }
  stream.consumeValue("}");
  return withLoc(start, { kind: "TelemetryStatement", config }, stream.peek(-1));
}

function parseStatement(stream) {
  const token = stream.peek();
  if (!token) {
    throw new ParserError("ERR001", "Unexpected end of input", token);
  }

  switch (token.value) {
    case "observe":
      return parseObserve(stream);
    case "hunt":
      return parseObserve(stream, "hunt");
    case "navigate":
      return parseNavigate(stream);
    case "find":
      return parseFind(stream);
    case "remember":
      return parseRemember(stream);
    case "forget":
      return parseForget(stream);
    case "recall":
      return parseRecall(stream);
    case "emit":
      return parseEmit(stream);
    case "flag":
      return parseFlag(stream);
    case "session":
      return parseSession(stream);
    case "parallel":
      return parseParallel(stream);
    case "synthesise":
      return parseSynthesise(stream);
    case "attempt":
      return parseAttempt(stream);
    case "expect":
      return parseExpectOtherwise(stream);
    case "when":
      return parseWhen(stream);
    case "use.instead":
      return parseUseInstead(stream);
    case "skip":
      return parseSimpleKeyword(stream, "skip", "SkipStatement");
    case "retry":
      return parseSimpleKeyword(stream, "retry", "RetryStatement");
    case "rotate":
      return parseRotateProxy(stream);
    case "use":
      return parseUseDefault(stream);
    case "goal":
      return parseGoal(stream);
    case "workspace":
      return parseWorkspace(stream);
    case "rationale":
      return parseRationale(stream);
    case "fact":
      return parseVariableDeclaration(stream, "fact");
    case "state":
      return parseVariableDeclaration(stream, "state");
    case "assess":
      return parseAssess(stream);
    case "tool":
      return parseTool(stream);
    case "equip":
      return parseEquip(stream);
    case "telemetry":
      return parseTelemetry(stream);
    case "spawn":
      return parseSpawn(stream);
    case "send":
      return parseSend(stream);
    case "security":
      return parseSecurity(stream);
    default:
      return parseHostJsStatement(stream);
  }
}

export function parse(source) {
  const tokens = tokenize(source);
  const stream = new TokenStream(tokens);
  const body = [];

  while (!stream.eof()) {
    const statement = parseStatement(stream);
    if (statement) {
      body.push(statement);
    }
  }

  return {
    kind: "Program",
    body
  };
}

export { ParserError };
