var Config, Plugin, Type, assert, assertType, isType, ref, steal, sync, syncFs, type;

require("coffee-script/register");

ref = require("type-utils"), isType = ref.isType, assert = ref.assert, assertType = ref.assertType;

syncFs = require("io/sync");

steal = require("steal");

Type = require("Type");

sync = require("sync");

Plugin = require("./Plugin");

type = Type("Lotus_Config");

type.argumentTypes = {
  dir: String.Maybe
};

type.initInstance(function(dir) {
  var json, path;
  if (!dir) {
    dir = ".";
  }
  assert(syncFs.isDir(dir), {
    reason: "Expected an existing directory!",
    dir: dir
  });
  path = dir + "/lotus-config.coffee";
  if (syncFs.isFile(path)) {
    json = module.optional(path, function(error) {
      log.moat(1);
      log.white("Failed to require: ");
      log.red(path);
      log.moat(1);
      log.gray.dim(error.stack);
      return log.moat(1);
    });
  }
  if (!json) {
    path = dir + "/package.json";
    if (syncFs.isFile(path)) {
      json = module.optional(path, function(error) {
        log.moat(1);
        log.white("Failed to require: ");
        log.red(path);
        log.moat(1);
        log.gray.dim(error.stack);
        return log.moat(1);
      });
      if (json) {
        json = json.lotus;
      }
      if (!json) {
        json = {};
      }
    }
  }
  assert(isType(json, Object), {
    reason: "Failed to find configuration file!",
    dir: dir,
    path: path
  });
  return Config.fromJSON.call(this, path, json);
});

type.defineMethods({
  _onRequireError: function(error) {
    if (error.code !== "REQUIRE_FAILED") {
      throw error;
    }
  }
});

type.defineStatics({
  fromJSON: function(path, json) {
    var config, error, plugins;
    if (!(this instanceof Config)) {
      config = Object.create(Config.prototype);
      return Config.fromJSON.call(config, path, json);
    }
    plugins = json.plugins != null ? json.plugins : json.plugins = [];
    try {
      assertType(plugins, Array.Maybe);
    } catch (error1) {
      error = error1;
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
});

module.exports = Config = type.build();

//# sourceMappingURL=../../map/src/config.map
