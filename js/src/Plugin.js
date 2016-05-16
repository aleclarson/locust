var Plugin, Q, RESERVED_NAMES, Tracer, Type, assert, assertType, define, isType, steal, sync, type;

assertType = require("assertType");

Tracer = require("tracer");

isType = require("isType");

define = require("define");

assert = require("assert");

steal = require("steal");

sync = require("sync");

Type = require("Type");

Q = require("q");

RESERVED_NAMES = {
  plugins: true
};

type = Type("Plugin");

type.argumentTypes = {
  name: String
};

type.returnCached(function(name) {
  assert(!RESERVED_NAMES[name], "A plugin cannot be named '" + name + "'!");
  return name;
});

type.defineValues({
  name: function(name) {
    return name;
  },
  _loading: null
});

type.defineProperties({
  isLoading: {
    get: function() {
      return this._loading !== null;
    }
  },
  isLoaded: {
    get: function() {
      return Q.isFulfilled(this._loading);
    }
  },
  dependencies: {
    get: function() {
      var dependencies;
      this._assertLoaded();
      dependencies = this._loading.inspect().value.dependencies;
      if (!isType(dependencies, Array)) {
        return [];
      }
      return dependencies;
    }
  },
  globalDependencies: {
    get: function() {
      var globalDependencies;
      this._assertLoaded();
      globalDependencies = this._loading.inspect().value.globalDependencies;
      if (!isType(globalDependencies, Array)) {
        return [];
      }
      return globalDependencies;
    }
  },
  _initModule: {
    lazy: function() {
      var initModule;
      initModule = this._callHook("initModule");
      if (initModule) {
        assert(isType(initModule, Function), {
          plugin: this,
          reason: "Plugins must return a second function when hooking into 'initModule'!"
        });
        return initModule;
      }
      return emptyFunction;
    }
  }
});

type.defineMethods({
  load: function() {
    if (!Q.isRejected(this._loading)) {
      return this._loading;
    }
    return this._loading = Q["try"]((function(_this) {
      return function() {
        var plugin;
        if (!lotus.isFile(_this.name)) {
          throw Error("Cannot find plugin: '" + _this.name + "'");
        }
        plugin = require(_this.name);
        assert(isType(plugin, Object), {
          name: _this.name,
          plugin: plugin,
          reason: "Plugins must export an object!"
        });
        return plugin;
      };
    })(this));
  },
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
  _assertLoaded: function() {
    return assert(this.isLoaded, {
      plugin: this,
      reason: "Must call 'plugin.load' first!"
    });
  },
  _callHook: function(name, context, args) {
    var hook, loaded;
    this._assertLoaded();
    loaded = this._loading.inspect().value;
    if (isType(loaded[name], Function)) {
      hook = steal(loaded, name);
      return hook.call(context, args);
    }
    return null;
  }
});

type.defineStatics({
  _loadedGlobals: Object.create(null),
  load: function(plugins, iterator) {
    var pluginsLoading, tracer;
    assertType(plugins, Array);
    assertType(iterator, Function);
    tracer = Tracer("Plugin.load()");
    pluginsLoading = Object.create(null);
    return sync.reduce(plugins, Q(), function(promise, plugin) {
      if (isType(plugin, String)) {
        plugin = Plugin(plugin);
      }
      if (!isType(plugin, Plugin)) {
        return promise;
      }
      pluginsLoading[plugin.name] = Q.defer();
      return promise.then(function() {
        var loading;
        loading = iterator(plugin, pluginsLoading);
        assert(plugin._loading, "Must call 'plugin.load' in the iterator!");
        return loading;
      }).then(function(result) {
        pluginsLoading[plugin.name].fulfill(result);
        return result;
      }).fail(function(error) {
        if (error.plugin) {
          return;
        }
        error.plugin = plugin;
        pluginsLoading[plugin.name].reject(error);
        throw error;
      });
    });
  }
});

type.didBuild(function() {
  define(lotus, {
    _moduleMixins: [],
    _fileMixins: []
  });
  assertType(lotus._moduleMixins, Array);
  return assertType(lotus._fileMixins, Array);
});

module.exports = Plugin = type.build();

//# sourceMappingURL=../../map/src/Plugin.map
