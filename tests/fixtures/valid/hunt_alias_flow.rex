expect {
  hunt page "https://example.com/data" as $prey
  synthesise [$prey] as $summary
} otherwise * {
  skip
}
