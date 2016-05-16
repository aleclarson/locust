var setupBindings, setupGlobal;

module.exports = function() {
  var command, log, minimist, options;
  setupGlobal();
  setupBindings();
  minimist = require("minimist");
  process.options = options = minimist(process.argv.slice(2));
  command = options._.shift();
  log = require("log");
  log.indent = 2;
  log.moat(1);
  return lotus.initialize().then(function() {
    return lotus.runCommand(command, options);
  }).done();
};

setupGlobal = function() {
  global.lotus = require("./index");
  require("isDev");
  require("lazy-var");
  require("reactive-var");
  global.prompt = require("prompt");
  return global.repl = require("repl");
};

setupBindings = function() {
  var KeyBindings, keys;
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
  return keys.stream = process.stdin;
};

//# sourceMappingURL=../../map/src/cli.map
