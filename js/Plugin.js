var Plugin, Promise, Tracer, Type, assertType, define, emptyFunction, isType, pluginCache, reservedNames, steal, sync, type;

emptyFunction = require("emptyFunction");

assertType = require("assertType");

Promise = require("Promise");

Tracer = require("tracer");

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
    _loading: null
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
  isLoading: function() {
    return this._loading !== null;
  },
  isLoaded: function() {
    return Promise.isFulfilled(this._loading);
  },
  dependencies: function() {
    var dependencies;
    this._assertLoaded();
    dependencies = this._loading.inspect().value.dependencies;
    if (!isType(dependencies, Array)) {
      return [];
    }
    return dependencies;
  },
  globalDependencies: function() {
    var globalDependencies;
    this._assertLoaded();
    globalDependencies = this._loading.inspect().value.globalDependencies;
    if (!isType(globalDependencies, Array)) {
      return [];
    }
    return globalDependencies;
  }
});

type.defineMethods({
  load: function() {
    if (!Promise.isRejected(this._loading)) {
      return this._loading;
    }
    return this._loading = Promise["try"]((function(_this) {
      return function() {
        var plugin;
        if (!lotus.isFile(_this.name)) {
          throw Error("Cannot find plugin: '" + _this.name + "'");
        }
        plugin = require(_this.name);
        assertType(plugin, Object);
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
    if (this.isLoaded) {
      return;
    }
    throw Error("Must call 'plugin.load' first!");
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
  get: function(name) {
    if (!pluginCache[name]) {
      if (reservedNames[name]) {
        throw Error("A plugin cannot be named '" + name + "'!");
      }
      pluginCache[name] = Plugin(name);
    }
    return pluginCache[name];
  },
  load: function(plugins, iterator) {
    var pluginsLoading, tracer;
    assertType(plugins, Array);
    assertType(iterator, Function);
    tracer = Tracer("Plugin.load()");
    pluginsLoading = Object.create(null);
    return Promise.chain(plugins, function(plugin) {
      if (isType(plugin, String)) {
        plugin = Plugin.get(plugin);
      }
      if (!isType(plugin, Plugin)) {
        return;
      }
      pluginsLoading[plugin.name] = Promise.defer();
      return Promise["try"](function() {
        var loading;
        loading = iterator(plugin, pluginsLoading);
        if (plugin._loading) {
          return loading;
        }
        throw Error("Must call 'plugin.load' in the iterator!");
      }).then(function(result) {
        pluginsLoading[plugin.name].resolve(result);
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

//# sourceMappingURL=map/Plugin.map
