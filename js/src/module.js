var Config, Event, Factory, Module, Path, SemVer, SortedArray, chokidar, ignoredErrors, inArray, mm, plural, reportModuleError, syncFs;

SortedArray = require("sorted-array");

chokidar = require("chokidar");

Factory = require("factory");

inArray = require("in-array");

syncFs = require("io/sync");

SemVer = require("semver");

plural = require("plural");

Event = require("event");

Path = require("path");

mm = require("micromatch");

Config = require("./Config");

ignoredErrors = {
  init: ["Module path must be a directory!", "Module with that name already exists!", "Module ignored by global config file!"],
  load: ["Lotus.Config() failed to find valid configuration!", "Lotus.Config() must be passed a directory!"]
};

module.exports = Module = Factory("Lotus_Module", {
  initArguments: function(name) {
    var path;
    assert(Module.cache[name] == null, {
      name: name,
      reason: "Module with that name already exists!"
    });
    assert((name[0] !== "/") && (name.slice(0, 2) !== "./"), {
      name: name,
      reason: "Module name cannot begin with `/` or `./`!"
    });
    path = Path.resolve(lotus.path, name);
    assert(syncFs.isDir(path), {
      reason: "Module path must be a directory!",
      path: path
    });
    assert(!inArray(GlobalConfig.json.ignoredModules, name), {
      reason: "Module ignored by global config file!",
      name: name,
      path: path
    });
    return [name, path];
  },
  getFromCache: function(name) {
    return Module.cache[name];
  },
  initValues: function(name, path) {
    return {
      name: name,
      path: path,
      files: {},
      versions: {},
      dependers: {},
      dependencies: {},
      _deleted: false,
      _patterns: Object.create(null),
      _loading: null,
      _retryWatcher: null,
      _reportedMissing: {}
    };
  },
  init: function(name) {
    return Module.cache[name] = this;
  },
  load: function(options) {
    if (options == null) {
      options = {};
    }
    if (this._loading) {
      return this._loading;
    }
    return this._loading = Q["try"]((function(_this) {
      return function() {
        if (options.loadConfig !== false) {
          return _this.config = Config(_this.path);
        }
      };
    })(this)).then((function(_this) {
      return function() {
        if (options.loadPlugins !== false) {
          return _this._loadPlugins();
        }
      };
    })(this)).fail((function(_this) {
      return function(error) {
        _this._loading = null;
        throw error;
      };
    })(this));
  },
  crawl: function(pattern, onFileChange) {
    var deferred, files, fs, onAdd;
    pattern = Path.join(this.path, pattern);
    if (onFileChange) {
      Module.watch(pattern, onFileChange);
    }
    if (this._patterns[pattern]) {
      return this._patterns[pattern].adding;
    }
    fs = this._patterns[pattern] = chokidar.watch();
    deferred = Q.defer();
    files = Object.create(null);
    fs.on("add", onAdd = (function(_this) {
      return function(path) {
        if (!syncFs.isFile(path)) {
          return;
        }
        return files[path] = lotus.File(path, _this);
      };
    })(this));
    fs.once("ready", (function(_this) {
      return function() {
        fs.removeListener("add", onAdd);
        deferred.fulfill(files);
        return fs.on("all", function(event, path) {
          return _this._onFileChange(event, path);
        });
      };
    })(this));
    fs.add(pattern);
    return fs.adding = deferred.promise;
  },
  toJSON: function() {
    if (!this._loading) {
      return false;
    }
    return this._loading.then((function(_this) {
      return function() {
        var config, dependers, files;
        config = {
          path: _this.config.path,
          json: _this.config.json
        };
        files = Object.keys(_this.files);
        if (files.length > 0) {
          files = sync.map(files, function(path) {
            return Path.relative(_this.path, path);
          });
        }
        dependers = Object.keys(_this.dependers);
        return {
          name: _this.name,
          files: files,
          dependers: dependers,
          dependencies: _this.dependencies,
          config: config
        };
      };
    })(this));
  },
  _onFileChange: function(event, path) {
    var file;
    if (event === "add") {
      if (!syncFs.isFile(path)) {
        return;
      }
    } else if (!this.files[path]) {
      log.moat(1);
      log.white("Unknown file: ");
      log.red(path);
      log.moat(1);
      log.format(this.files, {
        maxObjectDepth: 0
      });
      log.moat(1);
      return;
    }
    file = lotus.File(path, this);
    if (event === "unlink") {
      file["delete"]();
    }
    return process.nextTick(function() {
      return Module.didFileChange.emit({
        file: file,
        event: event
      });
    });
  },
  _retryLoad: function(error) {
    if (this._deleted) {
      return;
    }
    reportModuleError(this.name, error, ignoredErrors.load);
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
    sync.each(this.dependers, (function(_this) {
      return function(mod) {
        return delete mod.dependencies[_this.name];
      };
    })(this));
    sync.each(this.dependencies, (function(_this) {
      return function(mod) {
        return delete mod.dependers[_this.name];
      };
    })(this));
    sync.each(this.files, function(file) {
      return file["delete"]();
    });
    return delete Module.cache[this.name];
  },
  _loadPlugins: function() {
    var failedPlugin, i, len, name, plugins, ref;
    plugins = [].concat(lotus.Plugin.injectedPlugins);
    if (this.config.plugins) {
      ref = this.config.plugins;
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        plugins.push(lotus.Plugin(name));
      }
    }
    if (!(plugins.length > 0)) {
      return Q();
    }
    failedPlugin = null;
    return Q.all(plugins.map((function(_this) {
      return function(plugin) {
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
  },
  statics: {
    didFileChange: Event(),
    cache: Object.create(null),
    watch: function(options, callback) {
      if (isType(options, String)) {
        options = {
          include: options
        };
      }
      if (options.include == null) {
        options.include = "**/*";
      }
      return lotus.Module.didFileChange(function(arg) {
        var event, file;
        file = arg.file, event = arg.event;
        if (mm(file.path, options.include).length === 0) {
          return;
        }
        if ((options.exclude != null) && mm(file.path, options.exclude).length > 0) {
          return;
        }
        return callback(file, event, options);
      });
    },
    crawl: function(dir, options) {
      var deferred, fs, newModules, promises;
      if (lotus.Module.fs) {
        throw Error("Lotus.Module.crawl() can only be called once!");
      }
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
      lotus.Module.fs = fs = chokidar.watch(dir, {
        depth: 0
      });
      fs.on("addDir", function(path) {
        var name;
        if (path === lotus.path) {
          return;
        }
        name = Path.relative(lotus.path, path);
        return promises.push(Q["try"](function() {
          var mod;
          mod = lotus.Module(name);
          return mod.load(options).then(function() {
            return newModules.insert(mod);
          }).fail(function(error) {
            mod._retryLoad(error);
          });
        }).fail(function(error) {
          return reportModuleError(name, error, ignoredErrors.init);
        }));
      });
      fs.on("unlinkDir", function(path) {
        var name, ref;
        name = Path.relative(lotus.path, path);
        return (ref = lotus.Module.cache[name]) != null ? ref._delete() : void 0;
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
      return lotus.Module.cache[name];
    },
    fromJSON: function(json) {
      var config, dependencies, dependers, files, mod, name;
      name = json.name, files = json.files, dependers = json.dependers, dependencies = json.dependencies, config = json.config;
      mod = lotus.Module.cache[name];
      if (mod == null) {
        mod = lotus.Module(name);
      }
      mod._loading = Q();
      mod.config = Config.fromJSON(config.path, config.json);
      mod.dependencies = dependencies;
      mod.files = sync.reduce(files, {}, function(files, path) {
        path = Path.resolve(mod.path, path);
        files[path] = lotus.File(path, mod);
        return files;
      });
      return {
        module: mod,
        dependers: dependers
      };
    }
  }
});

reportModuleError = function(moduleName, error, ignoredErrors) {
  assertType(moduleName, String);
  assertType(error, Error.Kind);
  if (isType(ignoredErrors, Array)) {
    if (inArray(ignoredErrors, error.message)) {
      return;
    }
  }
  log.moat(1);
  log.red("Module error: ");
  log.white(moduleName);
  log.moat(0);
  log.gray.dim(error.stack);
  return log.moat(1);
};

//# sourceMappingURL=../../map/src/Module.map
