#!/bin/bash -e
set -e
find ./bin -name '*.d.ts' -or -name '*.js' | xargs rm
find ./generator -name '*.d.ts' -or -name '*.js' | xargs rm
find ./pileuple-api -name '*.d.ts' -or -name '*.js' | xargs rm
find ./renderer -name '*.d.ts' -or -name '*.js' | xargs rm
find ./__tests__ -name '*.d.ts' -or -name '*.js' | xargs rm
rm index.js
rm index.d.ts