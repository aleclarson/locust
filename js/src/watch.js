(function() {
  var Package, Path, color, gaze, ln, log, ref, semver;

  require("lotus-repl");

  ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

  Path = require("path");

  gaze = require("gaze");

  semver = require("semver");

  Package = require("./package");

  Package.startup().then(function() {
    log.moat(1);
    log.green.bold(Object.keys(Package.cache).length);
    log(" packages were found!");
    return log.moat(1);
  }).fail(function(error) {
    var format;
    log.moat(1);
    log("Package startup failed!");
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
        return !frame.isNode() && !frame.isNative() && !frame.isEval();
      };
      return opts;
    };
    throw error;
  }).done();

}).call(this);

//# sourceMappingURL=map/watch.js.map
