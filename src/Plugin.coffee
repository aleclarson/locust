
KeyMirror = require "keymirror"
inArray = require "in-array"
Type = require "Type"

RESERVED_NAMES = { plugins: yes }

type = Type "Plugin"

type.argumentTypes =
  name: String

type.returnCached (name) ->
  assert not RESERVED_NAMES[name], "A plugin cannot be named '#{name}'!"
  return name

type.defineStatics

  commands: Object.create null

  injectedPlugins: []

  inject: (name) ->
    assertType name, String
    return if inArray Plugin.injectedPlugins, name
    plugin = Plugin name
    plugin.load()
    Plugin.injectedPlugins.push name
    return

type.defineValues

  name: (name) -> name

  isLoading: no

  _exports: null

  _initModule: null

type.defineProperties

  isLoaded: get: ->
    @_exports isnt null

type.defineMethods

  load: ->

    return if @isLoaded or @isLoading
    @isLoading = yes

    # TODO: Check 'node_modules' before using $LOTUS_PATH.
    #       Check global 'node_modules' if not present in $LOTUS_PATH.
    initPlugin = module.optional lotus.path + "/" + @name, (error) =>
      error.message = "Cannot find plugin '#{@name}'." if error.code is "REQUIRE_FAILED"
      throw error

    assert (isType initPlugin, Function), { @name, reason: "Plugin failed to export a Function!" }

    context =
      commands: Plugin.commands
      injectPlugin: Plugin.inject

    @_exports = initPlugin.call context
    @isLoading = no
    return

  initModule: (module, options) ->

    @load()

    unless @isLoaded
      log.moat 1
      log.yellow "Plugin warning: "
      log.white @name
      log.gray.dim " for module "
      log.cyan module.name
      log.moat 0
      log.gray.dim "'plugin.isLoaded' must be true!"
      log.moat 1
      return

    unless @_initModule
      unless isType @_exports.initModule, Function
        log.moat 1
        log.yellow "Plugin warning: "
        log.white @name
        log.gray.dim " for module "
        log.cyan module.name
        log.moat 0
        log.gray.dim "'plugin.initModule' must be a Function!"
        log.moat 1
        return

      initModule = @_exports.initModule()

      unless isType initModule, Function
        log.moat 1
        log.yellow "Plugin warning: "
        log.white @name
        log.gray.dim " for module "
        log.cyan module.name
        log.moat 0
        log.gray.dim "'plugin.initModule' must return a Function!"
        log.moat 1
        return

      @_initModule = initModule

    @_initModule module, options

module.exports = Plugin = type.build()
