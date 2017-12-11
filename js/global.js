// Generated by CoffeeScript 1.12.7
var onError;

global.lotus = require("lotus-require");

global.isDev = require("isDev");

require("ReactiveVar");

require("LazyVar");

global.log = require("log");

global.Promise = require("Promise");

onError = function(error) {
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
};

Promise.onUnhandledRejection(onError);

process.on("uncaughtException", onError);
