
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

  _loaded: null

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

    if not @isLoaded
      throw Error "Must call 'plugin.load' first!"

    if hook = @_loaded[name]
      assertType hook, Function
      return hook.call context, args

    return null



module.exports = Plugin = type.build()
