var Plugin, assertType, assertTypes, define, frozen, fs, inArray, initializing, isType, path, sync;

require("./global");

module.exports = lotus;

frozen = require("Property").frozen;

assertTypes = require("assertTypes");

assertType = require("assertType");

inArray = require("in-array");

isType = require("isType");

define = require("define");

sync = require("sync");

path = require("path");

fs = require("io/sync");

Plugin = require("./Plugin");

initializing = false;

define(lotus, {
  initialize: function(options) {
    if (options == null) {
      options = {};
    }
    if (!Promise.isRejected(initializing)) {
      return initializing;
    }
    this._initConfig();
    return initializing = this._loadPlugins().then((function(_this) {
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
    if (!Promise.isFulfilled(initializing)) {
      throw Error("Must call 'lotus.initialize' first!");
    }
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
    return Promise["try"](function() {
      return runCommand(options);
    });
  },
  callMethod: function(methodName, config) {
    var files, method, modulePath;
    assertType(methodName, String);
    assertTypes(config, {
      dir: String,
      command: String,
      options: Object.Maybe
    });
    if (config.dir[0] !== path.sep) {
      throw Error("'config.dir' must be an absolute path!");
    }
    if (!fs.isDir(config.dir)) {
      throw Error("'config.dir' must be an existing directory!");
    }
    if (!isType(methodName, String)) {
      log.moat(1);
      log.red("Error: ");
      log.white("Must provide a method name!");
      log.moat(1);
      log.gray.dim("lotus ", config.command);
      log.gray(" [method]");
      log.plusIndent(2);
      files = fs.readDir(config.dir);
      sync.each(files, function(file) {
        methodName = file.replace(/\.js$/, "");
        log.moat(0);
        return log.yellow(methodName);
      });
      log.popIndent();
      log.moat(1);
      return;
    }
    modulePath = path.join(config.dir, methodName);
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
    return Promise["try"](function() {
      return method.call(method, config.options || {});
    });
  },
  isModuleIgnored: function(moduleName) {
    if (!Promise.isFulfilled(initializing)) {
      throw Error("Must call 'lotus.initialize' first!");
    }
    return inArray(lotus.config.ignoredModules, moduleName);
  }
});

define(lotus, {
  _moduleMixins: [],
  _fileMixins: [],
  _initConfig: function() {
    var configPath;
    if (isType(lotus.config, Object)) {
      return;
    }
    configPath = path.join(lotus.path, "lotus.config.json");
    if (!fs.isFile(configPath)) {
      throw Error("Missing global config: '" + configPath + "'");
    }
    lotus.config = JSON.parse(fs.read(configPath));
  },
  _loadPlugins: function() {
    var plugins;
    if (!lotus.config) {
      throw Error("Must call '_initConfig' first!");
    }
    plugins = lotus.config.plugins;
    if (!Array.isArray(plugins)) {
      return Promise();
    }
    return Plugin.loadGlobals(plugins, (function(_this) {
      return function(plugin) {
        plugin.initCommands(_this._commands);
        plugin.initModuleType();
        plugin.initFileType();
      };
    })(this));
  },
  _initClasses: function(options) {
    if (lotus.Plugin) {
      return;
    }
    lotus.Plugin = Plugin;
    lotus.Module = require("./Module");
    lotus.File = require("./File");
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

//# sourceMappingURL=map/index.map
