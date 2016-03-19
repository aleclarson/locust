var Config, EventEmitter, Lotus, NamedFunction, SemVer, SortedArray, assert, assertType, async, basename, chokidar, color, combine, define, dirname, getType, inArray, isAbsolute, isKind, isType, join, ln, log, mm, noop, plural, ref, ref1, ref2, ref3, relative, resolve, setType, sync;

Lotus = require("./index");

ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, dirname = ref.dirname, basename = ref.basename, isAbsolute = ref.isAbsolute;

ref1 = require("type-utils"), assert = ref1.assert, assertType = ref1.assertType, getType = ref1.getType, setType = ref1.setType, isKind = ref1.isKind, isType = ref1.isType;

ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

EventEmitter = require("events").EventEmitter;

ref3 = require("io"), sync = ref3.sync, async = ref3.async;

NamedFunction = require("named-function");

SortedArray = require("sorted-array");

chokidar = require("chokidar");

combine = require("combine");

inArray = require("in-array");

SemVer = require("semver");

define = require("define");

plural = require("plural");

noop = require("no-op");

mm = require("micromatch");

Config = require("./Config");

module.exports = Lotus.Module = NamedFunction("Module", function(name) {
  var mod, path;
  assert(Lotus.Module.cache[name] == null, {
    name: name,
    reason: "Module with that name already exists!"
  });
  assert((name[0] !== "/") && (name.slice(0, 2) !== "./"), {
    name: name,
    reason: "Module name cannot begin with `/` or `./`!"
  });
  path = resolve(Lotus.path, name);
  assert(sync.isDir(path), {
    path: path,
    reason: "Module path must be a directory!"
  });
  assert(!inArray(GlobalConfig.json.ignoredModules, name), {
    name: name,
    reason: "Ignored by '$LOTUS_PATH/lotus-config' file!"
  });
  Lotus.Module.cache[name] = mod = setType({}, Lotus.Module);
  return define(mod, function() {
    this.options = {
      configurable: false
    };
    this({
      name: name,
      path: path,
      files: {},
      versions: {},
      dependers: {},
      dependencies: {}
    });
    this.enumerable = false;
    return this({
      _deleted: false,
      _patterns: Object.create(null),
      _initializing: null,
      _retryWatcher: null,
      _reportedMissing: {}
    });
  });
});

define(Lotus.Module, function() {
  var emitter;
  this.options = {
    configurable: false
  };
  this({
    cache: {
      value: Object.create(null)
    },
    pluginsEnabled: true,
    watch: function(options, callback) {
      if (isType(options, String)) {
        options = {
          include: options
        };
      }
      if (options.include == null) {
        options.include = "**/*";
      }
      Lotus.Module._emitter.on("file event", function(arg) {
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
    crawl: function(dir) {
      var deferred, fs, ignoredModuleErrors, newModules, promises;
      if (Lotus.Module.fs != null) {
        throw Error("Already crawled.");
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
      Lotus.Module.fs = fs = chokidar.watch(dir, {
        depth: 0
      });
      ignoredModuleErrors = ["Module with that name already exists!", "Module path must be a directory!", "Ignored by '$LOTUS_PATH/lotus-config' file!"];
      fs.on("addDir", function(path) {
        var error, mod, name, promise;
        if (path === Lotus.path) {
          return;
        }
        name = relative(Lotus.path, path);
        try {
          mod = Lotus.Module(name);
        } catch (_error) {
          error = _error;
          Lotus.Module._reportError({
            name: name,
            error: error,
            ignored: ignoredModuleErrors
          });
        }
        if (mod == null) {
          return;
        }
        promise = async["try"](function() {
          return mod.initialize();
        }).then(function() {
          return newModules.insert(mod);
        }).fail(function(error) {
          return mod._retryInitialize(error);
        });
        return promises.push(promise);
      });
      fs.on("unlinkDir", function(path) {
        var name, ref4;
        name = relative(Lotus.path, path);
        return (ref4 = Lotus.Module.cache[name]) != null ? ref4._delete() : void 0;
      });
      deferred = async.defer();
      fs.once("ready", function() {
        return async.all(promises).then(function() {
          return deferred.resolve(newModules.array);
        });
      });
      return deferred.promise;
    },
    forFile: function(path) {
      var name;
      path = relative(Lotus.path, path);
      name = path.slice(0, path.indexOf("/"));
      return Lotus.Module.cache[name];
    },
    fromJSON: function(json) {
      var config, dependencies, dependers, files, mod, name;
      name = json.name, files = json.files, dependers = json.dependers, dependencies = json.dependencies, config = json.config;
      mod = Lotus.Module.cache[name];
      if (mod == null) {
        mod = Lotus.Module(name);
      }
      mod._initializing = async.fulfill();
      mod.config = Config.fromJSON(config.path, config.json);
      mod.dependencies = dependencies;
      mod.files = sync.reduce(files, {}, function(files, path) {
        path = resolve(mod.path, path);
        files[path] = File(path, mod);
        return files;
      });
      return {
        module: mod,
        dependers: dependers
      };
    }
  });
  emitter = new EventEmitter;
  emitter.setMaxListeners(Infinity);
  this.enumerable = false;
  return this({
    _emitter: emitter,
    _plugins: {},
    _reportError: function(options) {
      var error;
      if (options == null) {
        options = {};
      }
      assertType(options, Object);
      if ((isType(options.ignored, Array)) && (inArray(options.ignored, options.error.message))) {
        return;
      }
      error = log.isVerbose ? options.error.stack : options.error.message;
      return log.moat(1).white("Module error: ").red(options.name).moat(0).gray(error).moat(1);
    }
  });
});

define(Lotus.Module.prototype, function() {
  this.options = {
    frozen: true
  };
  this({
    initialize: function() {
      if (this._initializing) {
        return this._initializing;
      }
      return this._initializing = async["try"]((function(_this) {
        return function() {
          _this.config = Config(_this.path);
          return async.all([_this._loadVersions(), _this._loadDependencies()]);
        };
      })(this)).then((function(_this) {
        return function() {
          return _this._loadPlugins();
        };
      })(this)).fail((function(_this) {
        return function(error) {
          _this._initializing = null;
          throw error;
        };
      })(this));
    },
    watch: function(pattern) {
      var deferred, files, fs, onAdd, self;
      pattern = join(this.path, pattern);
      if (this._patterns[pattern] != null) {
        return this._patterns[pattern].adding;
      }
      fs = this._patterns[pattern] = chokidar.watch();
      deferred = async.defer();
      self = this;
      files = Object.create(null);
      fs.on("add", onAdd = function(path) {
        if (!sync.isFile(path)) {
          return;
        }
        return files[path] = File(path, self);
      });
      fs.once("ready", function() {
        fs.removeListener("add", onAdd);
        deferred.fulfill(files);
        return fs.on("all", function(event, path) {
          return self._onFileEvent(event, path);
        });
      });
      fs.add(pattern);
      return fs.adding = deferred.promise;
    },
    toJSON: function() {
      if (!this._initializing) {
        return false;
      }
      return this._initializing.then((function(_this) {
        return function() {
          var config, dependers, files;
          config = {
            path: _this.config.path,
            json: _this.config.json
          };
          files = Object.keys(_this.files);
          if (files.length > 0) {
            files = sync.map(files, function(path) {
              return relative(_this.path, path);
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
    }
  });
  this.enumerable = false;
  return this({
    _onFileEvent: function(event, path) {
      var file;
      if (event === "add") {
        if (!sync.isFile(path)) {
          return;
        }
      } else {
        if (this.files[path] == null) {
          return;
        }
      }
      file = File(path, this);
      if (event === "unlink") {
        file["delete"]();
      }
      return process.nextTick(function() {
        return Lotus.Module._emitter.emit("file event", {
          file: file,
          event: event
        });
      });
    },
    _retryInitialize: function(error) {
      if (this._deleted) {
        return;
      }
      Lotus.Module._reportError({
        name: this.name,
        error: error,
        ignored: ["The given path is not a directory!", "Could not find 'lotus-config' file!"]
      });
      if (this._retryWatcher == null) {
        this._retryWatcher = chokidar.watch(this.path, {
          depth: 1
        });
        this._retryWatcher.once("ready", (function(_this) {
          return function() {
            return _this._retryWatcher.on("all", function(event, path) {
              return async["try"](function() {
                return _this.initialize();
              }).then(function() {
                if (_this._retryWatcher == null) {
                  return;
                }
                _this._retryWatcher.close();
                return _this._retryWatcher = null;
              }).fail(function(error) {
                return _this._retryInitialize(error);
              });
            });
          };
        })(this));
      }
    },
    _delete: function() {
      if (this._deleted) {
        return;
      }
      this._deleted = true;
      log.it("Deleted module: " + this.name);
      delete Lotus.Module.cache[this.name];
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
      return sync.each(this.files, function(file) {
        return file["delete"]();
      });
    },
    _loadPlugins: function() {
      if (!Lotus.Module.pluginsEnabled) {
        return;
      }
      this.config.addPlugins(Lotus.Module._plugins);
      return this.config.loadPlugins((function(_this) {
        return function(plugin, options) {
          return plugin(_this, options);
        };
      })(this)).fail((function(_this) {
        return function(error) {
          return Lotus.Module._reportError({
            name: _this.name,
            error: error
          });
        };
      })(this));
    },
    _loadDependencies: function() {
      var depCount, depDirPath, moduleJson, moduleJsonPath;
      depCount = 0;
      depDirPath = join(this.path, "node_modules");
      moduleJsonPath = join(this.path, "package.json");
      moduleJson = null;
      return async.isFile(moduleJsonPath).then((function(_this) {
        return function(isFile) {
          assert(isFile, {
            path: moduleJsonPath,
            module: _this,
            reason: "Missing 'package.json' file!"
          });
          moduleJson = require(moduleJsonPath);
          return async.isDir(depDirPath);
        };
      })(this)).then((function(_this) {
        return function(isDir) {
          if (!isDir) {
            return;
          }
          return async.readDir(depDirPath);
        };
      })(this)).then((function(_this) {
        return function(names) {
          if (names == null) {
            return;
          }
          return async.each(names, function(name, i) {
            var dep, depJsonPath, ref4;
            if (name[0] === ".") {
              return;
            }
            if (((ref4 = moduleJson.devDependencies) != null ? ref4[name] : void 0) != null) {
              return;
            }
            dep = Lotus.Module.cache[name];
            try {
              if (dep == null) {
                dep = Lotus.Module(name);
              }
            } catch (_error) {}
            if (dep == null) {
              return;
            }
            depJsonPath = join(dep.path, "package.json");
            return async.isDir(dep.path).then(function(isDir) {
              if (isDir) {
                return async.isFile(depJsonPath);
              }
              return dep._delete();
            }).then(function(isFile) {
              assert(isFile, {
                path: depJsonPath,
                module: _this,
                reason: "Could not find 'package.json' file!"
              });
              return async.read(depJsonPath);
            }).then(function(contents) {
              var json;
              json = JSON.parse(contents);
              return async.stats(dep.path).then(function(stats) {
                return {
                  stats: stats,
                  json: json
                };
              });
            }).then(function(arg) {
              var json, stats;
              stats = arg.stats, json = arg.json;
              depCount++;
              dep.dependers[_this.name] = _this;
              return _this.dependencies[dep.name] = {
                version: json.version,
                lastModified: stats.node.mtime
              };
            }).fail(function(error) {
              return log.moat(1).white("Dependency error: ").red(name).moat(0).gray(error.stack).moat(1);
            });
          });
        };
      })(this));
    },
    _loadVersions: function() {
      var tagDirPath, versionCount;
      versionCount = 0;
      tagDirPath = join(this.path, ".git/refs/tags");
      return async.isDir(tagDirPath).then((function(_this) {
        return function(isDir) {
          if (!isDir) {
            return;
          }
          return async.readDir(tagDirPath);
        };
      })(this)).then((function(_this) {
        return function(tags) {
          if (tags == null) {
            return;
          }
          return async.each(tags, function(tag, i) {
            if (!SemVer.valid(tag)) {
              return;
            }
            return async.stats(join(tagDirPath, tag)).then(function(stats) {
              versionCount++;
              return _this.versions[tag] = {
                lastModified: stats.node.mtime
              };
            });
          });
        };
      })(this));
    }
  });
});

//# sourceMappingURL=../../map/src/Module.map
