(function() {
  var Config, Q, color, command, commands, config, help, io, isType, ln, log, lotus, ref, ref1;

  lotus = require("../../../lotus-require");

  process.chdir(lotus.path);

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  log.cursor.isHidden = true;

  log.clear();

  log.moat(1);

  log.indent = 2;

  require("lotus-repl");

  log.repl.transform = "coffee";

  command = (ref1 = process.argv[2]) != null ? ref1 : "watch";

  commands = {
    watch: __dirname + "/watch",
    upgrade: __dirname + "/upgrade"
  };

  help = function() {
    log.moat(1);
    log.indent = 2;
    log.green.bold("Commands");
    log.indent = 4;
    log(ln, Object.keys(commands).join(ln));
    return log.moat(1);
  };

  Config = require("./config");

  config = Config(process.env.LOTUS_PATH);

  io = require("io");

  isType = require("type-utils").isType;

  Q = require("q");

  Q.debug = true;

  config.loadPlugins(function(plugin, options) {
    return plugin(commands, options);
  }).then(function() {
    command = commands[command];
    if (command != null) {
      if (isType(command, Function)) {
        command();
      } else if (isType(command, String)) {
        require(command);
      }
      return;
    }
    help();
    if (command === "--help") {
      process.exit(0);
    }
    return io["throw"]({
      error: Error("'" + (color.red(command)) + "' is an invalid command"),
      format: {
        simple: true
      }
    });
  }).done();

}).call(this);

//# sourceMappingURL=map/cli.js.map
