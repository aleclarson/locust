var Module, Promise, SortedArray, Tracer, Type, assert, assertType, emptyFunction, fs, globby, hasKeys, isType, log, path, resolveAbsolutePath, sortObject, sync, type;

emptyFunction = require("emptyFunction");

SortedArray = require("sorted-array");

assertType = require("assertType");

sortObject = require("sortObject");

Promise = require("Promise");

hasKeys = require("hasKeys");

Tracer = require("tracer");

isType = require("isType");

globby = require("globby");

assert = require("assert");

sync = require("sync");

path = require("path");

Type = require("Type");

log = require("log");

fs = require("io");

type = Type("Lotus_Module");

type.argumentTypes = {
  name: String,
  path: String
};

type.initArguments(function(arg) {
  var name;
  name = arg[0];
  return assert(!Module.cache[name], "Module named '" + name + "' already exists!");
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

resolveAbsolutePath = function(newValue) {
  assertType(newValue, String);
  if (path.isAbsolute(newValue)) {
    return newValue;
  }
  return path.resolve(this.path, newValue);
};

type.defineProperties({
  src: {
    value: null,
    willSet: resolveAbsolutePath
  },
  spec: {
    value: null,
    willSet: resolveAbsolutePath
  },
  dest: {
    value: null,
    willSet: resolveAbsolutePath
  },
  specDest: {
    value: null,
    willSet: resolveAbsolutePath
  }
});

type.initInstance(function() {
  if (!Module._debug) {
    return;
  }
  log.moat(1);
  log.green.dim("new Module(");
  log.green("\"" + this.name + "\"");
  log.green.dim(")");
  return log.moat(1);
});

type.defineMethods({
  load: function(names) {
    var tracer;
    assertType(names, Array);
    tracer = Tracer("module.load()");
    return Promise.chain(names, (function(_this) {
      return function(name) {
        var base;
        return (base = _this._loading)[name] != null ? base[name] : base[name] = Promise["try"](function() {
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
          throw error;
        });
      };
    })(this));
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
      return Promise.map(pattern, (function(_this) {
        return function(pattern) {
          return _this.crawl(pattern, options);
        };
      })(this)).then(function(filesByPattern) {
        var paths, results;
        paths = Object.create(null);
        results = [];
        filesByPattern.forEach(function(files) {
          return files.forEach(function(file) {
            if (paths[file.path]) {
              return;
            }
            paths[file.path] = true;
            return results.push(file);
          });
        });
        return results;
      });
    }
    assertType(pattern, String);
    if (!path.isAbsolute(pattern[0])) {
      pattern = path.resolve(this.path, pattern);
    }
    if (!options.force) {
      if (this._crawling[pattern]) {
        return this._crawling[pattern];
      }
    }
    if (options.verbose) {
      log.moat(1);
      log.white("crawl ");
      log.cyan(lotus.relative(pattern));
      log.moat(1);
    }
    return this._crawling[pattern] = globby(pattern, {
      nodir: true,
      ignore: "**/node_modules/**"
    }).then((function(_this) {
      return function(filePaths) {
        var filePath, files, i, len;
        files = [];
        for (i = 0, len = filePaths.length; i < len; i++) {
          filePath = filePaths[i];
          files.push(lotus.File(filePath, _this));
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
    var config, configPath, dependencies, devDependencies, ref;
    if (!this.config) {
      return;
    }
    configPath = this.path + "/package.json";
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
    fs.sync.write(configPath, config + log.ln);
  }
});

type.defineStatics({
  _debug: false,
  _loaders: Object.create(null),
  _plugins: [],
  resolve: function(filePath) {
    var name;
    filePath = path.relative(lotus.path, filePath);
    name = filePath.slice(0, filePath.indexOf(path.sep));
    return Module.cache[name];
  },
  load: function(moduleName) {
    var modulePath;
    if (moduleName[0] === ".") {
      modulePath = path.resolve(process.cwd(), moduleName);
      moduleName = path.basename(modulePath);
    } else if (path.isAbsolute(moduleName)) {
      modulePath = moduleName;
      moduleName = lotus.relative(modulePath);
    } else {
      modulePath = path.join(lotus.path, moduleName);
    }
    return fs.async.isDir(modulePath).assert("Module path must be a directory: '" + modulePath + "'").then(function() {
      var configPath;
      configPath = path.join(modulePath, "package.json");
      return fs.async.isFile(configPath).assert("Missing config file: '" + configPath + "'");
    }).then(function() {
      return Module.cache[moduleName] || Module(moduleName, modulePath);
    });
  },
  crawl: function(dirPath) {
    var mods;
    if (dirPath == null) {
      dirPath = lotus.path;
    }
    assertType(dirPath, String);
    if (!path.isAbsolute(dirPath)) {
      throw Error("Expected an absolute path: '" + dirPath + "'");
    }
    if (!fs.sync.isDir(dirPath)) {
      throw Error("Expected a directory: '" + dirPath + "'");
    }
    mods = SortedArray([], function(a, b) {
      a = a.name.toLowerCase();
      b = b.name.toLowerCase();
      if (a > b) {
        return 1;
      } else {
        return -1;
      }
    });
    return fs.async.readDir(dirPath).then(function(children) {
      return Promise.chain(children, function(moduleName) {
        return Module.load(moduleName).then(function(mod) {
          return mod && mods.insert(mod);
        }).fail(emptyFunction);
      });
    }).then(function() {
      return mods.array;
    });
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
    var configPath, error;
    configPath = this.path + "/package.json";
    if (!fs.sync.isFile(configPath)) {
      error = Error("'package.json' could not be found!");
      return Promise.reject(error);
    }
    return fs.async.read(configPath).then((function(_this) {
      return function(json) {
        var config;
        _this.config = JSON.parse(json);
        config = _this.config.lotus || {};
        if (isType(config.src, String)) {
          _this.src = config.src;
        }
        if (isType(config.spec, String)) {
          _this.spec = config.spec;
        }
        if (isType(config.dest, String)) {
          _this.dest = config.dest;
        } else if (isType(_this.config.main, String)) {
          _this.dest = path.dirname(path.join(_this.path, _this.config.main));
        }
        if (isType(config.specDest, String)) {
          return _this.specDest = config.specDest;
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
          return Promise.all(promises);
        }).then(function() {
          return plugin.initModule(_this, config[plugin.name] || {});
        }).fail(function(error) {
          log.moat(1);
          log.red("Plugin error: ");
          log.white(plugin.name);
          log.moat(0);
          log.gray.dim(error.stack);
          return log.moat(1);
        });
      };
    })(this));
  }
});

//# sourceMappingURL=../../map/src/Module.map
