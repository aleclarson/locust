
assertType = require "assertType"
Tracer = require "tracer"
isType = require "isType"
define = require "define"
assert = require "assert"
steal = require "steal"
sync = require "sync"
Type = require "Type"
Q = require "q"

RESERVED_NAMES = { plugins: yes }

type = Type "Plugin"

type.argumentTypes =
  name: String

type.returnCached (name) ->
  assert not RESERVED_NAMES[name], "A plugin cannot be named '#{name}'!"
  return name

type.defineValues

  name: (name) -> name

  _loading: null

type.defineProperties

  isLoading: get: ->
    @_loading isnt null

  isLoaded: get: ->
    Q.isFulfilled @_loading

  dependencies: get: ->
    @_assertLoaded()
    { dependencies } = @_loading.inspect().value
    return [] unless isType dependencies, Array
    return dependencies

  globalDependencies: get: ->
    @_assertLoaded()
    { globalDependencies } = @_loading.inspect().value
    return [] unless isType globalDependencies, Array
    return globalDependencies

  _initModule: lazy: ->
    initModule = @_callHook "initModule"
    if initModule
      assert isType(initModule, Function), { plugin: this, reason: "Plugins must return a second function when hooking into 'initModule'!" }
      return initModule
    return emptyFunction

type.defineMethods

  load: ->

    unless Q.isRejected @_loading
      return @_loading

    @_loading = Q.try =>

      unless lotus.exists @name
        throw Error "Cannot find plugin: '#{@name}'"

      plugin = require @name
      assert isType(plugin, Object), { @name, plugin, reason: "Plugins must export an object!" }
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
    assert @isLoaded, { plugin: this, reason: "Must call 'plugin.load' first!" }

  _callHook: (name, context, args) ->
    @_assertLoaded()
    loaded = @_loading.inspect().value
    if isType loaded[name], Function
      hook = steal loaded, name
      return hook.call context, args
    return null

type.defineStatics

  _loadedGlobals: Object.create null

  load: (plugins, iterator) ->

    assertType plugins, Array
    assertType iterator, Function

    tracer = Tracer "Plugin.load()"

    pluginsLoading = Object.create null

    sync.reduce plugins, Q(), (promise, plugin) ->

      if isType plugin, String
        plugin = Plugin plugin

      unless isType plugin, Plugin
        return promise

      pluginsLoading[plugin.name] = Q.defer()

      promise.then ->
        loading = iterator plugin, pluginsLoading
        assert plugin._loading, "Must call 'plugin.load' in the iterator!"
        return loading

      .then (result) ->
        pluginsLoading[plugin.name].fulfill result
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
