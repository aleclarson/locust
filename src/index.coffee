
require "./global"
module.exports = lotus

{frozen} = require "Property"

assertTypes = require "assertTypes"
assertType = require "assertType"
inArray = require "in-array"
isType = require "isType"
define = require "define"
sync = require "sync"
path = require "path"
fs = require "fsx"

Plugin = require "./Plugin"

initializing = no

define lotus,

  initialize: (options = {}) ->
    return initializing if not Promise.isRejected initializing
    @_initConfig()
    initializing = @_loadPlugins()
    .then => @_initClasses options

  runCommand: (command, options = {}) ->

    if not Promise.isFulfilled initializing
      throw Error "Must call 'lotus.initialize' first!"

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

    if config.dir[0] isnt path.sep
      throw Error "'config.dir' must be an absolute path!"

    if not fs.isDir config.dir
      throw Error "'config.dir' must be an existing directory!"

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

    modulePath = path.join config.dir, methodName

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
    if not Promise.isFulfilled initializing
      throw Error "Must call 'lotus.initialize' first!"
    return inArray lotus.config.ignoredModules, moduleName

define lotus,

  plugins: require "./PluginCache"

  _modulePlugins: []

  _moduleMixins: []

  _fileMixins: []

  _initConfig: ->
    return if isType lotus.config, Object
    configPath = path.join lotus.path, "lotus.config.json"
    if not fs.isFile configPath
      throw Error "Missing global config: '#{configPath}'"
    lotus.config = JSON.parse fs.readFile configPath
    return

  _loadPlugins: ->
    {plugins, config} = lotus

    unless config
      throw Error "Must call '_initConfig' first!"

    unless Array.isArray config.plugins
      return Promise()

    options = {global: yes}
    loader = (plugin) =>
      plugin.initCommands @_commands
      plugin.initModuleType()
      plugin.initFileType()
      return

    Promise.all config.plugins, (name) ->
      plugins.load name, options, loader

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
