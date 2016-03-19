var Config, argv, command, commands;

require("./global");

log.clear();

log.indent = 2;

log.moat(1);

commands = {
  watch: __dirname + "/watch"
};

argv = process.argv.slice(2);

command = argv[0] != null ? argv[0] : argv[0] = "watch";

Config = require("./Config");

global.GlobalConfig = Config(lotus.path);

log.moat(1);

log.green.bold("Global plugins:");

log.moat(0);

log.plusIndent(2);

log.white(Object.keys(GlobalConfig.plugins).join(log.ln));

log.popIndent();

log.moat(1);

process.cli = true;

GlobalConfig.loadPlugins(function(plugin, options) {
  process.options = options;
  plugin(commands);
  return process.options = void 0;
}).then(function() {
  var help, modulePath;
  process.cli = false;
  help = function() {
    log.moat(1);
    log.green.bold("Available commands:");
    log.plusIndent(2);
    log.moat(0);
    log.white(Object.keys(commands).join(log.ln));
    log.popIndent();
    return log.moat(1);
  };
  if (command === "--help") {
    help();
    process.exit();
  }
  modulePath = commands[command];
  assertType(modulePath, [String, Void]);
  if (modulePath == null) {
    help();
    log.moat(1);
    log.red("Invalid command: ");
    log.white(command);
    log.moat(1);
    process.exit();
  }
  return require(modulePath);
}).done();

//# sourceMappingURL=../../map/src/cli.map
