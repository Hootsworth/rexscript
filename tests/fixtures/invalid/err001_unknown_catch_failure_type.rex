expect {
  observe page "https://example.com" as $page
} otherwise UnknownFailure {
  skip
} otherwise * {
  skip
}
