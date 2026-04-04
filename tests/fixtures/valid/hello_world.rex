expect {
  console.log("Hello, world from RexScript!");
  emit { action: "hello_world", message: "Hello, world from RexScript!" }
} otherwise * {
  emit { action: "hello_world_fallback" }
  skip
}