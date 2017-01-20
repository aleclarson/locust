// Generated by CoffeeScript 1.11.1
var Module, SortedArray, Type, assertType, emptyFunction, fs, globby, hasKeys, inArray, isType, log, moduleCache, path, resolveAbsolutePath, sortObject, sync, type;

emptyFunction = require("emptyFunction");

SortedArray = require("sorted-array");

assertType = require("assertType");

sortObject = require("sortObject");

hasKeys = require("hasKeys");

inArray = require("in-array");

isType = require("isType");

globby = require("globby");

sync = require("sync");

path = require("path");

Type = require("Type");

log = require("log");

fs = require("io");

moduleCache = Object.create(null);

type = Type("Lotus_Module");

type.defineArgs({
  name: String.isRequired,
  path: String.isRequired
});

type.initArgs(function(arg) {
  var name;
  name = arg[0];
  if (!moduleCache[name]) {
    return;
  }
  throw Error("Module named '" + name + "' already exists!");
});

type.defineValues(function(name, path) {
  return {
    name: name,
    path: path,
    files: Object.create(null),
    _loading: Object.create(null),
    _crawling: Object.create(null)
  };
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
  }
});

type.defineMethods({
  getFile: function(filePath) {
    var file, mod;
    if (file = this.files[filePath]) {
      return file;
    }
    if (!(mod = Module.resolve(filePath))) {
      return null;
    }
    this.files[filePath] = file = lotus.File(filePath, mod);
    return file;
  },
  load: function(names) {
    assertType(names, Array);
    return Promise.chain(names, (function(_this) {
      return function(name) {
        var base;
        return (base = _this._loading)[name] != null ? base[name] : base[name] = Promise["try"](function() {
          var load;
          load = Module._loaders[name];
          assertType(load, Function);
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
      return Promise.all(pattern, (function(_this) {
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
      ignore: options.ignore
    }).then((function(_this) {
      return function(filePaths) {
        var file, filePath, files, i, len;
        files = [];
        for (i = 0, len = filePaths.length; i < len; i++) {
          filePath = filePaths[i];
          if (file = _this.getFile(filePath)) {
            files.push(file);
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
    var config, configPath, dependencies, devDependencies, ref;
    if (!this.config) {
      return;
    }
    configPath = this.path + "/package.json";
    ref = this.config, dependencies = ref.dependencies, devDependencies = ref.devDependencies;
    if (hasKeys(dependencies)) {
      this.config.dependencies = sortObject(dependencies);
    } else {
      delete this.config.dependencies;
    }
    if (hasKeys(devDependencies)) {
      this.config.devDependencies = sortObject(devDependencies);
    } else {
      delete this.config.devDependencies;
    }
    config = JSON.stringify(this.config, null, 2);
    fs.sync.write(configPath, config + log.ln);
  },
  hasPlugin: function(plugin) {
    if (this.config) {
      return inArray(this.config.plugins, plugin);
    }
    throw Error("Must first load the module's config file!");
  }
});

type.defineStatics({
  _loaders: Object.create(null),
  _plugins: [],
  has: function(moduleName) {
    return moduleCache[moduleName] != null;
  },
  get: function(moduleName, modulePath) {
    return moduleCache[moduleName] != null ? moduleCache[moduleName] : moduleCache[moduleName] = Module(moduleName, modulePath);
  },
  resolve: function(filePath) {
    var moduleName, packageJson, packageRoot;
    packageRoot = filePath;
    while (true) {
      packageRoot = path.dirname(packageRoot);
      packageJson = path.join(packageRoot, "package.json");
      if (fs.sync.exists(packageJson)) {
        break;
      }
    }
    moduleName = path.basename(packageRoot);
    return moduleCache[moduleName];
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
      return Module.get(moduleName, modulePath);
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
    if (this._loaders[name]) {
      throw Error("Loader named '" + name + "' already exists!");
    }
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
    assertType(plugin, String);
    if (0 <= this._plugins.indexOf(plugin)) {
      throw Error("Plugin has already been added!");
    }
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
        try {
          _this.config = JSON.parse(json);
        } catch (error1) {
          error = error1;
          throw Error("Failed to parse JSON:\n" + configPath + "\n\n" + error.stack);
        }
        if (isType(_this.config.src, String)) {
          _this.src = _this.config.src;
        }
        if (isType(_this.config.spec, String)) {
          _this.spec = _this.config.spec;
        }
        if (isType(_this.config.dest, String)) {
          return _this.dest = _this.config.dest;
        } else if (isType(_this.config.main, String)) {
          return _this.dest = path.dirname(path.join(_this.path, _this.config.main));
        }
      };
    })(this));
  },
  plugins: function() {
    var mod, plugins;
    plugins = [].concat(this.config.plugins || []).concat(Module._plugins);
    mod = this;
    return lotus.Plugin.load(plugins, function(plugin) {
      return plugin.initModule(mod);
    });
  }
});
