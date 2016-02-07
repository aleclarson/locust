var Config, KeyMirror, NamedFunction, Path, Stack, assert, assertType, async, color, combine, define, isKind, isType, log, ref, ref1, ref2, reservedPluginNames, sync;

require("coffee-script/register");

Stack = require("stack");

Stack.initialize();

ref = require("type-utils"), isType = ref.isType, isKind = ref.isKind, assert = ref.assert, assertType = ref.assertType;

ref1 = require("io"), sync = ref1.sync, async = ref1.async;

ref2 = require("lotus-log"), log = ref2.log, color = ref2.color;

NamedFunction = require("named-function");

KeyMirror = require("keymirror");

combine = require("combine");

define = require("define");

Path = require("path");

module.exports = Config = NamedFunction("LotusConfig", function(dir) {
  var i, json, len, path, paths, regex;
  if (dir == null) {
    dir = ".";
  }
  if (!isKind(this, Config)) {
    return new Config(dir);
  }
  assert(sync.isDir(dir), {
    dir: dir,
    reason: "'" + dir + "' is not a directory!"
  });
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
  assert(json != null, {
    path: path,
    reason: "Could not find 'lotus-config' file!"
  });
  return Config.fromJSON.call(this, path, json);
});

reservedPluginNames = KeyMirror(["plugins"]);

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
    return define(this, function() {
      this.frozen = true;
      return this({
        path: path,
        json: {
          value: json
        },
        plugins: {
          value: plugins
        },
        implicitDependencies: {
          value: implicitDependencies
        }
      });
    });
  }
});

define(Config.prototype, {
  addPlugins: function(plugins) {
    var key, plugin, results;
    assertType(plugins, Object);
    if (this.plugins == null) {
      this.plugins = {};
    }
    if (this.plugins instanceof KeyMirror) {
      this.plugins._add(plugins);
    }
    results = [];
    for (key in plugins) {
      plugin = plugins[key];
      results.push(this.plugins[key] = plugin);
    }
    return results;
  },
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
        if (isType(path, String)) {
          plugin = module.optional(path, function(error) {
            if (error.code === "REQUIRE_FAILED") {
              error.message = "Cannot find plugin '" + path + "'.";
            }
            throw error;
          });
          plugin.path = path;
        } else if (isType(path, Function)) {
          plugin = path;
        }
        if (!isKind(plugin, Function)) {
          throw Error("'" + alias + "' failed to export a Function.");
        }
        plugin.alias = alias;
        return async["try"](function() {
          return iterator(plugin, _this.json[alias] || {});
        }).fail(function(error) {
          return log.moat(1).white("Plugin failed: ").red(alias).moat(0).gray(error.stack).moat(1);
        });
      };
    })(this));
  }
});

//# sourceMappingURL=../../map/src/config.map
