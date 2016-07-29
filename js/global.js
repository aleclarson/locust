var KeyBindings, keys, setGlobalErrorHandler;

global.lotus = require("lotus-require");

lotus.register({
  exclude: ["/node_modules/"]
});

require("isDev");

require("ReactiveVar");

require("LazyVar");

require("Event");

global.Promise = require("Promise");

global.prompt = require("prompt");

global.repl = require("repl");

global.log = require("log");

if (process.stdin.setRawMode) {
  KeyBindings = require("key-bindings");
  keys = KeyBindings({
    "c+ctrl": function() {
      log.moat(1);
      log.red("CTRL+C");
      log.moat(1);
      return process.exit();
    },
    "x+ctrl": function() {
      log.moat(1);
      log.red("CTRL+X");
      log.moat(1);
      return process.exit();
    }
  });
  keys.stream = process.stdin;
}

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
