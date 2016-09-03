
require "./global"
module.exports = lotus

{frozen} = require "Property"

assertTypes = require "assertTypes"
assertType = require "assertType"
Promise = require "Promise"
inArray = require "in-array"
Tracer = require "tracer"
isType = require "isType"
assert = require "assert"
define = require "define"
sync = require "sync"
fs = require "io/sync"

Plugin = require "./Plugin"

initializing = no

define lotus,

  initialize: (options = {}) ->
    return initializing if not Promise.isRejected initializing
    @_initConfig()
    initializing = @_loadPlugins()
    .then => @_initClasses options

  runCommand: (command, options = {}) ->

    assert Promise.isFulfilled(initializing), "Must call 'lotus.initialize' first!"

    if not isType command, String
      log.moat 1
      log.red "Error: "
      log.white "Must provide a command!"
      log.moat 1
      @_printCommandList()
      return

    args = command.split " "
    command = args.shift()

    options._ ?= []
    options._ = options._.concat args

    initCommand = @_commands[command]

    unless isType initCommand, Function
      @_printCommandList()
      log.moat 1
      log.gray "Unrecognized command: "
      log.white command
      log.moat 1
      return

    options.command = command

    runCommand = initCommand options

    assertType runCommand, Function

    Promise.try -> runCommand options

  callMethod: (methodName, config) ->

    assertType methodName, String
    assertTypes config,
      dir: String
      command: String
      options: Object.Maybe

    assert config.dir[0] is "/", "'config.dir' must be an absolute path!"
    assert fs.isDir(config.dir), "'config.dir' must be an existing directory!"

    unless isType methodName, String
      log.moat 1
      log.red "Error: "
      log.white "Must provide a method name!"
      log.moat 1
      log.gray.dim "lotus ", config.command
      log.gray " [method]"
      log.plusIndent 2
      files = fs.readDir config.dir
      sync.each files, (file) ->
        methodName = file.replace /\.js$/, ""
        log.moat 0
        log.yellow methodName
      log.popIndent()
      log.moat 1
      return

    modulePath = config.dir + "/" + methodName

    if not lotus.isFile modulePath
      log.moat 1
      log.white "Unrecognized method: "
      log.red "'" + (methodName or "") + "'"
      log.moat 1
      return

    method = require modulePath

    if not isType method, Function
      log.moat 1
      log.white "Method must return function: "
      log.red "'#{modulePath}'"
      log.moat 1
      return

    return Promise.try ->
      method.call method, config.options or {}

  isModuleIgnored: (moduleName) ->
    assert Promise.isFulfilled(initializing), "Must call 'lotus.initialize' first!"
    return inArray lotus.config.ignoredModules, moduleName

  _initConfig: ->
    return if isType lotus.config, Object
    configPath = lotus.path + "/lotus.json"
    assert fs.isFile(configPath), "Missing global config: '#{configPath}'"
    lotus.config = JSON.parse fs.read configPath
    return

  _loadPlugins: Promise.wrap ->

    assert lotus.config, "Must call '_initConfig' first!"
    { plugins } = lotus.config

    return unless Array.isArray plugins
    return if plugins.length is 0

    tracer = Tracer "lotus._loadPlugins()"

    Plugin.load plugins, (plugin, pluginsLoading) =>

      plugin.load().then ->

        promises = []

        sync.each plugin.globalDependencies, (depName) ->
          deferred = pluginsLoading[depName]
          assert deferred, { depName, plugin, stack: tracer(), reason: "Missing local plugin dependency!" }
          promises.push deferred.promise

        Promise.all promises

      .then =>
        plugin.initCommands @_commands
        plugin.initModuleType()
        plugin.initFileType()
        Plugin._loadedGlobals[plugin.name] = yes

      .fail (error) ->
        log.moat 1
        log.red "Plugin error: "
        log.white plugin.name
        log.moat 0
        log.gray.dim error.stack
        log.moat 1

  _initClasses: (options) ->
    return if lotus.Plugin
    lotus.Plugin = Plugin
    lotus.Module = require "./Module"
    lotus.File = require "./File"
    return

  _commands: Object.create null

  _printCommandList: ->

    commandNames = Object.keys @_commands

    log.moat 1
    log.gray.dim "lotus"
    log.gray " [command]"
    log.plusIndent 2

    if commandNames.length
      sync.each commandNames, (name) ->
        log.moat 0
        log.yellow name

    else
      log.moat 0
      log.red "No commands found."
      # TODO: Create/open 'lotus.json'

    log.popIndent()
    log.moat 1
