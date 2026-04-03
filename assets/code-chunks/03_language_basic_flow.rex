try {
  observe page "https://example.com/data" as $page

  when $page is loaded {
    find "Latest headlines" in $page as $headlines
    synthesise [$page, $headlines] as $summary
  } otherwise {
    flag $page as unavailable
    skip
  }
} catch * {
  emit { action: "fallback" }
  skip
}
