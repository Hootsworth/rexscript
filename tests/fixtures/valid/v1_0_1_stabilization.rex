# RexScript v1.0.1 Stabilization Test Fixture
# Verifies fix for '!=' operator and dot-access lexing.

observe:html "https://example.com" as $page {
    # Test 1: != operator (now correctly lexed as a SYMBOL via '!')
    attempt {
        find:text "missing" as $e
    } catch * {
        expect ($e.token != null)
    }

    # Test 2: use.instead (verify dot handled as part of keyword)
    use.instead:python as $res {
        result = 10 * 2
    }

    # Test 3: verify property access lexing (hypothetical syntax)
    # This should now yield tokens: IDENTIFIER(obj), SYMBOL(.), IDENTIFIER(prop)
    # instead of a single IDENTIFIER(obj.prop)
    remember $res as $obj
    expect ($obj.result == 20)
}
