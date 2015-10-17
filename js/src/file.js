var File, Finder, Module, NODE_PATHS, NamedFunction, _findDepPath, _installMissing, _unshiftContext, async, basename, define, dirname, inArray, isAbsolute, isInitialized, isKind, join, log, lotus, plural, ref, ref1, relative, spawn, sync,
  slice = [].slice;

lotus = require("lotus-require");

ref = require("path"), join = ref.join, isAbsolute = ref.isAbsolute, dirname = ref.dirname, basename = ref.basename, relative = ref.relative;

ref1 = require("io"), async = ref1.async, sync = ref1.sync;

NamedFunction = require("named-function");

NODE_PATHS = require("node-paths");

isKind = require("type-utils").isKind;

spawn = require("child_process").spawn;

inArray = require("in-array");

Finder = require("finder");

define = require("define");

plural = require("plural");

log = require("lotus-log");

Module = null;

File = NamedFunction("File", function(path, module) {
  var file;
  if (module == null) {
    module = Module.forFile(path);
  }
  if (module == null) {
    throw TypeError("Invalid file path: '" + path + "'");
  }
  file = module.files[path];
  if (file != null) {
    return file;
  }
  if (!isKind(this, File)) {
    return new File(path, module);
  }
  if (!isAbsolute(path)) {
    throw Error("'path' must be absolute.");
  }
  if (log.isVerbose) {
    log.moat(1);
    log("File created: ");
    log.blue(relative(lotus.path, path));
    log.moat(1);
  }
  module.files[path] = this;
  return define(this, function() {
    this.options = {};
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

define(File, {
  fromJSON: function(file, files) {
    var json;
    json = files[file.path];
    if (json == null) {
      if (log.isVerbose) {
        log.moat(1);
        log("File '" + file.path + "' could not be found");
        log.moat(1);
      }
      return false;
    }
    if (json.lastModified != null) {
      file.isInitialized = true;
      file.lastModified = json.lastModified;
    }
    return async.reduce(json.dependers, {}, function(dependers, path) {
      return dependers[path] = File(path, Module.forFile(path));
    }).then(function(dependers) {
      file.dependers = dependers;
      return async.reduce(json.dependencies, {}, function(dependencies, path) {
        return dependencies[path] = File(path, Module.forFile(path));
      });
    }).then(function(dependencies) {
      file.dependencies = dependencies;
      return file;
    });
  }
});

define(File.prototype, function() {
  this.options = {
    configurable: false,
    writable: false
  };
  this({
    initialize: function() {
      if (this.isInitialized) {
        return async.fulfill();
      }
      this.isInitialized = true;
      return async.all([this._loadLastModified(), this._loadDeps()]);
    },
    "delete": function() {
      if (log.isVerbose) {
        log.moat(1);
        log("File deleted: ");
        log.moat(0);
        log.red(this.path);
        log.moat(1);
      }
      return delete this.module.files[this.path];
    },
    toJSON: function() {
      var dependencies, dependers;
      dependers = Object.keys(this.dependers);
      dependencies = Object.keys(this.dependencies);
      return {
        path: this.path,
        dependers: dependers,
        dependencies: dependencies,
        lastModified: this.lastModified
      };
    }
  });
  this.enumerable = false;
  return this({
    _loadLastModified: function() {
      return async.stats(this.path).then((function(_this) {
        return function(stats) {
          return _this.lastModified = stats.node.mtime;
        };
      })(this));
    },
    _loadDeps: function() {
      return async.read(this.path).then((function(_this) {
        return function(contents) {
          return _this._parseDeps(contents);
        };
      })(this));
    },
    _parseDeps: function(contents) {
      var depCount, depPaths;
      depCount = 0;
      depPaths = _findDepPath.all(contents);
      if (log.isVerbose) {
        log.origin("lotus/file");
        log.yellow(relative(lotus.path, this.path));
        log(" has ");
        log.yellow(depPaths.length);
        log(" ", plural("dependency", depPaths.length));
        log.moat(1);
      }
      return async.each(depPaths, (function(_this) {
        return function(depPath) {
          return _this._loadDep(depPath).then(function(dep) {
            var promise;
            if (dep == null) {
              return;
            }
            depCount++;
            if (log.isDebug && log.isVerbose) {
              log.origin("lotus/file");
              log.yellow(relative(lotus.path, _this.path));
              log(" depends on ");
              log.yellow(relative(lotus.path, dep.path));
              log.moat(1);
            }
            promise = _installMissing(_this.module, dep.module);
            if (promise != null) {
              _this.dependencies[dep.path] = dep;
              dep.dependers[_this.path] = _this;
            }
            return promise;
          });
        };
      })(this)).then((function(_this) {
        return function() {
          if (log.isVerbose) {
            log.moat(1);
            log("File '" + _this.path + "' loaded " + depCount + " dependencies");
            return log.moat(1);
          }
        };
      })(this));
    },
    _loadDep: async.promised(function(depPath) {
      var depDir, depFile;
      if (NODE_PATHS.indexOf(depPath) >= 0) {
        return;
      }
      depFile = lotus.resolve(depPath, dirname(this.path));
      if (depFile === null) {
        return;
      }
      if (depPath[0] !== "." && depPath.indexOf("/") < 0) {
        return File(depFile, Module(depPath));
      }
      depDir = depFile;
      return async.loop((function(_this) {
        return function(done) {
          var newDepDir, requiredJson;
          newDepDir = dirname(depDir);
          if (newDepDir === ".") {
            return done(depDir);
          }
          depDir = newDepDir;
          requiredJson = join(depDir, "package.json");
          return async.isFile(requiredJson).then(function(isFile) {
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
    })
  });
});

isInitialized = false;

define(exports, {
  initialize: function(_Module) {
    if (!isInitialized) {
      isInitialized = true;
      Module = _Module;
    }
    return File;
  }
});

_findDepPath = Finder({
  regex: /(^|[\(\[\s\n]+)require\(("|')([^"']+)("|')/g,
  group: 3
});

_unshiftContext = function(fn) {
  return function() {
    var args, context;
    context = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    return fn.apply(context, args);
  };
};

_installMissing = _unshiftContext(function(dep) {
  var answer, deferred, info, installer, isIgnored, ref2, ref3, ref4;
  if (!isKind(this, Module)) {
    throw TypeError("'this' must be a Lotus.Module");
  }
  if (!isKind(dep, Module)) {
    throw TypeError("'dep' must be a Lotus.Module");
  }
  if (dep === this) {
    return false;
  }
  info = JSON.parse(sync.read(this.path + "/package.json"));
  isIgnored = ((ref2 = info.dependencies) != null ? ref2.hasOwnProperty(dep.name) : void 0) || ((ref3 = info.peerDependencies) != null ? ref3.hasOwnProperty(dep.name) : void 0) || (inArray((ref4 = this.config) != null ? ref4.implicitDependencies : void 0, dep.name));
  if (isIgnored) {
    return false;
  }
  log.origin("lotus/file");
  log.yellow(this.name, " ");
  log.bgRed.white("Error");
  log(": ");
  log.yellow(dep.name);
  log(" isn't saved as a dependency.");
  log.moat(1);
  if (this._reportedMissing[dep.path]) {
    return false;
  }
  this._reportedMissing[dep.path] = true;
  answer = log.prompt.sync({
    label: function() {
      return log.withIndent(2, function() {
        return log.blue("npm install --save ");
      });
    }
  });
  log.moat(1);
  if (answer != null) {
    deferred = async.defer();
    installer = spawn("npm", ["install", "--save", answer], {
      stdio: ["ignore", "ignore", "ignore"],
      cwd: this.path
    });
    installer.on("exit", (function(_this) {
      return function() {
        log.origin("lotus/file");
        log.yellow(_this.name);
        log(" installed ");
        log.yellow(dep.name);
        log(" successfully!");
        log.moat(1);
        return deferred.resolve();
      };
    })(this));
    return deferred.promise;
  }
  return null;
});

//# sourceMappingURL=../../map/src/file.map
