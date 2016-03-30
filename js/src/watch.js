var Cache, Path, exit, semver, syncFs;

syncFs = require("io/sync");

semver = require("semver");

Path = require("path");

exit = require("exit");

Cache = require("./Cache");

Cache.load().then(function() {
  log.moat(1);
  log.white("Crawling: ");
  log.yellow(lotus.path);
  log.moat(1);
  return lotus.Module.crawl(lotus.path);
}).then(function(newModules) {
  var color, i, index, isDirty, len, module, newLength, newPart;
  log.moat(1);
  if (newModules.length > 0) {
    isDirty = true;
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
  return Cache.save().then(function() {
    log.moat(1);
    log.cyan("Listening for file changes...");
    return log.moat(1);
  });
});

//# sourceMappingURL=../../map/src/watch.map
