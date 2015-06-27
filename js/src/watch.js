(function() {
  var Module, Path, _printOrigin, color, gaze, ln, log, lotus, ref, semver;

  lotus = require("../../../lotus-require");

  require("lotus-repl");

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  log._repl = function(scope) {
    return log.repl.sync(scope);
  };

  semver = require("semver");

  Path = require("path");

  gaze = require("gaze");

  Module = require("./module");

  module.exports = function() {
    Module = Module.initialize();
    log.moat(1);
    _printOrigin();
    log("Gathering modules from ");
    log.yellow(lotus.path);
    log.moat(1);
    return Module.initialize().then(function() {
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
  };

  _printOrigin = function() {
    return log.gray.dim("lotus/watch ");
  };

}).call(this);

//# sourceMappingURL=map/watch.js.map
