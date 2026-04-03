try {
  use.instead:sql as $rows {
    SELECT id, title FROM posts LIMIT 5
  } catch QueryFailed {
    use default []
  }

  synthesise [$rows] as $report
} catch * {
  emit { action: "fallback" }
  skip
}
