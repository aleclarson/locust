var Finder, Lotus, NODE_PATHS, NamedFunction, _findDepPath, _installMissing, _unshiftContext, assert, async, basename, define, dirname, extname, inArray, isAbsolute, isKind, join, log, plural, ref, ref1, ref2, relative, setType, spawn, sync,
  slice = [].slice;

Lotus = require("./index");

ref = require("path"), join = ref.join, isAbsolute = ref.isAbsolute, dirname = ref.dirname, basename = ref.basename, extname = ref.extname, relative = ref.relative;

ref1 = require("type-utils"), assert = ref1.assert, isKind = ref1.isKind, setType = ref1.setType;

ref2 = require("io"), async = ref2.async, sync = ref2.sync;

spawn = require("child_process").spawn;

NamedFunction = require("named-function");

NODE_PATHS = require("node-paths");

inArray = require("in-array");

Finder = require("finder");

define = require("define");

plural = require("plural");

log = require("lotus-log");

module.exports = Lotus.File = NamedFunction("File", function(path, mod) {
  var dir, file, name;
  if (mod == null) {
    mod = Lotus.Module.forFile(path);
  }
  assert(mod != null, {
    path: path,
    reason: "This file belongs to an unknown module!"
  });
  file = mod.files[path];
  if (file != null) {
    return file;
  }
  mod.files[path] = file = setType({}, File);
  assert(isAbsolute(path), {
    path: path,
    reason: "The file path must be absolute!"
  });
  name = basename(path, extname(path));
  dir = relative(mod.path, dirname(path));
  return define(file, function() {
    this.options = {
      configurable: false
    };
    this({
      contents: null,
      dependers: {},
      dependencies: {}
    });
    this.writable = false;
    this({
      name: name,
      dir: dir,
      path: path,
      module: mod
    });
    this.options = {
      enumerable: false
    };
    return this({
      _initializing: null,
      _reading: null
    });
  });
});

define(Lotus.File, {
  fromJSON: function(file, json) {
    if (json.lastModified != null) {
      file.isInitialized = true;
      file.lastModified = json.lastModified;
    }
    return async.reduce(json.dependers, {}, function(dependers, path) {
      dependers[path] = Lotus.File(path);
      return dependers;
    }).then(function(dependers) {
      return file.dependers = dependers;
    }).then(function() {
      return async.reduce(json.dependencies, {}, function(dependencies, path) {
        dependencies[path] = Lotus.File(path);
        return dependencies;
      });
    }).then(function(dependencies) {
      file.dependencies = dependencies;
      return file;
    });
  }
});

define(Lotus.File.prototype, function() {
  this.options = {
    configurable: false,
    writable: false
  };
  this({
    initialize: function() {
      if (this._initializing) {
        return this._initializing;
      }
      return this._initializing = async.all([this._loadLastModified(), this._loadDeps()]);
    },
    read: function(options) {
      if (options == null) {
        options = {};
      }
      if (options.force || (this._reading == null)) {
        this.contents = null;
        this._reading = async.read(this.path).then((function(_this) {
          return function(contents) {
            return _this.contents = contents;
          };
        })(this));
      }
      return this._reading;
    },
    "delete": function() {
      sync.each(this.dependers, (function(_this) {
        return function(file) {
          return delete file.dependencies[_this.path];
        };
      })(this));
      sync.each(this.dependencies, (function(_this) {
        return function(file) {
          return delete file.dependers[_this.path];
        };
      })(this));
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
      return async.each(depPaths, (function(_this) {
        return function(depPath) {
          return _this._loadDep(depPath).then(function(dep) {
            var promise;
            if (dep == null) {
              return;
            }
            depCount++;
            promise = _installMissing(_this.module, dep.module);
            if (promise != null) {
              _this.dependencies[dep.path] = dep;
              dep.dependers[_this.path] = _this;
            }
            return promise;
          });
        };
      })(this));
    },
    _loadDep: async.promised(function(depPath) {
      var depDir, depFile, error, mod;
      if (NODE_PATHS.indexOf(depPath) >= 0) {
        return;
      }
      depFile = Lotus.resolve(depPath, this.path);
      if (depFile === null) {
        return;
      }
      if (depPath[0] !== "." && depPath.indexOf("/") < 0) {
        mod = Lotus.Module.cache[depPath];
        if (mod == null) {
          try {
            mod = Lotus.Module(depPath);
          } catch (_error) {
            error = _error;
          }
          if (mod == null) {
            return;
          }
          async["try"](function() {
            return mod.initialize();
          }).fail(function(error) {
            return mod._retryInitialize(error);
          });
        }
        Lotus.File(depFile, mod);
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
        return function(modName) {
          mod = Lotus.Module.cache[modName];
          if (mod == null) {
            mod = Lotus.Module(modName);
          }
          return Lotus.File(depFile, mod);
        };
      })(this));
    })
  });
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
  var info, isIgnored, ref3, ref4, ref5;
  if (!isKind(this, Lotus.Module)) {
    throw TypeError("'this' must be a Lotus.Module");
  }
  if (!isKind(dep, Lotus.Module)) {
    throw TypeError("'dep' must be a Lotus.Module");
  }
  if (dep === this) {
    return false;
  }
  info = JSON.parse(sync.read(this.path + "/package.json"));
  isIgnored = ((ref3 = info.dependencies) != null ? ref3.hasOwnProperty(dep.name) : void 0) || ((ref4 = info.peerDependencies) != null ? ref4.hasOwnProperty(dep.name) : void 0) || (inArray((ref5 = this.config) != null ? ref5.implicitDependencies : void 0, dep.name));
  if (isIgnored) {
    return false;
  }
  if (this._reportedMissing[dep.name]) {
    return false;
  }
  this._reportedMissing[dep.name] = true;
  return null;
});

//# sourceMappingURL=../../map/src/File.map
