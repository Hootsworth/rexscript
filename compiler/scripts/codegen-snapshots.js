import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFile } from "../src/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const compilerRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(compilerRoot, "..");
const fixturesRoot = path.resolve(workspaceRoot, "tests/fixtures");
const snapshotsRoot = path.resolve(workspaceRoot, "tests/snapshots");
const update = process.argv.includes("--update");

function readManifest() {
  const manifestPath = path.resolve(fixturesRoot, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function snapshotPathForFixture(relFixturePath) {
  return path.resolve(snapshotsRoot, `${relFixturePath.replace(/\.rex$/i, ".js")}.snap`);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const manifest = readManifest();
  let failures = 0;

  for (const entry of manifest.valid) {
    const fixtureAbs = path.resolve(fixturesRoot, entry.file);
    const mode = entry.mode || "default";
    const result = compileFile(fixtureAbs, {
      strict: mode === "strict",
      dynamicFeature: mode === "dynamic"
    });

    if (!result.ok) {
      console.error(`Compile failed for ${entry.file}`);
      failures += 1;
      continue;
    }

    const snapPath = snapshotPathForFixture(entry.file);
    ensureDir(snapPath);

    if (update || !fs.existsSync(snapPath)) {
      fs.writeFileSync(snapPath, result.code, "utf8");
      console.log(`Updated snapshot: ${path.relative(workspaceRoot, snapPath)}`);
      continue;
    }

    const existing = fs.readFileSync(snapPath, "utf8");
    if (existing !== result.code) {
      console.error(`Snapshot mismatch: ${entry.file}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`\nSnapshot verification failed (${failures} mismatch(es)).`);
    process.exit(2);
  }

  console.log("Snapshot verification passed.");
}

main();
