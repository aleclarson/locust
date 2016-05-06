var Cache, Path, inArray, semver, syncFs;

inArray = require("in-array");

syncFs = require("io/sync");

semver = require("semver");

Path = require("path");

Cache = require("./Cache");

log.moat(1);

log.white("Crawling: ");

log.yellow(lotus.path);

log.moat(1);

lotus.Module.crawl(lotus.path).then(function(newModules) {
  var color, i, index, len, module, newLength, newPart;
  log.moat(1);
  if (newModules.length > 0) {
    log.white("Found " + (log.color.green(newModules.length)) + " modules: ");
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
    log.white("Found " + (log.color.green.dim(0)) + " modules!");
  }
  log.moat(1);
  log.gray("Watching files...");
  return log.moat(1);
}).done();

//# sourceMappingURL=../../map/src/watch.map
