(function() {
  var Config, File, Gaze, NamedFunction, Package, SemVer, basename, color, define, each, exports, filter, formatError, io, isAbsolute, isDir, isFile, join, ln, log, merge, read, readDir, reduce, ref, ref1, ref2, resolve;

  ref = require("path"), join = ref.join, resolve = ref.resolve, basename = ref.basename, isAbsolute = ref.isAbsolute;

  SemVer = require("semver");

  define = require("define");

  NamedFunction = require("named-function");

  ref1 = require("io"), io = ref1.io, each = ref1.each, filter = ref1.filter, reduce = ref1.reduce, read = ref1.read, readDir = ref1.readDir, isDir = ref1.isDir, isFile = ref1.isFile;

  ref2 = require("lotus-log"), log = ref2.log, color = ref2.color, ln = ref2.ln;

  Gaze = require("gaze").Gaze;

  merge = require("merge");

  File = require("./file");

  Config = require("./config");

  Package = exports = NamedFunction("Package", function(name) {
    var pkg;
    if ((pkg = Package.cache[name]) != null) {
      return pkg;
    }
    if (!(this instanceof Package)) {
      return new Package(name);
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
    return Package.cache[this.name] = this;
  });

  define(module, function() {
    this.options = {
      configurable: false
    };
    return this({
      exports: exports
    });
  });

  define(Package, function() {
    this.options = {
      configurable: false
    };
    return this({
      cache: {
        value: {}
      },
      startup: function() {
        var dir, pkgCount;
        dir = process.env.LOTUS_PATH;
        log.moat(1);
        log("Reading packages from ");
        log.yellow(dir);
        log("...");
        log.moat(1);
        pkgCount = 0;
        return readDir(dir).then((function(_this) {
          return function(paths) {
            paths = paths.slice(0, 8);
            return each(paths, function(path, i, done) {
              var pkg;
              pkg = Package(join(dir, path));
              return isDir(pkg.path).then(function(isDir) {
                if (isDir) {
                  return pkg.initialize();
                }
                return log["throw"]({
                  error: Error("'@culprit' is not a directory."),
                  culprit: pkg.path,
                  fatal: false,
                  format: function() {
                    var opts;
                    opts = formatError();
                    if (opts.repl !== false) {
                      opts.repl = merge(opts.repl, {
                        pkg: pkg,
                        Package: Package
                      });
                    }
                    return opts;
                  }
                });
              }).then(function() {
                pkgCount++;
                return pkg._log("finished initialization.", "green");
              }).fail(function(error) {
                if (error.fatal !== false) {
                  throw error;
                }
                pkg._delete();
                if (log.isVerbose && log.isDebug) {
                  return pkg._log(error.message, "red");
                }
              }).fin(done).done();
            }).then(function() {
              log.moat(1);
              log.green.dim("Found ");
              log.green("" + pkgCount);
              log.green.dim(" valid packages.");
              return log.moat(1);
            });
          };
        })(this));
      }
    });
  });

  define(Package.prototype, function() {
    this.options = {
      configurable: false,
      writable: false
    };
    this({
      initialize: function() {
        var error;
        if (this.isInitialized) {
          return io.resolved();
        }
        this.isInitialized = true;
        try {
          this.config = Config(this.path);
        } catch (_error) {
          error = _error;
          return io.rejected(error);
        }
        return io.all([this._loadVersions(), this._loadDependencies()]).then((function(_this) {
          return function() {
            return each.sync(_this.config.plugins, function(path, done) {
              var plugin;
              plugin = require(path);
              if (!(plugin instanceof Function)) {
                log["throw"]({
                  error: TypeError("'@culprit' failed to export a Function."),
                  culprit: path,
                  format: function() {
                    return {
                      repl: {
                        plugin: plugin
                      }
                    };
                  }
                });
              }
              return plugin(_this);
            });
          };
        })(this));
      }
    });
    this.enumerable = false;
    return this({
      initPlugin: function(handler) {},
      watchFiles: function(pattern, handler) {
        var deferred, gaze;
        deferred = io.defer();
        pattern = join(this.path, pattern);
        gaze = new Gaze(pattern);
        gaze.on("ready", (function(_this) {
          return function() {
            var files, paths, watched;
            watched = gaze.watched();
            paths = Object.keys(watched);
            paths = reduce.sync(paths, [], function(paths, dir) {
              return paths.concat(filter.sync(watched[dir], function(path) {
                return isFile.sync(path);
              }));
            });
            files = reduce.sync(paths, {}, function(files, path) {
              files[path] = _this.files[path] || (_this.files[path] = File(path, _this));
              return files;
            });
            deferred.resolve({
              pattern: pattern,
              files: files,
              watcher: gaze
            });
            return gaze.on("all", function(event, path) {
              if (!isFile.sync(path)) {
                return;
              }
              if (event === "added") {
                _this.files[path] = File(path, _this);
              }
              handler(event, _this.files[path]);
              if (event === "deleted") {
                return delete _this.files[path];
              }
            });
          };
        })(this));
        return deferred.promise;
      },
      _delete: function() {
        return delete Package.cache[this.name];
      },
      _log: function(message, color) {
        log.moat(1);
        log[color](this.name);
        log(" ");
        log[color].dim(message);
        return log.moat(1);
      },
      _loadDependencies: function() {
        var depCount, depDirPath, pkgJson, pkgJsonPath;
        depCount = 0;
        depDirPath = join(this.path, "node_modules");
        pkgJsonPath = join(this.path, "package.json");
        pkgJson = null;
        return isFile(pkgJsonPath).then((function(_this) {
          return function(isFile) {
            if (isFile) {
              return read(pkgJsonPath);
            }
            return log["throw"]({
              error: Error("'@culprit' is not a file."),
              culprit: pkgJsonPath,
              fatal: false,
              format: function() {
                return {
                  repl: {
                    pkg: _this,
                    Package: Package
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(pkgJsonRaw) {
            pkgJson = JSON.parse(pkgJsonRaw);
            return isDir(depDirPath);
          };
        })(this)).then((function(_this) {
          return function(isDir) {
            if (isDir) {
              return readDir(depDirPath);
            }
            return log["throw"]({
              error: Error("'@culprit' is not a directory."),
              culprit: depDirPath,
              fatal: false,
              format: function() {
                return {
                  repl: {
                    pkg: dep,
                    Package: Package
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(paths) {
            return each(paths, function(path, i, done) {
              var dep, depJsonPath;
              if ((path[0] === ".") || (pkgJson.devDependencies[path] != null)) {
                return done();
              }
              dep = Package(path);
              depJsonPath = join(dep.path, "package.json");
              return isDir(dep.path).then(function(isDir) {
                if (isDir) {
                  return isFile(depJsonPath);
                }
                return log["throw"]({
                  error: Error("'@culprit' is not a directory."),
                  culprit: dep.path,
                  fatal: false,
                  format: function() {
                    return {
                      repl: {
                        pkg: dep,
                        Package: Package
                      }
                    };
                  }
                });
              }).then(function(isFile) {
                if (isFile) {
                  return read(depJsonPath);
                }
                return log["throw"]({
                  error: Error("'@culprit' is not a file."),
                  culprit: depJsonPath,
                  fatal: false,
                  format: function() {
                    return {
                      repl: {
                        pkg: dep,
                        Package: Package
                      }
                    };
                  }
                });
              }).then(function(contents) {
                var json;
                json = JSON.parse(contents);
                return stat(dep.path).then(function(stats) {
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
                if (error.fatal !== false) {
                  throw error;
                }
                dep._delete();
                if (log.isVerbose && log.isDebug) {
                  return dep._log(error.message, "red");
                }
              }).fin(done).done();
            });
          };
        })(this)).then((function(_this) {
          return function() {
            return _this._log("loaded " + depCount + " dependencies!", "green");
          };
        })(this));
      },
      _loadVersions: function() {
        var tagDirPath, versionCount;
        versionCount = 0;
        tagDirPath = join(this.path, ".git/refs/tags");
        return isDir(tagDirPath).then((function(_this) {
          return function(isDir) {
            if (isDir) {
              return readDir(tagDirPath);
            }
            return log["throw"]({
              error: Error("'@culprit' is not a directory."),
              culprit: tagDirPath,
              fatal: false,
              format: function() {
                return {
                  repl: {
                    pkg: _this,
                    Package: Package
                  }
                };
              }
            });
          };
        })(this)).then((function(_this) {
          return function(paths) {
            return each(paths, function(tag, i, done) {
              if (!SemVer.valid(tag)) {
                return done();
              }
              return stat(join(tagDirPath, tag)).then(function(stats) {
                versionCount++;
                _this.versions[tag] = {
                  lastModified: stats.node.mtime
                };
                return done();
              }).done();
            });
          };
        })(this)).then((function(_this) {
          return function() {
            return _this._log("loaded " + versionCount + " versions!", "green");
          };
        })(this));
      }
    });
  });

  formatError = function() {
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

//# sourceMappingURL=map/package.js.map
