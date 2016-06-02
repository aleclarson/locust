var Plugin, Property, Q, Tracer, assert, assertType, assertTypes, configTypes, define, isType, log, sync, syncFs;

global.lotus = require("lotus-require");

lotus.register({
  exclude: ["/node_modules/"]
});

require("isDev");

assertTypes = require("assertTypes");

assertType = require("assertType");

Property = require("Property");

Tracer = require("tracer");

syncFs = require("io/sync");

isType = require("isType");

assert = require("assert");

define = require("define");

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
  initialize: function(options) {
    if (options == null) {
      options = {};
    }
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
        return _this._initClasses(options);
      };
    })(this));
  },
  runCommand: function(command, options) {
    var args, initCommand, runCommand;
    if (options == null) {
      options = {};
    }
    assert(Q.isFulfilled(this._initializing), "Must call 'initialize' first!");
    if (!isType(command, String)) {
      log.moat(1);
      log.red("Error: ");
      log.white("Must provide a command!");
      log.moat(1);
      this._printCommandList();
      return;
    }
    args = command.split(" ");
    command = args.shift();
    if (options._ == null) {
      options._ = [];
    }
    options._ = options._.concat(args);
    initCommand = this._commands[command];
    if (!isType(initCommand, Function)) {
      this._printCommandList();
      log.moat(1);
      log.gray("Unrecognized command: ");
      log.white(command);
      log.moat(1);
      return;
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
      assertTypes(config, configTypes.callMethod, "config");
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
      return;
    }
    modulePath = config.dir + "/" + methodName;
    if (!lotus.isFile(modulePath)) {
      log.moat(1);
      log.white("Unrecognized method: ");
      log.red("'" + (methodName || "") + "'");
      log.moat(1);
      return;
    }
    method = require(modulePath);
    if (!isType(method, Function)) {
      log.moat(1);
      log.white("Method must return function: ");
      log.red("'" + modulePath + "'");
      log.moat(1);
      return;
    }
    return Q["try"](function() {
      return method.call(method, config.options || {});
    });
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
  _initClasses: function(options) {
    var File, Module, frozen, key, ref, value;
    if (lotus.Plugin) {
      return;
    }
    Module = require("./Module");
    Module._debug = options.debugModules;
    File = require("./File");
    File._debug = options.debugFiles;
    frozen = Property({
      frozen: true
    });
    ref = {
      Plugin: Plugin,
      Module: Module,
      File: File
    };
    for (key in ref) {
      value = ref[key];
      frozen.define(lotus, key, value);
    }
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
