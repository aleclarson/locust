var Lotus, Path, async, color, exit, ln, log, ref, ref1, semver, sync;

Lotus = require("./index");

ref = require("lotus-log"), log = ref.log, ln = ref.ln, color = ref.color;

ref1 = require("io"), sync = ref1.sync, async = ref1.async;

semver = require("semver");

Path = require("path");

exit = require("exit");

module.exports = function(options) {
  var fromJSON, isCached, isDirty, promise, ref2, toJSON;
  ref2 = require("./persistence"), toJSON = ref2.toJSON, fromJSON = ref2.fromJSON;
  isDirty = false;
  Lotus.Module._emitter.on("file event", function() {
    return isDirty = true;
  });
  exit.on(function() {
    if (isDirty) {
      return toJSON().done();
    }
  });
  isCached = sync.isFile("lotus-cache.json");
  promise = isCached ? fromJSON() : async.resolve();
  return promise.then(function() {
    log.moat(1).white("Crawling: ").yellow(Lotus.path).moat(1);
    return Lotus.Module.crawl(Lotus.path);
  }).then(function(newModules) {
    var i, len, module;
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
    return log.moat(1).cyan("Listening for file changes...").moat(1);
  }).done();
};

//# sourceMappingURL=../../map/src/watch.map
