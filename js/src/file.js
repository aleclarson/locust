var Finder, NODE_PATHS, Path, Type, _findDepPath, _getFile, _ignoredErrors, _installMissing, _unshiftContext, async, asyncFs, inArray, spawn, syncFs, type,
  slice = [].slice;

spawn = require("child_process").spawn;

NODE_PATHS = require("node-paths");

asyncFs = require("io/async");

inArray = require("in-array");

syncFs = require("io/sync");

Finder = require("finder");

async = require("async");

Path = require("path");

Type = require("Type");

type = Type("Lotus_File");

type.argumentTypes = {
  path: String,
  mod: lotus.Module.Maybe
};

type.createArguments(function(args) {
  if (args[1] == null) {
    args[1] = lotus.Module.forFile(args[0]);
  }
  return args;
});

type.initArguments(function(args) {
  assert(Path.isAbsolute(args[0]), {
    reason: "Expected an absolute path!",
    path: args[0]
  });
  return assert(args[1], {
    reason: "This file belongs to an unknown module!"
  });
});

type.returnExisting(function(path, mod) {
  return mod.files[path];
});

type.initInstance(function(path, mod) {
  return mod.files[path] = this;
});

type.defineValues({
  name: function(path) {
    return Path.basename(path, Path.extname(path));
  },
  dir: function(path, mod) {
    return Path.relative(mod.path, Path.dirname(path));
  },
  path: function(path) {
    return path;
  },
  module: function(_, mod) {
    return mod;
  },
  contents: null,
  dependers: function() {
    return {};
  },
  dependencies: function() {
    return {};
  },
  _loading: null,
  _reading: null
});

type.defineMethods({
  load: function() {
    return Q();
  },
  read: function(options) {
    if (options == null) {
      options = {};
    }
    if (options.force || (this._reading == null)) {
      this.contents = null;
      this._reading = asyncFs.read(this.path).then((function(_this) {
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
  },
  _loadLastModified: function() {
    return asyncFs.stats(this.path).then((function(_this) {
      return function(stats) {
        return _this.lastModified = stats.node.mtime;
      };
    })(this));
  },
  _loadDeps: function() {
    return asyncFs.read(this.path).then((function(_this) {
      return function(contents) {
        return _this._parseDeps(contents);
      };
    })(this));
  },
  _parseDeps: function(contents) {
    var depCount, depPaths;
    depCount = 0;
    depPaths = _findDepPath.all(contents);
    return Q.all(sync.map(depPaths, (function(_this) {
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
    })(this)));
  },
  _loadDep: Q.fbind(function(depPath) {
    var depDir, depFile, error, mod;
    if (NODE_PATHS.indexOf(depPath) >= 0) {
      return;
    }
    depFile = lotus.resolve(depPath, this.path);
    if (depFile === null) {
      return;
    }
    if (depPath[0] !== "." && depPath.indexOf("/") < 0) {
      mod = lotus.Module.cache[depPath];
      if (!mod) {
        try {
          mod = lotus.Module(depPath);
        } catch (_error) {
          error = _error;
          if (typeof error["catch"] === "function") {
            error["catch"]();
          }
        }
        if (!mod) {
          return;
        }
        Q["try"](function() {
          return mod.load();
        }).fail(function(error) {
          return mod._retryLoad(error);
        });
      }
      lotus.File(depFile, mod);
    }
    depDir = depFile;
    return async.loop((function(_this) {
      return function(done) {
        var newDepDir, requiredJson;
        newDepDir = Path.dirname(depDir);
        if (newDepDir === ".") {
          return done(depDir);
        }
        depDir = newDepDir;
        requiredJson = Path.join(depDir, "package.json");
        return asyncFs.isFile(requiredJson).then(function(isFile) {
          if (!isFile) {
            return;
          }
          return done(Path.basename(depDir));
        });
      };
    })(this)).then((function(_this) {
      return function(modName) {
        mod = lotus.Module.cache[modName];
        if (mod == null) {
          mod = lotus.Module(modName);
        }
        return lotus.File(depFile, mod);
      };
    })(this));
  })
});

type.defineStatics({
  fromJSON: function(file, json) {
    if (json.lastModified != null) {
      file.isInitialized = true;
      file.lastModified = json.lastModified;
    }
    return Q["try"](function() {
      return file.dependers = sync.reduce(json.dependers, {}, function(dependers, path) {
        var depender;
        depender = _getFile(path);
        if (depender) {
          dependers[path] = depender;
        }
        return dependers;
      });
    }).then(function() {
      return file.dependencies = sync.reduce(json.dependencies, {}, function(dependencies, path) {
        var dependency;
        dependency = _getFile(path);
        if (dependency) {
          dependencies[path] = dependency;
        }
        return dependencies;
      });
    }).then(function() {
      return file;
    });
  }
});

module.exports = type.build();

_ignoredErrors = {
  getFile: ["This file belongs to an unknown module!"]
};

_getFile = function(path) {
  var error, file;
  try {
    file = lotus.File(path);
  } catch (_error) {
    error = _error;
    if (!inArray(_ignoredErrors.getFile, error.message)) {
      return;
    }
    throw error;
  }
  return file;
};

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
  var info, isIgnored, ref, ref1, ref2;
  if (!isKind(this, lotus.Module)) {
    throw TypeError("'this' must be a Lotus_Module");
  }
  if (!isKind(dep, lotus.Module)) {
    throw TypeError("'dep' must be a Lotus_Module");
  }
  if (dep === this) {
    return false;
  }
  info = JSON.parse(syncFs.read(this.path + "/package.json"));
  isIgnored = ((ref = info.dependencies) != null ? ref.hasOwnProperty(dep.name) : void 0) || ((ref1 = info.peerDependencies) != null ? ref1.hasOwnProperty(dep.name) : void 0) || (inArray((ref2 = this.config) != null ? ref2.implicitDependencies : void 0, dep.name));
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
