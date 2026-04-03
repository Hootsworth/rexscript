function scoreLanguage(content, language) {
  const text = String(content || "").toLowerCase();
  const signatures = {
    sql: ["select", "from", "where", "join", "limit", "group by"],
    regex: ["/", "\\d", "\\w", "*", "+", "?"],
    python: ["def ", "import ", "class ", "return ", "print("],
    bash: ["#!/", "echo ", "grep ", "curl ", "|"],
    graphql: ["query", "mutation", "fragment", "__typename"],
    xpath: ["//", "@", "text()", "node()"],
    json: ["{", "}", ":", "\""],
    yaml: [": ", "---"]
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

const rosetta = {
  detect(content = "") {
    const candidates = ["sql", "regex", "python", "bash", "graphql", "xpath", "json", "yaml"];
    const ranked = candidates
      .map((language) => ({ language, confidence: Number(scoreLanguage(content, language).toFixed(2)) }))
      .sort((a, b) => b.confidence - a.confidence);

    const best = ranked[0] || { language: "unknown", confidence: 0 };
    if (best.confidence < 0.4) {
      return {
        language: "unknown",
        confidence: best.confidence,
        alternatives: ranked.slice(0, 3)
      };
    }

    return {
      language: best.language,
      confidence: best.confidence,
      alternatives: ranked.slice(1, 4)
    };
  }
};

export default rosetta;
