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
  "|"
]);

export function createToken(type, value, line, column) {
  return { type, value, line, column };
}
