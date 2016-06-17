
require "./global"
module.exports = lotus

assertTypes = require "assertTypes"
assertType = require "assertType"
Property = require "Property"
Promise = require "Promise"
Tracer = require "tracer"
syncFs = require "io/sync"
isType = require "isType"
assert = require "assert"
define = require "define"
sync = require "sync"

Plugin = require "./Plugin"

if isDev
  configTypes =
    callMethod:
      dir: String
      command: String
      options: Object.Maybe

define lotus,

  _initializing: null

  initialize: (options = {}) ->
    unless Promise.isRejected @_initializing
      return @_initializing
    @_initConfig()
    @_initializing =
      Promise.try => @_loadPlugins()
      .then => @_initClasses options

  runCommand: (command, options = {}) ->

    assert Promise.isFulfilled(@_initializing), "Must call 'initialize' first!"

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

    if isDev
      assertTypes config, configTypes.callMethod, "config"
      assert config.dir[0] is "/", "'config.dir' must be an absolute path!"
      assert syncFs.isDir(config.dir), "'config.dir' must be an existing directory!"

    unless isType methodName, String
      log.moat 1
      log.red "Error: "
      log.white "Must provide a method name!"
      log.moat 1
      log.gray.dim "lotus ", config.command
      log.gray " [method]"
      log.plusIndent 2
      files = syncFs.readDir config.dir
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

  _initConfig: ->
    return if isType lotus.config, Object
    syncFs = require "io/sync"
    path = lotus.path + "/lotus.json"
    assert syncFs.isFile(path), { path, reason: "Failed to find global configuration!" }
    lotus.config = JSON.parse syncFs.read path
    return

  _loadPlugins: ->

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
        process.exit()

  _initClasses: (options) ->

    return if lotus.Plugin

    Module = require "./Module"
    Module._debug = options.debugModules

    File = require "./File"
    File._debug = options.debugFiles

    frozen = Property { frozen: yes }
    for key, value of { Plugin, Module, File }
      frozen.define lotus, key, value
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
