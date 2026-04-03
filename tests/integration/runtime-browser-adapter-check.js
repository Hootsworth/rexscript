import runtime from "../../packages/runtime/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function setEnv(name, value) {
  const previous = process.env[name];
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  return previous;
}

function restoreEnv(name, previous) {
  if (previous == null) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

async function main() {
  const prevAdapter = process.env.REX_RUNTIME_BROWSER_ADAPTER;
  const prevStrict = process.env.REX_RUNTIME_BROWSER_ADAPTER_STRICT;
  const prevDisable = process.env.REX_RUNTIME_PLAYWRIGHT_DISABLE;

  try {
    setEnv("REX_RUNTIME_BROWSER_ADAPTER", "fetch");
    setEnv("REX_RUNTIME_BROWSER_ADAPTER_STRICT", null);

    const fetchSession = await runtime.session({ id: "adapter-fetch-session" });
    const fetchPage = await runtime.observe(
      "data:text/html,<html><head><title>Adapter Fetch</title></head><body>fetch mode</body></html>",
      { session: fetchSession }
    );

    assert(fetchPage.metadata?.adapter === "fetch", "Expected fetch adapter in fetch mode");

    setEnv("REX_RUNTIME_BROWSER_ADAPTER", "playwright");
    const playwrightSession = await runtime.session({ id: "adapter-playwright-session" });
    const playwrightPage = await runtime.observe(
      "data:text/html,<html><head><title>Adapter Playwright</title></head><body>playwright mode</body></html>",
      { session: playwrightSession }
    );

    const adapter = String(playwrightPage.metadata?.adapter || "");
    const acceptable = ["playwright", "fetch-fallback-playwright-unavailable", "fetch"];
    assert(acceptable.includes(adapter), `Unexpected adapter selection: ${adapter}`);

    const navResult = await runtime.navigate("https://example.com", { session: playwrightSession, timeout: 2000 });
    assert(typeof navResult.adapter === "string", "navigate result should include adapter metadata");

    setEnv("REX_RUNTIME_BROWSER_ADAPTER_STRICT", "1");
    setEnv("REX_RUNTIME_PLAYWRIGHT_DISABLE", "1");

    const strictSession = await runtime.session({ id: "adapter-strict-session" });
    let strictObserveBlocked = false;
    try {
      await runtime.observe(
        "data:text/html,<html><head><title>Strict Adapter</title></head><body>strict mode</body></html>",
        { session: strictSession }
      );
    } catch (err) {
      strictObserveBlocked = err?.name === "BrowserAdapterUnavailable" || err?.code === "BrowserAdapterUnavailable";
    }
    assert(strictObserveBlocked, "Expected strict playwright observe to fail when adapter is unavailable");

    let strictNavigateBlocked = false;
    try {
      await runtime.navigate("https://example.com", { session: strictSession, timeout: 2000 });
    } catch (err) {
      strictNavigateBlocked = err?.name === "BrowserAdapterUnavailable" || err?.code === "BrowserAdapterUnavailable";
    }
    assert(strictNavigateBlocked, "Expected strict playwright navigate to fail when adapter is unavailable");

    await strictSession.close();

    await playwrightSession.close();
    await fetchSession.close();

    console.log("Runtime browser adapter check passed.");
  } finally {
    restoreEnv("REX_RUNTIME_BROWSER_ADAPTER", prevAdapter);
    restoreEnv("REX_RUNTIME_BROWSER_ADAPTER_STRICT", prevStrict);
    restoreEnv("REX_RUNTIME_PLAYWRIGHT_DISABLE", prevDisable);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
