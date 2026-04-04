import { parseFile } from "./compiler/src/index.js";
import path from "node:path";

const target = "./tests/fixtures/invalid/err007_dynamic_isolation_violation.rex";
const ast = parseFile(path.resolve(process.cwd(), target));
console.log("AST:", JSON.stringify(ast, null, 2));
