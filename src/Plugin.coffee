
emptyFunction = require "emptyFunction"
assertType = require "assertType"
isType = require "isType"
define = require "define"
steal = require "steal"
sync = require "sync"
Type = require "Type"

reservedNames = {plugins:1}
pluginCache = Object.create null

type = Type "Plugin"

type.defineArgs
  name: String.isRequired

type.defineValues (name) ->

  name: name

  _loaded: null

  _deps: null

type.defineProperties

  _initModule: lazy: ->
    initModule = @_callHook "initModule"
    if initModule
      assertType initModule, Function
      return initModule
    return emptyFunction

type.defineGetters

  isLoaded: -> @_loaded isnt null

  dependencies: ->
    return null if not @_loaded
    return @_loaded.dependencies or []

  globalDependencies: ->
    return null if not @_loaded
    return @_loaded.globalDependencies or []

type.defineMethods

  initCommands: (commands) ->

    newCommands = @_callHook "initCommands"
    return unless newCommands
    assertType newCommands, Object

    for key, fn of newCommands
      assertType fn, Function
      commands[key] = fn
    return

  initModule: (mod, options) ->
    @_initModule mod, options

  initModuleType: (type) ->
    initType = @_callHook "initModuleType"
    return unless initType
    assertType initType, Function
    lotus._moduleMixins.push initType
    return

  initFileType: (type) ->
    initType = @_callHook "initFileType"
    return unless initType
    assertType initType, Function
    lotus._fileMixins.push initType
    return

  _callHook: (name, context, args) ->

    if not @isLoaded
      throw Error "Must call 'plugin.load' first!"

    if hook = @_loaded[name]
      assertType hook, Function
      return hook.call context, args

    return null

  _load: (config) ->

    Promise.try =>

      if @_loaded
        return @_loaded

      if not lotus.isFile @name
        throw Error "Plugin does not exist: '#{@name}'"

      loaded = require @name
      if not isType loaded, Object
        throw TypeError "Plugin must return an object: '#{@name}'"

      @_loaded = loaded
      @_loadDeps config

    .then => config.onLoad this

    .then =>

      if config.global
        Plugin._loadedGlobals[@name] = @_loaded

      loading = config.loadingPlugins[@name]
      loading.resolve this
      return @_loaded

    .fail (error) =>
      log.moat 1
      log.red "Plugin threw an error: "
      log.white @name
      log.moat 0
      log.gray error.stack
      log.moat 1
      return

  _loadDeps: (config) ->
    deps = []

    if not config.global
      if Array.isArray @_loaded.globalDependencies
        for dep in @_loaded.globalDependencies
          continue if Plugin._loadedGlobals[dep]
          throw Error "Unmet global plugin dependency: #{dep}"

    if Array.isArray @_loaded.dependencies
      for dep in @_loaded.dependencies
        loading = config.loadingPlugins[dep]
        if loading
          deps.push loading.promise
          return
        throw Error "Unmet local plugin dependency: #{dep}"

    return Promise.all deps

type.defineStatics

  get: (name) ->
    unless pluginCache[name]
      if reservedNames[name]
        throw Error "A plugin cannot be named '#{name}'!"
      pluginCache[name] = Plugin name
    return pluginCache[name]

  load: (plugins, onLoad) ->
    assertType plugins, Array
    assertType onLoad, Function
    @_load plugins, {onLoad}

  loadGlobals: (plugins, onLoad) ->
    assertType plugins, Array
    assertType onLoad, Function
    @_load plugins, {onLoad, global: yes}

  _loadedGlobals: Object.create null

  _load: (plugins, config) ->

    loadingPlugins = Object.create null
    plugins = sync.map plugins, (plugin) ->

      if isType plugin, String
        plugin = Plugin.get plugin

      loadingPlugins[plugin.name] = Promise.defer()
      return plugin

    config.loadingPlugins = loadingPlugins
    Promise.all plugins, (plugin) ->
      plugin._load config
      deferred = loadingPlugins[plugin.name]
      return deferred.promise

module.exports = Plugin = type.build()
