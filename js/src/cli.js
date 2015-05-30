(function() {
  var Config, color, command, commands, config, help, ln, log, ref, ref1;

  require("../../../lotus-require");

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  require("lotus-repl");

  log.repl.transform = "coffee";

  log.cursor.isHidden = true;

  log.clear();

  log.moat(1);

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

  log.format(config, {
    label: "config = "
  });

  config.loadPlugins(function(plugin, i, done) {
    var _done, error;
    log.format(Array.prototype.slice.call(arguments), {
      label: "arguments = "
    });
    _done = function(error) {
      var format;
      if (error == null) {
        return done();
      }
      if (!(error instanceof Error)) {
        throw TypeError("'error' must be an Error or undefined.");
      }
      format = function() {
        return {
          stack: {
            exclude: ["**/q/q.js", "**/nimble/nimble.js"],
            filter: function(frame) {
              return !(frame.isNode() || frame.isNative() || frame.isEval());
            }
          }
        };
      };
      return log["throw"]({
        error: error,
        format: format
      });
    };
    try {
      return plugin({
        commands: commands,
        config: config
      }, _done);
    } catch (_error) {
      error = _error;
      return _done(error);
    }
  }).then(function() {
    var error;
    if (commands.hasOwnProperty(command)) {
      return require(commands[command]);
    }
    help();
    if (command === "--help") {
      return process.exit(0);
    }
    error = Error("'" + (color.red(command)) + "' is an invalid command");
    return log.error(error, {
      stack: false,
      repl: false
    });
  }).done();

}).call(this);

//# sourceMappingURL=map/cli.js.map
