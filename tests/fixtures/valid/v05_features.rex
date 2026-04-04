security {
    sandbox "docker"
    lockdown strict
}

fact $key = vault("MY_API_KEY");

use.instead:python as $data {
    import os
    print("running isolated")
}

observe page "https://example.com" as $content;

attempt {
    synthesise [$content] as $understanding;
} recover Timeout { }
