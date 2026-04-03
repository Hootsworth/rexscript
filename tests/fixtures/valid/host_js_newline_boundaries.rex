const base = "https://example.com"
const route = "/news"
const url = base + route

expect {
  observe page url as $page
  find "headline" in $page as $headline
} otherwise * {
  skip
}
