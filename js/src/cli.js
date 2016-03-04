var Config, arg, assert, async, color, command, commands, help, i, isType, len, ln, log, lotus, ref, ref1, ref2;

lotus = require("lotus-require");

async = require("io").async;

ref = require("type-utils"), isType = ref.isType, assert = ref.assert;

ref1 = require("lotus-log"), log = ref1.log, ln = ref1.ln, color = ref1.color;

global.File = require("./File");

global.Module = require("./Module");

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

Config = require("./Config");

global.GlobalConfig = Config(lotus.path);

log.origin("lotus");

log.yellow("plugins:");

log.moat(0);

log.plusIndent(2);

log(Object.keys(GlobalConfig.plugins).join(log.ln));

log.popIndent();

log.moat(1);

GlobalConfig.loadPlugins(function(plugin, options) {
  return plugin(commands, options);
}).then(function() {
  var key;
  command = commands[key = command];
  if (command != null) {
    process.chdir(lotus.path);
    if (isType(command, Function)) {
      return command.call();
    } else if (isType(command, String)) {
      return require(command);
    } else {
      throw Error("'" + (color.red(key)) + "' must be defined as a Function or String");
    }
  } else {
    help();
    throw Error("'" + (color.red(key)) + "' is an invalid command");
  }
}).done();

//# sourceMappingURL=../../map/src/cli.map
