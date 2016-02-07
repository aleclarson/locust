var Config, EventEmitter, Gaze, NamedFunction, SemVer, SortedArray, assert, async, basename, color, combine, define, dirname, getType, has, inArray, isAbsolute, isKind, isType, join, ln, log, lotus, mm, noop, plural, ref, ref1, ref2, ref3, relative, resolve, setType, sync;

lotus = require("lotus-require");

ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, dirname = ref.dirname, basename = ref.basename, isAbsolute = ref.isAbsolute;

ref1 = require("type-utils"), assert = ref1.assert, getType = ref1.getType, setType = ref1.setType, isKind = ref1.isKind, isType = ref1.isType;

ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

EventEmitter = require("events").EventEmitter;

ref3 = require("io"), sync = ref3.sync, async = ref3.async;

Gaze = require("gaze").Gaze;

NamedFunction = require("named-function");

SortedArray = require("sorted-array");

combine = require("combine");

inArray = require("in-array");

SemVer = require("semver");

define = require("define");

plural = require("plural");

noop = require("no-op");

has = require("has");

mm = require("micromatch");

Config = require("./config");

module.exports = global.Module = NamedFunction("Module", function(name) {
  var fs, module, path;
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
  Module.cache[name] = module = setType({}, Module);
  fs = new Gaze;
  fs.paths = Object.create(null);
  fs.on("all", function(event, path) {
    return module._onFileEvent(event, path);
  });
  return define(module, function() {
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
      _fs: fs,
      _initializing: null,
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
      var newModules;
      newModules = SortedArray.comparing("name", []);
      return async.readDir(dir).then((function(_this) {
        return function(paths) {
          var ignoredErrors;
          ignoredErrors = ["Could not find 'lotus-config' file!"];
          return async.all(sync.map(paths, function(path) {
            var error, module;
            try {
              module = Module(path);
            } catch (_error) {
              error = _error;
              return;
            }
            return async["try"](function() {
              return module.initialize();
            }).then(function() {
              return newModules.insert(module);
            }).fail(function(error) {
              module._delete();
              if (inArray(ignoredErrors, error.message)) {
                return;
              }
              return log.moat(1).white("Module error: ").red(path).moat(0).gray((log.isVerbose ? error.stack : error.message)).moat(1);
            });
          }));
        };
      })(this)).then(function() {
        return newModules.array;
      });
    },
    forFile: function(path) {
      var name;
      path = relative(lotus.path, path);
      name = path.slice(0, path.indexOf("/"));
      return Module.cache[name];
    },
    fromJSON: function(json) {
      var config, dependencies, dependers, files, module, name;
      name = json.name, files = json.files, dependers = json.dependers, dependencies = json.dependencies, config = json.config;
      module = Module.cache[name];
      if (module == null) {
        module = Module(name);
      }
      module._initializing = async.fulfill();
      module.config = Config.fromJSON(config.path, config.json);
      module.dependencies = dependencies;
      module.files = sync.reduce(files, {}, function(files, path) {
        path = resolve(module.path, path);
        files[path] = File(path, module);
        return files;
      });
      return {
        module: module,
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
      this.config = Config(this.path);
      return this._initializing = async.all([this._loadVersions(), this._loadDependencies()]).then((function(_this) {
        return function() {
          return _this._loadPlugins();
        };
      })(this));
    },
    watch: function(pattern) {
      var promise;
      pattern = join(this.path, pattern);
      pattern = relative(process.cwd(), pattern);
      promise = this._fs.adding || async.fulfill();
      return this._fs.adding = promise.then((function(_this) {
        return function() {
          var deferred;
          deferred = async.defer();
          _this._fs.add(pattern);
          _this._fs.once("ready", function() {
            var module, newFiles, watched;
            module = _this;
            watched = _this._fs.paths;
            newFiles = sync.reduce(_this._fs.watched(), {}, function(newFiles, paths, dir) {
              sync.each(paths, function(path) {
                if (has(watched, path)) {
                  return;
                }
                if (!sync.isFile(path)) {
                  return;
                }
                newFiles[path] = File(path, module);
                return watched[path] = true;
              });
              return newFiles;
            });
            return deferred.resolve(newFiles);
          });
          return deferred.promise;
        };
      })(this));
    },
    toJSON: function() {
      var config, dependers, files;
      if (this.error != null) {
        log.moat(1).red(module.name).white(" threw an error: ").gray(this.error.message).moat(1);
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
      if (event === "renamed") {
        event = "added";
      }
      if (event === "added") {
        if (!sync.isFile(path)) {
          return;
        }
      } else {
        if (!has(this.files, path)) {
          return;
        }
      }
      file = File(path, this);
      if (event === "deleted") {
        file["delete"]();
      }
      return Module._emitter.emit("file event", {
        file: file,
        event: event
      });
    },
    _delete: function() {
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
