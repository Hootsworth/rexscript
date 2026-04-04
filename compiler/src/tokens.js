export const TOKEN_TYPES = {
  KEYWORD: "KEYWORD",
  VARIABLE: "VARIABLE",
  IDENTIFIER: "IDENTIFIER",
  STRING: "STRING",
  NUMBER: "NUMBER",
  SYMBOL: "SYMBOL",
  NEWLINE: "NEWLINE",
  UNKNOWN: "UNKNOWN"
};

export const SYMBOLS = new Set([
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ",",
  ":",
  ".",
  ";",
  "=",
  ">",
  "<",
  "*",
  "+",
  "-",
  "/",
  "|",
  "!"
]);

export function createToken(type, value, line, column, meta = {}) {
  return {
    type,
    value,
    line,
    column,
    start: meta.start ?? null,
    end: meta.end ?? null,
    terminated: meta.terminated ?? true
  };
}
