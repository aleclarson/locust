var Config, EventEmitter, NamedFunction, SemVer, SortedArray, assert, async, basename, chokidar, color, combine, define, dirname, getType, inArray, isAbsolute, isKind, isType, join, ln, log, lotus, mm, noop, plural, ref, ref1, ref2, ref3, relative, resolve, setType, sync;

lotus = require("lotus-require");

ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, dirname = ref.dirname, basename = ref.basename, isAbsolute = ref.isAbsolute;

ref1 = require("type-utils"), assert = ref1.assert, getType = ref1.getType, setType = ref1.setType, isKind = ref1.isKind, isType = ref1.isType;

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

Config = require("./config");

module.exports = global.Module = NamedFunction("Module", function(name) {
  var mod, path;
  assert(Module.cache[name] == null, {
    name: name,
    reason: "Module with that name already exists!"
  });
  assert((name[0] !== "/") && (name.slice(0, 2) !== "./"), {
    name: name,
    reason: "Module name cannot begin with `/` or `./`!"
  });
  path = resolve(name);
  assert(sync.isDir(path), {
    path: path,
    reason: "Module path must be a directory!"
  });
  Module.cache[name] = mod = setType({}, Module);
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
      _patterns: Object.create(null),
      _initializing: null,
      _retryWatcher: null,
      _reportedMissing: {}
    });
  });
});

define(Module, function() {
  var emitter;
  this.options = {
    configurable: false
  };
  this({
    cache: {
      value: Object.create(null)
    },
    watch: function(options, callback) {
      if (isType(options, String)) {
        options = {
          include: options
        };
      }
      if (options.include == null) {
        options.include = "**/*";
      }
      Module._emitter.on("file event", function(arg) {
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
      var deferred, fs, newModules, promises;
      if (Module.fs != null) {
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
      fs = Module.fs = chokidar.watch(dir, {
        depth: 0
      });
      fs.on("addDir", function(path) {
        var error, mod, name, promise;
        if (path === lotus.path) {
          return;
        }
        name = relative(lotus.path, path);
        try {
          mod = Module(name);
        } catch (_error) {
          error = _error;
          return;
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
        name = relative(lotus.path, path);
        return (ref4 = Module.cache[name]) != null ? ref4._delete() : void 0;
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
      path = relative(lotus.path, path);
      name = path.slice(0, path.indexOf("/"));
      return Module.cache[name];
    },
    fromJSON: function(json) {
      var config, dependencies, dependers, files, mod, name;
      name = json.name, files = json.files, dependers = json.dependers, dependencies = json.dependencies, config = json.config;
      mod = Module.cache[name];
      if (mod == null) {
        mod = Module(name);
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
    _plugins: {}
  });
});

define(Module.prototype, function() {
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
      var config, dependers, files;
      if (this.error != null) {
        log.moat(1).red(this.name).white(" threw an error: ").gray(this.error.message).moat(1);
        return false;
      }
      if (this.config == null) {
        return false;
      }
      config = {
        path: this.config.path,
        json: this.config.json
      };
      files = Object.keys(this.files);
      if (files.length === 0) {
        if (log.isVerbose) {
          log.moat(1);
          log("'" + this.name + "' has no files");
          log.moat(1);
        }
        return false;
      }
      files = sync.map(files, (function(_this) {
        return function(path) {
          return relative(_this.path, path);
        };
      })(this));
      dependers = Object.keys(this.dependers);
      return {
        name: this.name,
        files: files,
        dependers: dependers,
        dependencies: this.dependencies,
        config: config
      };
    }
  });
  this.enumerable = false;
  return this({
    _ignoredErrorCodes: ["NOT_A_DIRECTORY", "NODE_MODULES_NOT_A_DIRECTORY"],
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
        return Module._emitter.emit("file event", {
          file: file,
          event: event
        });
      });
    },
    _retryInitialize: function(error) {
      var silentErrors;
      if (this._deleted) {
        return;
      }
      silentErrors = ["Could not find 'lotus-config' file!"];
      if (!inArray(silentErrors, error.message)) {
        log.moat(1).white("Module error: ").red(this.name).moat(0).gray((log.isVerbose ? error.stack : error.message)).moat(1);
      }
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
      this._retryWatcher.close();
      this._retryWatcher = null;
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
      this.config.addPlugins(Module._plugins);
      return this.config.loadPlugins((function(_this) {
        return function(plugin, options) {
          return plugin(_this, options);
        };
      })(this)).fail((function(_this) {
        return function(error) {
          return log.moat(1).white("Module error: ").red(_this.name).moat(0).gray((log.isVerbose ? error.stack : error.message)).moat(1);
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
            dep = Module.cache[name];
            try {
              if (dep == null) {
                dep = Module(name);
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
              _this.dependencies[dep.name] = {
                version: json.version,
                lastModified: stats.node.mtime
              };
              if (log.isDebug) {
                log.origin("lotus/module");
                log.yellow(_this.name);
                log(" depends on ");
                log.yellow(dep.name);
                return log.moat(1);
              }
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

//# sourceMappingURL=../../map/src/module.map
