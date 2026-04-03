expect {
  observe page "https://example.com" as $page
} otherwise BlockedByBot {
  rotate proxy
  retry
} otherwise QueryFailed {
  use default []
} otherwise * {
  skip
}
