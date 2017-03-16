
emptyFunction = require "emptyFunction"
assertType = require "assertType"
isType = require "isType"
define = require "define"
steal = require "steal"
sync = require "sync"
Type = require "Type"

type = Type "Plugin"

type.defineArgs [String]

type.defineValues (name) ->

  name: name

  # The object exported by the plugin.
  _loaded: null

type.defineProperties

  _initModule: lazy: ->
    initModule = @_callHook "initModule"
    return emptyFunction unless initModule
    return initModule if initModule instanceof Function
    throw TypeError "The '#{@name}' plugin failed to export an 'initModule' function!"

type.defineGetters

  isLoaded: -> @_loaded isnt null

  dependencies: ->
    return null unless @_loaded
    return @_loaded.dependencies or []

  globalDependencies: ->
    return null unless @_loaded
    return @_loaded.globalDependencies or []

type.defineMethods

  initModule: (mod, options) ->
    @_initModule mod, options

  loadGlobals: ->
    @_callHook "loadGlobals"

  loadCommands: ->
    @_callHook "loadCommands"

  loadModuleMixin: (type) ->
    if mixin = @_callHook "loadModuleMixin"
      lotus.moduleMixins.push mixin
    return

  loadFileMixin: (type) ->
    if mixin = @_callHook "loadFileMixin"
      lotus.fileMixins.push mixin
    return

  _callHook: (name, context, args) ->

    unless @isLoaded
      throw Error "Must call 'plugin.load' first!"

    unless hook = @_loaded[name]
      return null

    if hook instanceof Function
      return hook.call context, args

    throw TypeError "The '#{@name}' plugin failed to export a '#{name}' function!"

module.exports = Plugin = type.build()
