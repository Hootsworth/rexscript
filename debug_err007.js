import { checkString } from "./compiler/src/index.js";
import fs from "node:fs";

const source = `use.instead:python as $out {
  import rex-core
  print('x')
}`;

const result = checkString(source, "test.rex", { dynamicFeature: true });
console.log("Diagnostics:", JSON.stringify(result.diagnostics, null, 2));
