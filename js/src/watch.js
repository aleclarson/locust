var Path, async, color, exit, gaze, ln, log, lotus, ref, ref1, semver, sync;

lotus = require("lotus-require");

ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

ref1 = require("io"), sync = ref1.sync, async = ref1.async;

semver = require("semver");

Path = require("path");

gaze = require("gaze");

exit = require("exit");

module.exports = function(options) {
  var fromJSON, isCached, promise, ref2, startTime, toJSON;
  ref2 = require("./persistence"), toJSON = ref2.toJSON, fromJSON = ref2.fromJSON;
  isCached = sync.isFile("lotus-cache.json");
  startTime = Date.now();
  promise = isCached ? fromJSON() : async.resolve();
  return promise.then(function() {
    log.moat(1).white("Crawling: ").yellow(lotus.path).moat(1);
    return Module.crawl(lotus.path);
  }).then(function(newModules) {
    var i, isDirty, len, module;
    if (newModules.length > 0) {
      log.moat(1).white("Found " + newModules.length + " modules: ").moat(1);
      log.plusIndent(2);
      for (i = 0, len = newModules.length; i < len; i++) {
        module = newModules[i];
        log.green(module.name);
        log.moat(1);
      }
      log.popIndent();
      toJSON().done();
    }
    log.moat(1).cyan("Listening for file changes...").moat(1);
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
