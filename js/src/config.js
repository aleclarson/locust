(function() {
  var Config, NamedFunction, Path, Stack, color, define, each, filter, formatError, isDir, isFile, log, readDir, ref, ref1;

  define = require("define");

  NamedFunction = require("named-function");

  Path = require("path");

  ref = require("lotus-log"), log = ref.log, color = ref.color, Stack = ref.Stack;

  ref1 = require("io"), each = ref1.each, filter = ref1.filter, isFile = ref1.isFile, isDir = ref1.isDir, readDir = ref1.readDir;

  require("coffee-script/register");

  Stack.setup();

  Config = NamedFunction("LotusConfig", function(dir) {
    var config, j, len, path, paths, regex;
    if (dir == null) {
      dir = ".";
    }
    if (!(this instanceof Config)) {
      return new Config(dir);
    }
    if (!isDir.sync(dir)) {
      log["throw"]({
        error: Error("'@culprit' is not a directory."),
        culprit: dir,
        fatal: false,
        format: formatError
      });
    }
    regex = /^lotus-config(\.[^\.]+)?$/;
    paths = readDir.sync(dir);
    paths = filter.sync(paths, function(path) {
      return (regex.test(path)) && (isFile.sync(dir + "/" + path));
    });
    config = null;
    for (j = 0, len = paths.length; j < len; j++) {
      path = paths[j];
      path = Path.join(dir, path);
      config = module.optional(path, function(error) {
        if (error.code !== "REQUIRE_FAILED") {
          throw error;
        }
      });
      if (config !== null) {
        break;
      }
    }
    if (config === null) {
      log["throw"]({
        error: Error("Failed to find a 'lotus-config' file."),
        culprit: dir,
        fatal: false,
        format: function() {
          var opts;
          opts = formatError();
          opts.limit = 1;
          return opts;
        }
      });
    }
    this.path = path;
    this.plugins = config.plugins;
    return this;
  });

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
    this(Config.prototype, {
      loadPlugins: function(iterator) {
        if (!(this.plugins instanceof Object)) {
          throw Error("No plugins found.");
        }
        return each(this.plugins, function(id, i, done) {
          var plugin;
          plugin = module.optional(id, function(error) {
            if (error.code === "REQUIRE_FAILED") {
              error.message = "Cannot find plugin '" + id + "'.";
            }
            throw error;
          });
          if (!(plugin instanceof Function)) {
            throw Error("'" + id + "' failed to export a Function.");
          }
          return iterator(plugin, i);
        });
      }
    });
    this.enumerable = false;
    return this(exports, {
      regex: /^lotus-config(\.[^\.]+)?$/
    });
  });

}).call(this);

//# sourceMappingURL=map/config.js.map
