async function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "RexScriptRuntime/0.1 (+agentic execution)"
      }
    });
    const html = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      finalUrl: response.url || url,
      headers: Object.fromEntries(response.headers.entries()),
      html
    };
  } finally {
    clearTimeout(timeout);
  }
}

function semanticFind(selector, source) {
  const tokens = keywordTokens(selector);
  const content = String(source?.content || source || "").toLowerCase();

  if (!content) {
    return {
      selector,
      source,
      confidence: 0.1,
      element: null,
      matches: [],
      reason: "Empty source content"
    };
  }

  const matches = [];
  for (const token of tokens) {
    const idx = content.indexOf(token);
    if (idx >= 0) {
      matches.push({ token, index: idx, snippet: makeSnippet(String(source?.content || source || ""), idx) });
    }
  }

  const coverage = tokens.length > 0 ? matches.length / tokens.length : 0;
  const confidence = Math.min(0.99, Number((0.25 + coverage * 0.7).toFixed(2)));
  return { selector, source, confidence, element: matches[0] || null, matches };
}
