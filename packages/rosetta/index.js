export function scoreLanguage(content, language) {
  const text = String(content || "").toLowerCase();
  const signatures = {
    sql: ["select", "insert", "update", "delete", "from", "where", "join", "limit", "group by", "order by", "having"],
    regex: ["/", "\\d", "\\w", "*", "+", "?"],
    python: ["def ", "import ", "class ", "return ", "print("],
    bash: ["#!/", "echo ", "grep ", "curl ", "|", "$"],
    graphql: ["query", "mutation", "fragment", "__typename"],
    xpath: ["//", "@", "text()", "node()"],
    json: ["{", "}", ":", "\""],
    yaml: [": ", "---", "true", "false", "null"]
  };

  const hints = signatures[language] || [];
  if (hints.length === 0) {
    return 0;
  }

  let score = 0;
  for (const hint of hints) {
    if (text.includes(hint)) {
      score += 1;
    }
  }
  return score / hints.length;
}

export function detectLanguage(content = "") {
  const candidates = ["sql", "regex", "python", "bash", "graphql", "xpath", "json", "yaml"];
  const ranked = candidates
    .map((language) => ({ language, confidence: Number(scoreLanguage(content, language).toFixed(2)) }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0] || { language: "unknown", confidence: 0 };
  if (best.confidence < 0.25) {
    return {
      language: "unknown",
      confidence: best.confidence,
      alternatives: ranked.slice(0, 3),
      best // Include best for consistency
    };
  }

  return {
    language: best.language,
    confidence: best.confidence,
    alternatives: ranked.slice(1, 4),
    best: ranked[0] // Added for compatibility with semantic.js expectation
  };
}

const rosetta = {
  detect: detectLanguage,
  score: scoreLanguage
};

export default rosetta;
