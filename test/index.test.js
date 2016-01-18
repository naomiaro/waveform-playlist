// require all modules ending in ".spec.js" from the
// current directory and all subdirectories
var testsContext = require.context(".", true, /\.spec\.js$/);
testsContext.keys().forEach(testsContext);