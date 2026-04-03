session research with {
  cookies: true,
  fingerprint: random,
  timeout: 30000
}

try {
  observe page "https://example.com" with session research as $page
  find "main article content" in $page as $article
  emit { action: "article_extracted", confidence: $article.confidence }
} catch Timeout {
  flag $page as timed_out
  skip
} catch * {
  emit { action: "unhandled_failure" }
  skip
}
