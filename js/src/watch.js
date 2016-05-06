var Cache, Path, cache, ignoredErrors, inArray, semver, syncFs;

inArray = require("in-array");

syncFs = require("io/sync");

semver = require("semver");

Path = require("path");

Cache = require("./Cache");

ignoredErrors = ["Cache does not exist!", "Cache was manually reset!"];

cache = Cache(lotus.path + "/lotus-cache.json");

cache.load(process.options).fail(function(error) {
  if (inArray(ignoredErrors, error.message)) {
    return;
  }
  throw error;
}).then(function() {
  log.moat(1);
  log.white("Crawling: ");
  log.yellow(lotus.path);
  log.moat(1);
  return lotus.Module.crawl(lotus.path);
}).then(function(newModules) {
  var color, i, index, len, module, newLength, newPart;
  log.moat(1);
  if (newModules.length > 0) {
    cache.isDirty = true;
    log.white("Found " + (log.color.green(newModules.length)) + " new modules: ");
    log.moat(1);
    log.plusIndent(2);
    for (index = i = 0, len = newModules.length; i < len; index = ++i) {
      module = newModules[index];
      color = index % 2 ? "cyan" : "green";
      newPart = module.name + " ";
      newLength = log.line.length + newPart.length;
      if (newLength > log.size[0] - log.indent) {
        log.moat(0);
      }
      log[color](newPart);
    }
    log.popIndent();
  } else {
    log.white("Found " + (log.color.green.dim(0)) + " new modules!");
  }
  return cache.save().then(function() {
    log.moat(1);
    log.gray("Watching files...");
    return log.moat(1);
  });
}).done();

//# sourceMappingURL=../../map/src/watch.map
