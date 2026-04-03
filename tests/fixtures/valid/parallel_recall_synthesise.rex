remember $seed tagged "bootstrap"

parallel limit 3 {
  observe page "https://example.com/a" as $a
  observe page "https://example.com/b" as $b
  observe page "https://example.com/c" as $c
} then synthesise [$a, $b, $c] as $summary

recall tagged "bootstrap" as $memory
synthesise [$summary, $memory] as $report
