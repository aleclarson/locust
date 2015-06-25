var Config, Event, Module, Path, Q, SortedArray, Type, chokidar, inArray, knownErrors, match, plural, reportModuleError, syncFs, type;

SortedArray = require("sorted-array");

chokidar = require("chokidar");

inArray = require("in-array");

syncFs = require("io/sync");

plural = require("plural");

match = require("micromatch");

Event = require("event");

Path = require("path");

Type = require("Type");

Q = require("q");

Config = require("./Config");

type = Type("Lotus_Module");

type.argumentTypes = {
  name: String,
  path: String
};

type.createArguments(function(args) {
  args[1] = Path.resolve(lotus.path, args[0]);
  return args;
});

type.initInstance(function(name, path) {
  assert(!Module.cache[name], {
    reason: "Module with that name already exists!",
    name: name
  });
  assert(name[0] !== "/", {
    reason: "Module name cannot begin with '/'!",
    name: name
  });
  assert(name.slice(0, 2) !== "./", {
    reason: "Module name cannot begin with './'!",
    name: name
  });
  assert(syncFs.isDir(path), {
    reason: "Module path must be a directory!",
    path: path
  });
  return assert(!inArray(GlobalConfig.json.ignoredModules, name), {
    reason: "Module ignored by global config file!",
    name: name,
    path: path
  });
});

type.returnCached(function(name) {
  return name;
});

type.defineValues({
  name: function(name) {
    return name;
  },
  path: function(_, path) {
    return path;
  },
  files: function() {
    return Object.create(null);
  },
  _deleted: false,
  _patterns: function() {
    return Object.create(null);
  },
  _loading: null,
  _retryWatcher: null,
  _reportedMissing: function() {
    return {};
  }
});

type.defineMethods({
  load: function(options) {
    if (options == null) {
      options = {};
    }
    if (this._loading) {
      return this._loading;
    }
    return this._loading = Q["try"]((function(_this) {
      return function() {
        if (options.skipConfig) {
          return;
        }
        _this.config = Config(_this.path);
      };
    })(this)).then((function(_this) {
      return function() {
        if (options.skipPlugins) {
          return;
        }
        return _this._loadPlugins();
      };
    })(this)).fail((function(_this) {
      return function(error) {
        _this._loading = null;
        throw error;
      };
    })(this));
  },
  crawl: function(pattern, onFileChange) {
    var deferred, files, fs, onFileAdded, onceFilesReady;
    pattern = Path.join(this.path, pattern);
    if (onFileChange) {
      Module.watch(pattern, onFileChange);
    }
    fs = this._patterns[pattern];
    if (fs) {
      return fs.adding;
    }
    deferred = Q.defer();
    fs = chokidar.watch();
    files = Object.create(null);
    onFileAdded = (function(_this) {
      return function(path) {
        if (!syncFs.isFile(path)) {
          return;
        }
        return files[path] = lotus.File(path, _this);
      };
    })(this);
    onceFilesReady = (function(_this) {
      return function() {
        fs.removeListener("add", onFileAdded);
        deferred.fulfill(files);
        return fs.on("all", function(event, path) {
          var file;
          file = lotus.File(path, _this);
          return Module.didFileChange.emit(event, file);
        });
      };
    })(this);
    fs.on("add", onFileAdded);
    fs.once("ready", onceFilesReady);
    fs.add(pattern);
    return fs.adding = deferred.promise;
  },
  _retryLoad: function(error) {
    if (this._deleted) {
      return;
    }
    reportModuleError(this.name, error, knownErrors.load);
    if (this._retryWatcher) {
      return;
    }
    this._retryWatcher = chokidar.watch(this.path, {
      depth: 1
    });
    this._retryWatcher.once("ready", (function(_this) {
      return function() {
        return _this._retryWatcher.on("all", function(event, path) {
          return Q["try"](function() {
            return _this.load();
          }).then(function() {
            if (_this._retryWatcher == null) {
              return;
            }
            _this._retryWatcher.close();
            return _this._retryWatcher = null;
          }).fail(function(error) {
            return _this._retryLoad(error);
          });
        });
      };
    })(this));
  },
  _delete: function() {
    if (this._deleted) {
      return;
    }
    this._deleted = true;
    if (this._retryWatcher != null) {
      this._retryWatcher.close();
      this._retryWatcher = null;
    }
    return delete Module.cache[this.name];
  },
  _loadPlugins: function() {
    var failedPlugin, i, len, name, pluginNames, ref;
    pluginNames = [].concat(lotus.Plugin.injectedPlugins);
    if (this.config.plugins) {
      ref = this.config.plugins;
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        pluginNames.push(lotus.Plugin(name));
      }
    }
    if (pluginNames.length === 0) {
      return Q();
    }
    failedPlugin = null;
    return Q.all(pluginNames.map((function(_this) {
      return function(pluginName) {
        var plugin;
        if (isType(pluginName, lotus.Plugin)) {
          plugin = pluginName;
        } else {
          plugin = lotus.Plugin(pluginName);
        }
        return Q["try"](function() {
          var options;
          options = _this.config.json[plugin.name] || {};
          return plugin.initModule(_this, options);
        }).fail(function(error) {
          if (failedPlugin) {
            return;
          }
          failedPlugin = plugin;
          throw error;
        });
      };
    })(this))).fail((function(_this) {
      return function(error) {
        log.moat(1);
        log.red("Plugin failed: ");
        log.white(failedPlugin.name);
        log.gray.dim(" for module ");
        log.cyan(_this.name);
        log.moat(0);
        log.gray.dim(error.stack);
        log.moat(1);
        return process.exit();
      };
    })(this));
  }
});

type.defineStatics({
  didFileChange: Event(),
  watch: function(options, callback) {
    if (isType(options, String)) {
      options = {
        include: options
      };
    }
    if (options.include == null) {
      options.include = "**/*";
    }
    return Module.didFileChange(function(event, file) {
      if (match(file.path, options.include).length === 0) {
        return;
      }
      if ((options.exclude != null) && match(file.path, options.exclude).length > 0) {
        return;
      }
      return callback(file, event, options);
    });
  },
  crawl: function(dir, options) {
    var deferred, fs, newModules, promises;
    assert(!Module.fs, {
      reason: "Cannot call 'Module.crawl' more than once!"
    });
    promises = [];
    newModules = SortedArray([], function(a, b) {
      a = a.name.toLowerCase();
      b = b.name.toLowerCase();
      if (a > b) {
        return 1;
      } else {
        return -1;
      }
    });
    Module.fs = fs = chokidar.watch(dir, {
      depth: 0
    });
    fs.on("addDir", function(path) {
      var name, promise;
      if (path === lotus.path) {
        return;
      }
      name = Path.relative(lotus.path, path);
      promise = Q["try"](function() {
        var mod;
        if (Module.cache[name]) {
          return;
        }
        mod = Module(name);
        return mod.load(options).then(function() {
          return newModules.insert(mod);
        }).fail(function(error) {
          mod._retryLoad(error);
        });
      }).fail(function(error) {
        return reportModuleError(name, error, knownErrors.init);
      });
      return promises.push(promise);
    });
    fs.on("unlinkDir", function(path) {
      var name, ref;
      name = Path.relative(lotus.path, path);
      return (ref = Module.cache[name]) != null ? ref._delete() : void 0;
    });
    deferred = Q.defer();
    fs.once("ready", function() {
      return Q.all(promises).then(function() {
        return deferred.resolve(newModules.array);
      }).done();
    });
    return deferred.promise;
  },
  forFile: function(path) {
    var name;
    path = Path.relative(lotus.path, path);
    name = path.slice(0, path.indexOf("/"));
    return Module.cache[name];
  }
});

module.exports = Module = type.build();

reportModuleError = function(moduleName, error, options) {
  if (options == null) {
    options = {};
  }
  assertType(moduleName, String);
  assertType(error, Error.Kind);
  if (isType(options.warn, Array)) {
    if (inArray(options.warn, error.message)) {
      log.moat(1);
      log.yellow("WARN: ");
      log.white(moduleName);
      log.moat(0);
      log.gray.dim(error.message);
      log.moat(1);
      if (typeof error["catch"] === "function") {
        error["catch"]();
      }
      return;
    }
  }
  if (isType(options.quiet, Array)) {
    if (inArray(options.quiet, error.message)) {
      if (typeof error["catch"] === "function") {
        error["catch"]();
      }
      return;
    }
  }
  log.moat(1);
  log.red("ERROR: ");
  log.white(moduleName);
  log.moat(0);
  log.gray.dim(error.stack);
  log.moat(1);
};

knownErrors = {
  init: {
    quiet: ["Module path must be a directory!", "Module with that name already exists!", "Module ignored by global config file!"]
  },
  load: {
    quiet: ["Expected an existing directory!", "Failed to find configuration file!"]
  }
};

//# sourceMappingURL=../../map/src/module.map
