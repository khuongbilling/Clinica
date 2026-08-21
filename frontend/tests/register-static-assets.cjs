// Node contract tests import Metro modules that use static image requires.
// Metro resolves these to numeric asset handles at bundle time; the Node runner
// only needs a non-null stand-in so it can exercise map-placement contracts.
const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveJourneyAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return path.resolve(__dirname, '..', request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

for (const extension of ['.png', '.jpg', '.jpeg', '.webp']) {
  require.extensions[extension] = module => {
    module.exports = 1;
  };
}