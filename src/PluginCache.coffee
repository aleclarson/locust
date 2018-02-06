
findDependency = require "find-dependency"
assertType = require "assertType"
isObject = require "isObject"
Type = require "Type"
path = require "path"
fs = require "fsx"

Plugin = require "./Plugin"

type = Type "PluginCache"

type.defineValues ->

  # All plugin instances by their names.
  _plugins: Object.create null

  # Loader promises for each global plugin.
  _loading: Object.create null

  # Global plugins that are loaded.
  _loaded: new Set

type.defineMethods

  get: (name) ->
    assertType name, String
    return plugin if plugin = @_plugins[name]
    @_plugins[name] = plugin = Plugin name
    return plugin

  load: (name, options, loader) ->

    if arguments.length is 2
      loader = options
      options = {}

    assertType options, Object
    assertType loader, Function

    # Check if the plugin was loaded with `options.global` set to true.
    promise = @_loading[name] or Promise.resolve()

    plugin = @get name
    promise = promise.then =>
      deps = []

      unless loaded = plugin._loaded
        try loaded = @_load plugin
        catch error
          if error.code is 404
            return log.warn "Plugin does not exist: '#{plugin.name}'"
          throw error

      # The `globalDependencies` property is only used by non-global loaders.
      unless options.global or not Array.isArray loaded.globalDependencies
        for dep in loaded.globalDependencies
          unless @_loaded.has dep
            throw Error "The '#{name}' plugin depends on a global plugin that is missing: '#{dep}'"

      if Array.isArray loaded.dependencies
        for dep in loaded.dependencies
          unless loading = @_loading[dep]
            throw Error "The '#{name}' plugin depends on a local plugin that is missing: '#{dep}'"
          deps.push loading

      Promise.all deps
      .then -> loader plugin
      .timeout 5000, ->
        log.warn "The '#{name}' plugin failed to load within 5 seconds!"

    if options.global
      @_loading[name] = promise = promise.then =>
        @_loaded.add name if options.global
        return

    return promise.fail (error) ->
      log.moat 1
      log.white "The '#{name}' plugin threw an error! \n"
      log.gray error.stack
      log.moat 1
      return

  _load: (plugin) ->
    unless pluginPath = resolvePlugin plugin.name
      throw do -> e = Error(); e.code = 404; e

    loaded = require pluginPath

    unless isObject loaded
      throw TypeError "Expected an object export"

    plugin._loaded = loaded
    return loaded

module.exports = type.construct()

resolvePlugin = (name) ->
  unless path.isAbsolute name
    return findDependency name
  return name if fs.exists name
