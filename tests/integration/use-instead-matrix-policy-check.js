import runtime from "../../packages/runtime/index.js";
import xrisk from "../../packages/xrisk/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectThrows(name, fn) {
  try {
    await fn();
    throw new Error(`Expected ${name} to be thrown`);
  } catch (err) {
    assert(err?.name === name || err?.code === name, `Expected ${name}, got ${err?.name || err?.code || err}`);
  }
}

function restoreEnv(name, previous) {
  if (previous == null) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

async function checkRuntimeMatrix() {
  const support = runtime.useInsteadSupport();
  const expected = ["sql", "regex", "json", "yaml", "xpath", "graphql", "bash", "python"];
  for (const lang of expected) {
    assert(support.implemented.includes(lang), `Support matrix missing language: ${lang}`);
  }

  const sqlResult = await runtime.useInstead({
    hint: "sql",
    content: "SELECT id FROM rows LIMIT 1",
    context: { rows: [{ id: 7 }, { id: 8 }] }
  });
  assert(sqlResult.language === "sql" && sqlResult.executor === "native", "sql route should execute natively");

  const regexResult = await runtime.useInstead({
    hint: "regex",
    content: "/rex/gi",
    context: { text: "rex one REX two" }
  });
  assert(regexResult.language === "regex" && regexResult.executor === "native", "regex route should execute natively");
  assert(regexResult.output.matchCount === 2, "regex route should produce deterministic matches");

  const jsonResult = await runtime.useInstead({
    hint: "json",
    content: '{"id":42,"ok":true}'
  });
  assert(jsonResult.executor === "native", "json route should execute natively");
  assert(jsonResult.output.value?.id === 42, "json route should parse payload");

  const yamlResult = await runtime.useInstead({
    hint: "yaml",
    content: "name: rex\ncount: 2"
  });
  assert(yamlResult.executor === "native", "yaml route should execute natively");
  assert(yamlResult.output.value?.name === "rex", "yaml route should parse scalar value");

  const xpathResult = await runtime.useInstead({
    hint: "xpath",
    content: "//a/@href",
    context: { html: "<a href='/a'>A</a><a href='/b'>B</a>" }
  });
  assert(xpathResult.executor === "native", "xpath route should execute natively");
  assert(xpathResult.output.matchCount === 2, "xpath route should return both href matches");

  const prevGraphqlAllow = process.env.REX_GRAPHQL_ALLOWED_ENDPOINTS;
  const prevGraphqlEndpoint = process.env.REX_GRAPHQL_ENDPOINT;
  process.env.REX_GRAPHQL_ALLOWED_ENDPOINTS = "https://example.com/graphql";
  process.env.REX_GRAPHQL_ENDPOINT = "https://example.com/graphql";
  try {
    const graphqlResult = await runtime.useInstead({
      hint: "graphql",
      content: "query Viewer { viewer { id } }",
      context: {
        transport: async () => ({
          status: 200,
          data: { data: { viewer: { id: "user-1" } } }
        })
      }
    });
    assert(graphqlResult.executor === "native", "graphql route should execute natively");
    assert(graphqlResult.output.data?.viewer?.id === "user-1", "graphql route should return payload data");
  } finally {
    restoreEnv("REX_GRAPHQL_ALLOWED_ENDPOINTS", prevGraphqlAllow);
    restoreEnv("REX_GRAPHQL_ENDPOINT", prevGraphqlEndpoint);
  }

  const prevBashEnable = process.env.REX_BASH_EXECUTOR_ENABLE;
  const prevBashAllowed = process.env.REX_BASH_ALLOWED_COMMANDS;
  process.env.REX_BASH_EXECUTOR_ENABLE = "1";
  process.env.REX_BASH_ALLOWED_COMMANDS = "echo";
  try {
    const bashResult = await runtime.useInstead({
      hint: "bash",
      content: "echo matrix-ok"
    });
    assert(bashResult.executor === "native", "bash route should execute natively when explicitly enabled");
    assert(bashResult.output.command === "echo", "bash route should execute allowlisted command");
  } finally {
    restoreEnv("REX_BASH_EXECUTOR_ENABLE", prevBashEnable);
    restoreEnv("REX_BASH_ALLOWED_COMMANDS", prevBashAllowed);
  }

  try {
    const pythonResult = await runtime.useInstead({
      hint: "python",
      content: "result = context.get('n', 0) + 1",
      context: { n: 4 }
    });
    assert(pythonResult.executor === "native", "python route should execute natively when runtime exists");
    assert(pythonResult.output.result === 5, "python route should return evaluated result");
  } catch (err) {
    if (err?.name !== "ForeignRuntimeMissing" && err?.code !== "ForeignRuntimeMissing") {
      throw err;
    }
  }
}

async function checkPolicyAllowDeny() {
  xrisk.resetTrace();
  const previous = process.env.REX_ALLOWED_USE_INSTEAD_LANGS;
  process.env.REX_ALLOWED_USE_INSTEAD_LANGS = "sql,regex";

  try {
    await xrisk.before({
      action: "use.instead",
      capability: "FOREIGN_EXEC",
      target: JSON.stringify("sql")
    });
    await xrisk.after({
      action: "use.instead",
      riskLevel: "LOW",
      result: { language: "sql", executor: "native", confidence: 0.99, via: "hint", output: { rowCount: 1 } }
    });

    await expectThrows("ForeignLanguageBlocked", async () => {
      await xrisk.before({
        action: "use.instead",
        capability: "FOREIGN_EXEC",
        target: JSON.stringify("bash")
      });
    });

    await xrisk.before({
      action: "use.instead",
      capability: "FOREIGN_EXEC",
      target: JSON.stringify("auto")
    });
    await expectThrows("ForeignLanguageBlocked", async () => {
      await xrisk.after({
        action: "use.instead",
        riskLevel: "LOW",
        result: { language: "bash", executor: "native", confidence: 0.82, via: "rosetta", output: { command: "echo" } }
      });
    });
  } finally {
    restoreEnv("REX_ALLOWED_USE_INSTEAD_LANGS", previous);
  }
}

async function main() {
  await checkRuntimeMatrix();
  await checkPolicyAllowDeny();
  console.log("use.instead runtime matrix and policy checks passed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});