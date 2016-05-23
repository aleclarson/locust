var ErrorMap, Module, Path, Q, SortedArray, Tracer, Type, assert, assertType, asyncFs, errors, globby, hasKeys, inArray, isType, log, sortObject, sync, syncFs, throwFailure, type;

throwFailure = require("failure").throwFailure;

SortedArray = require("sorted-array");

assertType = require("assertType");

sortObject = require("sortObject");

ErrorMap = require("ErrorMap");

inArray = require("in-array");

asyncFs = require("io/async");

hasKeys = require("hasKeys");

syncFs = require("io/sync");

Tracer = require("tracer");

isType = require("isType");

globby = require("globby");

assert = require("assert");

sync = require("sync");

Path = require("path");

Type = require("Type");

log = require("log");

Q = require("q");

type = Type("Lotus_Module");

type.argumentTypes = {
  name: String,
  path: String
};

type.createArguments(function(args) {
  if (args[1] == null) {
    args[1] = Path.resolve(lotus.path, args[0]);
  }
  return args;
});

type.returnCached(function(name) {
  return name;
});

type.defineValues({
  name: function(name) {
    return name;
  },
  path: function(_, path) {
    return path;
  },
  files: function() {
    return Object.create(null);
  },
  _loading: function() {
    return Object.create(null);
  },
  _crawling: function() {
    return Object.create(null);
  }
});

type.defineProperties({
  dest: {
    value: null,
    didSet: function(newValue) {
      assertType(newValue, String);
      assert(Path.isAbsolute(newValue), {
        path: newValue,
        reason: "'dest' must be an absolute path!"
      });
      return assert(syncFs.isDir(newValue), {
        path: newValue,
        reason: "'dest' must be an existing directory!"
      });
    }
  },
  specDest: {
    value: null,
    didSet: function(newValue) {
      assertType(newValue, String);
      assert(Path.isAbsolute(newValue), {
        path: newValue,
        reason: "'specDest' must be an absolute path!"
      });
      return assert(syncFs.isDir(newValue), {
        path: newValue,
        reason: "'specDest' must be an existing directory!"
      });
    }
  }
});

type.initInstance(function() {
  assert(this.name[0] !== "/", {
    mod: this,
    reason: "Module name cannot begin with '/'!"
  });
  assert(this.name.slice(0, 2) !== "./", {
    mod: this,
    reason: "Module name cannot begin with './'!"
  });
  assert(syncFs.isDir(this.path), {
    mod: this,
    reason: "Module path must be a directory!"
  });
  assert(!inArray(lotus.config.ignoredModules, this.name), {
    mod: this,
    reason: "Module ignored by global config file!"
  });
  if (Module._debug) {
    log.moat(1);
    log.green.dim("new Module(");
    log.green("\"" + this.name + "\"");
    log.green.dim(")");
    return log.moat(1);
  }
});

type.defineMethods({
  load: function(names) {
    var queue, tracer;
    assertType(names, Array);
    tracer = Tracer("module.load()");
    queue = Q();
    sync.each(names, (function(_this) {
      return function(name) {
        return queue = queue.then(function() {
          var base;
          return (base = _this._loading)[name] != null ? base[name] : base[name] = Q["try"](function() {
            var load;
            load = Module._loaders[name];
            assert(isType(load, Function), {
              mod: _this,
              name: name,
              reason: "Invalid loader!"
            });
            return load.call(_this);
          }).fail(function(error) {
            _this._loading[name] = null;
            return throwFailure(error, {
              mod: _this,
              name: name,
              stack: tracer()
            });
          });
        });
      };
    })(this));
    return queue;
  },
  crawl: function(pattern, options) {
    if (isType(pattern, Object)) {
      options = pattern;
      pattern = null;
    } else if (!isType(options, Object)) {
      options = {};
    }
    if (!pattern) {
      pattern = [];
      pattern[0] = this.path + "/*.js";
      if (this.dest) {
        pattern[1] = this.dest + "/**/*.js";
      }
    }
    if (Array.isArray(pattern)) {
      return Q.all(sync.map(pattern, (function(_this) {
        return function(pattern) {
          return _this.crawl(pattern);
        };
      })(this))).then(function(filesByPattern) {
        var file, files, i, j, len, len1, paths, results;
        paths = Object.create(null);
        results = [];
        for (i = 0, len = filesByPattern.length; i < len; i++) {
          files = filesByPattern[i];
          for (j = 0, len1 = files.length; j < len1; j++) {
            file = files[j];
            if (paths[file.path]) {
              continue;
            }
            paths[file.path] = true;
            results.push(file);
          }
        }
        return results;
      });
    }
    assertType(pattern, String);
    if (pattern[0] !== "/") {
      pattern = Path.resolve(this.path, pattern);
    }
    if (options.force) {

    } else if (this._crawling[pattern]) {
      return this._crawling[pattern];
    }
    return this._crawling[pattern] = globby(pattern, {
      nodir: true,
      ignore: "**/node_modules/**"
    }).then((function(_this) {
      return function(paths) {
        var error, files, i, len, path;
        files = [];
        for (i = 0, len = paths.length; i < len; i++) {
          path = paths[i];
          try {
            files.push(lotus.File(path, _this));
          } catch (error1) {
            error = error1;
            errors.createFile.resolve(error, function() {
              return log.yellow(_this.name);
            });
          }
        }
        return files;
      };
    })(this)).fail((function(_this) {
      return function(error) {
        delete _this._crawling[pattern];
        throw error;
      };
    })(this));
  },
  saveConfig: function() {
    var config, dependencies, devDependencies, path, ref;
    if (!this.config) {
      return;
    }
    path = this.path + "/package.json";
    ref = this.config, dependencies = ref.dependencies, devDependencies = ref.devDependencies;
    if (hasKeys(dependencies)) {
      this.config.dependencies = sortObject(dependencies, function(a, b) {
        if (a.key > b.key) {
          return 1;
        } else {
          return -1;
        }
      });
    } else {
      delete this.config.dependencies;
    }
    if (hasKeys(devDependencies)) {
      this.config.devDependencies = sortObject(devDependencies, function(a, b) {
        if (a.key > b.key) {
          return 1;
        } else {
          return -1;
        }
      });
    } else {
      delete this.config.devDependencies;
    }
    config = JSON.stringify(this.config, null, 2);
    syncFs.write(path, config + log.ln);
  }
});

type.defineStatics({
  _debug: false,
  _loaders: Object.create(null),
  _plugins: [],
  resolvePath: function(modulePath) {
    if (modulePath[0] === ".") {
      modulePath = Path.resolve(process.cwd(), modulePath);
    } else if (modulePath[0] !== "/") {
      modulePath = lotus.path + "/" + modulePath;
    }
    return modulePath;
  },
  tryPath: function(modulePath) {
    var error, moduleName;
    if (!syncFs.isDir(modulePath)) {
      return null;
    }
    if (!syncFs.isFile(modulePath + "/package.json")) {
      return null;
    }
    moduleName = Path.relative(lotus.path, modulePath);
    if (moduleName[0] === ".") {
      return null;
    }
    if (0 <= moduleName.indexOf("/")) {
      return null;
    }
    if (Module.cache[moduleName]) {
      return Module.cache[moduleName];
    }
    try {
      return Module(moduleName, modulePath);
    } catch (error1) {
      error = error1;
      return errors.createModule.resolve(error, function() {
        return log.yellow(moduleName);
      });
    }
  },
  getParent: function(path) {
    var name;
    path = Path.relative(lotus.path, path);
    name = path.slice(0, path.indexOf("/"));
    return Module.cache[name];
  },
  crawl: function(path) {
    var children, mods;
    if (path == null) {
      path = lotus.path;
    }
    assert(Path.isAbsolute(path), "Expected an absolute path!");
    assert(syncFs.isDir(path), "Expected an existing directory!");
    mods = SortedArray([], function(a, b) {
      a = a.name.toLowerCase();
      b = b.name.toLowerCase();
      if (a > b) {
        return 1;
      } else {
        return -1;
      }
    });
    children = syncFs.readDir(path);
    sync.each(children, function(moduleName) {
      var mod, modulePath;
      modulePath = lotus.path + "/" + moduleName;
      mod = Module.tryPath(modulePath);
      if (mod) {
        return mods.insert(mod);
      }
    });
    return mods.array;
  },
  addLoader: function(name, loader) {
    assert(!this._loaders[name], "Loader named '" + name + "' already exists!");
    this._loaders[name] = loader;
  },
  addLoaders: function(loaders) {
    var loader, name;
    assertType(loaders, Object);
    for (name in loaders) {
      loader = loaders[name];
      this.addLoader(name, loader);
    }
  },
  addPlugin: function(plugin) {
    var index;
    assertType(plugin, String);
    index = this._plugins.indexOf(plugin);
    assert(index < 0, "Plugin has already been added!");
    this._plugins.push(plugin);
  }
});

type.addMixins(lotus._moduleMixins);

module.exports = Module = type.build();

Module.addLoaders({
  config: function() {
    var error, path;
    path = this.path + "/package.json";
    if (!syncFs.isFile(path)) {
      error = Error("'package.json' could not be found!");
      return Q.reject(error);
    }
    return asyncFs.read(path).then((function(_this) {
      return function(json) {
        var dest, ref, specDest;
        _this.config = JSON.parse(json);
        if (isType(_this.config.lotus, Object)) {
          ref = _this.config.lotus, dest = ref.dest, specDest = ref.specDest;
        }
        if (isType(dest, String)) {
          assert(dest[0] !== "/", "'config.lotus.dest' must be a relative path");
          _this.dest = Path.resolve(_this.path, dest);
        } else if (isType(_this.config.main, String)) {
          dest = lotus.resolve(Path.join(_this.name, _this.config.main));
          if (dest) {
            _this.dest = Path.dirname(dest);
          }
        } else {
          dest = _this.path + "/js/src";
          if (syncFs.isDir(dest)) {
            _this.dest = dest;
          }
        }
        if (isType(specDest, String)) {
          assert(dest[0] !== "/", "'config.lotus.specDest' must be a relative path");
          return _this.specDest = Path.resolve(_this.path, specDest);
        } else {
          specDest = _this.path + "/js/spec";
          if (syncFs.isDir(specDest)) {
            return _this.specDest = specDest;
          }
        }
      };
    })(this));
  },
  plugins: function() {
    var Plugin, config, i, len, name, plugins, ref, tracer;
    config = this.config.lotus;
    if (!isType(config, Object)) {
      return;
    }
    plugins = [].concat(config.plugins);
    if (Module._plugins.length) {
      ref = Module._plugins;
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        if (0 <= plugins.indexOf(name)) {
          continue;
        }
        plugins.push(name);
      }
    }
    Plugin = lotus.Plugin;
    tracer = Tracer("Plugin.load()");
    return Plugin.load(plugins, (function(_this) {
      return function(plugin, pluginsLoading) {
        return plugin.load().then(function() {
          var promises;
          promises = [];
          sync.each(plugin.globalDependencies, function(depName) {
            return assert(Plugin._loadedGlobals[depName], {
              depName: depName,
              plugin: plugin,
              stack: tracer(),
              reason: "Missing global plugin dependency!"
            });
          });
          sync.each(plugin.dependencies, function(depName) {
            var deferred;
            deferred = pluginsLoading[depName];
            assert(deferred, {
              depName: depName,
              plugin: plugin,
              stack: tracer(),
              reason: "Missing local plugin dependency!"
            });
            return promises.push(deferred.promise);
          });
          return Q.all(promises);
        }).then(function() {
          return plugin.initModule(_this, config[plugin.name] || {});
        }).fail(function(error) {
          log.moat(1);
          log.red("Plugin error: ");
          log.white(plugin.name);
          log.moat(0);
          log.gray.dim(error.stack);
          log.moat(1);
          return process.exit();
        });
      };
    })(this));
  }
});

errors = {
  createFile: ErrorMap({
    quiet: []
  }),
  createModule: ErrorMap({
    quiet: ["Module path must be a directory!", "Module with that name already exists!", "Module ignored by global config file!"]
  })
};

//# sourceMappingURL=../../map/src/Module.map
