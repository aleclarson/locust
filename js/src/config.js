(function() {
  var Config, KeyMirror, NamedFunction, Stack, color, define, formatError, io, isKind, isType, join, log, merge, ref, ref1, reservedPluginNames;

  require("coffee-script/register");

  join = require("path").join;

  ref = require("type-utils"), isType = ref.isType, isKind = ref.isKind;

  ref1 = require("lotus-log"), log = ref1.log, color = ref1.color, Stack = ref1.Stack;

  NamedFunction = require("named-function");

  KeyMirror = require("keymirror");

  define = require("define");

  merge = require("merge");

  io = require("io");

  Config = NamedFunction("LotusConfig", function(dir) {
    var exports, i, len, path, paths, regex;
    if (dir == null) {
      dir = ".";
    }
    if (!isKind(this, Config)) {
      return new Config(dir);
    }
    if (!io.isDir.sync(dir)) {
      io["throw"]({
        fatal: false,
        error: Error("'" + dir + "' is not a directory."),
        code: "NOT_A_DIRECTORY",
        format: formatError
      });
    }
    regex = /^lotus-config(\.[^\.]+)?$/;
    paths = io.readDir.sync(dir);
    paths = io.filter.sync(paths, function(path) {
      return (regex.test(path)) && (io.isFile.sync(dir + "/" + path));
    });
    exports = null;
    for (i = 0, len = paths.length; i < len; i++) {
      path = paths[i];
      path = join(dir, path);
      exports = module.optional(path, function(error) {
        if (error.code !== "REQUIRE_FAILED") {
          throw error;
        }
      });
      if (exports !== null) {
        break;
      }
    }
    if (exports === null) {
      io["throw"]({
        fatal: false,
        error: Error("Failed to find a 'lotus-config' file."),
        code: "NO_LOTUS_CONFIG",
        format: merge(formatError(), {
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
    return define(this, function() {
      this.options = {
        configurable: false,
        writable: false
      };
      this({
        path: path,
        plugins: {
          value: exports.plugins
        }
      });
      this.enumerable = false;
      return this({
        exports: {
          value: exports
        }
      });
    });
  });

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

  define(function() {
    this.options = {
      configurable: false,
      writable: false
    };
    this(module, {
      exports: Config
    });
    return this(Config.prototype, {
      loadPlugins: function(iterator) {
        var isMap, promise;
        if (!isKind(this.plugins, Object)) {
          throw Error("No plugins found.");
        }
        isMap = isKind(this.plugins, Array);
        promise = io.fulfill();
        io.each.sync(this.plugins, (function(_this) {
          return function(path, alias) {
            var options, plugin;
            if (isMap && (reservedPluginNames[alias] != null)) {
              throw Error("'" + alias + "' is reserved and cannot be used as a plugin name.");
            }
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
            if (isMap) {
              options = _this.exports[alias];
            }
            if (!isType(options, Object)) {
              options = _this.exports[alias] = {};
            }
            return promise = promise.then(function() {
              return iterator(plugin, options);
            });
          };
        })(this));
        return promise;
      }
    });
  });

}).call(this);

//# sourceMappingURL=map/config.js.map
