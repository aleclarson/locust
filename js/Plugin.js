var Plugin, Type, assertType, define, emptyFunction, isType, pluginCache, reservedNames, steal, sync, type;

emptyFunction = require("emptyFunction");

assertType = require("assertType");

isType = require("isType");

define = require("define");

steal = require("steal");

sync = require("sync");

Type = require("Type");

reservedNames = {
  plugins: 1
};

pluginCache = Object.create(null);

type = Type("Plugin");

type.defineArgs({
  name: String.isRequired
});

type.defineValues(function(name) {
  return {
    name: name,
    _loaded: null,
    _deps: null
  };
});

type.defineProperties({
  _initModule: {
    lazy: function() {
      var initModule;
      initModule = this._callHook("initModule");
      if (initModule) {
        assertType(initModule, Function);
        return initModule;
      }
      return emptyFunction;
    }
  }
});

type.defineGetters({
  isLoaded: function() {
    return this._loaded !== null;
  },
  dependencies: function() {
    if (!this._loaded) {
      return null;
    }
    return this._loaded.dependencies || [];
  },
  globalDependencies: function() {
    if (!this._loaded) {
      return null;
    }
    return this._loaded.globalDependencies || [];
  }
});

type.defineMethods({
  initCommands: function(commands) {
    var fn, key, newCommands;
    newCommands = this._callHook("initCommands");
    if (!newCommands) {
      return;
    }
    assertType(newCommands, Object);
    for (key in newCommands) {
      fn = newCommands[key];
      assertType(fn, Function);
      commands[key] = fn;
    }
  },
  initModule: function(mod, options) {
    return this._initModule(mod, options);
  },
  initModuleType: function(type) {
    var initType;
    initType = this._callHook("initModuleType");
    if (!initType) {
      return;
    }
    assertType(initType, Function);
    lotus._moduleMixins.push(initType);
  },
  initFileType: function(type) {
    var initType;
    initType = this._callHook("initFileType");
    if (!initType) {
      return;
    }
    assertType(initType, Function);
    lotus._fileMixins.push(initType);
  },
  _callHook: function(name, context, args) {
    var hook;
    if (!this.isLoaded) {
      throw Error("Must call 'plugin.load' first!");
    }
    if (hook = this._loaded[name]) {
      assertType(hook, Function);
      return hook.call(context, args);
    }
    return null;
  },
  _load: function(config) {
    return Promise["try"]((function(_this) {
      return function() {
        var loaded;
        if (_this._loaded) {
          return _this._loaded;
        }
        if (!lotus.isFile(_this.name)) {
          throw Error("Plugin does not exist: '" + _this.name + "'");
        }
        loaded = require(_this.name);
        if (!isType(loaded, Object)) {
          throw TypeError("Plugin must return an object: '" + _this.name + "'");
        }
        _this._loaded = loaded;
        return _this._loadDeps(config);
      };
    })(this)).then((function(_this) {
      return function() {
        return config.onLoad(_this);
      };
    })(this)).then((function(_this) {
      return function() {
        var loading;
        if (config.global) {
          Plugin._loadedGlobals[_this.name] = _this._loaded;
        }
        loading = config.loadingPlugins[_this.name];
        loading.resolve(_this);
        return _this._loaded;
      };
    })(this)).fail((function(_this) {
      return function(error) {
        log.moat(1);
        log.red("Plugin threw an error: ");
        log.white(_this.name);
        log.moat(0);
        log.gray(error.stack);
        log.moat(1);
      };
    })(this));
  },
  _loadDeps: function(config) {
    var dep, deps, i, j, len, len1, loading, ref, ref1;
    deps = [];
    if (!config.global) {
      if (Array.isArray(this._loaded.globalDependencies)) {
        ref = this._loaded.globalDependencies;
        for (i = 0, len = ref.length; i < len; i++) {
          dep = ref[i];
          if (Plugin._loadedGlobals[dep]) {
            continue;
          }
          throw Error("Unmet global plugin dependency: " + dep);
        }
      }
    }
    if (Array.isArray(this._loaded.dependencies)) {
      ref1 = this._loaded.dependencies;
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        dep = ref1[j];
        loading = config.loadingPlugins[dep];
        if (loading) {
          deps.push(loading.promise);
          return;
        }
        throw Error("Unmet local plugin dependency: " + dep);
      }
    }
    return Promise.all(deps);
  }
});

type.defineStatics({
  get: function(name) {
    if (!pluginCache[name]) {
      if (reservedNames[name]) {
        throw Error("A plugin cannot be named '" + name + "'!");
      }
      pluginCache[name] = Plugin(name);
    }
    return pluginCache[name];
  },
  load: function(plugins, onLoad) {
    assertType(plugins, Array);
    assertType(onLoad, Function);
    return this._load(plugins, {
      onLoad: onLoad
    });
  },
  loadGlobals: function(plugins, onLoad) {
    assertType(plugins, Array);
    assertType(onLoad, Function);
    return this._load(plugins, {
      onLoad: onLoad,
      global: true
    });
  },
  _loadedGlobals: Object.create(null),
  _load: function(plugins, config) {
    var loadingPlugins;
    loadingPlugins = Object.create(null);
    plugins = sync.map(plugins, function(plugin) {
      if (isType(plugin, String)) {
        plugin = Plugin.get(plugin);
      }
      loadingPlugins[plugin.name] = Promise.defer();
      return plugin;
    });
    config.loadingPlugins = loadingPlugins;
    return Promise.all(plugins, function(plugin) {
      var deferred;
      plugin._load(config);
      deferred = loadingPlugins[plugin.name];
      return deferred.promise;
    });
  }
});

module.exports = Plugin = type.build();

//# sourceMappingURL=map/Plugin.map
