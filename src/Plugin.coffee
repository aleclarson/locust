
emptyFunction = require "emptyFunction"
assertType = require "assertType"
isType = require "isType"
define = require "define"
steal = require "steal"
sync = require "sync"
Type = require "Type"

type = Type "Plugin"

type.defineArgs
  name: String.isRequired

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



module.exports = Plugin = type.build()
