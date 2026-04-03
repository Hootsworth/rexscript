session s with {
  cookies: true
}

s.close()
observe page "https://example.com" with session s as $page
