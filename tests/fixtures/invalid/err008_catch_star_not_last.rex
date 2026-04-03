expect {
  observe page "https://example.com" as $page
} otherwise * {
  skip
} otherwise Timeout {
  retry
}
