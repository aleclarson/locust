var Config, Factory, KeyMirror, Path, Plugin, Q, assert, assertType, combine, define, isKind, isType, log, ref, steal, sync, syncFs;

require("coffee-script/register");

ref = require("type-utils"), isType = ref.isType, isKind = ref.isKind, assert = ref.assert, assertType = ref.assertType;

KeyMirror = require("keymirror");

Factory = require("factory");

combine = require("combine");

syncFs = require("io/sync");

define = require("define");

steal = require("steal");

sync = require("sync");

Path = require("path");

log = require("lotus-log");

Q = require("q");

Plugin = require("./Plugin");

module.exports = Config = Factory("Lotus_Config", {
  initArguments: function(dir) {
    if (!dir) {
      dir = ".";
    }
    assertType(dir, String);
    assert(syncFs.isDir(dir), {
      reason: "Lotus.Config() must be passed a directory!",
      dir: dir
    });
    return [dir];
  },
  init: function(dir) {
    var json, path;
    path = dir + "/lotus-config.coffee";
    if (syncFs.isFile(path)) {
      json = module.optional(path, this.handleLoadError);
    }
    if (!json) {
      path = dir + "/package.json";
      if (syncFs.isFile(path)) {
        json = module.optional(path, this.handleLoadError);
        if (json) {
          json = json.lotus;
        }
        if (!json) {
          json = {};
        }
      }
    }
    assert(isType(json, Object), {
      reason: "Lotus.Config() failed to find valid configuration!",
      dir: dir,
      path: path
    });
    return Config.fromJSON.call(this, path, json);
  },
  handleLoadError: function(error) {
    if (error.code !== "REQUIRE_FAILED") {
      throw error;
    }
  },
  statics: {
    fromJSON: function(path, json) {
      var config, error, plugins;
      if (!(this instanceof Config)) {
        config = Object.create(Config.prototype);
        return Config.fromJSON.call(config, path, json);
      }
      plugins = json.plugins != null ? json.plugins : json.plugins = [];
      try {
        assertType(plugins, Array.Maybe);
      } catch (_error) {
        error = _error;
        repl.sync((function(_this) {
          return function(c) {
            return eval(c);
          };
        })(this));
      }
      this.path = path;
      this.plugins = plugins;
      this.implicitDependencies = steal(json, "implicitDependencies");
      this.json = json;
      return this;
    }
  }
});

//# sourceMappingURL=../../map/src/config.map
