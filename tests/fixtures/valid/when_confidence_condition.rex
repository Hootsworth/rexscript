observe page "https://example.com" as $page

when $page confidence > 0 {
  flag $page as trusted
} otherwise {
  flag $page as low_quality
}
