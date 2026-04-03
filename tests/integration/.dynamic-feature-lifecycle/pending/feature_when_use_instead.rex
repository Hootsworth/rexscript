expect {
  observe page "https://example.com/data" as $page

  when $page is loaded {
    use.instead:sql as $rows {
      SELECT id, title FROM posts LIMIT 5
    } catch QueryFailed {
      use default []
    }

    synthesise [$page, $rows] as $summary
  } otherwise {
    flag $page as unavailable
    skip
  }
} otherwise * {
  emit { action: "fallback" }
  skip
}
