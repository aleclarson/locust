var File, Module, async, log, lotus;

async = require("io").async;

lotus = require("lotus-require");

log = require("lotus-log");

Module = (require("./module")).initialize();

File = (require("./file")).initialize();

module.exports = {
  toJSON: function() {
    var files, modules, startTime;
    startTime = Date.now();
    modules = [];
    files = [];
    return async.each(Module.cache, function(module) {
      return async["try"](function() {
        return module.toJSON();
      }).then(function(json) {
        if (json === false) {
          return;
        }
        modules.push(json);
        return async.each(module.files, function(file, path) {
          return async["try"](function() {
            return file.toJSON();
          }).then(function(json) {
            return files.push(json);
          });
        });
      });
    }).then(function() {
      return async.write("lotus-cache.json", JSON.stringify({
        modules: modules,
        files: files
      }));
    }).then(function() {
      log.origin("lotus/persistence");
      log.green("exported ");
      log.yellow(lotus.path + "/lotus-cache.json");
      log.gray(" (in " + (Date.now() - startTime) + " ms)");
      return log.moat(1);
    });
  },
  fromJSON: function() {
    var startTime;
    startTime = Date.now();
    return async.read("lotus-cache.json").then(function(json) {
      json = JSON.parse(json);
      return async.each(json.modules, function(module) {
        return async["try"](function() {
          return Module.fromJSON(module);
        }).then(function(module) {
          return async.each(module.files, function(file) {
            return File.fromJSON(file, json.files);
          });
        }).fail(async["catch"]);
      });
    }).then(function() {
      log.origin("lotus/persistence");
      log.green("imported ");
      log.yellow(lotus.path + "/lotus-cache.json");
      log.gray(" (in " + (Date.now() - startTime) + " ms)");
      return log.moat(1);
    });
  }
};

//# sourceMappingURL=../../map/src/persistence.map
