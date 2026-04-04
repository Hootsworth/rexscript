import rosetta from "../../packages/rosetta/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const sqlSnippet = "SELECT id, title FROM posts WHERE id = 7 LIMIT 1";
  const regexSnippet = "/\\d{3}-\\w+/";
  const neutralSnippet = "hello world plain text";

  const sqlA = rosetta.detect(sqlSnippet);
  const sqlB = rosetta.detect(sqlSnippet);
  assert(JSON.stringify(sqlA) === JSON.stringify(sqlB), "Rosetta SQL detection should be deterministic");
  assert(sqlA.language === "sql", `Expected sql detection, got ${sqlA.language}`);
  assert(Number(sqlA.confidence) >= 0.25, "Expected SQL confidence >= 0.25");

  const regexA = rosetta.detect(regexSnippet);
  assert(regexA.language === "regex", `Expected regex detection, got ${regexA.language}`);
  assert(Number(regexA.confidence) >= 0.25, "Expected regex confidence >= 0.25");

  const neutral = rosetta.detect(neutralSnippet);
  assert(neutral.language === "unknown", `Expected unknown for neutral text, got ${neutral.language}`);

  console.log("Rosetta detection check passed.");
}

main();