try {
  observe page "https://example.com" as $page
} catch BlockedByBot {
  rotate proxy
  retry
} catch QueryFailed {
  use default []
} catch * {
  skip
}
