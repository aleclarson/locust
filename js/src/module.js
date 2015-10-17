var Config, EventEmitter, File, Gaze, Module, NamedFunction, SemVer, _formatError, _printError, async, basename, color, combine, define, dirname, getType, has, inArray, isAbsolute, isInitialized, isKind, isType, join, ln, log, lotus, mm, noop, plural, ref, ref1, ref2, ref3, relative, resolve, sync,
  slice = [].slice;

lotus = require("lotus-require");

ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, dirname = ref.dirname, basename = ref.basename, isAbsolute = ref.isAbsolute;

ref1 = require("type-utils"), getType = ref1.getType, isKind = ref1.isKind, isType = ref1.isType;

ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

EventEmitter = require("events").EventEmitter;

ref3 = require("io"), sync = ref3.sync, async = ref3.async;

NamedFunction = require("named-function");

Gaze = require("gaze").Gaze;

combine = require("combine");

inArray = require("in-array");

SemVer = require("semver");

define = require("define");

plural = require("plural");

noop = require("no-op");

has = require("has");

mm = require("micromatch");

Config = require("./config");

File = require("./file");

Module = NamedFunction("Module", function(name) {
  var _reportedMissing, dependencies, dependers, error, files, isInitialized, path, versions;
  if (has(Module.cache, name)) {
    return Module.cache[name];
  }
  if (!isKind(this, Module)) {
    return new Module(name);
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
  if (sync.isDir(path)) {
    if (log.isVerbose) {
      log.moat(1);
      log("Module created: ");
      log.blue(name);
      log.moat(1);
    }
    Module.cache[name] = this;
  } else {
    error = Error("'" + path + "' must be a directory.");
  }
  isInitialized = false;
  files = {
    value: {}
  };
  versions = {
    value: {}
  };
  dependers = {
    value: {}
  };
  dependencies = {
    value: {}
  };
  _reportedMissing = {
    value: {}
  };
  define(this, function() {
    this.options = {
      enumerable: false
    };
    return this({
      _reportedMissing: _reportedMissing
    });
  });
  return define(this, {
    name: name,
    path: path,
    isInitialized: isInitialized,
    files: files,
    versions: versions,
    dependers: dependers,
    dependencies: dependencies,
    error: error
  });
});

define(Module, function() {
  this.options = {
    configurable: false
  };
  this({
    cache: {
      value: Object.create(null)
    },
    initialize: function() {
      var moduleCount;
      moduleCount = 0;
      return async.readDir(lotus.path).then((function(_this) {
        return function(paths) {
          return async.each(paths, function(path) {
            var _module;
            _module = Module(path);
            return async.isDir(_module.path).then(function(isDir) {
              if (isDir) {
                return _module.initialize();
              }
              _module._delete();
              return async["throw"]({
                fatal: false,
                error: Error("'" + _module.path + "' is not a directory."),
                code: "NOT_A_DIRECTORY",
                format: combine(_formatError(), {
                  repl: {
                    _module: _module,
                    Module: Module
                  }
                })
              });
            }).then(function() {
              return moduleCount++;
            }).fail(function(error) {
              return _module._onError(error);
            });
          });
        };
      })(this)).then(function() {
        if (log.isDebug) {
          log.origin("lotus/module");
          log.yellow("" + moduleCount);
          log(" modules were initialized!");
          return log.moat(1);
        }
      });
    },
    forFile: function(path) {
      var name;
      path = relative(lotus.path, path);
      name = dirname(path.slice(0, -1 + path.indexOf("/")));
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
      module.isInitialized = true;
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
        module._loadPlugins();
        return module;
      });
    }
  });
  this.enumerable = false;
  return this({
    _emitter: new EventEmitter,
    _watchFiles: function(options, callback) {
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
    }
  });
});

define(Module.prototype, function() {
  this.options = {
    frozen: true
  };
  this({
    initialize: function() {
      if (this.isInitialized) {
        return async.fulfill();
      }
      this.isInitialized = true;
      this.config = Config(this.path);
      return async.all([this._loadVersions(), this._loadDependencies()]).then((function(_this) {
        return function() {
          return _this._loadPlugins();
        };
      })(this));
    },
    toJSON: function() {
      var config, dependers, files;
      if (this.error != null) {
        if (log.isVerbose) {
          log.moat(1);
          log("'" + module.name + "' threw an error: ");
          log(this.error.message);
          log.moat(1);
        }
        return false;
      }
      if (this.config == null) {
        if (log.isVerbose) {
          log.moat(1);
          log("'" + this.name + "' has no config file");
          log.moat(1);
        }
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
    _watchFiles: function(options) {
      var deferred, gaze, pattern;
      deferred = async.defer();
      pattern = join(this.path, options.pattern);
      pattern = relative(process.cwd(), pattern);
      gaze = new Gaze(pattern);
      log.origin("lotus/module");
      log.green("watching ");
      log.yellow(pattern);
      log.moat(1);
      gaze.once("ready", (function(_this) {
        return function() {
          var files, paths, result, watched;
          watched = gaze.watched();
          paths = Object.keys(watched);
          paths = sync.reduce(paths, [], function(paths, dir) {
            return paths.concat(sync.filter(watched[dir], function(path) {
              return sync.isFile(path);
            }));
          });
          files = sync.reduce(paths, {}, function(files, path) {
            files[path] = File(path, _this);
            return files;
          });
          result = {
            pattern: pattern,
            files: files,
            watcher: gaze
          };
          deferred.resolve(result);
          if (typeof options.onStartup === "function") {
            options.onStartup(result);
          }
          if (isKind(options.onReady, Function)) {
            return async.each(files, function(file) {
              log.origin("lotus/module");
              log.cyan("ready ");
              log.yellow(relative(process.cwd(), file.path));
              log.moat(1);
              return options.onReady(file);
            });
          }
        };
      })(this));
      gaze.on("all", (function(_this) {
        return function(event, path) {
          var file, isValid;
          if (event === "renamed") {
            event = "added";
          }
          isValid = event === "added" ? sync.isFile(path) : _this.files[path] != null;
          if (!isValid) {
            return;
          }
          file = File(path, _this);
          return _this._onFileEvent(event, file, options);
        };
      })(this));
      return deferred.promise;
    },
    _onFileEvent: (function(_this) {
      return function(event, file, options) {
        var enqueue, eventQueue, isDeleted;
        log.origin("lotus/module");
        log.cyan(event);
        log(" ");
        log.yellow(relative(process.cwd(), file.path));
        log.moat(1);
        isDeleted = false;
        eventQueue = file.eventQueue || async.fulfill();
        enqueue = function() {
          var args, callback;
          callback = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
          if (!isKind(callback, Function)) {
            return false;
          }
          eventQueue = async.when(eventQueue, function() {
            return callback.apply(null, [file].concat(args));
          });
          return enqueue.wasCalled = true;
        };
        switch (event) {
          case "added":
            enqueue(options.onReady);
            enqueue(options.onCreate);
            break;
          case "changed":
            enqueue(options.onChange);
            break;
          case "deleted":
            isDeleted = true;
            file["delete"]();
            enqueue(options.onDelete);
            break;
          default:
            throw Error("Unhandled file event: '" + event + "'");
        }
        if (!isDeleted) {
          enqueue(options.onSave);
        }
        enqueue(options.onEvent, event);
        Module._emitter.emit("file event", {
          file: file,
          event: event
        });
        if (enqueue.wasCalled) {
          eventQueue = eventQueue.fail(function(error) {
            return async["catch"](error, function() {
              return log.error(error);
            });
          });
        }
        return file.eventQueue = eventQueue;
      };
    })(this),
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
      return this.config.loadPlugins((function(_this) {
        return function(plugin, options) {
          return async["try"](function() {
            return plugin(_this, options);
          });
        };
      })(this)).fail((function(_this) {
        return function(error) {
          if (error.fatal) {
            throw error;
          }
          log.origin("lotus/module");
          log.yellow(_this.name);
          log(" has no plugins.");
          return log.moat(1);
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
            dep = Module(path);
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
      })(this)).then((function(_this) {
        return function() {
          if (log.isVerbose) {
            log.moat(1);
            log("Module '" + _this.name + "' loaded " + depCount + " dependencies");
            return log.moat(1);
          }
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
      async["catch"](error);
      if (log.isDebug && (log.isVerbose || !inArray(Module._ignoredErrorCodes, error.code))) {
        return _printError(this.name, error);
      }
    }
  });
});

isInitialized = false;

define(exports, {
  initialize: function() {
    if (!isInitialized) {
      isInitialized = true;
      File = File.initialize(Module);
    }
    return Module;
  }
});

_printError = function(moduleName, error) {
  log.origin("lotus/module");
  log.yellow(moduleName);
  log(" ");
  log.bgRed.white(getType(error).name);
  log(": ");
  log(error.message);
  return log.moat(1);
};

_formatError = function() {
  return {
    stack: {
      exclude: ["**/lotus-require/src/**", "**/q/q.js", "**/nimble/nimble.js"],
      filter: function(frame) {
        return !frame.isNative() && !frame.isNode();
      }
    }
  };
};

//# sourceMappingURL=../../map/src/module.map
