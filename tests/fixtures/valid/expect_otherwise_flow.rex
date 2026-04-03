expect {
  observe page "https://example.com" as $page
  find "headline" in $page as $headline
  synthesise [$page, $headline] as $summary
} otherwise Timeout {
  flag $page as timed_out
  skip
} otherwise * {
  emit { action: "fallback" }
  skip
}