var Module, Path, color, exit, gaze, ln, log, lotus, ref, semver, sync;

lotus = require("lotus-require");

require("lotus-repl");

ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

sync = require("io").sync;

semver = require("semver");

Path = require("path");

gaze = require("gaze");

exit = require("exit");

Module = require("./module");

module.exports = function(options) {
  var fromJSON, isCached, promise, ref1, startTime, toJSON;
  Module = Module.initialize(options);
  ref1 = require("./persistence"), toJSON = ref1.toJSON, fromJSON = ref1.fromJSON;
  isCached = sync.isFile("lotus-cache.json");
  startTime = Date.now();
  if (isCached) {
    promise = fromJSON();
  } else {
    log.origin("lotus/watch");
    log.green("crawling ");
    log.yellow(lotus.path);
    log.moat(1);
    promise = Module.initialize();
  }
  return promise.then(function() {
    var isDirty;
    log.origin("lotus/watch");
    log.yellow(Object.keys(Module.cache).length);
    log(" modules were found");
    log.gray(" (in " + (Date.now() - startTime) + " ms)");
    log.moat(1);
    if (!isCached) {
      toJSON().done();
    }
    isDirty = false;
    Module._emitter.on("file event", function() {
      return isDirty = true;
    });
    return exit.on(function() {
      if (isDirty) {
        return toJSON().done();
      }
    });
  }).done();
};

//# sourceMappingURL=../../map/src/watch.map
