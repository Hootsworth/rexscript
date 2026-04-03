import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import xrisk from "../../packages/xrisk/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreEnv(name, previous) {
  if (previous == null) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

function runSchemaValidator(tracePath) {
  const validatorPath = path.resolve(process.cwd(), "../tests/integration/validate-trace-schema.js");
  const result = spawnSync("node", [validatorPath, tracePath], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.error) {
    throw new Error(`Failed to execute trace schema validator: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(`Trace schema validator failed: ${stderr || stdout || `exit ${result.status}`}`);
  }
}

async function main() {
  xrisk.resetTrace();

  const previousAllowed = process.env.REX_ALLOWED_USE_INSTEAD_LANGS;
  process.env.REX_ALLOWED_USE_INSTEAD_LANGS = "sql";

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rexscript-blocked-trace-schema-"));
  const tracePath = path.join(tmpDir, "blocked-use-instead.trace.json");

  try {
    await xrisk.before({
      action: "use.instead",
      capability: "FOREIGN_EXEC",
      target: JSON.stringify("auto"),
      loc: { line: 2, column: 3 }
    });

    let blocked = false;
    try {
      await xrisk.after({
        action: "use.instead",
        riskLevel: "LOW",
        result: {
          language: "bash",
          executor: "native",
          confidence: 0.81,
          via: "rosetta",
          output: {
            command: "echo",
            stdout: "blocked"
          }
        },
        loc: { line: 2, column: 3 }
      });
    } catch (err) {
      blocked = err?.name === "ForeignLanguageBlocked" || err?.code === "ForeignLanguageBlocked";
    }

    assert(blocked, "Expected ForeignLanguageBlocked from xrisk.after in blocked schema check");

    xrisk.writeTrace(tracePath);
    assert(fs.existsSync(tracePath), "Expected blocked trace artifact to be written");

    runSchemaValidator(tracePath);
    console.log("use.instead blocked trace schema check passed.");
  } finally {
    restoreEnv("REX_ALLOWED_USE_INSTEAD_LANGS", previousAllowed);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});