var Config, EventEmitter, Gaze, NamedFunction, SemVer, async, basename, color, combine, define, dirname, getType, has, inArray, isAbsolute, isKind, isType, join, ln, log, lotus, mm, noop, plural, ref, ref1, ref2, ref3, relative, resolve, setType, sync;

lotus = require("lotus-require");

ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, dirname = ref.dirname, basename = ref.basename, isAbsolute = ref.isAbsolute;

ref1 = require("type-utils"), getType = ref1.getType, setType = ref1.setType, isKind = ref1.isKind, isType = ref1.isType;

ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

EventEmitter = require("events").EventEmitter;

ref3 = require("io"), sync = ref3.sync, async = ref3.async;

Gaze = require("gaze").Gaze;

NamedFunction = require("named-function");

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
  if (has(Module.cache, name)) {
    return Module.cache[name];
  }
  if ((name[0] === "/") || (name.slice(0, 2) === "./")) {
    async["throw"]({
      error: Error("'name' cannot start with a '.' or '/' character"),
      format: {
        repl: {
          name: name
        }
      }
    });
  }
  path = resolve(name);
  if (!sync.isDir(path)) {
    throw Error("'" + path + "' must be a directory.");
  }
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
    initialize: function() {
      var moduleCount;
      moduleCount = 0;
      return async.readDir(lotus.path).then((function(_this) {
        return function(paths) {
          return async.all(sync.map(paths, function(path) {
            var module;
            try {
              module = Module(path);
            } catch (_error) {}
            if (module == null) {
              return;
            }
            return module.initialize().then(function() {
              return moduleCount++;
            }).fail(function(error) {
              return module._onError(error);
            });
          }));
        };
      })(this)).then(function() {
        return log.moat(1).yellow(moduleCount).white(" modules were initialized!").moat(1);
      });
    },
    forFile: function(path) {
      var name;
      path = relative(lotus.path, path);
      name = path.slice(0, path.indexOf("/"));
      if (!has(Module.cache, name)) {
        return null;
      }
      return Module(name);
    },
    fromJSON: function(json) {
      var config, dependencies, dependers, files, module, name;
      name = json.name, files = json.files, dependers = json.dependers, dependencies = json.dependencies, config = json.config;
      module = Module(name);
      if (module.error != null) {
        delete Module.cache[name];
        throw module.error;
      }
      module._initializing = async.fulfill();
      module.config = Config.fromJSON(config.path, config.json);
      module.dependencies = dependencies;
      return async.reduce(files, {}, function(files, path) {
        path = resolve(module.path, path);
        files[path] = File(path, module);
        return files;
      }).then(function(files) {
        module.files = files;
        return async.reduce(dependers, {}, function(dependers, name) {
          dependers[name] = Module(name);
          return dependers;
        }).then(function(dependers) {
          return module.dependers = dependers;
        });
      }).then(function() {
        module._loadPlugins().done();
        return module;
      });
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
      var error;
      if (this._initializing) {
        return this._initializing;
      }
      try {
        this.config = Config(this.path);
      } catch (_error) {
        error = _error;
        log.moat(1).red(this.path).moat(0).white(error.message).moat(1);
        this._delete();
        error.fatal = false;
        return async.reject(error);
      }
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
      if (log.isVerbose) {
        log.moat(1);
        log("Module deleted: ");
        log.red(this.name);
        log.moat(1);
      }
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
          if (error.fatal !== false) {
            throw error;
          }
          return log.moat(1).yellow(_this.name).white(" has no plugins.").moat(1);
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
          if (isFile) {
            moduleJson = require(moduleJsonPath);
            return async.isDir(depDirPath);
          }
          _this._delete();
          return async["throw"]({
            fatal: false,
            error: Error("'" + moduleJsonPath + "' is not a file."),
            code: "PACKAGE_JSON_NOT_A_FILE",
            format: function() {
              return {
                repl: {
                  _module: _this,
                  Module: Module
                }
              };
            }
          });
        };
      })(this)).then((function(_this) {
        return function(isDir) {
          if (isDir) {
            return async.readDir(depDirPath);
          }
          return async["throw"]({
            fatal: false,
            error: Error("'" + depDirPath + "' is not a directory."),
            code: "NODE_MODULES_NOT_A_DIRECTORY",
            format: function() {
              return {
                repl: {
                  _module: dep,
                  Module: Module
                }
              };
            }
          });
        };
      })(this)).then((function(_this) {
        return function(paths) {
          return async.each(paths, function(path, i) {
            var dep, depJsonPath, ref4;
            if (path[0] === ".") {
              return;
            }
            if (((ref4 = moduleJson.devDependencies) != null ? ref4[path] : void 0) != null) {
              return;
            }
            try {
              dep = Module(path);
            } catch (_error) {}
            if (dep == null) {
              return;
            }
            depJsonPath = join(dep.path, "package.json");
            return async.isDir(dep.path).then(function(isDir) {
              if (isDir) {
                return async.isFile(depJsonPath);
              }
              dep._delete();
              return async["throw"]({
                fatal: false,
                error: Error("'" + dep.path + "' is not a directory."),
                code: "NOT_A_DIRECTORY",
                format: function() {
                  return {
                    repl: {
                      _module: dep,
                      Module: Module
                    }
                  };
                }
              });
            }).then(function(isFile) {
              if (isFile) {
                return async.read(depJsonPath);
              }
              dep._delete();
              return async["throw"]({
                fatal: false,
                error: Error("'" + depJsonPath + "' is not a file."),
                code: "PACKAGE_JSON_NOT_A_FILE",
                format: function() {
                  return {
                    repl: {
                      module: dep,
                      Module: Module
                    }
                  };
                }
              });
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
              return dep._onError(error);
            });
          });
        };
      })(this)).fail((function(_this) {
        return function(error) {
          return _this._onError(error);
        };
      })(this));
    },
    _loadVersions: function() {
      var tagDirPath, versionCount;
      versionCount = 0;
      tagDirPath = join(this.path, ".git/refs/tags");
      return async.isDir(tagDirPath).then((function(_this) {
        return function(isDir) {
          if (isDir) {
            return async.readDir(tagDirPath);
          }
          return async["throw"]({
            fatal: false,
            error: Error("'" + tagDirPath + "' is not a directory."),
            format: function() {
              return {
                repl: {
                  _module: _this,
                  Module: Module
                }
              };
            }
          });
        };
      })(this)).then((function(_this) {
        return function(paths) {
          return async.each(paths, function(tag, i) {
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
      })(this)).then((function(_this) {
        return function() {
          if (log.isDebug) {
            log.origin("lotus/module");
            log.yellow(relative(lotus.path, _this.path));
            log(" loaded ");
            log.yellow(versionCount);
            log(" ", plural("version", versionCount));
            return log.moat(1);
          }
        };
      })(this));
    },
    _onError: function(error) {
      if (inArray(Module._ignoredErrorCodes, error.code)) {
        return;
      }
      return async["catch"](error);
    }
  });
});

//# sourceMappingURL=../../map/src/module.map
