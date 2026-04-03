parallel {
  observe page "https://example.com/a" as $a
  observe page "https://example.com/b" as $b
} then synthesise [$a, $b] as $summary
