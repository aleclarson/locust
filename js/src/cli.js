var Config, arg, assert, async, color, command, commands, config, help, i, isType, len, ln, log, lotus, ref, ref1, ref2;

lotus = require("lotus-require");

async = require("io").async;

ref = require("type-utils"), isType = ref.isType, assert = ref.assert;

ref1 = require("lotus-log"), log = ref1.log, ln = ref1.ln, color = ref1.color;

require("./file");

require("./module");

log.clear();

log.indent = 2;

log.moat(1);

commands = {
  watch: require("./watch")
};

command = "watch";

ref2 = process.argv.slice(2);
for (i = 0, len = ref2.length; i < len; i++) {
  arg = ref2[i];
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
      throw Error("'" + (color.red(command)) + "' must be defined as a Function or String");
    }
  } else {
    help();
    throw Error("'" + (color.red(command)) + "' is an invalid command");
  }
}).done();

//# sourceMappingURL=../../map/src/cli.map
