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
    this.tokens = tokens.filter((t) => t.type !== "NEWLINE");
    this.pos = 0;
  }

  eof() {
    return this.pos >= this.tokens.length;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || null;
  }

  next() {
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

function parseObserve(stream) {
  const start = stream.consumeValue("observe");
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

  return withLoc(start, { kind: "ObserveStatement", url, session, alias }, stream.peek(-1));
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
  return withLoc(start, { kind: "RememberStatement", data, tags }, stream.peek(-1));
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
    const comparator = stream.next()?.value;
    const amount = stream.consumeType("NUMBER", "ERR001", "Expected relevance number").value;
    threshold = { comparator, amount: Number(amount) };
  }

  if (!stream.matchValue("as")) {
    throw new ParserError("ERR004", "recall requires 'as $alias'", stream.peek() || stream.peek(-1));
  }
  stream.next();
  const alias = parseVariable(stream, "ERR004", "recall requires variable alias");

  return withLoc(start, { kind: "RecallStatement", tags, threshold, alias }, stream.peek(-1));
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

  return withLoc(start, { kind: "ParallelStatement", limit, body, thenHandler }, stream.peek(-1));
}

function parseCatch(stream) {
  const start = stream.consumeValue("catch");
  const token = stream.next();
  if (!token) {
    throw new ParserError("ERR001", "Expected catch type", token);
  }
  const failureType = token.value;
  const body = parseBlock(stream);
  return withLoc(start, { kind: "CatchClause", failureType, body }, stream.peek(-1));
}

function parseTryCatch(stream) {
  const start = stream.consumeValue("try");
  const body = parseBlock(stream);
  const catches = [];
  while (stream.matchValue("catch")) {
    catches.push(parseCatch(stream));
  }
  if (catches.length === 0) {
    throw new ParserError("ERR001", "try must include at least one catch block", stream.peek());
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

function parseStatement(stream) {
  const token = stream.peek();
  if (!token) {
    throw new ParserError("ERR001", "Unexpected end of input", token);
  }

  switch (token.value) {
    case "observe":
      return parseObserve(stream);
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
    case "try":
      return parseTryCatch(stream);
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
    default:
      if (token.type === "UNKNOWN") {
        throw new ParserError("ERR001", `Unknown token '${token.value}'`, token);
      }
      stream.next();
      return withLoc(token, { kind: "HostJsStatement", raw: token.value }, token);
  }
}

export function parse(source) {
  const tokens = tokenize(source);
  const stream = new TokenStream(tokens);
  const body = [];

  while (!stream.eof()) {
    body.push(parseStatement(stream));
  }

  return {
    kind: "Program",
    body
  };
}

export { ParserError };
