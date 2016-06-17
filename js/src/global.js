var KeyBindings, inject, keys, onError;

global.lotus = require("lotus-require");

lotus.register({
  exclude: ["/node_modules/"]
});

require("isDev");

inject = require("Property/inject");

inject("ReactiveVar", require("ReactiveVar"));

inject("LazyVar", require("LazyVar"));

inject = require("Builder/inject");

inject("EventMap", require("Event").Map);

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

onError = function(error, promise) {
  try {
    if (log.isDebug) {
      throw error;
    }
    log.moat(1);
    log.red("Error: ");
    log.white(error.message);
    log.moat(0);
    log.gray.dim(error.stack.split(log.ln).slice(1).join(log.ln));
    return log.moat(1);
  } catch (error1) {
    error = error1;
    return console.log(error.stack);
  }
};

require("Promise")._onUnhandledRejection = onError;

process.on("uncaughtException", onError);

//# sourceMappingURL=../../map/src/global.map
