var Factory, Path, Q, SortedArray, assert, asyncFs, exit, inArray, log, sync, syncFs;

assert = require("type-utils").assert;

SortedArray = require("sorted-array");

Factory = require("factory");

inArray = require("in-array");

asyncFs = require("io/async");

syncFs = require("io/sync");

Path = require("path");

sync = require("sync");

exit = require("exit");

log = require("lotus-log");

Q = require("q");

module.exports = Factory("Lotus_Cache", {
  singleton: true,
  initValues: function() {
    return {
      path: null,
      isDirty: false,
      _watcher: null
    };
  },
  load: function(path) {
    var error, startTime;
    if (this.path !== null) {
      error = Error("Cache is already loaded!");
      return Q.reject(error);
    }
    this.path = path != null ? path : path = lotus.path + "/lotus-cache.json";
    if (!syncFs.isFile(path)) {
      error = Error("Cache does not exist!");
      return Q.reject(error);
    }
    if (process.options.reset) {
      log.moat(1);
      log.gray("--reset");
      log.moat(0);
      log.white("Clearing ");
      log.yellow("lotus-cache.json");
      log.white("...");
      log.moat(1);
      syncFs.remove(path);
      error = Error("Cache was manually reset!");
      return Q.reject(error);
    }
    log.moat(1);
    log.cyan("Reading the 'lotus-cache.json' file...");
    log.moat(1);
    startTime = Date.now();
    return asyncFs.read(path).then((function(_this) {
      return function(json) {
        return _this.fromJSON(JSON.parse(json));
      };
    })(this)).then((function(_this) {
      return function(loadedModules) {
        var color, endTime, i, index, len, module, newLength, newPart;
        endTime = Date.now();
        log.moat(1);
        log.white("Restored ");
        log.green(loadedModules.length);
        log.white(" existing modules: ");
        log.moat(1);
        log.plusIndent(2);
        for (index = i = 0, len = loadedModules.length; i < len; index = ++i) {
          module = loadedModules[index];
          color = index % 2 ? "cyan" : "green";
          newPart = module.name + " ";
          newLength = log.line.length + newPart.length;
          if (newLength > log.size[0] - log.indent) {
            log.moat(0);
          }
          log[color](newPart);
        }
        log.popIndent();
        log.moat(1);
        log.white("Loaded ");
        log.yellow("lotus-cache.json");
        log.white(" in ");
        log.green(endTime - startTime);
        log.white(" ms!");
        log.moat(1);
        _this._watcher = lotus.Module.didFileChange(function() {
          return _this.isDirty = true;
        });
        return exit.on(function() {
          return _this.save();
        });
      };
    })(this));
  },
  save: function() {
    var startTime;
    if (!this.isDirty) {
      return Q();
    }
    this.isDirty = false;
    startTime = Date.now();
    return this.toJSON().then(function(json) {
      var path;
      path = lotus.path + "/lotus-cache.json";
      return asyncFs.write(path, json).then(function() {
        var endTime;
        endTime = Date.now();
        log.moat(1);
        log.white("Saved ");
        log.yellow("lotus-cache.json");
        log.white(" in ");
        log.green(endTime - startTime);
        log.white(" ms!");
        return log.moat(1);
      });
    });
  },
  toJSON: function() {
    var files, moduleNames, modules, startTime;
    startTime = Date.now();
    modules = [];
    files = [];
    moduleNames = Object.keys(lotus.Module.cache);
    return Q.all(sync.map(moduleNames, function(name) {
      var module;
      module = lotus.Module.cache[name];
      return Q["try"](function() {
        return module.toJSON();
      }).then(function(json) {
        var filePaths;
        if (json === false) {
          return;
        }
        modules.push(json);
        filePaths = Object.keys(module.files);
        return Q.all(sync.map(filePaths, function(path) {
          return Q["try"](function() {
            return module.files[path].toJSON();
          }).then(function(json) {
            return files.push(json);
          });
        }));
      });
    })).then(function() {
      log.moat(1);
      log.white("Saving ");
      log.yellow(modules.length);
      log.white(" modules...");
      log.moat(1);
      log.moat(1);
      log.white("Saving ");
      log.yellow(files.length);
      log.white(" files...");
      log.moat(1);
      return JSON.stringify({
        modules: modules,
        files: files
      });
    });
  },
  fromJSON: function(json) {
    var fileMap, hasThrown, ignoredErrors, loadedModules;
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
    hasThrown = false;
    return Q.all(sync.map(json.modules, function(module) {
      return Q["try"](function() {
        return lotus.Module.fromJSON(module);
      }).then(function(result) {
        return loadedModules.insert(result);
      }).fail(function(error) {
        if (inArray(ignoredErrors, error.message)) {
          return;
        }
        if (hasThrown) {
          return;
        }
        hasThrown = true;
        log.moat(1);
        log.white("Module failed to load: ");
        log.red(module.name);
        log.moat(1);
        log.gray(error.stack);
        return log.moat(1);
      });
    })).then(function() {
      return sync.each(loadedModules.array, function(arg) {
        var dependers, module;
        module = arg.module, dependers = arg.dependers;
        return module.dependers = sync.reduce(dependers, {}, function(dependers, name) {
          var dependerModule;
          dependerModule = lotus.Module.cache[name];
          if (dependerModule != null) {
            dependers[name] = dependerModule;
          }
          return dependers;
        });
      });
    }).then(function() {
      ignoredErrors = ["This file belongs to an unknown module!"];
      hasThrown = false;
      return Q.all(sync.map(loadedModules.array, function(arg) {
        var module;
        module = arg.module;
        return Q.all(sync.map(module.files, function(file) {
          return Q["try"](function() {
            json = fileMap[file.path];
            assert(json != null, {
              file: file,
              reason: "File not found in 'lotus-cache.json'!"
            });
            return lotus.File.fromJSON(file, json);
          }).fail(function(error) {
            if (inArray(ignoredErrors, error.message)) {
              return;
            }
            if (hasThrown) {
              return;
            }
            hasThrown = true;
            log.moat(1);
            log.white("File error: ");
            log.red(Path.relative(lotus.path, file.path));
            log.moat(0);
            log.gray(error.stack);
            return log.moat(1);
          });
        }));
      }));
    }).then(function() {
      return Q.all(sync.map(loadedModules.array, function(arg) {
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
  }
});

//# sourceMappingURL=../../map/src/Cache.map
