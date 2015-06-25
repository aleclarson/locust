(function() {
  var Finder, NamedFunction, Stream, basename, define, dirname, io, isAbsolute, isKind, join, log, lotus, plural, ref, relative, spawn,
    slice = [].slice;

  lotus = require("../../../lotus-require");

  io = require("io");

  log = require("lotus-log");

  Finder = require("finder");

  define = require("define");

  plural = require("plural");

  Stream = require("stream");

  NamedFunction = require("named-function");

  isKind = require("type-utils").isKind;

  spawn = require("child_process").spawn;

  ref = require("path"), join = ref.join, isAbsolute = ref.isAbsolute, dirname = ref.dirname, basename = ref.basename, relative = ref.relative;

  exports.initialize = function(Module) {
    var File, _findDepPath, _missingDep, _printOrigin, _unshiftContext;
    delete exports.initialize;
    File = exports.File = NamedFunction("File", function(path, module) {
      var file;
      if ((file = module.files[path]) != null) {
        if (log.isDebug && log.isVerbose) {
          log.moat(1);
          log("File already exists: ");
          log.red(relative(process.env.LOTUS_PATH, file.path));
          log.moat(1);
        }
        return file;
      }
      if (!isKind(this, File)) {
        return new File(path, module);
      }
      if (!isAbsolute(path)) {
        throw Error("'path' must be absolute.");
      }
      if (!io.isFile.sync(path)) {
        throw Error("'path' must be an existing file.");
      }
      if (log.isDebug && log.isVerbose) {
        log.moat(1);
        log("File created: ");
        log.blue(relative(process.env.LOTUS_PATH, path));
        log.moat(1);
      }
      module.files[path] = this;
      return define(this, function() {
        this.options = {};
        this.configurable = false;
        this({
          isInitialized: false
        });
        this.writable = false;
        return this({
          module: module,
          path: path,
          dependers: {
            value: {}
          },
          dependencies: {
            value: {}
          }
        });
      });
    });
    define(File.prototype, function() {
      this.options = {
        configurable: false,
        writable: false
      };
      this({
        initialize: function() {
          if (this.isInitialized) {
            return io.fulfill();
          }
          this.isInitialized = true;
          return io.all([this._loadLastModified(), this._loadDeps()]);
        }
      });
      this.enumerable = false;
      return this({
        _loadLastModified: function() {
          return io.stat(this.path).then((function(_this) {
            return function(stats) {
              return _this.lastModified = stats.node.mtime;
            };
          })(this));
        },
        _loadDeps: function() {
          return io.read(this.path).then((function(_this) {
            return function(contents) {
              return _this._parseDeps(contents);
            };
          })(this));
        },
        _parseDeps: function(contents) {
          var depPaths;
          depPaths = _findDepPath.all(contents);
          if (log.isDebug) {
            log.moat(1);
            _printOrigin();
            log.yellow(relative(lotus.path, this.path));
            log(" has ");
            log.yellow(depPaths.length);
            log(" ", plural("dependency", depPaths.length));
            log.moat(1);
          }
          return io.each(depPaths, (function(_this) {
            return function(depPath) {
              return _this._loadDep(depPath).then(function(dep) {
                if (dep == null) {
                  return;
                }
                if (dep.module !== _this.module && !_this.module.dependencies.hasOwnProperty(dep.module.name)) {
                  return _missingDep(_this.module, dep.module);
                } else {
                  _this.dependencies[dep.path] = dep;
                  return dep.dependers[_this.path] = _this;
                }
              });
            };
          })(this));
        },
        _loadDep: function(depPath) {
          var depDir, depFile;
          depFile = module.abs(depPath, dirname(this.path));
          if (depFile === null) {
            return io.fulfill();
          }
          if (log.isDebug) {
            log.moat(1);
            _printOrigin();
            log.yellow(relative(lotus.path, this.path));
            log(" depends on ");
            log.yellow(relative(lotus.path, depFile));
            log.moat(1);
          }
          if (depPath[0] !== "/" && depPath[0] !== ".") {
            return io.fulfill(File(depFile, Module(depPath)));
          }
          depDir = depFile;
          return io.loop((function(_this) {
            return function(done) {
              var newDepDir, requiredJson;
              newDepDir = dirname(depDir);
              if (newDepDir === ".") {
                return done(depDir);
              }
              depDir = newDepDir;
              requiredJson = join(depDir, "package.json");
              return io.isFile(requiredJson).then(function(isFile) {
                if (!isFile) {
                  return;
                }
                return done(basename(depDir));
              });
            };
          })(this)).then((function(_this) {
            return function(module) {
              return File(depFile, Module(module));
            };
          })(this));
        }
      });
    });
    _findDepPath = Finder({
      regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g,
      group: 3
    });
    _printOrigin = function() {
      return log.gray.dim("lotus/file ");
    };
    _unshiftContext = function(fn) {
      return function() {
        var args, context;
        context = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
        return fn.apply(context, args);
      };
    };
    _missingDep = _unshiftContext(function(dep) {
      var answer, deferred, installer;
      if (!isKind(this, Module)) {
        throw TypeError("'this' must be a Lotus.Module");
      }
      if (!isKind(dep, Module)) {
        throw TypeError("'dep' must be a Lotus.Module");
      }
      log.moat(1);
      _printOrigin();
      log.yellow(this.name, " ");
      log.bgRed.white("Error");
      log(": ");
      log.yellow(dep.name);
      log(" isn't saved as a dependency.");
      log.moat(1);
      answer = log.prompt.sync({
        label: function() {
          return log.withIndent(2, function() {
            return log.blue("npm install --save ");
          });
        }
      });
      log.moat(1);
      if (answer != null) {
        deferred = io.defer();
        installer = spawn("npm", ["install", "--save", answer], {
          stdio: ["ignore", "ignore", "ignore"],
          cwd: this.path
        });
        installer.on("exit", deferred.resolve);
        return deferred.promise;
      }
    });
    return File;
  };

}).call(this);

//# sourceMappingURL=map/file.js.map
