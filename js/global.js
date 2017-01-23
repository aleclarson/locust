var setGlobalErrorHandler;

global.lotus = require("lotus-require");

global.isDev = require("isDev");

require("ReactiveVar");

require("LazyVar");

global.Promise = require("Promise");

global.log = require("log");

setGlobalErrorHandler = function(onError) {
  Promise.onUnhandledRejection(onError);
  return process.on("uncaughtException", onError);
};

setGlobalErrorHandler(function(error) {
  var lines, stack;
  lines = error.message.split(log.ln);
  stack = error.stack.split(log.ln);
  stack = stack.slice(lines.length);
  log.moat(1);
  log.red("Error: ");
  log.white(error.message);
  log.moat(0);
  log.gray.dim(stack.join(log.ln));
  return log.moat(1);
});

//# sourceMappingURL=map/global.map
