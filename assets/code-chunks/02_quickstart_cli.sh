cd rexscript/compiler
npm install

npm run phase1:smoke
npm run rex:check -- ../tests/fixtures/valid/when_use_instead.rex
npm run rex:compile -- ../tests/fixtures/valid/when_use_instead.rex ./.rex-run/quickstart.js default --map
npm run rex:run -- ../tests/fixtures/valid/when_use_instead.rex default --trace-out ../tests/integration/quickstart.runtime.trace.json
npm run rex:trace -- ../tests/fixtures/valid/when_use_instead.rex ../tests/integration/quickstart.plan.trace.json default
