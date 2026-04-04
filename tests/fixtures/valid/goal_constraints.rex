goal "Scrape with constraints" constraint { budget 0.05 timeout 30s } {
  attempt {
    observe page "https://example.com" as $page
  } recover Timeout {
    skip
  } otherwise * {
    retry
  }
}

goal "Scrape with operators" constraint { budget < 1.0 timeout <= 60s } {
  observe page "https://example.com" as $page
}

recall tagged "test" where relevance 0.8 as $mem
recall tagged "test" where relevance > 0.9 as $mem2
