(function() {
  var Module, Path, _printOrigin, color, gaze, ln, log, lotus, ref, semver;

  lotus = require("../../../lotus-require");

  Path = require("path");

  gaze = require("gaze");

  semver = require("semver");

  Module = require("./module");

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  require("lotus-repl");

  _printOrigin = function() {
    return log.gray.dim("lotus/watch ");
  };

  log.moat(1);

  _printOrigin();

  log("Gathering modules from ");

  log.yellow(lotus.path);

  log.moat(1);

  Module.startup().then(function() {
    log.moat(1);
    _printOrigin();
    log.yellow(Object.keys(Module.cache).length);
    log(" modules were found!");
    return log.moat(1);
  }).fail(function(error) {
    var format;
    log.moat(1);
    log("Module startup failed!");
    log.moat(1);
    format = error.format;
    error.format = function() {
      var base, opts;
      opts = format instanceof Function ? format() : {};
      if (opts.stack == null) {
        opts.stack = {};
      }
      if ((base = opts.stack).exclude == null) {
        base.exclude = [];
      }
      opts.stack.exclude.push("**/q/q.js");
      opts.stack.filter = function(frame) {
        return frame.isUserCreated();
      };
      return opts;
    };
    throw error;
  }).done();

}).call(this);

//# sourceMappingURL=map/watch.js.map
