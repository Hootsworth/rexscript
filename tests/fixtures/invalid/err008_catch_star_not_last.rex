try {
  observe page "https://example.com" as $page
} catch * {
  skip
} catch Timeout {
  retry
}
