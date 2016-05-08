var Plugin, Q, Tracer, assert, assertType, configTypes, define, isType, log, ref, sync, syncFs;

(global.lotus = require("lotus-require")).forceAll = true;

require("isDev");

ref = require("type-utils"), isType = ref.isType, assert = ref.assert, assertType = ref.assertType;

Tracer = require("tracer");

define = require("define");

syncFs = require("io/sync");

sync = require("sync");

log = require("log");

Q = require("q");

Plugin = require("./Plugin");

module.exports = lotus;

if (isDev) {
  configTypes = {
    callMethod: {
      dir: String,
      command: String,
      options: Object.Maybe
    }
  };
}

define(lotus, {
  _initializing: null,
  initialize: function() {
    if (!Q.isRejected(this._initializing)) {
      return this._initializing;
    }
    this._initConfig();
    return this._initializing = Q["try"]((function(_this) {
      return function() {
        return _this._loadPlugins();
      };
    })(this)).then((function(_this) {
      return function() {
        return _this._initClasses();
      };
    })(this));
  },
  runCommand: function(command, options) {
    var initCommand, runCommand;
    if (options == null) {
      options = {};
    }
    assert(Q.isFulfilled(this._initializing), "Must call 'init' first!");
    if (!isType(command, String)) {
      log.moat(1);
      log.red("Error: ");
      log.white("Must provide a command!");
      log.moat(1);
      this._printCommandList();
      process.exit();
    }
    initCommand = this._commands[command];
    if (!isType(initCommand, Function)) {
      this._printCommandList();
      log.moat(1);
      log.gray("Unrecognized command: ");
      log.white(command);
      log.moat(1);
      process.exit();
    }
    options.command = command;
    runCommand = initCommand(options);
    assertType(runCommand, Function);
    return Q["try"](function() {
      return runCommand(options);
    });
  },
  callMethod: function(methodName, config) {
    var files, method, modulePath;
    if (isDev) {
      validateTypes(config, configTypes.callMethod, "config");
      assert(config.dir[0] === "/", "'config.dir' must be an absolute path!");
      assert(syncFs.isDir(config.dir), "'config.dir' must be an existing directory!");
    }
    if (!isType(methodName, String)) {
      log.moat(1);
      log.red("Error: ");
      log.white("Must provide a method name!");
      log.moat(1);
      log.gray.dim("lotus ", config.command);
      log.gray(" [method]");
      log.plusIndent(2);
      files = syncFs.readDir(config.dir);
      sync.each(files, function(file) {
        methodName = file.replace(/\.js$/, "");
        log.moat(0);
        return log.yellow(methodName);
      });
      log.popIndent();
      log.moat(1);
      process.exit();
    }
    modulePath = config.dir + "/" + methodName;
    if (lotus.exists(modulePath)) {
      method = require(modulePath);
      if (isType(method, Function)) {
        return method.call(method, config.options || {});
      } else {
        log.moat(1);
        log.white("Method must return function: ");
        log.red("'" + modulePath + "'");
        log.moat(1);
        return process.exit();
      }
    } else {
      log.moat(1);
      log.white("Unrecognized method: ");
      log.red("'" + (methodName || "") + "'");
      log.moat(1);
      return process.exit();
    }
  },
  _initConfig: function() {
    var path;
    if (isType(lotus.config, Object)) {
      return;
    }
    syncFs = require("io/sync");
    path = lotus.path + "/lotus.json";
    assert(syncFs.isFile(path), {
      path: path,
      reason: "Failed to find global configuration!"
    });
    lotus.config = JSON.parse(syncFs.read(path));
  },
  _loadPlugins: function() {
    var plugins, tracer;
    assert(lotus.config, "Must call '_initConfig' first!");
    plugins = lotus.config.plugins;
    if (!Array.isArray(plugins)) {
      return;
    }
    if (plugins.length === 0) {
      return;
    }
    tracer = Tracer("lotus._loadPlugins()");
    return Plugin.load(plugins, (function(_this) {
      return function(plugin, pluginsLoading) {
        return plugin.load().then(function() {
          var promises;
          promises = [];
          sync.each(plugin.globalDependencies, function(depName) {
            var deferred;
            deferred = pluginsLoading[depName];
            assert(deferred, {
              depName: depName,
              plugin: plugin,
              stack: tracer(),
              reason: "Missing local plugin dependency!"
            });
            return promises.push(deferred.promise);
          });
          return Q.all(promises);
        }).then(function() {
          plugin.initCommands(_this._commands);
          plugin.initModuleType();
          plugin.initFileType();
          return Plugin._loadedGlobals[plugin.name] = true;
        }).fail(function(error) {
          log.moat(1);
          log.red("Plugin error: ");
          log.white(plugin.name);
          log.moat(0);
          log.gray.dim(error.stack);
          log.moat(1);
          return process.exit();
        });
      };
    })(this));
  },
  _initClasses: function() {
    if (lotus.Plugin) {
      return;
    }
    return define(lotus, {
      frozen: true
    }, {
      Plugin: Plugin,
      Module: {
        lazy: function() {
          return require("./Module");
        }
      },
      File: {
        lazy: function() {
          return require("./File");
        }
      }
    });
  },
  _commands: Object.create(null),
  _printCommandList: function() {
    var commandNames;
    commandNames = Object.keys(this._commands);
    log.moat(1);
    log.gray.dim("lotus");
    log.gray(" [command]");
    log.plusIndent(2);
    if (commandNames.length) {
      sync.each(commandNames, function(name) {
        log.moat(0);
        return log.yellow(name);
      });
    } else {
      log.moat(0);
      log.red("No commands found.");
    }
    log.popIndent();
    return log.moat(1);
  }
});

//# sourceMappingURL=../../map/src/index.map
