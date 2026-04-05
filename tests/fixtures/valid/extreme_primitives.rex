# RexScript Extreme Primitives Test

session s with {
  cookies: true
}

observe page "https://example.com" with session s as $page

# Semantic Interactions
click "login button" on $page
type "user@example.com" into "username field" on $page
scroll to "footer" on $page

# Schema Extraction
extract {
  price: number,
  inStock: boolean
} from $page as $data

# Temporal Watch
watch "https://example.com/status" for "available" until 5m as $statusPage

# Verification
verify $data.price is "a reasonable value"

# Resource Budgeting
budget max_cost=$0.10, max_tokens=1000, max_time=10s {
  synthesise [$page] as $summary
}
