cd rexscript/compiler
npm run -s phase1:smoke && \
  npm run -s codegen:snapshots && \
  npm run -s integration:run && \
  npm run -s integration:trace-schema && \
  npm run -s integration:runtime-trace-schema && \
  npm run -s integration:runtime-behavior && \
  npm run -s integration:compiler-policy && \
  npm run -s integration:runtime-trace-metadata && \
  npm run -s integration:diagnostic-format && \
  npm run -s integration:dynamic-feature-lifecycle
