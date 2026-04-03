class TokenStream {
  constructor(tokens) {
    this.tokens = tokens.filter((t) => t.type !== "NEWLINE");
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || null;
  }

  consumeValue(value, code = "ERR001", message = `Expected '${value}'`) {
    const token = this.peek();
    if (!token || token.value !== value) {
      throw new ParserError(code, message, token || this.peek(-1));
    }
    this.pos += 1;
    return token;
  }
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
