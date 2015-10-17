var Config, KeyBindings, arg, async, color, command, commands, config, help, i, isType, keys, len, ln, log, lotus, ref, ref1;

lotus = require("lotus-require");

async = require("io").async;

isType = require("type-utils").isType;

KeyBindings = require("key-bindings");

ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

require("lotus-repl");

keys = KeyBindings({
  "c+ctrl": function() {
    log.moat(1);
    log.red("CTRL+C");
    log.moat(1);
    return process.exit(0);
  }
});

keys.stream = process.stdin;

log.clear();

log.indent = 2;

log.cursor.isHidden = true;

log.repl.transform = "coffee";

log.moat(1);

if (log.isDebug) {
  log("Port: ");
  log.green(process.pid);
  log.moat(1);
}

commands = {
  watch: require("./watch")
};

command = "watch";

ref1 = process.argv.slice(2);
for (i = 0, len = ref1.length; i < len; i++) {
  arg = ref1[i];
  if (arg[0] !== "-") {
    command = arg;
    break;
  }
}

help = function() {
  log.moat(1);
  log.indent = 2;
  log.green.bold("Commands");
  log.indent = 4;
  log(ln, Object.keys(commands).join(ln));
  return log.moat(1);
};

if (command === "--help") {
  return help();
}

Config = require("./config");

config = Config(lotus.path);

log.origin("lotus");

log.yellow("plugins:");

log.moat(0);

log.plusIndent(2);

log(Object.keys(config.plugins).join(log.ln));

log.popIndent();

log.moat(1);

config.loadPlugins(function(plugin, options) {
  return plugin(commands, options);
}).then(function() {
  command = commands[command];
  if (command != null) {
    process.chdir(lotus.path);
    if (isType(command, Function)) {
      return command.call();
    } else if (isType(command, String)) {
      return require(command);
    } else {
      return async["throw"]({
        error: Error("'" + (color.red(command)) + "' must be defined as a Function or String"),
        format: {
          simple: true
        }
      });
    }
  } else {
    help();
    return async["throw"]({
      error: Error("'" + (color.red(command)) + "' is an invalid command"),
      format: {
        simple: true
      }
    });
  }
}).done();

//# sourceMappingURL=../../map/src/cli.map
