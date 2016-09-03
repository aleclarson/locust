
emptyFunction = require "emptyFunction"
assertType = require "assertType"
Promise = require "Promise"
Tracer = require "tracer"
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

  _loading: null

type.defineProperties

  _initModule: lazy: ->
    initModule = @_callHook "initModule"
    if initModule
      assertType initModule, Function
      return initModule
    return emptyFunction

type.defineGetters

  isLoading: ->
    @_loading isnt null

  isLoaded: ->
    Promise.isFulfilled @_loading

  dependencies: ->
    @_assertLoaded()
    { dependencies } = @_loading.inspect().value
    return [] unless isType dependencies, Array
    return dependencies

  globalDependencies: ->
    @_assertLoaded()
    { globalDependencies } = @_loading.inspect().value
    return [] unless isType globalDependencies, Array
    return globalDependencies

type.defineMethods

  load: ->

    unless Promise.isRejected @_loading
      return @_loading

    @_loading = Promise.try =>

      unless lotus.isFile @name
        throw Error "Cannot find plugin: '#{@name}'"

      plugin = require @name
      assertType plugin, Object
      return plugin

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

  _assertLoaded: ->
    return if @isLoaded
    throw Error "Must call 'plugin.load' first!"

  _callHook: (name, context, args) ->
    @_assertLoaded()
    loaded = @_loading.inspect().value
    if isType loaded[name], Function
      hook = steal loaded, name
      return hook.call context, args
    return null

type.defineStatics

  _loadedGlobals: Object.create null

  get: (name) ->
    unless pluginCache[name]
      if reservedNames[name]
        throw Error "A plugin cannot be named '#{name}'!"
      pluginCache[name] = Plugin name
    return pluginCache[name]

  load: (plugins, iterator) ->
    assertType plugins, Array
    assertType iterator, Function

    tracer = Tracer "Plugin.load()"

    pluginsLoading = Object.create null

    Promise.chain plugins, (plugin) ->

      if isType plugin, String
        plugin = Plugin.get plugin

      return if not isType plugin, Plugin
      pluginsLoading[plugin.name] = Promise.defer()

      Promise.try ->
        loading = iterator plugin, pluginsLoading
        return loading if plugin._loading
        throw Error "Must call 'plugin.load' in the iterator!"

      .then (result) ->
        pluginsLoading[plugin.name].resolve result
        return result

      .fail (error) ->
        return if error.plugin
        error.plugin = plugin
        pluginsLoading[plugin.name].reject error
        throw error

type.didBuild ->

  define lotus,
    _moduleMixins: [] # Used by Plugin::initModuleType
    _fileMixins: []   # Used by Plugin::initFileType

  assertType lotus._moduleMixins, Array
  assertType lotus._fileMixins, Array

module.exports = Plugin = type.build()
