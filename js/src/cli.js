var setupBindings, setupGlobal;

module.exports = function() {
  var command, log, minimist, options;
  setupGlobal();
  minimist = require("minimist");
  options = minimist(process.argv.slice(2));
  command = options._.shift();
  log = require("log");
  log.indent = 2;
  log.moat(1);
  setupBindings(log);
  return lotus.initialize(options).then(function() {
    return lotus.runCommand(command, options);
  }).then(function() {
    log.moat(1);
    log.green("Finished without errors!");
    log.moat(1);
    return process.exit();
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

setupBindings = function(log) {
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
