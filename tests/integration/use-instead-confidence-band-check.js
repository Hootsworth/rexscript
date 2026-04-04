import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkFile } from "../../compiler/src/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFixture(dir, name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, "utf8");
  return file;
}

function getCodes(result) {
  return {
    errors: new Set((result?.diagnostics?.errors || []).map((d) => d.code)),
    warnings: new Set((result?.diagnostics?.warnings || []).map((d) => d.code))
  };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rexscript-use-instead-confidence-"));
  try {
    const ambiguousFile = writeFixture(
      tmp,
      "ambiguous.rex",
      "use.instead as $out {\n  do work quickly with this text\n}\n"
    );
    const lowConfidenceFile = writeFixture(
      tmp,
      "low-confidence.rex",
      "use.instead as $out {\n  import math\n  def calc(x):\n    pass\n}\n"
    );
    const highConfidenceFile = writeFixture(
      tmp,
      "high-confidence.rex",
      "use.instead as $out {\n  SELECT id FROM posts WHERE id > 1 JOIN users ON users.id = posts.id\n  INSERT INTO audit VALUES (1)\n  UPDATE posts SET title = 'ok'\n  DELETE FROM posts WHERE id = -1\n}\n"
    );

    const ambiguous = getCodes(checkFile(ambiguousFile));
    assert(ambiguous.errors.has("ERR005"), "Expected ERR005 when inferred confidence is below 0.25");
    assert(!ambiguous.warnings.has("WARN006"), "WARN006 should not be emitted when ERR005 is present");

    const lowConfidence = getCodes(checkFile(lowConfidenceFile));
    assert(!lowConfidence.errors.has("ERR005"), "ERR005 should not trigger at confidence >= 0.25");
    assert(lowConfidence.warnings.has("WARN006"), "Expected WARN006 when inferred confidence is between 0.25 and 0.49");

    const highConfidence = getCodes(checkFile(highConfidenceFile));
    assert(!highConfidence.errors.has("ERR005"), "ERR005 should not trigger at high confidence");
    assert(!highConfidence.warnings.has("WARN006"), "WARN006 should not trigger at confidence >= 0.50");

    console.log("use.instead confidence-band diagnostics check passed.");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();