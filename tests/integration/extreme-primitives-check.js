import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compileString } from "../../compiler/src/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const source = `
session s with {
  cookies: true
}

expect {
  observe page "data:text/html,<html><body><button>login button</button><label>username field</label><div>Price: 19.99</div><div>In stock: true</div><footer>footer</footer></body></html>" with session s as $page
  click "login button" on $page
  type "user@example.com" into "username field" on $page
  scroll to "footer" on $page
  watch "data:text/html,<html><body>Status available</body></html>" for "available" until 1s as $statusPage
} otherwise * {
  use default null
}

extract {
  price: number,
  inStock: boolean
} from $page as $data

verify $data.price is "a reasonable value"

budget max_cost=$1, max_tokens=5000, max_time=1s {
  synthesise [$page, $statusPage] as $summary
}
`;

  const result = compileString(source, "extreme-primitives-check.rex", {
    generatedFile: path.join(repoRoot, "compiler/.rex-run/extreme-primitives-check.js")
  });

  assert(result.ok, `extreme primitives source should compile: ${result.formatted}`);
  assert(result.code.includes('__rex.extract({"price":"number","inStock":"boolean"}, $page)'), "extract should compile schema types as string literals");
  assert(!result.code.includes("price: number"), "extract should not emit bare JS identifiers for schema types");

  const tmpDir = path.join(repoRoot, "compiler/.rex-run");
  const compiledPath = path.join(tmpDir, "extreme-primitives-check.js");

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(compiledPath, result.code, "utf8");
    const proc = spawnSync("node", [compiledPath], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    if (proc.error) {
      throw proc.error;
    }

    assert((proc.status ?? 1) === 0, `extreme primitives program failed: ${proc.stderr || proc.stdout}`);
    console.log("Extreme primitives check passed.");
  } finally {
    fs.rmSync(compiledPath, { force: true });
  }
}

main();
