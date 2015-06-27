(function() {
  var Config, File, Gaze, Module, NamedFunction, SemVer, _formatError, _printError, _printOrigin, basename, color, define, getType, io, isAbsolute, isKind, join, ln, log, lotus, merge, plural, ref, ref1, ref2, relative, resolve,
    slice = [].slice;

  lotus = require("../../../lotus-require");

  ref = require("path"), join = ref.join, relative = ref.relative, resolve = ref.resolve, basename = ref.basename, isAbsolute = ref.isAbsolute;

  SemVer = require("semver");

  define = require("define");

  NamedFunction = require("named-function");

  io = require("io");

  ref1 = require("type-utils"), getType = ref1.getType, isKind = ref1.isKind;

  ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

  Gaze = require("gaze").Gaze;

  merge = require("merge");

  plural = require("plural");

  Config = require("./config");

  File = require("./file");

  Module = NamedFunction("Module", function(name) {
    var module;
    if ((module = Module.cache[name]) != null) {
      return module;
    }
    if (!isKind(this, Module)) {
      return new Module(name);
    }
    if (isAbsolute(name)) {
      this.path = name;
      this.name = basename(name);
    } else {
      this.name = name;
      this.path = resolve(name);
    }
    this.files = {};
    this.versions = {};
    this.dependers = {};
    this.dependencies = {};
    this.isInitialized = false;
    if (io.isDir.sync(this.path)) {
      if (log.isDebug && log.isVerbose) {
        log.moat(1);
        log("Module created: ");
        log.blue(this.name);
        log.moat(1);
      }
      Module.cache[this.name] = this;
    } else {
      this.error = Error("'module.path' must be a directory.");
    }
    return this;
  });

  define(Module, function() {
    this.options = {
      configurable: false
    };
    return this({
      cache: {
        value: {}
      },
      initialize: function() {
        var moduleCount;
        moduleCount = 0;
        return io.readDir(lotus.path).then((function(_this) {
          return function(paths) {
            return io.each(paths, function(path) {
              var module;
              module = Module(join(lotus.path, path));
              return io.isDir(module.path).then(function(isDir) {
                if (isDir) {
                  return module.initialize();
                }
                return io["throw"]({
                  fatal: false,
                  error: Error("'" + module.path + "' is not a directory."),
                  code: "NOT_A_DIRECTORY",
                  format: merge(_formatError(), {
                    repl: {
                      module: module,
                      Module: Module
                    }
                  })
                });
              }).then(function() {
                return moduleCount++;
              }).fail(function(error) {
                io["catch"](error);
                module._delete();
                if (log.isDebug) {
                  return _printError(module.name, error);
                }
              });
            });
          };
        })(this)).then(function() {
          if (log.isDebug) {
            log.moat(1);
            _printOrigin();
            log.yellow("" + moduleCount);
            log(" modules were initialized!");
            return log.moat(1);
          }
        });
      }
    });
  });

  define(Module.prototype, function() {
    this.options = {
      configurable: false,
      writable: false
    };
    this({
      initialize: function() {
        var error;
        if (this.isInitialized) {
          return io.fulfill();
        }
        this.isInitialized = true;
        try {
          this.config = Config(this.path);
        } catch (_error) {
          error = _error;
          return io.reject(error);
        }
        return io.all([this._loadVersions(), this._loadDependencies()]).then((function(_this) {
          return function() {
            return _this.config.loadPlugins(function(plugin, options) {
              return io.resolve(plugin(_this, options));
            });
          };
        })(this));
      }
    });
    this.enumerable = false;
    return this({
      _watchFiles: function(options) {
        var deferred, gaze, pattern;
        deferred = io.defer();
        pattern = join(this.path, options.pattern);
        gaze = new Gaze(pattern);
        gaze.on("ready", (function(_this) {
          return function() {
            var files, paths, result, watched;
            watched = gaze.watched();
            paths = Object.keys(watched);
            paths = io.reduce.sync(paths, [], function(paths, dir) {
              return paths.concat(io.filter.sync(watched[dir], function(path) {
                return io.isFile.sync(path);
              }));
            });
            files = io.reduce.sync(paths, {}, function(files, path) {
              files[path] = File(path, _this);
              return files;
            });
            result = {
              pattern: pattern,
              files: files,
              watcher: gaze
            };
            deferred.resolve(result);
            if (typeof options.onReady === "function") {
              options.onReady(result);
            }
            return gaze.on("all", function(event, path) {
              var enqueue, eventQueue, file, isDeleted;
              if (!io.isFile.sync(path)) {
                return;
              }
              isDeleted = false;
              file = File(path, _this);
              eventQueue = file.eventQueue || io.fulfill();
              enqueue = function() {
                var args, callback;
                callback = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
                if (!isKind(callback, Function)) {
                  return false;
                }
                eventQueue = io.when(eventQueue, function() {
                  return callback.apply(null, [file].concat(args));
                });
                return enqueue.wasCalled = true;
              };
              if (event === "added") {
                enqueue(options.onCreate);
              } else if (event === "changed") {
                enqueue(options.onChange);
              } else if (event === "deleted") {
                isDeleted = true;
                delete _this.files[path];
                if (isKind(options.onDelete, Function)) {
                  enqueue(options.onDelete);
                  addErrorHandler();
                }
              } else {
                throw Error("Unhandled file event: '" + event + "'");
              }
              if (!isDeleted) {
                enqueue(options.onSave);
              }
              enqueue(options.onEvent, event);
              if (enqueue.wasCalled) {
                eventQueue = eventQueue.fail(function(error) {
                  return io["catch"](error, function() {
                    return log.error(error);
                  });
                });
              }
              return file.eventQueue = eventQueue;
            });
          };
        })(this));
        return deferred.promise;
      },
      _delete: function() {
        return delete Module.cache[this.name];
      },
      _loadDependencies: function() {
        var depCount, depDirPath, moduleJson, moduleJsonPath;
        depCount = 0;
        depDirPath = join(this.path, "node_modules");
        moduleJsonPath = join(this.path, "package.json");
        moduleJson = null;
        return io.isFile(moduleJsonPath).then((function(_this) {
          return function(isFile) {
            if (isFile) {
              moduleJson = require(moduleJsonPath);
              return io.isDir(depDirPath);
            }
            return io["throw"]({
              fatal: false,
              error: Error("'" + moduleJsonPath + "' is not a file."),
              code: "PACKAGE_JSON_NOT_A_FILE",
              format: function() {
                return {
                  repl: {
                    module: _this,
                    Module: Module
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(isDir) {
            if (isDir) {
              return io.readDir(depDirPath);
            }
            return io["throw"]({
              fatal: false,
              error: Error("'" + depDirPath + "' is not a directory."),
              code: "NODE_MODULES_NOT_A_DIRECTORY",
              format: function() {
                return {
                  repl: {
                    module: dep,
                    Module: Module
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(paths) {
            return io.each(paths, function(path, i) {
              var dep, depJsonPath, ref3;
              if (path[0] === ".") {
                return;
              }
              if (((ref3 = moduleJson.devDependencies) != null ? ref3[path] : void 0) != null) {
                return;
              }
              dep = Module(path);
              depJsonPath = join(dep.path, "package.json");
              return io.isDir(dep.path).then(function(isDir) {
                if (isDir) {
                  return io.isFile(depJsonPath);
                }
                return io["throw"]({
                  fatal: false,
                  error: Error("'" + dep.path + "' is not a directory."),
                  code: "NOT_A_DIRECTORY",
                  format: function() {
                    return {
                      repl: {
                        module: dep,
                        Module: Module
                      }
                    };
                  }
                });
              }).then(function(isFile) {
                if (isFile) {
                  return io.read(depJsonPath);
                }
                return io["throw"]({
                  fatal: false,
                  error: Error("'depJsonPath' is not a file."),
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
                return io.stat(dep.path).then(function(stats) {
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
                  log.moat(1);
                  _printOrigin();
                  log.yellow(_this.name);
                  log(" depends on ");
                  log.yellow(dep.name);
                  return log.moat(1);
                }
              }).fail(function(error) {
                io["catch"](error);
                dep._delete();
                if (log.isDebug) {
                  return _printError(_this.name, error);
                }
              });
            });
          };
        })(this));
      },
      _loadVersions: function() {
        var tagDirPath, versionCount;
        versionCount = 0;
        tagDirPath = join(this.path, ".git/refs/tags");
        return io.isDir(tagDirPath).then((function(_this) {
          return function(isDir) {
            if (isDir) {
              return io.readDir(tagDirPath);
            }
            return io["throw"]({
              fatal: false,
              error: Error("'" + tagDirPath + "' is not a directory."),
              format: function() {
                return {
                  repl: {
                    module: _this,
                    Module: Module
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(paths) {
            return io.each(paths, function(tag, i) {
              if (!SemVer.valid(tag)) {
                return;
              }
              return io.stat(join(tagDirPath, tag)).then(function(stats) {
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
              log.moat(1);
              _printOrigin();
              log.yellow(relative(lotus.path, _this.path));
              log(" loaded ");
              log.yellow(versionCount);
              log(" ", plural("version", versionCount));
              return log.moat(1);
            }
          };
        })(this));
      }
    });
  });

  exports.initialize = function() {
    File = File.initialize(Module);
    exports.initialize = function() {
      return Module;
    };
    return exports.Module = Module;
  };

  _printOrigin = function() {
    return log.gray.dim("lotus/module ");
  };

  _printError = function(moduleName, error) {
    log.moat(1);
    _printOrigin();
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

}).call(this);

//# sourceMappingURL=map/module.js.map
