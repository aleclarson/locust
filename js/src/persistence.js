var Lotus, SortedArray, assert, async, inArray, log, ref, sync;

Lotus = require("./index");

ref = require("io"), sync = ref.sync, async = ref.async;

assert = require("type-utils").assert;

SortedArray = require("sorted-array");

inArray = require("in-array");

log = require("lotus-log");

module.exports = {
  toJSON: function() {
    var files, moduleNames, modules, startTime;
    startTime = Date.now();
    modules = [];
    files = [];
    moduleNames = Object.keys(Lotus.Module.cache);
    return async.all(sync.map(moduleNames, function(name) {
      var module;
      module = Lotus.Module.cache[name];
      return async["try"](function() {
        return module.toJSON();
      }).then(function(json) {
        var filePaths;
        if (json === false) {
          return;
        }
        modules.push(json);
        filePaths = Object.keys(module.files);
        return async.all(sync.map(filePaths, function(path) {
          return async["try"](function() {
            return module.files[path].toJSON();
          }).then(function(json) {
            return files.push(json);
          });
        }));
      });
    })).then(function() {
      log.moat(1).white("Saving ").yellow(modules.length).white(" modules...").moat(1);
      log.moat(1).white("Saving ").yellow(files.length).white(" files...").moat(1);
      return async.write("lotus-cache.json", JSON.stringify({
        modules: modules,
        files: files
      }));
    }).then(function() {
      return log.moat(1).white("Saved ").yellow("lotus-cache.json").white(" file in ").green(Date.now() - startTime).white(" ms!").moat(1);
    });
  },
  fromJSON: function() {
    var startTime;
    log.moat(1).cyan("Reading the 'lotus-cache.json' file...").moat(1);
    startTime = Date.now();
    return async.read("lotus-cache.json").then(function(json) {
      var fileMap, ignoredErrors, loadedModules;
      json = JSON.parse(json);
      fileMap = Object.create(null);
      sync.each(json.files, function(file) {
        return fileMap[file.path] = file;
      });
      ignoredErrors = ["Module with that name already exists!", "Module path must be a directory!"];
      loadedModules = SortedArray([], function(a, b) {
        a = a.module.name.toLowerCase();
        b = b.module.name.toLowerCase();
        if (a > b) {
          return 1;
        } else {
          return -1;
        }
      });
      return async.all(sync.map(json.modules, function(module) {
        return async["try"](function() {
          return Lotus.Module.fromJSON(module);
        }).then(function(result) {
          return loadedModules.insert(result);
        }).fail(function(error) {
          if (inArray(ignoredErrors, error.message)) {
            return;
          }
          log.moat(1).white("Module failed to load: ").red(module.name).moat(1).gray(error.stack).moat(1);
          try {
            require("lotus-repl");
            return log.repl.sync();
          } catch (_error) {
            error = _error;
            return log.it("REPL failed: " + error.message);
          }
        });
      })).then(function() {
        return async.each(loadedModules.array, function(arg) {
          var dependers, module;
          module = arg.module, dependers = arg.dependers;
          return module.dependers = sync.reduce(dependers, {}, function(dependers, name) {
            var dependerModule, error;
            dependerModule = Lotus.Module.cache[name];
            if (dependerModule != null) {
              dependers[name] = dependerModule;
            } else {
              error = "Failed to find depender: '" + name + "'!";
              Lotus.Module._reportError({
                error: error
              });
            }
            return dependers;
          });
        });
      }).then(function() {
        ignoredErrors = ["This file belongs to an unknown module!"];
        return async.all(sync.map(loadedModules.array, function(arg) {
          var module;
          module = arg.module;
          return async.each(module.files, function(file) {
            return async["try"](function() {
              json = fileMap[file.path];
              assert(json != null, {
                file: file,
                reason: "File not found in 'lotus-cache.json'!"
              });
              return Lotus.File.fromJSON(file, json);
            }).fail(function(error) {
              if (inArray(ignoredErrors, error.message)) {
                return;
              }
              return log.moat(1).white("File error: ").red(file.path).moat(0).gray((log.isVerbose ? error.stack : error.message)).moat(1);
            });
          });
        }));
      }).then(function() {
        return async.all(sync.map(loadedModules.array, function(arg) {
          var module;
          module = arg.module;
          return module._loadPlugins();
        }));
      }).then(function() {
        return sync.map(loadedModules.array, function(arg) {
          var module;
          module = arg.module;
          return module;
        });
      });
    }).then(function(loadedModules) {
      var i, len, module;
      log.moat(1);
      log.white("Loaded " + loadedModules.length + " modules: ");
      log.moat(1);
      log.plusIndent(2);
      for (i = 0, len = loadedModules.length; i < len; i++) {
        module = loadedModules[i];
        log.green(module.name);
        log.moat(1);
      }
      log.popIndent();
      return log.moat(1).white("Loaded cache: ").yellow(Lotus.path + "/lotus-cache.json").gray(" (in " + (Date.now() - startTime) + " ms)").moat(1);
    });
  }
};

//# sourceMappingURL=../../map/src/persistence.map
