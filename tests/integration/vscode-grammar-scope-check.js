import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findPatternByName(grammar, scopeName) {
  const repo = grammar.repository || {};
  for (const key of Object.keys(repo)) {
    const patterns = repo[key]?.patterns || [];
    for (const pattern of patterns) {
      if (pattern?.name === scopeName) {
        return pattern;
      }
    }
  }
  return null;
}

function toRegex(pattern, field = "match") {
  const source = pattern?.[field];
  assert(typeof source === "string" && source.length > 0, `Pattern missing ${field}: ${pattern?.name || "unknown"}`);
  return new RegExp(source);
}

function main() {
  const grammarPath = path.resolve(process.cwd(), "../extensions/vscode-rexscript/syntaxes/rexscript.tmLanguage.json");
  const grammar = readJson(grammarPath);

  const comment = findPatternByName(grammar, "comment.line.double-slash.rexscript");
  const keywordControl = findPatternByName(grammar, "keyword.control.rexscript");
  const keywordOther = findPatternByName(grammar, "keyword.other.rexscript");
  const constantLang = findPatternByName(grammar, "constant.language.rexscript");
  const variable = findPatternByName(grammar, "variable.other.rexscript");
  const number = findPatternByName(grammar, "constant.numeric.rexscript");
  const operator = findPatternByName(grammar, "keyword.operator.rexscript");
  const stringDouble = findPatternByName(grammar, "string.quoted.double.rexscript");
  const stringSingle = findPatternByName(grammar, "string.quoted.single.rexscript");

  assert(comment, "Missing comment scope pattern");
  assert(keywordControl, "Missing keyword.control scope pattern");
  assert(keywordOther, "Missing keyword.other scope pattern");
  assert(constantLang, "Missing constant.language scope pattern");
  assert(variable, "Missing variable scope pattern");
  assert(number, "Missing numeric scope pattern");
  assert(operator, "Missing operator scope pattern");
  assert(stringDouble, "Missing double-quoted string scope pattern");
  assert(stringSingle, "Missing single-quoted string scope pattern");

  const commentRe = toRegex(comment);
  const keywordControlRe = toRegex(keywordControl);
  const keywordOtherRe = toRegex(keywordOther);
  const constantLangRe = toRegex(constantLang);
  const variableRe = toRegex(variable);
  const numberRe = toRegex(number);
  const operatorRe = toRegex(operator);
  const stringDoubleBegin = toRegex(stringDouble, "begin");
  const stringDoubleEnd = toRegex(stringDouble, "end");
  const stringSingleBegin = toRegex(stringSingle, "begin");
  const stringSingleEnd = toRegex(stringSingle, "end");

  assert(commentRe.test("// RexScript comment"), "Expected // line to match comment scope");

  assert(keywordControlRe.test("expect"), "Expected expect to match keyword.control scope");
  assert(keywordControlRe.test("otherwise"), "Expected otherwise to match keyword.control scope");
  assert(keywordControlRe.test("try"), "Expected try to match keyword.control scope");
  assert(keywordControlRe.test("catch"), "Expected catch to match keyword.control scope");
  assert(keywordControlRe.test("use.instead"), "Expected use.instead to match keyword.control scope");
  assert(!keywordControlRe.test("expectation"), "keyword.control should not match expectation");

  assert(keywordOtherRe.test("observe"), "Expected observe to match keyword.other scope");
  assert(keywordOtherRe.test("synthesise"), "Expected synthesise to match keyword.other scope");
  assert(keywordOtherRe.test("limit"), "Expected limit to match keyword.other scope");

  assert(constantLangRe.test("loaded"), "Expected loaded to match constant.language scope");
  assert(constantLangRe.test("true"), "Expected true to match constant.language scope");

  assert(variableRe.test("$rows_1"), "Expected $rows_1 to match variable scope");
  assert(!variableRe.test("$1rows"), "Variable scope should reject invalid variable start");

  assert(numberRe.test("42"), "Expected integer to match numeric scope");
  assert(numberRe.test("3.14"), "Expected float to match numeric scope");

  assert(operatorRe.test("=="), "Expected == to match operator scope");
  assert(operatorRe.test("+"), "Expected + to match operator scope");

  assert(stringDoubleBegin.test("\""), "Expected double quote to match double string begin");
  assert(stringDoubleEnd.test("\""), "Expected double quote to match double string end");
  assert(stringSingleBegin.test("'"), "Expected single quote to match single string begin");
  assert(stringSingleEnd.test("'"), "Expected single quote to match single string end");

  console.log("VS Code RexScript grammar scope check passed.");
}

main();