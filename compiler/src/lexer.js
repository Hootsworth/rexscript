import { TOKEN_TYPES, SYMBOLS, createToken } from "./tokens.js";

export const REX_KEYWORDS = new Set([
  "goal", "constraint", "expect", "otherwise", "telemetry", "metric", "span", "trace_id",
  "synthesise", "hunt", "assess", "evaluate", "use.instead", "system", "workspace",
  "tool", "equip", "memory", "remember", "forget", "recall", "clear", "parallel",
  "distributed", "session", "close", "restart", "with", "as", "then", "timeout",
  "spawn", "send", "receive", "from", "to", "security", "vault", "sandbox", "lockdown", "strict",
  "fact", "state", "attempt", "recover", "navigate", "submit", "read", "click", "find",
  "agent", "trace", "trail", "risk", "true", "false", "null", "undefined",
  "if", "else", "function", "class", "return", "import", "export", "for", "while",
  "switch", "case", "break", "continue", "throw", "async", "new", "delete", "typeof", "instanceof", "void"
]);

export function loadKeywordsFromString(raw) {
  return new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

export function loadKeywords(keywordsPath) {
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
      const fs = require("node:fs");
      const path = require("node:path");
      const p = keywordsPath || path.resolve(process.cwd(), "contracts/reserved-keywords.txt");
      return loadKeywordsFromString(fs.readFileSync(p, "utf8"));
  }
  return REX_KEYWORDS;
}

export function tokenize(source, keywords = REX_KEYWORDS) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (type, value, tokenLine, tokenCol) => {
    tokens.push(createToken(type, value, tokenLine, tokenCol));
  };

  while (i < source.length) {
    const ch = source[i];
    const twoChar = source.slice(i, i + 2);

    if (ch === "\n") {
      push(TOKEN_TYPES.NEWLINE, "\\n", line, col);
      i += 1;
      line += 1;
      col = 1;
      continue;
    }

    if (/\s/.test(ch)) {
      i += 1;
      col += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startLine = line;
      const startCol = col;
      let value = quote;
      i += 1;
      col += 1;

      while (i < source.length && source[i] !== quote) {
        value += source[i];
        if (source[i] === "\n") {
          line += 1;
          col = 1;
        } else {
          col += 1;
        }
        i += 1;
      }

      if (i < source.length) {
        value += quote;
        i += 1;
        col += 1;
      }

      push(TOKEN_TYPES.STRING, value, startLine, startCol);
      continue;
    }

    if (ch === "$") {
      const startLine = line;
      const startCol = col;
      let value = ch;
      i += 1;
      col += 1;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        value += source[i];
        i += 1;
        col += 1;
      }
      push(TOKEN_TYPES.VARIABLE, value, startLine, startCol);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const startLine = line;
      const startCol = col;
      let value = ch;
      i += 1;
      col += 1;
      while (i < source.length && /[0-9.]/.test(source[i])) {
        value += source[i];
        i += 1;
        col += 1;
      }
      push(TOKEN_TYPES.NUMBER, value, startLine, startCol);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const startLine = line;
      const startCol = col;
      let value = ch;
      i += 1;
      col += 1;
      while (i < source.length && /[A-Za-z0-9_.]/.test(source[i])) {
        value += source[i];
        i += 1;
        col += 1;
      }
      if (keywords.has(value)) {
        push(TOKEN_TYPES.KEYWORD, value, startLine, startCol);
      } else {
        push(TOKEN_TYPES.IDENTIFIER, value, startLine, startCol);
      }
      continue;
    }

    if (SYMBOLS.has(ch)) {
      if ([">=", "<=", "==", "!="].includes(twoChar)) {
        push(TOKEN_TYPES.SYMBOL, twoChar, line, col);
        i += 2;
        col += 2;
        continue;
      }
      push(TOKEN_TYPES.SYMBOL, ch, line, col);
      i += 1;
      col += 1;
      continue;
    }

    push(TOKEN_TYPES.UNKNOWN, ch, line, col);
    i += 1;
    col += 1;
  }

  return tokens;
}
