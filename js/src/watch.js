var Path, exit, fromJSON, isCached, isDirty, promise, ref, semver, toJSON;

semver = require("semver");

Path = require("path");

exit = require("exit");

ref = require("./persistence"), toJSON = ref.toJSON, fromJSON = ref.fromJSON;

isDirty = false;

Module._emitter.on("file event", function() {
  return isDirty = true;
});

exit.on(function() {
  if (isDirty) {
    return toJSON().done();
  }
});

isCached = sync.isFile("lotus-cache.json");

promise = isCached ? fromJSON() : async.resolve();

promise.then(function() {
  log.moat(1).white("Crawling: ").yellow(lotus.path).moat(1);
  return Module.crawl(lotus.path);
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

//# sourceMappingURL=../../map/src/watch.map
