(function() {
  var Config, Q, arg, color, command, commands, config, help, i, io, isType, len, ln, log, lotus, ref, ref1;

  lotus = require("../../../lotus-require");

  process.chdir(lotus.path);

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  log.cursor.isHidden = true;

  log.clear();

  log.moat(1);

  log.indent = 2;

  require("lotus-repl");

  log.repl.transform = "coffee";

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

  Config = require("./config");

  config = Config(lotus.path);

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
