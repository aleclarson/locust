var KeyMirror, Plugin, RESERVED_NAMES, Type, inArray, type;

KeyMirror = require("keymirror");

inArray = require("in-array");

Type = require("Type");

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

type.defineStatics({
  commands: Object.create(null),
  injectedPlugins: [],
  inject: function(name) {
    var plugin;
    assertType(name, String);
    if (inArray(Plugin.injectedPlugins, name)) {
      return;
    }
    plugin = Plugin(name);
    plugin.load();
    Plugin.injectedPlugins.push(name);
  }
});

type.defineValues({
  name: function(name) {
    return name;
  },
  isLoading: false,
  _exports: null,
  _initModule: null
});

type.defineProperties({
  isLoaded: {
    get: function() {
      return this._exports !== null;
    }
  }
});

type.defineMethods({
  load: function() {
    var context, initPlugin;
    if (this.isLoaded || this.isLoading) {
      return;
    }
    this.isLoading = true;
    initPlugin = module.optional(lotus.path + "/" + this.name, (function(_this) {
      return function(error) {
        if (error.code === "REQUIRE_FAILED") {
          error.message = "Cannot find plugin '" + _this.name + "'.";
        }
        throw error;
      };
    })(this));
    assert(isType(initPlugin, Function), {
      name: this.name,
      reason: "Plugin failed to export a Function!"
    });
    context = {
      commands: Plugin.commands,
      injectPlugin: Plugin.inject
    };
    this._exports = initPlugin.call(context);
    this.isLoading = false;
  },
  initModule: function(module, options) {
    var initModule;
    this.load();
    if (!this.isLoaded) {
      log.moat(1);
      log.yellow("Plugin warning: ");
      log.white(this.name);
      log.gray.dim(" for module ");
      log.cyan(module.name);
      log.moat(0);
      log.gray.dim("'plugin.isLoaded' must be true!");
      log.moat(1);
      return;
    }
    if (!this._initModule) {
      if (!isType(this._exports.initModule, Function)) {
        log.moat(1);
        log.yellow("Plugin warning: ");
        log.white(this.name);
        log.gray.dim(" for module ");
        log.cyan(module.name);
        log.moat(0);
        log.gray.dim("'plugin.initModule' must be a Function!");
        log.moat(1);
        return;
      }
      initModule = this._exports.initModule();
      if (!isType(initModule, Function)) {
        log.moat(1);
        log.yellow("Plugin warning: ");
        log.white(this.name);
        log.gray.dim(" for module ");
        log.cyan(module.name);
        log.moat(0);
        log.gray.dim("'plugin.initModule' must return a Function!");
        log.moat(1);
        return;
      }
      this._initModule = initModule;
    }
    return this._initModule(module, options);
  }
});

module.exports = Plugin = type.build();

//# sourceMappingURL=../../map/src/Plugin.map
