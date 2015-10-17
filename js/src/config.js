var Config, KeyMirror, NamedFunction, Path, Stack, async, color, combine, define, formatError, isKind, isType, log, ref, ref1, ref2, reservedPluginNames, sync;

require("coffee-script/register");

ref = require("lotus-log"), log = ref.log, color = ref.color, Stack = ref.Stack;

ref1 = require("type-utils"), isType = ref1.isType, isKind = ref1.isKind;

ref2 = require("io"), sync = ref2.sync, async = ref2.async;

NamedFunction = require("named-function");

KeyMirror = require("keymirror");

combine = require("combine");

define = require("define");

Path = require("path");

Config = NamedFunction("LotusConfig", function(dir) {
  var i, json, len, path, paths, regex;
  if (dir == null) {
    dir = ".";
  }
  if (!isKind(this, Config)) {
    return new Config(dir);
  }
  if (!sync.isDir(dir)) {
    async["throw"]({
      fatal: false,
      error: Error("'" + dir + "' is not a directory."),
      code: "NOT_A_DIRECTORY",
      format: formatError
    });
  }
  regex = /^lotus-config(\.[^\.]+)?$/;
  paths = sync.readDir(dir);
  paths = sync.filter(paths, function(path) {
    return (regex.test(path)) && (sync.isFile(dir + "/" + path));
  });
  json = null;
  for (i = 0, len = paths.length; i < len; i++) {
    path = paths[i];
    path = Path.join(dir, path);
    json = module.optional(path, function(error) {
      if (error.code !== "REQUIRE_FAILED") {
        throw error;
      }
    });
    if (json !== null) {
      break;
    }
  }
  if (json === null) {
    async["throw"]({
      fatal: false,
      error: Error("Failed to find a 'lotus-config' file."),
      code: "NO_LOTUS_CONFIG",
      format: combine(formatError(), {
        repl: {
          dir: dir,
          config: this
        },
        stack: {
          limit: 1
        }
      })
    });
  }
  return Config.fromJSON.call(this, path, json);
});

module.exports = Config;

reservedPluginNames = KeyMirror(["plugins"]);

formatError = function() {
  return {
    stack: {
      exclude: ["**/lotus/src/config.*"],
      filter: function(frame) {
        return !frame.isEval() && !frame.isNative() && !frame.isNode();
      }
    }
  };
};

define(Config, {
  fromJSON: function(path, json) {
    var config, implicitDependencies, plugins;
    if (!isKind(this, Config)) {
      config = Object.create(Config.prototype);
      return Config.fromJSON.call(config, path, json);
    }
    plugins = json.plugins, implicitDependencies = json.implicitDependencies;
    if (isKind(plugins, Array)) {
      plugins = KeyMirror(plugins);
    }
    json = {
      value: json
    };
    plugins = {
      value: plugins
    };
    implicitDependencies = {
      value: implicitDependencies
    };
    return define(this, function() {
      this.options = {
        frozen: true
      };
      return this({
        path: path,
        plugins: plugins,
        implicitDependencies: implicitDependencies,
        json: json
      });
    });
  }
});

define(Config.prototype, {
  loadPlugins: function(iterator) {
    var aliases, error, promise;
    if (this.plugins == null) {
      error = Error("No plugins found.");
      error.fatal = false;
      return async.reject(error);
    }
    promise = async.fulfill();
    aliases = this.plugins instanceof KeyMirror ? this.plugins._keys : Object.keys(this.plugins);
    return async.each(aliases, (function(_this) {
      return function(alias) {
        var path, plugin;
        if (reservedPluginNames[alias] != null) {
          throw Error("'" + alias + "' is reserved and cannot be used as a plugin name.");
        }
        path = _this.plugins[alias];
        plugin = module.optional(path, function(error) {
          if (error.code === "REQUIRE_FAILED") {
            error.message = "Cannot find plugin '" + path + "'.";
          }
          throw error;
        });
        if (!isKind(plugin, Function)) {
          throw Error("'" + alias + "' failed to export a Function.");
        }
        plugin.alias = alias;
        plugin.path = path;
        return iterator(plugin, _this.json[alias] || {});
      };
    })(this)).fail(function(error) {
      return log.error(error);
    });
  }
});

//# sourceMappingURL=../../map/src/config.map
