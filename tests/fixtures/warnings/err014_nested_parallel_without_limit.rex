parallel limit 2 {
  parallel {
    observe page "https://example.com/a" as $a
  } then synthesise [$a] as $inner
} then synthesise [$inner] as $outer
